"""
Knowledge Versioning — PostgreSQL-only version management for knowledge entries.

Provides version history, diffs, and rollback for knowledge objects.
In JSON mode, versioning is embedded as an array inside the knowledge dict.
In PostgreSQL mode, versions are stored in a separate table with full diff support.

Reference: docs/FORGE-PLATFORM-V2.md Section 7.2
"""

from __future__ import annotations

import difflib
from contextlib import contextmanager
from datetime import datetime
from typing import Optional

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None  # type: ignore


class KnowledgeVersioningService:
    """Manages knowledge versioning in PostgreSQL.

    Operations:
    - create_version: Store a new version on knowledge update
    - list_versions: Get version history for a knowledge entry
    - get_version: Get specific version content
    - diff_versions: Compare two versions (unified diff)
    - rollback: Create new version from a previous one (non-destructive, atomic)

    The knowledge table has `current_version INT` which stays in sync.
    The knowledge_versions table stores each version separately.

    Connection management:
    - Accepts a pool object (psycopg2.pool.ThreadedConnectionPool)
    - Uses getconn/putconn pattern (never conn.close() on pooled connections)
    - All write operations are single-transaction atomic
    """

    def __init__(self, pool):
        """Initialize with a connection pool.

        Args:
            pool: psycopg2.pool.ThreadedConnectionPool (or compatible).
        """
        self._pool = pool

    @contextmanager
    def _conn(self):
        """Acquire a connection from the pool, auto-release on exit."""
        conn = self._pool.getconn()
        try:
            yield conn
        finally:
            self._pool.putconn(conn)

    def create_version(
        self,
        knowledge_db_id: int,
        content: str,
        changed_by: str = "",
        change_reason: str = "",
        conn=None,
        update_content: bool = False,
    ) -> int:
        """Create a new version for a knowledge entry (atomic).

        Uses SELECT ... FOR UPDATE to prevent race conditions on
        concurrent version creation.

        Args:
            knowledge_db_id: Internal DB ID of the knowledge entry
            content: The full content of this version
            changed_by: Who made the change
            change_reason: Why the change was made
            conn: Optional existing connection (for transactional use)
            update_content: If True, also updates knowledge.content

        Returns:
            The new version number.
        """
        manage_conn = conn is None
        if manage_conn:
            conn = self._pool.getconn()

        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # Lock the knowledge row to prevent concurrent version creation
                cur.execute(
                    "SELECT current_version FROM knowledge WHERE id = %s FOR UPDATE",
                    (knowledge_db_id,),
                )
                row = cur.fetchone()
                if row is None:
                    raise ValueError(f"Knowledge entry {knowledge_db_id} not found")

                new_version = row["current_version"] + 1

                # Insert version row
                cur.execute(
                    "INSERT INTO knowledge_versions "
                    "(knowledge_id, version, content, changed_by, change_reason) "
                    "VALUES (%s, %s, %s, %s, %s)",
                    (knowledge_db_id, new_version, content, changed_by, change_reason),
                )

                # Update current_version (and optionally content) on knowledge table
                if update_content:
                    cur.execute(
                        "UPDATE knowledge SET current_version = %s, content = %s, "
                        "updated_at = NOW() WHERE id = %s",
                        (new_version, content, knowledge_db_id),
                    )
                else:
                    cur.execute(
                        "UPDATE knowledge SET current_version = %s, updated_at = NOW() "
                        "WHERE id = %s",
                        (new_version, knowledge_db_id),
                    )

            if manage_conn:
                conn.commit()
            return new_version
        except Exception:
            if manage_conn:
                conn.rollback()
            raise
        finally:
            if manage_conn:
                self._pool.putconn(conn)

    def list_versions(self, knowledge_db_id: int) -> list[dict]:
        """List all versions for a knowledge entry (metadata only).

        Returns:
            [{"version": 1, "changed_by": "...", "change_reason": "...", "created_at": "..."}]
        """
        with self._conn() as conn:
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "SELECT version, changed_by, change_reason, created_at "
                        "FROM knowledge_versions "
                        "WHERE knowledge_id = %s ORDER BY version",
                        (knowledge_db_id,),
                    )
                    return [self._format_row(r) for r in cur.fetchall()]
            finally:
                conn.rollback()

    def get_version(
        self, knowledge_db_id: int, version: int, conn=None
    ) -> Optional[dict]:
        """Get a specific version's full content.

        Args:
            knowledge_db_id: Internal DB ID
            version: Version number (must be >= 1)
            conn: Optional existing connection (avoids pool checkout)

        Returns:
            {"version": N, "content": "...", "changed_by": "...",
             "change_reason": "...", "created_at": "..."}
            or None if version doesn't exist.
        """
        if version < 1:
            return None

        def _query(cur):
            cur.execute(
                "SELECT version, content, changed_by, change_reason, created_at "
                "FROM knowledge_versions "
                "WHERE knowledge_id = %s AND version = %s",
                (knowledge_db_id, version),
            )
            row = cur.fetchone()
            return self._format_row(row) if row else None

        if conn is not None:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                return _query(cur)
        else:
            with self._conn() as c:
                try:
                    with c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                        return _query(cur)
                finally:
                    c.rollback()

    def diff_versions(
        self, knowledge_db_id: int, version_a: int, version_b: int
    ) -> dict:
        """Generate a unified diff between two versions.

        Uses a single connection to fetch both versions efficiently.

        Returns:
            {
                "knowledge_id": N,
                "from_version": A,
                "to_version": B,
                "diff": "unified diff string",
                "lines_added": N,
                "lines_removed": N,
            }
        """
        with self._conn() as conn:
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "SELECT version, content FROM knowledge_versions "
                        "WHERE knowledge_id = %s AND version IN (%s, %s) "
                        "ORDER BY version",
                        (knowledge_db_id, version_a, version_b),
                    )
                    rows = {r["version"]: r["content"] or "" for r in cur.fetchall()}
            finally:
                conn.rollback()

        if version_a not in rows:
            raise ValueError(f"Version {version_a} not found")
        if version_b not in rows:
            raise ValueError(f"Version {version_b} not found")

        content_a = rows[version_a].splitlines()
        content_b = rows[version_b].splitlines()

        diff_lines = list(difflib.unified_diff(
            content_a, content_b,
            fromfile=f"v{version_a}",
            tofile=f"v{version_b}",
            lineterm="",
        ))

        added = sum(1 for ln in diff_lines if ln.startswith("+") and not ln.startswith("+++"))
        removed = sum(1 for ln in diff_lines if ln.startswith("-") and not ln.startswith("---"))

        return {
            "knowledge_id": knowledge_db_id,
            "from_version": version_a,
            "to_version": version_b,
            "diff": "\n".join(diff_lines),
            "lines_added": added,
            "lines_removed": removed,
        }

    def rollback(
        self,
        knowledge_db_id: int,
        target_version: int,
        changed_by: str = "",
    ) -> int:
        """Rollback to a previous version (atomic, non-destructive).

        Creates a new version with content from the target version.
        Updates knowledge.content + current_version in a single transaction.
        Does NOT delete any version history.

        Returns:
            The new version number.
        """
        # All operations in a single connection/transaction
        conn = self._pool.getconn()
        try:
            # Fetch target version content within this transaction
            target = self.get_version(knowledge_db_id, target_version, conn=conn)
            if target is None:
                raise ValueError(f"Version {target_version} not found for rollback")

            # Create new version + update knowledge.content atomically
            new_version = self.create_version(
                knowledge_db_id=knowledge_db_id,
                content=target["content"],
                changed_by=changed_by,
                change_reason=f"Rollback to version {target_version}",
                conn=conn,
                update_content=True,
            )

            conn.commit()
            return new_version
        except Exception:
            conn.rollback()
            raise
        finally:
            self._pool.putconn(conn)

    def ensure_initial_version(self, knowledge_db_id: int, content: str, conn=None) -> None:
        """Ensure version 1 exists for a knowledge entry (idempotent).

        Called when knowledge is first created. If version 1 already exists,
        this is a no-op. Also syncs current_version = 1 on the knowledge row.
        """
        manage_conn = conn is None
        if manage_conn:
            conn = self._pool.getconn()

        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT 1 FROM knowledge_versions "
                    "WHERE knowledge_id = %s AND version = 1",
                    (knowledge_db_id,),
                )
                if cur.fetchone() is not None:
                    return  # Already exists

                cur.execute(
                    "INSERT INTO knowledge_versions "
                    "(knowledge_id, version, content, changed_by, change_reason) "
                    "VALUES (%s, 1, %s, %s, %s)",
                    (knowledge_db_id, content, "", "Initial version"),
                )

                # Ensure current_version is synced
                cur.execute(
                    "UPDATE knowledge SET current_version = 1 WHERE id = %s AND current_version < 1",
                    (knowledge_db_id,),
                )

            if manage_conn:
                conn.commit()
        except Exception:
            if manage_conn:
                conn.rollback()
            raise
        finally:
            if manage_conn:
                self._pool.putconn(conn)

    @staticmethod
    def _format_row(row: dict) -> dict:
        """Format a version row: convert timestamps to ISO strings."""
        result = dict(row)
        if isinstance(result.get("created_at"), datetime):
            result["created_at"] = result["created_at"].strftime("%Y-%m-%dT%H:%M:%SZ")
        return result
