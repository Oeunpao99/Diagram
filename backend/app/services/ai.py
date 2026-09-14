"""Agent orchestration.

The pipeline from your architecture sketch, in code:

    prompt -> prompt agent -> template agent -> diagram agent
           -> validator -> layout engine -> canvas
"""

from __future__ import annotations

import json
import re
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.layout.engine import apply_layout, place_new_nodes
from app.models import AIRun, Template
from app.schemas.diagram import (
    AgentAction,
    AgentResponse,
    DiagramDoc,
    DiagramType,
    Direction,
    DocumentationResponse,
    EditResponse,
    ImprovePromptResponse,
    RouteMessageResponse,
    ValidationReport,
)
from app.services import agent_tools, prompts
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
        f"User request:\n{prompt}\n\nAvailable templates (slug — name — when to use):\n{catalogue}"
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


# Belt-and-suspenders: the icon is rendered via <img src="data:image/svg+xml,...">
# on the frontend, which already refuses to execute script content embedded in
# an image-sourced SVG — browsers just don't run it. This strips it anyway
# rather than leaning on that alone, and rejects anything that still looks
# like more than one plain icon shape.
_SVG_TAG = re.compile(r"<svg\b[^>]*>.*?</svg>", re.IGNORECASE | re.DOTALL)
_UNSAFE_SVG = re.compile(
    r"<script\b|<foreignObject\b|\bon[a-z]+\s*=|\bhref\s*=|\bxlink:href\s*=",
    re.IGNORECASE,
)


def _clean_svg(text: str) -> str:
    match = _SVG_TAG.search(text)
    if not match:
        raise ValueError("Model did not return an <svg> element.")
    svg = match.group(0)
    if _UNSAFE_SVG.search(svg):
        raise ValueError("Model's SVG contained a disallowed tag or attribute.")
    if len(svg) > 20_000:
        raise ValueError("Model's SVG was implausibly large for an icon.")
    # The frontend loads this as a standalone image resource
    # (<img src="data:image/svg+xml,...">), not pasted inline into the page.
    # Without its own xmlns, that's not a self-contained document and browsers
    # render nothing — no broken-image icon, just silently blank. The system
    # prompt asks for it, but don't depend on the model remembering.
    if "xmlns=" not in svg[: svg.index(">") + 1]:
        svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
    return svg


async def generate_icon(db: AsyncSession, prompt: str) -> str:
    if not prompt.strip():
        raise ValueError("Describe the icon you want.")
    try:
        result = await complete(
            system=prompts.GENERATE_ICON_SYSTEM,
            user=prompt,
            max_tokens=2000,
            expect_json=False,
        )
        svg = _clean_svg(result.text)
    except Exception as exc:
        await _log(db, "icon", None, prompt, error=str(exc))
        raise
    await _log(db, "icon", result, prompt, summary=svg[:500])
    return svg


async def analyze_image(
    db: AsyncSession,
    image_data_url: str,
    prompt: str = "",
) -> ImprovePromptResponse:
    """A sketch or screenshot stands in for the typed description: same
    output shape as improve_prompt, so the rest of the pipeline — the
    analysis card, Generate Diagram — doesn't need to know which one ran."""
    catalogue = await _template_catalogue(db)
    user = f"Available templates (slug — name — when to use):\n{catalogue}"
    if prompt.strip():
        user = f"Context from the user: {prompt}\n\n{user}"

    try:
        result = await complete(
            system=prompts.ANALYZE_IMAGE_SYSTEM,
            user=user,
            model=settings.azure_openai_vision_deployment,
            max_tokens=4000,
            image_data_url=image_data_url,
        )
    except Exception as exc:
        await _log(db, "analyze_image", None, prompt or "(image)", error=str(exc))
        raise

    await _log(db, "analyze_image", result, prompt or "(image)")
    data = result.data
    return ImprovePromptResponse(
        original=prompt or "(image)",
        improved=data.get("improved", "Could not make out a diagram in that image."),
        missing_information=data.get("missing_information", []) or [],
        recommended_type=_safe_type(data.get("recommended_type"), None),
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
    return "\n".join(f"- {t.slug} — {t.name} — {t.description or t.diagram_type}" for t in rows)


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
        summary=f"{len(doc.nodes)} nodes, {len(doc.edges)} edges, {len(report.issues)} issues",
    )
    return doc, report, notes


def _algorithm_for(doc: DiagramDoc) -> str:
    if doc.diagram_type == DiagramType.swimlane or (doc.lanes and len(doc.lanes) > 1):
        return "swimlane"
    return "layered"


# A direct ask for relayout ("improve the layout", "fix the crossing
# connectors") is exactly the kind of instruction the edit model tends to
# misread — it owns content, not position, so given a positioning request it
# can go looking for *something* to change and grab the wrong thing instead
# (recolouring a node, say) rather than reporting "nothing to change here,
# just recompute the geometry". Catching the obvious phrasings here doesn't
# depend on the model getting that distinction right.
_RELAYOUT_HINTS = re.compile(
    r"\b(layout|re-?layout|rearrange|re-?organi[sz]e|reflow|reposition"
    r"|crossing|overlap(?:ping)?|messy|tidy|clean.?up|spread.?out|auto.?arrange)\b",
    re.IGNORECASE,
)


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
    # `relayout` is a client override (nothing currently sends true); the
    # keyword check is a safety net for the phrasings a positioning request
    # obviously uses; the model's own "needs_relayout" read catches ones that
    # don't (e.g. "these two should swap sides"). Either way, more than a
    # couple of new nodes reshapes the flow enough that a full layout beats
    # guessing at placement one at a time.
    if (
        relayout
        or bool(payload.get("needs_relayout"))
        or _RELAYOUT_HINTS.search(instruction)
        or len(new_nodes) > 2
    ):
        apply_layout(updated, updated.direction, _algorithm_for(updated))
    elif new_nodes:
        place_new_nodes(updated, {n.id for n in new_nodes})

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


# --------------------------------------------------------------------------
# 5. The agent — one chat message in, an answer or a set of applied actions out
# --------------------------------------------------------------------------


def _slim(doc: DiagramDoc) -> str:
    """The doc as the model sees it. Coordinates are dropped: they cost tokens
    and tempt it to move things, and placement isn't its job either way."""
    return doc.model_dump_json(exclude={"nodes": {"__all__": {"position", "size"}}})


async def run_agent(
    db: AsyncSession,
    doc: DiagramDoc,
    message: str,
    selection: list[str] | None = None,
    edge_selection: list[str] | None = None,
    diagram_id: uuid.UUID | None = None,
) -> AgentResponse:
    """The copilot chat's front door once a diagram exists.

    One model call decides between three outcomes: answer the question
    (`ask`), apply a precise list of tool calls (`act`), or hand off to the
    whole-document edit agent for something structural (`rewrite`). Runs on
    the fast model — it sits in front of every chat message, and the tool
    calls it emits are checked in Python before anything is applied.
    """
    selection = selection or []
    edge_selection = edge_selection or []

    user = prompts.agent_user_prompt(_slim(doc), message, selection, edge_selection)
    try:
        result = await complete(
            system=prompts.agent_system(agent_tools.TOOL_CATALOGUE),
            user=user,
            model=settings.fast_deployment,
            max_tokens=4000,
        )
    except Exception as exc:
        await _log(db, "agent", None, message, diagram_id=diagram_id, error=str(exc))
        raise

    data = result.data
    intent = data.get("intent")
    answer = (data.get("answer") or "").strip() or None

    if intent == "ask":
        await _log(db, "agent", result, message, diagram_id=diagram_id, summary="ask")
        return AgentResponse(
            intent="ask",
            answer=answer or "I'm not sure how to answer that — could you rephrase it?",
        )

    raw_actions = data.get("actions")
    if intent != "act" or not isinstance(raw_actions, list) or not raw_actions:
        # Either the model asked for a rewrite outright, or it said "act" and
        # gave nothing usable. Both are better served by the whole-document
        # edit agent — which validates its own output — than by guessing.
        await _log(db, "agent", result, message, diagram_id=diagram_id, summary="rewrite")
        edited = await edit_diagram(db, doc, message, selection, diagram_id=diagram_id)
        return AgentResponse(
            intent="rewrite",
            answer=answer,
            doc=edited.doc,
            changes=edited.changes,
            validation=edited.validation,
        )

    calls = [
        AgentAction(tool=str(item.get("tool", "")), args=item.get("args") or {})
        for item in raw_actions
        if isinstance(item, dict)
    ]
    outcome = agent_tools.apply_tools(doc, calls, selection)

    if outcome.touched_doc:
        doc, repair_notes = repair(doc)
        outcome.warnings += repair_notes
        _settle_layout(doc, outcome)

    await _log(
        db,
        "agent",
        result,
        message,
        diagram_id=diagram_id,
        summary="act: " + "; ".join(outcome.changes)[:900],
    )
    return AgentResponse(
        intent="act",
        answer=answer,
        doc=doc if outcome.touched_doc else None,
        changes=outcome.changes,
        warnings=outcome.warnings,
        client_actions=outcome.client_actions,
        validation=validate(doc) if outcome.touched_doc else None,
    )


def _settle_layout(doc: DiagramDoc, outcome: agent_tools.ToolOutcome) -> None:
    """Give the changed document its geometry back.

    A full relayout discards every position the user placed by hand, so it
    only runs when something actually asked for it — a direction change, a
    page fit, an explicit "tidy this up", or enough new nodes that the old
    arrangement no longer describes the flow. Otherwise new nodes are slotted
    in beside what they connect to and nothing else moves.
    """
    page = outcome.page
    if page == "clear":
        for key in ("page_x", "page_y", "page_width", "page_height", "page_preset"):
            doc.meta.pop(key, None)
        apply_layout(doc, doc.direction, _algorithm_for(doc))
        return
    if isinstance(page, tuple):
        apply_layout(doc, doc.direction, _algorithm_for(doc), page[0], page[1])
        return
    if outcome.relayout or len(outcome.new_node_ids) > 2:
        apply_layout(doc, doc.direction, _algorithm_for(doc))
        return
    place_new_nodes(doc, outcome.new_node_ids)


async def route_message(db: AsyncSession, doc: DiagramDoc, message: str) -> RouteMessageResponse:
    """The copilot chat's front door once a diagram exists: one message in,
    a decision out — modify (falls through to the edit pipeline) or ask
    (answered right here, diagram untouched). Runs on the fast model since
    it sits in front of every chat message, edit or not."""
    user = (
        f"User message:\n{message}\n\n"
        f"Diagram:\n{doc.model_dump_json(exclude={'nodes': {'__all__': {'position', 'size'}}})}"
    )
    try:
        result = await complete(
            system=prompts.ROUTE_MESSAGE_SYSTEM,
            user=user,
            model=settings.fast_deployment,
            max_tokens=1500,
        )
    except Exception as exc:
        await _log(db, "route", None, message, error=str(exc))
        raise

    await _log(db, "route", result, message)
    data = result.data
    intent = data.get("intent")
    if intent not in ("modify", "ask"):
        intent = "modify"  # An unparseable steer defaults to the pipeline
        # that already validates its own output, rather than surfacing a
        # made-up answer as if the model had actually looked at the diagram.
    answer = (data.get("answer") or "").strip() if intent == "ask" else None
    if intent == "ask" and not answer:
        answer = "I'm not sure how to answer that — could you rephrase it?"
    return RouteMessageResponse(intent=intent, answer=answer)
