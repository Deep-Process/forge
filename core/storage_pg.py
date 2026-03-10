"""
PostgreSQL Storage Adapter — implements StorageAdapter Protocol for Forge.

Translates between the dict-based interface that core modules expect
and row-based PostgreSQL storage. Core modules work unchanged — they
call load_data/save_data with entity dicts, and this adapter handles
the SQL translation.

Architecture:
  - Uses psycopg2 (sync) for compatibility with existing core modules
    (which are synchronous). The FastAPI layer uses asyncpg separately.
  - Connection pooling via psycopg2.pool.ThreadedConnectionPool.
  - Entity type → table name mapping with row↔dict converters.

Reference: docs/FORGE-PLATFORM-V2.md Section 7.1
"""

from __future__ import annotations

import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Optional

from core.storage import (
    EntityNotFoundError,
    EntityType,
    StorageError,
    StorageWriteError,
    default_structure,
    now_iso,
)

try:
    from core.knowledge_versions import KnowledgeVersioningService
except ImportError:
    KnowledgeVersioningService = None  # type: ignore

try:
    from core.knowledge_impact import KnowledgeImpactService
except ImportError:
    KnowledgeImpactService = None  # type: ignore

try:
    import psycopg2
    import psycopg2.extras
    import psycopg2.pool
except ImportError:
    psycopg2 = None  # type: ignore


# ---------------------------------------------------------------------------
# Entity → Table mapping
# ---------------------------------------------------------------------------

# Maps EntityType to (table_name, list_key)
# list_key is the key in the dict that contains the list of items
# e.g., EntityType.DECISIONS → ("decisions", "decisions")
_ENTITY_TABLE_MAP: dict[str, tuple[str, str]] = {
    EntityType.TRACKER: ("tasks", "tasks"),
    EntityType.DECISIONS: ("decisions", "decisions"),
    EntityType.CHANGES: ("changes", "changes"),
    EntityType.GUIDELINES: ("guidelines", "guidelines"),
    EntityType.IDEAS: ("ideas", "ideas"),
    EntityType.OBJECTIVES: ("objectives", "objectives"),
    EntityType.LESSONS: ("lessons", "lessons"),
    EntityType.KNOWLEDGE: ("knowledge", "knowledge"),
    EntityType.AC_TEMPLATES: ("ac_templates", "ac_templates"),
}

# Columns that are JSONB in PostgreSQL (need json serialization)
_JSONB_COLUMNS = {
    "config", "assumptions", "acceptance_criteria", "test_requirements",
    "alternatives", "findings", "options", "open_questions", "blockers",
    "evidence_refs", "reasoning_trace", "examples", "parameters",
    "linked_entities", "review",
}

# Columns that are TEXT[] arrays in PostgreSQL
_ARRAY_COLUMNS = {
    "tags", "scopes", "knowledge_ids", "derived_guidelines",
    "advances_key_results", "guidelines", "depends_on", "conflicts_with",
    "blocked_by_decisions", "decision_ids", "guidelines_checked",
    "dependencies",
}

# Timestamp column names used in DB (mapped from JSON keys)
_TIMESTAMP_FIELDS = {
    "created_at", "updated_at", "started_at", "completed_at",
    "recorded_at", "committed_at", "checked_at",
}

# JSON timestamp keys → DB column mapping (per-entity, for save_data)
# Generic mappings used by most entities
_JSON_TS_TO_DB = {
    "created": "created_at",
    "updated": "updated_at",
}

# Per-entity overrides for timestamp key mapping
_ENTITY_TS_OVERRIDES: dict[str, dict[str, str]] = {
    "changes": {"timestamp": "recorded_at"},
    "decisions": {"timestamp": "created_at"},
    "lessons": {"timestamp": "created_at"},
}

# Reverse mapping: DB column → JSON key (per-entity, for load_data)
_DB_TS_TO_JSON: dict[str, dict[str, str]] = {
    "changes": {"recorded_at": "timestamp"},
    "decisions": {"created_at": "timestamp"},
    "lessons": {"created_at": "timestamp"},
}

# Known columns per table — used to filter out unknown dict keys
_TABLE_COLUMNS: dict[str, set[str]] = {
    "tasks": {
        "ext_id", "name", "description", "instruction", "type", "status",
        "origin", "origin_idea_id", "skill", "parallel",
        "acceptance_criteria", "test_requirements", "depends_on",
        "conflicts_with", "knowledge_ids", "scopes", "blocked_by_decisions",
        "agent", "failed_reason", "started_at", "completed_at",
        "created_at", "updated_at",
    },
    "decisions": {
        "ext_id", "task_id", "type", "status", "issue", "recommendation",
        "reasoning", "alternatives", "confidence", "decided_by", "file",
        "scope", "tags", "exploration_type", "findings", "options",
        "open_questions", "severity", "likelihood", "linked_entity_type",
        "linked_entity_id", "mitigation_plan", "resolution_notes",
        "blockers", "ready_for_tracker", "evidence_refs",
        "created_at", "updated_at",
    },
    "changes": {
        "ext_id", "task_id", "file", "action", "summary", "reasoning_trace",
        "decision_ids", "guidelines_checked", "group_id",
        "lines_added", "lines_removed", "recorded_at",
    },
    "guidelines": {
        "ext_id", "title", "scope", "content", "rationale", "examples",
        "tags", "weight", "status", "derived_from", "imported_from",
        "promoted_from", "created_at", "updated_at",
    },
    "ideas": {
        "ext_id", "parent_id", "title", "description", "category", "status",
        "appetite", "priority", "tags", "scopes", "knowledge_ids",
        "guidelines", "advances_key_results", "rejection_reason",
        "merged_into", "exploration_notes", "committed_at",
        "created_at", "updated_at",
    },
    "objectives": {
        "ext_id", "title", "description", "appetite", "scope", "status",
        "assumptions", "tags", "scopes", "derived_guidelines",
        "knowledge_ids", "created_at", "updated_at",
    },
    "lessons": {
        "ext_id", "category", "title", "detail", "task_id", "decision_ids",
        "severity", "applies_to", "tags", "promoted_to_guideline",
        "promoted_to_knowledge", "created_at",
    },
    "knowledge": {
        "ext_id", "title", "category", "content", "current_version",
        "status", "scopes", "tags", "dependencies", "source",
        "source_type", "created_by", "linked_entities", "review",
        "created_at", "updated_at",
    },
    "ac_templates": {
        "ext_id", "title", "description", "template", "category",
        "verification_method", "parameters", "scopes", "tags",
        "status", "usage_count", "created_at", "updated_at",
    },
}


# ---------------------------------------------------------------------------
# Row ↔ Dict converters
# ---------------------------------------------------------------------------

def _row_to_dict(row: dict, entity_type: str) -> dict:
    """Convert a database row (dict) to the JSON-compatible dict format.

    Handles:
    - JSONB columns: already parsed by psycopg2
    - TEXT[] arrays: already parsed by psycopg2
    - Timestamps: converted to ISO strings, with per-entity reverse mapping
    - id → internal, ext_id → id (JSON uses ext_id as the primary identifier)
    """
    # Get the table name for reverse TS lookups
    table = entity_type
    if isinstance(entity_type, EntityType):
        table = _ENTITY_TABLE_MAP.get(entity_type, (entity_type, ""))[0]
    reverse_ts = _DB_TS_TO_JSON.get(table, {})

    result = {}
    for key, value in row.items():
        # Skip internal DB columns
        if key == "project_id":
            continue
        # Map ext_id → id (JSON format uses ext_id as "id")
        if key == "ext_id":
            result["id"] = value
            continue
        # Keep internal id as _db_id for reference
        if key == "id":
            result["_db_id"] = value
            continue
        # Convert timestamps to ISO strings, applying reverse mapping
        if key in _TIMESTAMP_FIELDS and value is not None:
            ts_str = value.strftime("%Y-%m-%dT%H:%M:%SZ") if isinstance(value, datetime) else str(value)
            out_key = reverse_ts.get(key, key)
            result[out_key] = ts_str
            continue
        if key in _TIMESTAMP_FIELDS and value is None:
            out_key = reverse_ts.get(key, key)
            result[out_key] = value
            continue
        # JSONB and arrays are already deserialized by psycopg2
        result[key] = value

    return result


def _dict_to_row(item: dict, entity_type: str, project_id: int) -> dict:
    """Convert a JSON-format dict to database row columns.

    Handles:
    - id → ext_id mapping
    - Per-entity timestamp key mapping (e.g., "timestamp" → "recorded_at" for changes)
    - JSONB columns → json.dumps for psycopg2
    - Filters out keys not in the table's column set (prevents SQL errors)
    """
    # Get table name for column validation and TS overrides
    table = entity_type
    if isinstance(entity_type, EntityType):
        table = _ENTITY_TABLE_MAP.get(entity_type, (entity_type, ""))[0]
    ts_overrides = _ENTITY_TS_OVERRIDES.get(table, {})
    known_cols = _TABLE_COLUMNS.get(table)

    row = {"project_id": project_id}

    for key, value in item.items():
        # Skip internal fields
        if key in ("_db_id", "project"):
            continue
        # Map "id" back to ext_id
        if key == "id":
            row["ext_id"] = value
            continue
        # Map JSON timestamp keys to DB column names (entity-specific first, then generic)
        if key in ts_overrides:
            row[ts_overrides[key]] = value
            continue
        if key in _JSON_TS_TO_DB:
            row[_JSON_TS_TO_DB[key]] = value
            continue
        # JSONB columns: serialize to JSON string for psycopg2
        if key in _JSONB_COLUMNS and value is not None:
            row[key] = json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value
            continue
        # Everything else passes through
        row[key] = value

    # Filter out unknown columns to prevent SQL errors
    if known_cols is not None:
        allowed = known_cols | {"project_id", "ext_id"}
        row = {k: v for k, v in row.items() if k in allowed}

    return row


# ---------------------------------------------------------------------------
# Tracker-specific handling
# ---------------------------------------------------------------------------

def _tracker_rows_to_dict(rows: list[dict], project: str, project_row: Optional[dict]) -> dict:
    """Convert task rows + project row into the tracker dict format.

    Tracker JSON format:
    {
        "project": "slug",
        "goal": "...",
        "created": "...",
        "updated": "...",
        "config": {},
        "tasks": [...]
    }
    """
    tasks = [_row_to_dict(r, "tasks") for r in rows]

    # Remap some task fields for JSON compatibility
    for t in tasks:
        # JSON uses "depends_on" as list, already handled
        # Remove _db_id from output
        t.pop("_db_id", None)

    result = {
        "project": project,
        "goal": project_row.get("goal", "") if project_row else "",
        "created": "",
        "updated": "",
        "config": {},
        "tasks": tasks,
    }

    if project_row:
        if project_row.get("created_at"):
            ts = project_row["created_at"]
            result["created"] = ts.strftime("%Y-%m-%dT%H:%M:%SZ") if isinstance(ts, datetime) else str(ts)
        if project_row.get("updated_at"):
            ts = project_row["updated_at"]
            result["updated"] = ts.strftime("%Y-%m-%dT%H:%M:%SZ") if isinstance(ts, datetime) else str(ts)
        if project_row.get("config"):
            result["config"] = project_row["config"] if isinstance(project_row["config"], dict) else json.loads(project_row["config"])

    return result


def _entity_rows_to_dict(rows: list[dict], entity_type: str, project: str, list_key: str) -> dict:
    """Convert entity rows into the standard JSON dict format.

    Standard format:
    {
        "project": "slug",
        "updated": "...",
        "<list_key>": [...]
    }
    """
    items = [_row_to_dict(r, entity_type) for r in rows]
    for item in items:
        item.pop("_db_id", None)

    result = {
        "project": project,
        "updated": now_iso(),
        list_key: items,
    }

    # Decisions have extra open_count
    if entity_type == EntityType.DECISIONS:
        result["open_count"] = sum(1 for i in items if i.get("status") == "OPEN")

    return result


# ---------------------------------------------------------------------------
# PostgreSQL Storage Adapter
# ---------------------------------------------------------------------------

class PostgreSQLAdapter:
    """Storage backend using PostgreSQL.

    Implements the same StorageAdapter Protocol as JSONFileStorage.
    Core modules call load_data/save_data and get the same dict format.

    Connection management:
    - Uses psycopg2.pool.ThreadedConnectionPool for thread safety
    - Each operation acquires/releases a connection from the pool
    - Transactions are per-operation (not per-session)
    """

    def __init__(self, database_url: Optional[str] = None, min_conn: int = 1, max_conn: int = 5) -> None:
        if psycopg2 is None:
            raise ImportError("psycopg2 or psycopg required for PostgreSQLAdapter")

        self._database_url = database_url or os.environ.get(
            "DATABASE_URL", "postgresql://forge:forge@localhost:5432/forge_db"
        )
        self._pool = psycopg2.pool.ThreadedConnectionPool(
            min_conn, max_conn, self._database_url
        )
        # Knowledge versioning service (lazy: only used when saving knowledge)
        self._versioning: Optional[KnowledgeVersioningService] = None
        if KnowledgeVersioningService is not None:
            self._versioning = KnowledgeVersioningService(self._pool)
        # Knowledge impact analysis service
        self._impact: Optional[KnowledgeImpactService] = None
        if KnowledgeImpactService is not None:
            self._impact = KnowledgeImpactService(self._pool)

    @contextmanager
    def _conn(self):
        """Acquire a connection from the pool with auto-release."""
        conn = self._pool.getconn()
        try:
            yield conn
        finally:
            self._pool.putconn(conn)

    def _get_project_id(self, cur, project: str) -> Optional[int]:
        """Get the internal project ID from slug. Returns None if not found."""
        cur.execute("SELECT id FROM projects WHERE slug = %s", (project,))
        row = cur.fetchone()
        return row["id"] if row else None

    def _ensure_project(self, cur, project: str) -> int:
        """Get or create project, returning its internal ID."""
        pid = self._get_project_id(cur, project)
        if pid is not None:
            return pid
        cur.execute(
            "INSERT INTO projects (slug) VALUES (%s) RETURNING id",
            (project,),
        )
        return cur.fetchone()["id"]

    def _get_knowledge_db_id(self, cur, pid: int, ext_id: str) -> Optional[int]:
        """Get the internal DB id for a knowledge entry by project_id + ext_id."""
        cur.execute(
            "SELECT id FROM knowledge WHERE project_id = %s AND ext_id = %s",
            (pid, ext_id),
        )
        row = cur.fetchone()
        return row["id"] if row else None

    # -------------------------------------------------------------------
    # StorageAdapter Protocol: load_data
    # -------------------------------------------------------------------

    def load_data(self, project: str, entity: str) -> dict:
        """Load entity data for a project from PostgreSQL.

        Returns dict in same format as JSONFileStorage.
        If project doesn't exist, returns default empty structure.
        """
        entity_key = EntityType(entity) if isinstance(entity, str) else entity
        table, list_key = _ENTITY_TABLE_MAP[entity_key]

        with self._conn() as conn:
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    pid = self._get_project_id(cur, project)
                    if pid is None:
                        return default_structure(entity, project)

                    # Tracker is special: needs project row + task rows
                    if entity_key == EntityType.TRACKER:
                        cur.execute("SELECT * FROM projects WHERE id = %s", (pid,))
                        project_row = cur.fetchone()
                        cur.execute(
                            "SELECT * FROM tasks WHERE project_id = %s ORDER BY ext_id",
                            (pid,),
                        )
                        rows = cur.fetchall()
                        return _tracker_rows_to_dict(rows, project, project_row)

                    # Standard entities
                    cur.execute(
                        f"SELECT * FROM {table} WHERE project_id = %s ORDER BY ext_id",
                        (pid,),
                    )
                    rows = cur.fetchall()
                    return _entity_rows_to_dict(rows, entity_key, project, list_key)
            finally:
                conn.rollback()  # End any implicit read transaction

    # -------------------------------------------------------------------
    # StorageAdapter Protocol: save_data
    # -------------------------------------------------------------------

    def save_data(self, project: str, entity: str, data: dict) -> None:
        """Save entity data for a project to PostgreSQL.

        Performs upsert: inserts new items, updates existing ones.
        Sets data['updated'] to current timestamp (matching JSONFileStorage behavior).
        """
        entity_key = EntityType(entity) if isinstance(entity, str) else entity
        table, list_key = _ENTITY_TABLE_MAP[entity_key]
        data["updated"] = now_iso()

        with self._conn() as conn:
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    pid = self._ensure_project(cur, project)

                    # Tracker: update project row + upsert tasks
                    if entity_key == EntityType.TRACKER:
                        self._save_tracker(cur, pid, project, data)
                    else:
                        self._save_entity_list(cur, pid, table, list_key, data)

                conn.commit()
            except Exception as e:
                conn.rollback()
                raise StorageWriteError(f"Failed to save {entity} for {project}: {e}") from e

    def _save_tracker(self, cur, pid: int, project: str, data: dict) -> None:
        """Save tracker data: update project + upsert tasks."""
        # Update project metadata
        config = data.get("config", {})
        goal = data.get("goal", "")
        cur.execute(
            "UPDATE projects SET goal = %s, config = %s, updated_at = NOW() WHERE id = %s",
            (goal, json.dumps(config, ensure_ascii=False), pid),
        )

        # Upsert tasks
        tasks = data.get("tasks", [])
        # Get existing ext_ids
        cur.execute("SELECT ext_id FROM tasks WHERE project_id = %s", (pid,))
        existing = {row["ext_id"] for row in cur.fetchall()}

        for task in tasks:
            ext_id = task.get("id", "")
            if not ext_id:
                continue

            row = _dict_to_row(task, "tasks", pid)
            row.pop("project_id", None)  # Don't include in SET clause

            if ext_id in existing:
                # UPDATE existing task
                sets = []
                vals = []
                for k, v in row.items():
                    if k == "ext_id":
                        continue
                    sets.append(f"{k} = %s")
                    vals.append(v)
                if sets:
                    vals.append(pid)
                    vals.append(ext_id)
                    cur.execute(
                        f"UPDATE tasks SET {', '.join(sets)}, updated_at = NOW() "
                        f"WHERE project_id = %s AND ext_id = %s",
                        vals,
                    )
            else:
                # INSERT new task
                row["project_id"] = pid
                cols = list(row.keys())
                placeholders = ["%s"] * len(cols)
                cur.execute(
                    f"INSERT INTO tasks ({', '.join(cols)}) VALUES ({', '.join(placeholders)})",
                    [row[c] for c in cols],
                )
                existing.add(ext_id)

        # Remove tasks that are in DB but not in the data
        data_ext_ids = {t.get("id", "") for t in tasks}
        removed = existing - data_ext_ids
        if removed:
            cur.execute(
                "DELETE FROM tasks WHERE project_id = %s AND ext_id = ANY(%s)",
                (pid, list(removed)),
            )

    def _save_entity_list(self, cur, pid: int, table: str, list_key: str, data: dict) -> None:
        """Save a standard entity list: upsert items, remove deleted ones.

        For knowledge entities, automatically creates version rows when content
        changes (via KnowledgeVersioningService).
        """
        items = data.get(list_key, [])
        is_knowledge = table == "knowledge"

        # For knowledge: load existing content to detect changes
        existing_content: dict[str, str] = {}
        if is_knowledge and self._versioning:
            cur.execute(
                "SELECT ext_id, content FROM knowledge WHERE project_id = %s",
                (pid,),
            )
            existing_content = {r["ext_id"]: (r["content"] or "") for r in cur.fetchall()}

        # Get existing ext_ids
        cur.execute(f"SELECT ext_id FROM {table} WHERE project_id = %s", (pid,))
        existing = {row["ext_id"] for row in cur.fetchall()}

        for item in items:
            ext_id = item.get("id", "")
            if not ext_id:
                continue

            row = _dict_to_row(item, table, pid)
            row.pop("project_id", None)

            if ext_id in existing:
                # UPDATE
                sets = []
                vals = []
                for k, v in row.items():
                    if k == "ext_id":
                        continue
                    sets.append(f"{k} = %s")
                    vals.append(v)
                if sets:
                    # Add updated_at = NOW() for tables that have it
                    has_updated_at = "updated_at" in (_TABLE_COLUMNS.get(table) or set())
                    update_suffix = ", updated_at = NOW()" if has_updated_at else ""
                    vals.append(pid)
                    vals.append(ext_id)
                    cur.execute(
                        f"UPDATE {table} SET {', '.join(sets)}{update_suffix} "
                        f"WHERE project_id = %s AND ext_id = %s",
                        vals,
                    )

                # Knowledge versioning: create version if content changed
                if is_knowledge and self._versioning:
                    new_content = item.get("content", "")
                    old_content = existing_content.get(ext_id, "")
                    if new_content != old_content:
                        db_id = self._get_knowledge_db_id(cur, pid, ext_id)
                        if db_id is not None:
                            self._versioning.create_version(
                                knowledge_db_id=db_id,
                                content=new_content,
                                changed_by="storage_pg",
                                change_reason="Content updated via save_data",
                                conn=cur.connection,
                            )
            else:
                # INSERT
                row["project_id"] = pid
                cols = list(row.keys())
                placeholders = ["%s"] * len(cols)
                cur.execute(
                    f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(placeholders)})",
                    [row[c] for c in cols],
                )
                existing.add(ext_id)

                # Knowledge versioning: ensure initial version for new entries
                if is_knowledge and self._versioning:
                    db_id = self._get_knowledge_db_id(cur, pid, ext_id)
                    if db_id is not None:
                        self._versioning.ensure_initial_version(
                            knowledge_db_id=db_id,
                            content=item.get("content", ""),
                            conn=cur.connection,
                        )

        # Remove items not in the new data
        data_ext_ids = {i.get("id", "") for i in items}
        removed = existing - data_ext_ids
        if removed:
            cur.execute(
                f"DELETE FROM {table} WHERE project_id = %s AND ext_id = ANY(%s)",
                (pid, list(removed)),
            )

    # -------------------------------------------------------------------
    # StorageAdapter Protocol: exists
    # -------------------------------------------------------------------

    def exists(self, project: str, entity: str) -> bool:
        """Check whether entity data exists for a project in PostgreSQL."""
        entity_key = EntityType(entity) if isinstance(entity, str) else entity
        table, _ = _ENTITY_TABLE_MAP[entity_key]

        with self._conn() as conn:
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    pid = self._get_project_id(cur, project)
                    if pid is None:
                        return False

                    if entity_key == EntityType.TRACKER:
                        return True

                    cur.execute(
                        f"SELECT EXISTS(SELECT 1 FROM {table} WHERE project_id = %s) AS e",
                        (pid,),
                    )
                    return cur.fetchone()["e"]
            finally:
                conn.rollback()

    # -------------------------------------------------------------------
    # StorageAdapter Protocol: list_projects
    # -------------------------------------------------------------------

    def list_projects(self) -> list[str]:
        """List all project slugs from PostgreSQL."""
        with self._conn() as conn:
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute("SELECT slug FROM projects ORDER BY slug")
                    return [row["slug"] for row in cur.fetchall()]
            finally:
                conn.rollback()

    # -------------------------------------------------------------------
    # StorageAdapter Protocol: load_global
    # -------------------------------------------------------------------

    def load_global(self, entity: str) -> dict:
        """Load global entity data (project_id IS NULL).

        For entities like guidelines and knowledge that can be global.
        """
        entity_key = EntityType(entity) if isinstance(entity, str) else entity
        table, list_key = _ENTITY_TABLE_MAP[entity_key]

        with self._conn() as conn:
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        f"SELECT * FROM {table} WHERE project_id IS NULL ORDER BY ext_id",
                        (),
                    )
                    rows = cur.fetchall()
                    items = [_row_to_dict(r, entity_key) for r in rows]
                    for item in items:
                        item.pop("_db_id", None)

                    return {
                        "project": "_global",
                        "updated": now_iso(),
                        list_key: items,
                    }
            finally:
                conn.rollback()

    # -------------------------------------------------------------------
    # StorageAdapter Protocol: save_global
    # -------------------------------------------------------------------

    def save_global(self, entity: str, data: dict) -> None:
        """Save global entity data (project_id IS NULL)."""
        entity_key = EntityType(entity) if isinstance(entity, str) else entity
        table, list_key = _ENTITY_TABLE_MAP[entity_key]
        data["updated"] = now_iso()

        with self._conn() as conn:
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    items = data.get(list_key, [])

                    # Get existing global ext_ids
                    cur.execute(
                        f"SELECT ext_id FROM {table} WHERE project_id IS NULL",
                        (),
                    )
                    existing = {row["ext_id"] for row in cur.fetchall()}

                    for item in items:
                        ext_id = item.get("id", "")
                        if not ext_id:
                            continue

                        row = _dict_to_row(item, table, 0)  # project_id=0 placeholder
                        row.pop("project_id", None)

                        if ext_id in existing:
                            # UPDATE
                            sets = []
                            vals = []
                            for k, v in row.items():
                                if k == "ext_id":
                                    continue
                                sets.append(f"{k} = %s")
                                vals.append(v)
                            if sets:
                                vals.append(ext_id)
                                cur.execute(
                                    f"UPDATE {table} SET {', '.join(sets)} "
                                    f"WHERE project_id IS NULL AND ext_id = %s",
                                    vals,
                                )
                        else:
                            # INSERT with project_id = NULL
                            cols = ["ext_id"] + [k for k in row.keys() if k != "ext_id"]
                            vals = [row.get(c) for c in cols]
                            # Replace project_id column with NULL explicitly
                            col_str = "project_id, " + ", ".join(cols)
                            val_str = "NULL, " + ", ".join(["%s"] * len(cols))
                            cur.execute(
                                f"INSERT INTO {table} ({col_str}) VALUES ({val_str})",
                                vals,
                            )
                            existing.add(ext_id)

                    # Remove globals not in new data
                    data_ext_ids = {i.get("id", "") for i in items}
                    removed = existing - data_ext_ids
                    if removed:
                        cur.execute(
                            f"DELETE FROM {table} WHERE project_id IS NULL AND ext_id = ANY(%s)",
                            (list(removed),),
                        )

                conn.commit()
            except Exception as e:
                conn.rollback()
                raise StorageWriteError(f"Failed to save global {entity}: {e}") from e

    # -------------------------------------------------------------------
    # Knowledge impact analysis
    # -------------------------------------------------------------------

    def analyze_knowledge_impact(self, project: str, knowledge_ext_id: str) -> dict:
        """Run impact analysis for a knowledge entry.

        Finds all entities linked to the knowledge object and returns
        a structured report with impact levels.

        Uses a single connection for both lookup and analysis (no double checkout).
        Handles global knowledge (NULL project_id) correctly.

        Returns empty report if impact service is not available.
        """
        if self._impact is None:
            return {
                "knowledge_id": None,
                "knowledge_ext_id": knowledge_ext_id,
                "title": "",
                "total_affected": 0,
                "impact_summary": {"high": 0, "medium": 0, "low": 0},
                "affected_entities": [],
                "error": "Impact analysis service not available",
            }

        with self._conn() as conn:
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    pid = self._get_project_id(cur, project)
                    if pid is None:
                        raise ValueError(f"Project '{project}' not found")

                    # Resolve ext_id → DB id (handle both project-scoped and global)
                    cur.execute(
                        "SELECT id FROM knowledge "
                        "WHERE (project_id = %s OR project_id IS NULL) AND ext_id = %s "
                        "ORDER BY CASE WHEN project_id = %s THEN 0 ELSE 1 END "
                        "LIMIT 1",
                        (pid, knowledge_ext_id, pid),
                    )
                    row = cur.fetchone()
                    if row is None:
                        raise ValueError(
                            f"Knowledge '{knowledge_ext_id}' not found in project '{project}'"
                        )

                    # Pass cursor to avoid double pool checkout (F-04 fix)
                    return self._impact.analyze_impact(
                        row["id"], pid, cur=cur
                    )
            finally:
                conn.rollback()

    # -------------------------------------------------------------------
    # Lifecycle
    # -------------------------------------------------------------------

    def close(self) -> None:
        """Close all connections in the pool."""
        if self._pool:
            self._pool.closeall()
            self._pool = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def __repr__(self) -> str:
        return f"PostgreSQLAdapter(url='{self._database_url[:30]}...')"
