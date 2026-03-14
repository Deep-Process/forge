"""AC Templates router — CRUD + instantiate."""

from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.dependencies import get_storage
from app.routers._helpers import (
    _get_lock,
    check_project_exists,
    emit_event,
    find_item_or_404,
    load_entity,
    next_id,
    save_entity,
)

router = APIRouter(prefix="/projects/{slug}/ac-templates", tags=["ac-templates"])

AC_CATEGORIES = Literal[
    "performance", "security", "quality", "functionality",
    "accessibility", "reliability", "data-integrity", "ux",
]


class TemplateCreate(BaseModel):
    title: str
    template: str
    category: AC_CATEGORIES
    description: str = ""
    parameters: list[dict] = []
    scopes: list[str] = []
    tags: list[str] = []
    verification_method: str = ""


class TemplateUpdate(BaseModel):
    title: str | None = None
    template: str | None = None
    description: str | None = None
    category: AC_CATEGORIES | None = None
    parameters: list[dict] | None = None
    scopes: list[str] | None = None
    tags: list[str] | None = None
    verification_method: str | None = None
    status: Literal["ACTIVE", "DEPRECATED"] | None = None


class InstantiateRequest(BaseModel):
    params: dict[str, str | int | float | bool] = {}


@router.get("")
async def list_templates(
    slug: str,
    category: str | None = None,
    scope: str | None = None,
    status: str | None = None,
    storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "ac_templates")
    templates = data.get("ac_templates", [])
    if category:
        templates = [t for t in templates if t.get("category") == category]
    if scope:
        templates = [t for t in templates if scope in t.get("scopes", [])]
    if status:
        templates = [t for t in templates if t.get("status") == status]
    return {"templates": templates, "count": len(templates)}


@router.post("", status_code=201)
async def create_template(slug: str, body: list[TemplateCreate], storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "ac_templates"):
        data = await load_entity(storage, slug, "ac_templates")
        templates = data.get("ac_templates", [])
        added = []
        for item in body:
            ac_id = next_id(templates, "AC")
            template = {
                **item.model_dump(),
                "id": ac_id,
                "status": "ACTIVE",
                "usage_count": 0,
            }
            templates.append(template)
            added.append(ac_id)
        data["ac_templates"] = templates
        await save_entity(storage, slug, "ac_templates", data)
    return {"added": added, "total": len(templates)}


@router.get("/{template_id}")
async def get_template(slug: str, template_id: str, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "ac_templates")
    return find_item_or_404(data.get("ac_templates", []), template_id, "Template")


@router.patch("/{template_id}")
async def update_template(slug: str, template_id: str, body: TemplateUpdate, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "ac_templates"):
        data = await load_entity(storage, slug, "ac_templates")
        template = find_item_or_404(data.get("ac_templates", []), template_id, "Template")
        updates = body.model_dump(exclude_none=True)
        for k, v in updates.items():
            template[k] = v
        await save_entity(storage, slug, "ac_templates", data)
    return template


@router.post("/{template_id}/instantiate")
async def instantiate_template(
    slug: str,
    template_id: str,
    body: InstantiateRequest | None = None,
    storage=Depends(get_storage),
):
    """Instantiate template with parameters."""
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "ac_templates"):
        data = await load_entity(storage, slug, "ac_templates")
        template = find_item_or_404(data.get("ac_templates", []), template_id, "Template")

        if template.get("status") != "ACTIVE":
            raise HTTPException(422, f"Template is {template.get('status')}, must be ACTIVE")

        tmpl_str = template.get("template", "")
        params = body.params if body else {}

        # Apply defaults from parameter definitions
        for p in template.get("parameters", []):
            name = p.get("name", "")
            if name and name not in params and "default" in p:
                params[name] = p["default"]

        # Substitute placeholders (single-pass to prevent injection via param values)
        def _substitute(match: re.Match) -> str:
            name = match.group(1)
            if name in params:
                return str(params[name])
            return match.group(0)  # keep unresolved

        result = re.sub(r"\{(\w+)\}", _substitute, tmpl_str)

        # Check for unresolved placeholders (only original template placeholders)
        unresolved = [
            m for m in re.findall(r"\{(\w+)\}", tmpl_str)
            if m not in params
        ]
        if unresolved:
            raise HTTPException(422, f"Missing parameters: {', '.join(set(unresolved))}")

        # Increment usage count
        template["usage_count"] = template.get("usage_count", 0) + 1
        await save_entity(storage, slug, "ac_templates", data)

    return {"template_id": template_id, "criterion": result}


@router.delete("/{template_id}")
async def remove_template(slug: str, template_id: str, request: Request, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "ac_templates"):
        data = await load_entity(storage, slug, "ac_templates")
        templates = data.get("ac_templates", [])
        template = find_item_or_404(templates, template_id, "Template")
        templates.remove(template)
        data["ac_templates"] = templates
        await save_entity(storage, slug, "ac_templates", data)
    await emit_event(request, slug, "template.removed", {"id": template_id})
    return {"removed": template_id}
