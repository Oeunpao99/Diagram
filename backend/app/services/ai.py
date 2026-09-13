"""Agent orchestration.

The pipeline from your architecture sketch, in code:

    prompt -> prompt agent -> template agent -> diagram agent
           -> validator -> layout engine -> canvas
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.layout.engine import apply_layout
from app.models import AIRun, Template
from app.schemas.diagram import (
    DiagramDoc,
    DiagramType,
    Direction,
    DocumentationResponse,
    EditResponse,
    ImprovePromptResponse,
    ValidationReport,
)
from app.services import prompts
from app.services.llm import LLMResult, complete
from app.services.validator import validate


async def _log(
    db: AsyncSession,
    kind: str,
    result: LLMResult | None,
    prompt: str,
    diagram_id: uuid.UUID | None = None,
    error: str | None = None,
    summary: str | None = None,
) -> None:
    db.add(
        AIRun(
            diagram_id=diagram_id,
            kind=kind,
            model=result.model if result else settings.azure_openai_deployment,
            prompt=prompt[:8000],
            response_summary=(summary or (result.text[:1000] if result else None)),
            input_tokens=result.input_tokens if result else 0,
            output_tokens=result.output_tokens if result else 0,
            latency_ms=result.latency_ms if result else 0,
            ok=error is None,
            error=error,
        )
    )
    await db.commit()


# --------------------------------------------------------------------------
# 1. Prompt agent
# --------------------------------------------------------------------------


async def improve_prompt(
    db: AsyncSession,
    prompt: str,
    diagram_type: DiagramType | None = None,
) -> ImprovePromptResponse:
    catalogue = await _template_catalogue(db)
    user = (
        f"User request:\n{prompt}\n\n"
        f"Available templates (slug — name — when to use):\n{catalogue}"
    )
    if diagram_type:
        user += f"\n\nThe user has already chosen the type: {diagram_type.value}"

    try:
        result = await complete(
            system=prompts.IMPROVE_PROMPT_SYSTEM,
            user=user,
            model=settings.fast_deployment,
            max_tokens=4000,
        )
    except Exception as exc:
        await _log(db, "improve", None, prompt, error=str(exc))
        raise

    await _log(db, "improve", result, prompt)
    data = result.data
    return ImprovePromptResponse(
        original=prompt,
        improved=data.get("improved", prompt),
        missing_information=data.get("missing_information", []) or [],
        recommended_type=_safe_type(data.get("recommended_type"), diagram_type),
        recommended_template_slug=data.get("recommended_template_slug"),
        reasoning=data.get("reasoning"),
    )


def _safe_type(value: Any, fallback: DiagramType | None) -> DiagramType:
    try:
        return DiagramType(value)
    except (ValueError, TypeError):
        return fallback or DiagramType.process_flow


async def _template_catalogue(db: AsyncSession) -> str:
    rows = (await db.execute(select(Template).limit(60))).scalars().all()
    if not rows:
        return "(none seeded yet)"
    return "\n".join(
        f"- {t.slug} — {t.name} — {t.description or t.diagram_type}" for t in rows
    )


# --------------------------------------------------------------------------
# 2 + 3. Template agent, diagram agent, then validate + lay out
# --------------------------------------------------------------------------


async def generate_diagram(
    db: AsyncSession,
    prompt: str,
    diagram_type: DiagramType | None = None,
    template_slug: str | None = None,
    direction: Direction = Direction.LR,
) -> tuple[DiagramDoc, ValidationReport, list[str]]:
    notes: list[str] = []
    template_hint = None

    if template_slug:
        tpl = (
            await db.execute(select(Template).where(Template.slug == template_slug))
        ).scalar_one_or_none()
        if tpl:
            template_hint = json.dumps(tpl.data)[:6000]
            diagram_type = diagram_type or DiagramType(tpl.diagram_type)
            tpl.use_count += 1
            await db.commit()
            notes.append(f"Started from the '{tpl.name}' template.")
        else:
            notes.append(f"Template '{template_slug}' not found — generated from scratch.")

    user = prompts.generate_user_prompt(
        prompt,
        diagram_type.value if diagram_type else None,
        direction.value,
        template_hint,
    )

    try:
        result = await complete(system=prompts.GENERATE_SYSTEM, user=user)
    except Exception as exc:
        await _log(db, "generate", None, prompt, error=str(exc))
        raise

    doc = _coerce_doc(result.data, fallback_direction=direction)
    doc, repair_notes = repair(doc)
    notes += repair_notes

    apply_layout(doc, doc.direction, _algorithm_for(doc))
    report = validate(doc)

    await _log(
        db,
        "generate",
        result,
        prompt,
        summary=f"{len(doc.nodes)} nodes, {len(doc.edges)} edges, "
        f"{len(report.issues)} issues",
    )
    return doc, report, notes


def _algorithm_for(doc: DiagramDoc) -> str:
    if doc.diagram_type == DiagramType.swimlane or (doc.lanes and len(doc.lanes) > 1):
        return "swimlane"
    return "layered"


def _coerce_doc(data: dict[str, Any], fallback_direction: Direction) -> DiagramDoc:
    """Models occasionally return near-miss JSON. Nudge it into the schema."""
    data = dict(data)
    data.pop("positions", None)
    data.setdefault("direction", fallback_direction.value)

    for key in ("nodes", "edges", "lanes"):
        if not isinstance(data.get(key), list):
            data[key] = []

    for i, node in enumerate(data["nodes"]):
        node.setdefault("id", f"n{i + 1}")
        node.setdefault("label", node.get("name") or node.get("text") or f"Step {i + 1}")
        node.pop("position", None)
        node.pop("x", None)
        node.pop("y", None)
        if node.get("kind") in (None, ""):
            node["kind"] = "process"

    for i, edge in enumerate(data["edges"]):
        edge.setdefault("id", f"e{i + 1}")
        if "from" in edge:
            edge.setdefault("source", edge.pop("from"))
        if "to" in edge:
            edge.setdefault("target", edge.pop("to"))

    for i, lane in enumerate(data["lanes"]):
        lane.setdefault("id", f"lane_{i + 1}")
        lane.setdefault("order", i)

    return DiagramDoc.model_validate(data)


def repair(doc: DiagramDoc) -> tuple[DiagramDoc, list[str]]:
    """Fix the cheap problems silently instead of reporting them."""
    notes: list[str] = []

    seen: set[str] = set()
    remap: dict[str, str] = {}
    for node in doc.nodes:
        if node.id in seen:
            new_id = f"{node.id}_{len(seen)}"
            remap[node.id] = new_id
            node.id = new_id
            notes.append(f"Renamed a duplicate node id to '{new_id}'.")
        seen.add(node.id)

    valid = {n.id for n in doc.nodes}
    kept = []
    for edge in doc.edges:
        edge.source = remap.get(edge.source, edge.source)
        edge.target = remap.get(edge.target, edge.target)
        if edge.source in valid and edge.target in valid:
            kept.append(edge)
        else:
            notes.append(f"Dropped connector '{edge.id}' — it pointed at a missing node.")
    doc.edges = kept

    edge_ids: set[str] = set()
    for i, edge in enumerate(doc.edges):
        if edge.id in edge_ids:
            edge.id = f"{edge.id}_{i}"
        edge_ids.add(edge.id)

    lane_ids = {lane.id for lane in doc.lanes}
    for node in doc.nodes:
        if node.lane and node.lane not in lane_ids:
            node.lane = None
    return doc, notes


# --------------------------------------------------------------------------
# 4. Edit agent — the differentiator
# --------------------------------------------------------------------------


async def edit_diagram(
    db: AsyncSession,
    doc: DiagramDoc,
    instruction: str,
    selection: list[str],
    relayout: bool = True,
    diagram_id: uuid.UUID | None = None,
) -> EditResponse:
    # Strip coordinates before sending: they waste tokens and tempt the model
    # to move things. We re-apply the user's manual positions afterwards.
    manual = {
        n.id: (n.position.model_copy(), n.size.model_copy())
        for n in doc.nodes
        if n.position.x or n.position.y
    }
    slim = doc.model_dump(mode="json", exclude={"nodes": {"__all__": {"position", "size"}}})

    user = prompts.edit_user_prompt(json.dumps(slim), instruction, selection)
    try:
        result = await complete(system=prompts.EDIT_SYSTEM, user=user)
    except Exception as exc:
        await _log(db, "edit", None, instruction, diagram_id=diagram_id, error=str(exc))
        raise

    payload = result.data
    updated = _coerce_doc(payload.get("doc", payload), fallback_direction=doc.direction)
    updated, repair_notes = repair(updated)

    # Put the user's own positioning back for nodes that survived the edit.
    for node in updated.nodes:
        if node.id in manual:
            node.position, node.size = manual[node.id]

    new_nodes = [n for n in updated.nodes if n.id not in manual]
    if relayout or len(new_nodes) > 2:
        apply_layout(updated, updated.direction, _algorithm_for(updated))

    report = validate(updated)
    changes = list(payload.get("changes", [])) + repair_notes

    await _log(
        db,
        "edit",
        result,
        instruction,
        diagram_id=diagram_id,
        summary="; ".join(changes)[:1000],
    )
    return EditResponse(doc=updated, changes=changes, validation=report)


# --------------------------------------------------------------------------
# Documentation and narration
# --------------------------------------------------------------------------


async def generate_documentation(
    db: AsyncSession,
    doc: DiagramDoc,
    audience: str,
    language: str = "en",
) -> DocumentationResponse:
    user = (
        f"Audience: {audience}\nOutput language: {language}\n\n"
        f"Diagram:\n{doc.model_dump_json(exclude={'nodes': {'__all__': {'position', 'size'}}})}"
    )
    result = await complete(
        system=prompts.DOCUMENTATION_SYSTEM,
        user=user,
        max_tokens=6000,
        expect_json=False,
    )
    await _log(db, "docs", result, user[:2000])
    return DocumentationResponse(markdown=result.text)


async def explain_diagram(db: AsyncSession, doc: DiagramDoc) -> str:
    result = await complete(
        system=prompts.EXPLAIN_SYSTEM,
        user=doc.model_dump_json(exclude={"nodes": {"__all__": {"position", "size"}}}),
        model=settings.fast_deployment,
        max_tokens=4000,
        expect_json=False,
    )
    await _log(db, "explain", result, "explain diagram")
    return result.text
