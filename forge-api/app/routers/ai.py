"""AI suggestion endpoints — mock-mode LLM contract-based suggestions."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_storage
from app.routers._helpers import (
    check_project_exists,
    find_item_or_404,
    load_entity,
)

router = APIRouter(prefix="/projects/{slug}/ai", tags=["ai"])

# ---------------------------------------------------------------------------
# LLM provider config — MOCK by default (no live LLM required)
# ---------------------------------------------------------------------------

LLM_MODE = "mock"  # "mock" | "openai" | "anthropic" — only mock implemented


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class SuggestKnowledgeRequest(BaseModel):
    """Suggest relevant knowledge objects for an entity."""
    entity_type: Literal["task", "idea", "objective", "guideline", "lesson"]
    entity_id: str


class KnowledgeSuggestion(BaseModel):
    knowledge_id: str
    title: str
    relevance_score: float
    reason: str


class SuggestKnowledgeResponse(BaseModel):
    entity_type: str
    entity_id: str
    suggestions: list[KnowledgeSuggestion]
    mode: str = "mock"


class SuggestGuidelinesRequest(BaseModel):
    """Suggest applicable guidelines for an entity."""
    entity_type: Literal["task", "idea", "objective", "knowledge", "lesson"]
    entity_id: str


class GuidelineSuggestion(BaseModel):
    guideline_id: str
    title: str
    weight: str
    relevance_score: float
    reason: str


class SuggestGuidelinesResponse(BaseModel):
    entity_type: str
    entity_id: str
    suggestions: list[GuidelineSuggestion]
    mode: str = "mock"


class SuggestACRequest(BaseModel):
    """Suggest acceptance criteria from templates for a task."""
    task_id: str


class ACSuggestion(BaseModel):
    template_id: str
    title: str
    category: str
    suggested_criterion: str
    relevance_score: float
    reason: str


class SuggestACResponse(BaseModel):
    task_id: str
    suggestions: list[ACSuggestion]
    mode: str = "mock"


class EvaluateLessonRequest(BaseModel):
    """Evaluate a lesson and recommend whether to promote to knowledge/guideline."""
    lesson_id: str


class PromotionRecommendation(BaseModel):
    target: Literal["knowledge", "guideline", "none"]
    confidence: float
    reason: str
    suggested_scope: str
    suggested_category: str
    suggested_weight: str


class EvaluateLessonResponse(BaseModel):
    lesson_id: str
    lesson_title: str
    recommendation: PromotionRecommendation
    mode: str = "mock"


class AssessImpactRequest(BaseModel):
    """Assess impact of a knowledge change on linked entities."""
    knowledge_id: str


class ImpactItem(BaseModel):
    entity_type: str
    entity_id: str
    name: str
    impact_level: Literal["high", "medium", "low"]
    reason: str


class AssessImpactResponse(BaseModel):
    knowledge_id: str
    knowledge_title: str
    total_affected: int
    impact_items: list[ImpactItem]
    summary: str
    mode: str = "mock"


# ---------------------------------------------------------------------------
# Heuristic helpers for mock mode
# ---------------------------------------------------------------------------

def _token_overlap(text_a: str, text_b: str) -> float:
    """Simple word-overlap similarity score between two strings (0..1)."""
    if not text_a or not text_b:
        return 0.0
    tokens_a = set(text_a.lower().split())
    tokens_b = set(text_b.lower().split())
    # Remove very short / common words
    stop = {"the", "a", "an", "is", "are", "to", "in", "of", "and", "or", "for", "on", "it", "be", "as", "at", "by", "from", "with", "this", "that", "was", "not", "but", "all", "can", "had", "has", "have", "do", "if", "no", "so", "up"}
    tokens_a -= stop
    tokens_b -= stop
    if not tokens_a or not tokens_b:
        return 0.0
    overlap = tokens_a & tokens_b
    return len(overlap) / min(len(tokens_a), len(tokens_b))


def _tag_overlap(tags_a: list[str], tags_b: list[str]) -> float:
    """Tag set overlap score (0..1)."""
    if not tags_a or not tags_b:
        return 0.0
    set_a = set(t.lower() for t in tags_a)
    set_b = set(t.lower() for t in tags_b)
    overlap = set_a & set_b
    return len(overlap) / min(len(set_a), len(set_b))


def _scope_overlap(scopes_a: list[str] | str, scopes_b: list[str] | str) -> float:
    """Scope overlap score. Handles both list and comma-separated string."""
    if isinstance(scopes_a, str):
        scopes_a = [s.strip() for s in scopes_a.split(",") if s.strip()]
    if isinstance(scopes_b, str):
        scopes_b = [s.strip() for s in scopes_b.split(",") if s.strip()]
    if not scopes_a or not scopes_b:
        return 0.0
    set_a = set(s.lower() for s in scopes_a)
    set_b = set(s.lower() for s in scopes_b)
    overlap = set_a & set_b
    return len(overlap) / min(len(set_a), len(set_b))


def _combined_score(
    text_sim: float,
    tag_sim: float,
    scope_sim: float,
    weights: tuple[float, float, float] = (0.4, 0.35, 0.25),
) -> float:
    """Weighted combination, clamped to [0, 1]."""
    score = weights[0] * text_sim + weights[1] * tag_sim + weights[2] * scope_sim
    return round(min(1.0, max(0.0, score)), 3)


def _entity_text(entity: dict) -> str:
    """Extract searchable text from any entity dict."""
    parts = []
    for key in ("title", "name", "description", "detail", "content", "instruction"):
        val = entity.get(key, "")
        if val:
            parts.append(val)
    return " ".join(parts)


def _entity_tags(entity: dict) -> list[str]:
    """Extract tags from an entity."""
    return entity.get("tags", [])


def _entity_scopes(entity: dict) -> list[str]:
    """Extract scopes from an entity (handles 'scopes' list or 'scope' string)."""
    scopes = entity.get("scopes", [])
    if not scopes:
        scope_str = entity.get("scope", "")
        if scope_str:
            scopes = [s.strip() for s in scope_str.split(",") if s.strip()]
    return scopes


async def _load_entity_by_type(storage, slug: str, entity_type: str, entity_id: str) -> dict:
    """Load a specific entity by type and ID from storage."""
    entity_map = {
        "task": ("tracker", "tasks"),
        "idea": ("ideas", "ideas"),
        "objective": ("objectives", "objectives"),
        "knowledge": ("knowledge", "knowledge"),
        "guideline": ("guidelines", "guidelines"),
        "lesson": ("lessons", "lessons"),
    }
    if entity_type not in entity_map:
        raise HTTPException(422, f"Unsupported entity_type: {entity_type}")
    file_key, list_key = entity_map[entity_type]
    data = await load_entity(storage, slug, file_key)
    items = data.get(list_key, [])
    return find_item_or_404(items, entity_id, entity_type.capitalize())


# ---------------------------------------------------------------------------
# Mock LLM contract flow
# ---------------------------------------------------------------------------

def _mock_llm_call(contract_name: str, context: dict) -> dict:
    """Simulate an LLM contract call.

    In production this would:
    1. Load the contract schema for `contract_name`
    2. Assemble the prompt from context
    3. Call the LLM provider
    4. Validate the output against the contract schema

    In mock mode we return pre-computed heuristic results passed in context.
    """
    # The mock simply returns the pre-computed result
    return context.get("mock_result", {})


# ---------------------------------------------------------------------------
# Endpoint 1: Suggest Knowledge
# ---------------------------------------------------------------------------

@router.post("/suggest-knowledge", response_model=SuggestKnowledgeResponse)
async def suggest_knowledge(
    slug: str,
    body: SuggestKnowledgeRequest,
    storage=Depends(get_storage),
):
    """Given an entity, suggest relevant knowledge objects.

    Contract flow: load entity -> load knowledge -> score relevance -> return suggestions.
    """
    await check_project_exists(storage, slug)

    # Load the source entity
    entity = await _load_entity_by_type(storage, slug, body.entity_type, body.entity_id)
    entity_text = _entity_text(entity)
    entity_tags = _entity_tags(entity)
    entity_scopes = _entity_scopes(entity)

    # Load all active knowledge
    kn_data = await load_entity(storage, slug, "knowledge")
    knowledge_items = [k for k in kn_data.get("knowledge", []) if k.get("status") == "ACTIVE"]

    # Score each knowledge item against the entity
    scored: list[dict] = []
    for k in knowledge_items:
        text_sim = _token_overlap(entity_text, _entity_text(k))
        tag_sim = _tag_overlap(entity_tags, _entity_tags(k))
        scope_sim = _scope_overlap(entity_scopes, _entity_scopes(k))
        score = _combined_score(text_sim, tag_sim, scope_sim)

        if score > 0.05:  # Minimum relevance threshold
            reason_parts = []
            if text_sim > 0.1:
                reason_parts.append("content overlap")
            if tag_sim > 0.0:
                reason_parts.append("shared tags")
            if scope_sim > 0.0:
                reason_parts.append("matching scopes")
            reason = f"Relevant due to: {', '.join(reason_parts)}" if reason_parts else "Weak contextual match"

            scored.append({
                "knowledge_id": k["id"],
                "title": k.get("title", ""),
                "relevance_score": score,
                "reason": reason,
            })

    # Sort by score descending, take top 10
    scored.sort(key=lambda x: x["relevance_score"], reverse=True)
    top = scored[:10]

    # Contract-based LLM flow (mock)
    result = _mock_llm_call("suggest-knowledge", {"mock_result": top})

    return SuggestKnowledgeResponse(
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        suggestions=[KnowledgeSuggestion(**s) for s in result],
        mode=LLM_MODE,
    )


# ---------------------------------------------------------------------------
# Endpoint 2: Suggest Guidelines
# ---------------------------------------------------------------------------

@router.post("/suggest-guidelines", response_model=SuggestGuidelinesResponse)
async def suggest_guidelines(
    slug: str,
    body: SuggestGuidelinesRequest,
    storage=Depends(get_storage),
):
    """Given an entity, suggest applicable guidelines.

    Contract flow: load entity -> load guidelines -> score applicability -> return suggestions.
    """
    await check_project_exists(storage, slug)

    # Load the source entity
    entity = await _load_entity_by_type(storage, slug, body.entity_type, body.entity_id)
    entity_text = _entity_text(entity)
    entity_tags = _entity_tags(entity)
    entity_scopes = _entity_scopes(entity)

    # Load active guidelines
    gl_data = await load_entity(storage, slug, "guidelines")
    guidelines = [g for g in gl_data.get("guidelines", []) if g.get("status") == "ACTIVE"]

    scored: list[dict] = []
    for g in guidelines:
        text_sim = _token_overlap(entity_text, _entity_text(g))
        tag_sim = _tag_overlap(entity_tags, _entity_tags(g))
        scope_sim = _scope_overlap(entity_scopes, g.get("scope", ""))

        # Guidelines with scope "global" get a baseline boost
        global_boost = 0.15 if g.get("scope", "") == "global" else 0.0

        # Weight boost for "must" guidelines
        weight = g.get("weight", "should")
        weight_boost = 0.1 if weight == "must" else 0.0

        score = _combined_score(text_sim, tag_sim, scope_sim) + global_boost + weight_boost
        score = round(min(1.0, score), 3)

        if score > 0.05:
            reason_parts = []
            if scope_sim > 0.0:
                reason_parts.append("scope match")
            if text_sim > 0.1:
                reason_parts.append("content relevance")
            if tag_sim > 0.0:
                reason_parts.append("tag overlap")
            if global_boost > 0:
                reason_parts.append("global scope")
            if weight_boost > 0:
                reason_parts.append("mandatory guideline")
            reason = f"Applicable: {', '.join(reason_parts)}" if reason_parts else "Weak match"

            scored.append({
                "guideline_id": g["id"],
                "title": g.get("title", ""),
                "weight": weight,
                "relevance_score": score,
                "reason": reason,
            })

    scored.sort(key=lambda x: x["relevance_score"], reverse=True)
    top = scored[:10]

    result = _mock_llm_call("suggest-guidelines", {"mock_result": top})

    return SuggestGuidelinesResponse(
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        suggestions=[GuidelineSuggestion(**s) for s in result],
        mode=LLM_MODE,
    )


# ---------------------------------------------------------------------------
# Endpoint 3: Suggest Acceptance Criteria
# ---------------------------------------------------------------------------

@router.post("/suggest-ac", response_model=SuggestACResponse)
async def suggest_ac(
    slug: str,
    body: SuggestACRequest,
    storage=Depends(get_storage),
):
    """Given a task, suggest acceptance criteria from AC templates.

    Contract flow: load task -> load templates -> match by scope/tags/content -> instantiate -> return.
    """
    await check_project_exists(storage, slug)

    # Load the task
    tracker = await load_entity(storage, slug, "tracker")
    task = find_item_or_404(tracker.get("tasks", []), body.task_id, "Task")
    task_text = _entity_text(task)
    task_scopes = _entity_scopes(task)
    task_tags = task.get("tags", [])

    # Load active AC templates
    ac_data = await load_entity(storage, slug, "ac_templates")
    templates = [t for t in ac_data.get("ac_templates", []) if t.get("status") == "ACTIVE"]

    scored: list[dict] = []
    for tmpl in templates:
        text_sim = _token_overlap(task_text, _entity_text(tmpl))
        tag_sim = _tag_overlap(task_tags, tmpl.get("tags", []))
        scope_sim = _scope_overlap(task_scopes, tmpl.get("scopes", []))
        score = _combined_score(text_sim, tag_sim, scope_sim)

        # Boost score based on task type matching template category
        task_type = task.get("type", "feature")
        tmpl_category = tmpl.get("category", "")
        type_boost = 0.0
        if task_type == "bug" and tmpl_category in ("reliability", "data-integrity"):
            type_boost = 0.1
        elif task_type == "feature" and tmpl_category in ("functionality", "ux"):
            type_boost = 0.1
        score = round(min(1.0, score + type_boost), 3)

        if score > 0.03:
            # Generate a suggested criterion by using template as-is
            # (in production, LLM would instantiate with context-aware params)
            suggested = tmpl.get("template", "")
            # Try to fill any parameter placeholders with defaults
            for p in tmpl.get("parameters", []):
                name = p.get("name", "")
                default = p.get("default", "")
                if name and default:
                    suggested = suggested.replace(f"{{{name}}}", str(default))

            reason_parts = []
            if text_sim > 0.1:
                reason_parts.append("content relevance")
            if tag_sim > 0.0:
                reason_parts.append("tag match")
            if scope_sim > 0.0:
                reason_parts.append("scope match")
            if type_boost > 0:
                reason_parts.append(f"task type '{task_type}' matches category")
            reason = f"Suggested: {', '.join(reason_parts)}" if reason_parts else "Category match"

            scored.append({
                "template_id": tmpl["id"],
                "title": tmpl.get("title", ""),
                "category": tmpl_category,
                "suggested_criterion": suggested,
                "relevance_score": score,
                "reason": reason,
            })

    scored.sort(key=lambda x: x["relevance_score"], reverse=True)
    top = scored[:10]

    result = _mock_llm_call("suggest-ac", {"mock_result": top})

    return SuggestACResponse(
        task_id=body.task_id,
        suggestions=[ACSuggestion(**s) for s in result],
        mode=LLM_MODE,
    )


# ---------------------------------------------------------------------------
# Endpoint 4: Evaluate Lesson
# ---------------------------------------------------------------------------

@router.post("/evaluate-lesson", response_model=EvaluateLessonResponse)
async def evaluate_lesson(
    slug: str,
    body: EvaluateLessonRequest,
    storage=Depends(get_storage),
):
    """Given a lesson, recommend whether to promote to knowledge or guideline.

    Contract flow: load lesson -> analyze severity/category/content -> recommend promotion target.
    """
    await check_project_exists(storage, slug)

    # Load the lesson
    lessons_data = await load_entity(storage, slug, "lessons")
    lesson = find_item_or_404(lessons_data.get("lessons", []), body.lesson_id, "Lesson")

    # Check if already promoted
    already_guideline = lesson.get("promoted_to_guideline")
    already_knowledge = lesson.get("promoted_to_knowledge")

    # Heuristic decision logic
    category = lesson.get("category", "")
    severity = lesson.get("severity", "minor")
    detail = lesson.get("detail", "")
    title = lesson.get("title", "")

    # Categories that lean toward guidelines
    guideline_categories = {"pattern-discovered", "process-improvement", "mistake-avoided"}
    # Categories that lean toward knowledge
    knowledge_categories = {"architecture-lesson", "tool-insight", "market-insight", "decision-validated"}

    target: str = "none"
    confidence: float = 0.0
    reason: str = ""
    suggested_scope: str = ""
    suggested_category: str = ""
    suggested_weight: str = "should"

    if already_guideline or already_knowledge:
        target = "none"
        confidence = 1.0
        promoted_to = already_guideline or already_knowledge
        reason = f"Already promoted to {promoted_to}"
        suggested_category = "technical-context"
    elif severity == "critical":
        if category in guideline_categories:
            target = "guideline"
            confidence = 0.85
            reason = f"Critical {category} lesson should become a mandatory guideline"
            suggested_weight = "must"
        else:
            target = "knowledge"
            confidence = 0.80
            reason = f"Critical {category} lesson contains valuable domain knowledge"
            suggested_category = "technical-context"
    elif severity == "important":
        if category in guideline_categories:
            target = "guideline"
            confidence = 0.65
            reason = f"Important {category} lesson is a good candidate for a guideline"
            suggested_weight = "should"
        elif category in knowledge_categories:
            target = "knowledge"
            confidence = 0.70
            reason = f"Important {category} lesson should be preserved as knowledge"
            suggested_category = _map_lesson_to_knowledge_category(category)
        else:
            target = "knowledge"
            confidence = 0.50
            reason = "Important lesson with moderate knowledge value"
            suggested_category = "technical-context"
    else:
        # minor severity
        if len(detail) > 200:
            target = "knowledge"
            confidence = 0.35
            reason = "Minor lesson with substantial detail worth preserving"
            suggested_category = "technical-context"
        else:
            target = "none"
            confidence = 0.60
            reason = "Minor lesson with limited detail; not recommended for promotion"
            suggested_category = "technical-context"

    # Determine scope from lesson metadata
    suggested_scope = lesson.get("applies_to", "") or "global"

    recommendation = PromotionRecommendation(
        target=target,
        confidence=round(confidence, 2),
        reason=reason,
        suggested_scope=suggested_scope,
        suggested_category=suggested_category,
        suggested_weight=suggested_weight,
    )

    result = _mock_llm_call("evaluate-lesson", {"mock_result": recommendation.model_dump()})

    return EvaluateLessonResponse(
        lesson_id=body.lesson_id,
        lesson_title=lesson.get("title", ""),
        recommendation=PromotionRecommendation(**result),
        mode=LLM_MODE,
    )


def _map_lesson_to_knowledge_category(lesson_category: str) -> str:
    """Map lesson category to a knowledge category."""
    mapping = {
        "architecture-lesson": "architecture",
        "tool-insight": "technical-context",
        "market-insight": "business-context",
        "decision-validated": "domain-rules",
        "decision-reversed": "domain-rules",
        "pattern-discovered": "code-patterns",
        "process-improvement": "technical-context",
        "mistake-avoided": "technical-context",
    }
    return mapping.get(lesson_category, "technical-context")


# ---------------------------------------------------------------------------
# Endpoint 5: Assess Impact
# ---------------------------------------------------------------------------

@router.post("/assess-impact", response_model=AssessImpactResponse)
async def assess_impact(
    slug: str,
    body: AssessImpactRequest,
    storage=Depends(get_storage),
):
    """Given a knowledge change, assess impact on linked entities.

    Contract flow: load knowledge -> find linked entities -> score impact level -> return assessment.
    """
    await check_project_exists(storage, slug)

    # Load the knowledge item
    kn_data = await load_entity(storage, slug, "knowledge")
    knowledge = find_item_or_404(kn_data.get("knowledge", []), body.knowledge_id, "Knowledge")

    kn_text = _entity_text(knowledge)
    kn_scopes = _entity_scopes(knowledge)
    kn_tags = _entity_tags(knowledge)

    impact_items: list[dict] = []

    # Check tasks
    tracker = await load_entity(storage, slug, "tracker")
    for t in tracker.get("tasks", []):
        # Skip completed tasks — they are already done
        if t.get("status") == "DONE":
            continue
        # Check direct reference
        directly_linked = body.knowledge_id in t.get("knowledge_ids", [])
        text_sim = _token_overlap(kn_text, _entity_text(t))
        scope_sim = _scope_overlap(kn_scopes, _entity_scopes(t))

        if directly_linked or text_sim > 0.2 or scope_sim > 0.3:
            level = _impact_level(directly_linked, text_sim, scope_sim)
            reason_parts = []
            if directly_linked:
                reason_parts.append("directly linked")
            if text_sim > 0.2:
                reason_parts.append(f"content similarity ({text_sim:.0%})")
            if scope_sim > 0.3:
                reason_parts.append("scope overlap")
            impact_items.append({
                "entity_type": "task",
                "entity_id": t["id"],
                "name": t.get("name", ""),
                "impact_level": level,
                "reason": "; ".join(reason_parts),
            })

    # Check ideas
    ideas_data = await load_entity(storage, slug, "ideas")
    for i in ideas_data.get("ideas", []):
        directly_linked = body.knowledge_id in i.get("knowledge_ids", [])
        text_sim = _token_overlap(kn_text, _entity_text(i))

        if directly_linked or text_sim > 0.25:
            level = _impact_level(directly_linked, text_sim, 0.0)
            reason_parts = []
            if directly_linked:
                reason_parts.append("directly linked")
            if text_sim > 0.25:
                reason_parts.append(f"content similarity ({text_sim:.0%})")
            impact_items.append({
                "entity_type": "idea",
                "entity_id": i["id"],
                "name": i.get("title", ""),
                "impact_level": level,
                "reason": "; ".join(reason_parts),
            })

    # Check objectives
    obj_data = await load_entity(storage, slug, "objectives")
    for o in obj_data.get("objectives", []):
        directly_linked = body.knowledge_id in o.get("knowledge_ids", [])
        text_sim = _token_overlap(kn_text, _entity_text(o))

        if directly_linked or text_sim > 0.25:
            level = _impact_level(directly_linked, text_sim, 0.0)
            reason_parts = []
            if directly_linked:
                reason_parts.append("directly linked")
            if text_sim > 0.25:
                reason_parts.append(f"content similarity ({text_sim:.0%})")
            impact_items.append({
                "entity_type": "objective",
                "entity_id": o["id"],
                "name": o.get("title", ""),
                "impact_level": level,
                "reason": "; ".join(reason_parts),
            })

    # Check linked_entities on the knowledge item itself
    for le in knowledge.get("linked_entities", []):
        eid = le.get("entity_id", "")
        etype = le.get("entity_type", "")
        # Avoid duplicates already found above
        already = any(it["entity_id"] == eid for it in impact_items)
        if not already and eid:
            relation = le.get("relation", "reference")
            level = "high" if relation in ("required", "depends_on") else "medium"
            impact_items.append({
                "entity_type": etype,
                "entity_id": eid,
                "name": "",
                "impact_level": level,
                "reason": f"Linked with relation '{relation}'",
            })

    # Sort by impact level priority
    level_priority = {"high": 0, "medium": 1, "low": 2}
    impact_items.sort(key=lambda x: level_priority.get(x["impact_level"], 3))

    # Summary
    high_count = sum(1 for it in impact_items if it["impact_level"] == "high")
    med_count = sum(1 for it in impact_items if it["impact_level"] == "medium")
    low_count = sum(1 for it in impact_items if it["impact_level"] == "low")
    summary = (
        f"Knowledge '{knowledge.get('title', body.knowledge_id)}' change affects "
        f"{len(impact_items)} entities: {high_count} high, {med_count} medium, {low_count} low impact."
    )

    result = _mock_llm_call("assess-impact", {"mock_result": {
        "impact_items": impact_items,
        "summary": summary,
    }})

    return AssessImpactResponse(
        knowledge_id=body.knowledge_id,
        knowledge_title=knowledge.get("title", ""),
        total_affected=len(result["impact_items"]),
        impact_items=[ImpactItem(**it) for it in result["impact_items"]],
        summary=result["summary"],
        mode=LLM_MODE,
    )


def _impact_level(directly_linked: bool, text_sim: float, scope_sim: float) -> str:
    """Determine impact level from signals."""
    if directly_linked:
        return "high"
    combined = text_sim * 0.6 + scope_sim * 0.4
    if combined > 0.5:
        return "high"
    if combined > 0.25:
        return "medium"
    return "low"
