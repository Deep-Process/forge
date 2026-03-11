"""Knowledge maintenance router — staleness detection, usage tracking, review prompts."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_storage
from app.routers._helpers import (
    check_project_exists,
    load_entity,
)

router = APIRouter(prefix="/projects/{slug}/knowledge/maintenance", tags=["maintenance"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_dt(value: str | None) -> datetime | None:
    """Parse an ISO datetime string, returning None on failure."""
    if not value:
        return None
    try:
        # Handle both timezone-aware and naive datetimes
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def _last_updated(entry: dict) -> datetime | None:
    """Determine the effective 'last updated' timestamp for a knowledge entry."""
    # Prefer updated_at, fall back to created_at
    updated = _parse_dt(entry.get("updated_at"))
    if updated:
        return updated
    return _parse_dt(entry.get("created_at"))


def _is_stale(entry: dict, stale_days: int, now: datetime) -> bool:
    """Check if a knowledge entry is stale (not updated within stale_days)."""
    last = _last_updated(entry)
    if last is None:
        # No timestamp available — consider stale
        return True
    return (now - last) > timedelta(days=stale_days)


def _days_since_update(entry: dict, now: datetime) -> int | None:
    """Return the number of days since the entry was last updated."""
    last = _last_updated(entry)
    if last is None:
        return None
    return (now - last).days


def _count_linked_entities(entry: dict) -> int:
    """Count the number of linked entities on a knowledge entry."""
    return len(entry.get("linked_entities", []))


async def _count_external_references(storage, slug: str, k_id: str) -> dict:
    """Count how many tasks, ideas, and objectives reference this knowledge."""
    counts: dict[str, int] = {"tasks": 0, "ideas": 0, "objectives": 0}
    refs: list[dict] = []

    # Check tasks
    tracker = await load_entity(storage, slug, "tracker")
    for t in tracker.get("tasks", []):
        if k_id in t.get("knowledge_ids", []):
            counts["tasks"] += 1
            refs.append({"entity_type": "task", "entity_id": t["id"], "name": t.get("name", "")})

    # Check ideas
    ideas_data = await load_entity(storage, slug, "ideas")
    for i in ideas_data.get("ideas", []):
        if k_id in i.get("knowledge_ids", []):
            counts["ideas"] += 1
            refs.append({"entity_type": "idea", "entity_id": i["id"], "name": i.get("title", "")})

    # Check objectives
    obj_data = await load_entity(storage, slug, "objectives")
    for o in obj_data.get("objectives", []):
        if k_id in o.get("knowledge_ids", []):
            counts["objectives"] += 1
            refs.append({"entity_type": "objective", "entity_id": o["id"], "name": o.get("title", "")})

    return {"counts": counts, "references": refs}


def _generate_review_suggestion(entry: dict, days_stale: int | None, usage_count: int) -> str:
    """Generate a review suggestion based on staleness and usage."""
    status = entry.get("status", "ACTIVE")
    title = entry.get("title", entry.get("id", "Unknown"))

    if status == "DEPRECATED":
        if usage_count > 0:
            return f"'{title}' is DEPRECATED but still referenced by {usage_count} entities. Consider archiving or updating references."
        return f"'{title}' is DEPRECATED with no references. Consider archiving."

    if status == "REVIEW_NEEDED":
        return f"'{title}' is explicitly marked REVIEW_NEEDED. Review and update content, then set status back to ACTIVE."

    if days_stale is not None and days_stale > 90:
        if usage_count == 0:
            return f"'{title}' has not been updated in {days_stale} days and has no references. Consider deprecating or removing."
        return f"'{title}' has not been updated in {days_stale} days but has {usage_count} references. Review for accuracy."

    if days_stale is not None and days_stale > 0:
        return f"'{title}' has not been updated in {days_stale} days. Verify content is still accurate."

    return f"'{title}' is due for periodic review."


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def maintenance_overview(
    slug: str,
    stale_days: int = Query(30, ge=1, description="Number of days after which knowledge is considered stale"),
    storage=Depends(get_storage),
):
    """Full maintenance report: stale knowledge, usage stats, review suggestions."""
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "knowledge")
    entries = data.get("knowledge", [])
    now = datetime.now(timezone.utc)

    stale_items: list[dict] = []
    review_suggestions: list[dict] = []
    usage_stats: list[dict] = []

    # Preload referencing entities once
    tracker = await load_entity(storage, slug, "tracker")
    ideas_data = await load_entity(storage, slug, "ideas")
    obj_data = await load_entity(storage, slug, "objectives")

    for entry in entries:
        k_id = entry.get("id", "")
        status = entry.get("status", "ACTIVE")

        # Skip archived entries — they are terminal
        if status == "ARCHIVED":
            continue

        # --- Usage tracking ---
        linked_count = _count_linked_entities(entry)

        # Count external references (tasks, ideas, objectives that reference this knowledge)
        ext_task_count = sum(1 for t in tracker.get("tasks", []) if k_id in t.get("knowledge_ids", []))
        ext_idea_count = sum(1 for i in ideas_data.get("ideas", []) if k_id in i.get("knowledge_ids", []))
        ext_obj_count = sum(1 for o in obj_data.get("objectives", []) if k_id in o.get("knowledge_ids", []))
        total_references = linked_count + ext_task_count + ext_idea_count + ext_obj_count

        usage_stat = {
            "id": k_id,
            "title": entry.get("title", ""),
            "status": status,
            "category": entry.get("category", ""),
            "linked_entities": linked_count,
            "referencing_tasks": ext_task_count,
            "referencing_ideas": ext_idea_count,
            "referencing_objectives": ext_obj_count,
            "total_references": total_references,
        }
        usage_stats.append(usage_stat)

        # --- Staleness detection ---
        review_interval = entry.get("review_interval_days", stale_days)
        is_stale = _is_stale(entry, review_interval, now)
        days_since = _days_since_update(entry, now)

        if is_stale or status == "REVIEW_NEEDED":
            stale_entry = {
                "id": k_id,
                "title": entry.get("title", ""),
                "status": status,
                "category": entry.get("category", ""),
                "days_since_update": days_since,
                "review_interval_days": review_interval,
                "total_references": total_references,
                "last_updated": entry.get("updated_at") or entry.get("created_at"),
            }
            stale_items.append(stale_entry)

            # --- Review suggestion ---
            suggestion = _generate_review_suggestion(entry, days_since, total_references)
            review_suggestions.append({
                "id": k_id,
                "title": entry.get("title", ""),
                "suggestion": suggestion,
                "priority": "high" if (days_since is not None and days_since > 90) or days_since is None or status == "REVIEW_NEEDED" else "medium",
            })

    # Sort stale items: REVIEW_NEEDED first, then by days_since_update descending
    stale_items.sort(key=lambda x: (
        0 if x["status"] == "REVIEW_NEEDED" else 1,
        -(x["days_since_update"] or 0),
    ))
    review_suggestions.sort(key=lambda x: (0 if x["priority"] == "high" else 1))

    # Summary statistics
    total = len(entries)
    active_count = sum(1 for e in entries if e.get("status") == "ACTIVE")
    archived_count = sum(1 for e in entries if e.get("status") == "ARCHIVED")
    deprecated_count = sum(1 for e in entries if e.get("status") == "DEPRECATED")
    review_needed_count = sum(1 for e in entries if e.get("status") == "REVIEW_NEEDED")
    draft_count = sum(1 for e in entries if e.get("status") == "DRAFT")

    return {
        "summary": {
            "total_knowledge": total,
            "active": active_count,
            "draft": draft_count,
            "review_needed": review_needed_count,
            "deprecated": deprecated_count,
            "archived": archived_count,
            "stale_count": len(stale_items),
            "stale_days_threshold": stale_days,
        },
        "stale": stale_items,
        "review_suggestions": review_suggestions,
        "usage_stats": usage_stats,
    }


@router.get("/stale")
async def stale_knowledge(
    slug: str,
    stale_days: int = Query(30, ge=1, description="Number of days after which knowledge is considered stale"),
    storage=Depends(get_storage),
):
    """Return knowledge objects needing review (stale or REVIEW_NEEDED status)."""
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "knowledge")
    entries = data.get("knowledge", [])
    now = datetime.now(timezone.utc)

    # Preload referencing entities for consistent total_references calculation
    tracker = await load_entity(storage, slug, "tracker")
    ideas_data = await load_entity(storage, slug, "ideas")
    obj_data = await load_entity(storage, slug, "objectives")

    stale_items: list[dict] = []

    for entry in entries:
        status = entry.get("status", "ACTIVE")

        # Skip archived entries
        if status == "ARCHIVED":
            continue

        review_interval = entry.get("review_interval_days", stale_days)
        is_stale = _is_stale(entry, review_interval, now)
        days_since = _days_since_update(entry, now)

        if is_stale or status == "REVIEW_NEEDED":
            k_id = entry.get("id", "")
            linked_count = _count_linked_entities(entry)
            ext_task_count = sum(1 for t in tracker.get("tasks", []) if k_id in t.get("knowledge_ids", []))
            ext_idea_count = sum(1 for i in ideas_data.get("ideas", []) if k_id in i.get("knowledge_ids", []))
            ext_obj_count = sum(1 for o in obj_data.get("objectives", []) if k_id in o.get("knowledge_ids", []))
            total_references = linked_count + ext_task_count + ext_idea_count + ext_obj_count
            suggestion = _generate_review_suggestion(entry, days_since, total_references)

            stale_items.append({
                "id": entry.get("id", ""),
                "title": entry.get("title", ""),
                "status": status,
                "category": entry.get("category", ""),
                "days_since_update": days_since,
                "review_interval_days": review_interval,
                "linked_entities_count": linked_count,
                "last_updated": entry.get("updated_at") or entry.get("created_at"),
                "suggestion": suggestion,
                "priority": "high" if (days_since is not None and days_since > 90) or days_since is None or status == "REVIEW_NEEDED" else "medium",
            })

    # Sort: REVIEW_NEEDED first, then by days_since_update descending
    stale_items.sort(key=lambda x: (
        0 if x["status"] == "REVIEW_NEEDED" else 1,
        -(x["days_since_update"] or 0),
    ))

    return {
        "stale": stale_items,
        "count": len(stale_items),
        "stale_days_threshold": stale_days,
    }
