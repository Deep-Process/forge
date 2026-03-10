"""
Knowledge Impact Analysis — find all entities affected by a knowledge change.

Two modes:
  - PostgreSQL: Efficient reverse FK JOINs via knowledge_links, task_knowledge,
    array containment queries on knowledge_ids columns, and linked_entities JSONB.
  - JSON: Full-scan all entity files (delegated to cmd_impact in knowledge.py).

Reference: docs/FORGE-PLATFORM-V2.md Section 7.2
"""

from __future__ import annotations

from typing import Optional

try:
    import psycopg2
    import psycopg2.extras
    from psycopg2 import sql as pgsql
except ImportError:
    psycopg2 = None  # type: ignore
    pgsql = None  # type: ignore


# Impact severity weights — higher = more impacted
IMPACT_WEIGHTS = {
    # From knowledge.py VALID_LINK_RELATIONS (canonical)
    "required": 3,
    "context": 2,
    "reference": 1,
    # From knowledge_links schema defaults (legacy/migration)
    "references": 1,
    "derived-from": 2,
    "supports": 2,
    "contradicts": 3,
    # Synthetic relations from array/junction queries
    "uses": 2,
    "depends_on": 3,
}

# Allowed table names for dynamic SQL (prevents injection)
_ALLOWED_TABLES = {
    "tasks", "ideas", "objectives", "knowledge",
    "decisions", "guidelines", "lessons",
}

# Table → (table_name, title_column) mapping for entity resolution
_ENTITY_TABLE_MAP = {
    "objective": ("objectives", "title"),
    "idea": ("ideas", "title"),
    "task": ("tasks", "name"),
    "decision": ("decisions", "issue"),
    "guideline": ("guidelines", "title"),
    "knowledge": ("knowledge", "title"),
    "lesson": ("lessons", "title"),
}


class KnowledgeImpactService:
    """Performs impact analysis for knowledge objects in PostgreSQL.

    Given a knowledge entry, finds all entities that link to it and
    returns a structured impact report with severity levels.

    Data sources queried:
    1. knowledge.linked_entities JSONB (embedded links from JSON era)
    2. knowledge_links table (polymorphic — any entity type)
    3. task_knowledge junction table
    4. tasks.knowledge_ids TEXT[] (array containment)
    5. ideas.knowledge_ids TEXT[]
    6. objectives.knowledge_ids TEXT[]
    7. knowledge.dependencies TEXT[] (other knowledge depending on this)

    Connection management:
    - Accepts an optional cursor for single-connection use (preferred)
    - Falls back to pool-based connection if no cursor provided
    """

    def __init__(self, pool):
        """Initialize with a psycopg2 connection pool."""
        self._pool = pool

    def analyze_impact(
        self,
        knowledge_db_id: int,
        project_id: Optional[int] = None,
        cur=None,
    ) -> dict:
        """Run full impact analysis for a knowledge entry.

        Args:
            knowledge_db_id: Internal DB ID of the knowledge entry.
            project_id: Optional project_id to scope array scans.
                        If None, scans across all projects (for global knowledge).
            cur: Optional existing cursor (avoids second pool checkout).

        Returns:
            {
                "knowledge_id": N,
                "knowledge_ext_id": "K-NNN",
                "title": "...",
                "total_affected": N,
                "impact_summary": {"high": N, "medium": N, "low": N},
                "affected_entities": [...],
            }
        """
        if cur is not None:
            return self._do_analyze(cur, knowledge_db_id, project_id)

        # Fallback: acquire own connection from pool
        conn = self._pool.getconn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as c:
                result = self._do_analyze(c, knowledge_db_id, project_id)
            return result
        finally:
            conn.rollback()  # Read-only, end implicit transaction
            self._pool.putconn(conn)

    def _do_analyze(
        self, cur, knowledge_db_id: int, project_id: Optional[int]
    ) -> dict:
        """Core analysis logic using a provided cursor."""
        # Get knowledge metadata
        cur.execute(
            "SELECT id, ext_id, title, project_id, linked_entities "
            "FROM knowledge WHERE id = %s",
            (knowledge_db_id,),
        )
        k_row = cur.fetchone()
        if k_row is None:
            raise ValueError(f"Knowledge entry {knowledge_db_id} not found")

        ext_id = k_row["ext_id"]
        pid = project_id or k_row["project_id"]
        # pid may be None for global knowledge — array scans will be cross-project

        affected = []

        # 1. knowledge.linked_entities JSONB (embedded links, F-07 fix)
        linked_entities = k_row.get("linked_entities") or []
        if isinstance(linked_entities, str):
            import json
            linked_entities = json.loads(linked_entities)
        for le in linked_entities:
            affected.append({
                "entity_type": le.get("entity_type", ""),
                "entity_id": le.get("entity_id", ""),
                "entity_title": "",
                "relation": le.get("relation", "reference"),
                "source": "knowledge.linked_entities",
            })

        # 2. knowledge_links table (polymorphic)
        affected.extend(self._from_knowledge_links(cur, knowledge_db_id))

        # 3. task_knowledge junction table
        affected.extend(self._from_task_knowledge(cur, knowledge_db_id))

        # 4-6. Array containment queries on knowledge_ids
        for table, entity_type in [
            ("tasks", "task"),
            ("ideas", "idea"),
            ("objectives", "objective"),
        ]:
            affected.extend(
                self._from_array_column(
                    cur, table, "knowledge_ids", ext_id, pid, entity_type
                )
            )

        # 7. knowledge.dependencies (other knowledge depending on this)
        affected.extend(
            self._from_knowledge_deps(cur, ext_id, pid, knowledge_db_id)
        )

        # Deduplicate by (entity_type, entity_id)
        affected = self._deduplicate(affected)

        # Assign impact levels
        for item in affected:
            item["impact_level"] = self._compute_impact_level(item["relation"])

        # Build summary
        summary = {"high": 0, "medium": 0, "low": 0}
        for item in affected:
            summary[item["impact_level"]] += 1

        return {
            "knowledge_id": knowledge_db_id,
            "knowledge_ext_id": ext_id,
            "title": k_row["title"],
            "total_affected": len(affected),
            "impact_summary": summary,
            "affected_entities": affected,
        }

    def _from_knowledge_links(self, cur, knowledge_db_id: int) -> list[dict]:
        """Query knowledge_links table for direct links."""
        cur.execute(
            "SELECT kl.entity_type, kl.entity_id, kl.relation "
            "FROM knowledge_links kl "
            "WHERE kl.knowledge_id = %s",
            (knowledge_db_id,),
        )
        results = []
        for row in cur.fetchall():
            entity_info = self._resolve_entity(
                cur, row["entity_type"], row["entity_id"]
            )
            results.append({
                "entity_type": row["entity_type"],
                "entity_id": entity_info.get("ext_id", str(row["entity_id"])),
                "entity_title": entity_info.get("title", ""),
                "relation": row["relation"],
                "source": "knowledge_links",
            })
        return results

    def _from_task_knowledge(self, cur, knowledge_db_id: int) -> list[dict]:
        """Query task_knowledge junction table."""
        cur.execute(
            "SELECT t.ext_id, t.name "
            "FROM task_knowledge tk "
            "JOIN tasks t ON t.id = tk.task_id "
            "WHERE tk.knowledge_id = %s",
            (knowledge_db_id,),
        )
        return [
            {
                "entity_type": "task",
                "entity_id": row["ext_id"],
                "entity_title": row["name"],
                "relation": "uses",
                "source": "task_knowledge",
            }
            for row in cur.fetchall()
        ]

    def _from_array_column(
        self,
        cur,
        table: str,
        column: str,
        ext_id: str,
        project_id: Optional[int],
        entity_type: str,
    ) -> list[dict]:
        """Query a TEXT[] column for containment of ext_id.

        Uses PostgreSQL array containment operator @> with safe
        identifier quoting via psycopg2.sql.
        """
        if table not in _ALLOWED_TABLES:
            return []

        title_col = "name" if table == "tasks" else "title"
        query = pgsql.SQL(
            "SELECT ext_id, {title} AS title FROM {tbl} "
            "WHERE {col} @> ARRAY[%s]::TEXT[]"
        ).format(
            title=pgsql.Identifier(title_col),
            tbl=pgsql.Identifier(table),
            col=pgsql.Identifier(column),
        )

        if project_id is not None:
            query = pgsql.SQL(
                "SELECT ext_id, {title} AS title FROM {tbl} "
                "WHERE project_id = %s AND {col} @> ARRAY[%s]::TEXT[]"
            ).format(
                title=pgsql.Identifier(title_col),
                tbl=pgsql.Identifier(table),
                col=pgsql.Identifier(column),
            )
            cur.execute(query, (project_id, ext_id))
        else:
            cur.execute(query, (ext_id,))

        return [
            {
                "entity_type": entity_type,
                "entity_id": row["ext_id"],
                "entity_title": row["title"],
                "relation": "uses",
                "source": f"{table}.{column}",
            }
            for row in cur.fetchall()
        ]

    def _from_knowledge_deps(
        self,
        cur,
        ext_id: str,
        project_id: Optional[int],
        exclude_db_id: int,
    ) -> list[dict]:
        """Find other knowledge entries that depend on this one.

        Excludes the knowledge entry itself (prevents self-referencing).
        """
        if project_id is not None:
            cur.execute(
                "SELECT ext_id, title FROM knowledge "
                "WHERE project_id = %s AND dependencies @> ARRAY[%s]::TEXT[] "
                "AND id != %s",
                (project_id, ext_id, exclude_db_id),
            )
        else:
            cur.execute(
                "SELECT ext_id, title FROM knowledge "
                "WHERE dependencies @> ARRAY[%s]::TEXT[] "
                "AND id != %s",
                (ext_id, exclude_db_id),
            )
        return [
            {
                "entity_type": "knowledge",
                "entity_id": row["ext_id"],
                "entity_title": row["title"],
                "relation": "depends_on",
                "source": "knowledge.dependencies",
            }
            for row in cur.fetchall()
        ]

    def _resolve_entity(
        self, cur, entity_type: str, entity_db_id: int
    ) -> dict:
        """Resolve an entity's ext_id and title from its DB id.

        knowledge_links stores entity_id as the DB serial id,
        so we need to look up the actual ext_id and title/name/issue.
        Uses psycopg2.sql for safe identifier quoting.
        """
        if entity_type not in _ENTITY_TABLE_MAP:
            return {"ext_id": str(entity_db_id), "title": ""}

        table, title_col = _ENTITY_TABLE_MAP[entity_type]
        cur.execute(
            pgsql.SQL("SELECT ext_id, {title} AS title FROM {tbl} WHERE id = %s").format(
                title=pgsql.Identifier(title_col),
                tbl=pgsql.Identifier(table),
            ),
            (entity_db_id,),
        )
        row = cur.fetchone()
        if row is None:
            return {"ext_id": str(entity_db_id), "title": "(deleted)"}
        return {"ext_id": row["ext_id"], "title": row["title"]}

    @staticmethod
    def _deduplicate(items: list[dict]) -> list[dict]:
        """Remove duplicate entries, keeping the highest-impact relation.

        When duplicates are found, accumulates sources for audit trail.
        """
        seen: dict[tuple[str, str], dict] = {}
        for item in items:
            key = (item["entity_type"], item["entity_id"])
            if key in seen:
                existing = seen[key]
                # Accumulate sources for audit trail
                if "sources" not in existing:
                    existing["sources"] = [existing["source"]]
                existing["sources"].append(item["source"])
                # Keep the highest-weight relation
                existing_weight = IMPACT_WEIGHTS.get(existing["relation"], 1)
                new_weight = IMPACT_WEIGHTS.get(item["relation"], 1)
                if new_weight > existing_weight:
                    existing["relation"] = item["relation"]
                    existing["source"] = item["source"]
            else:
                seen[key] = item
        return list(seen.values())

    @staticmethod
    def _compute_impact_level(relation: str) -> str:
        """Map relation type to impact level (high/medium/low)."""
        weight = IMPACT_WEIGHTS.get(relation, 1)
        if weight >= 3:
            return "high"
        if weight >= 2:
            return "medium"
        return "low"
