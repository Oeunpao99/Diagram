import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.db.session import get_db
from app.layout.engine import apply_layout
from app.models import Diagram, DiagramVersion, User
from app.schemas.diagram import (
    AgentRequest,
    AgentResponse,
    AnalyzeImageRequest,
    DiagramDoc,
    DocumentationRequest,
    DocumentationResponse,
    EditRequest,
    EditResponse,
    GenerateIconRequest,
    GenerateIconResponse,
    GenerateRequest,
    GenerateResponse,
    ImprovePromptRequest,
    ImprovePromptResponse,
    LayoutRequest,
    RestyleTemplateRequest,
    RouteMessageRequest,
    RouteMessageResponse,
    ValidationReport,
)
from app.services import ai
from app.services.validator import validate

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/improve-prompt", response_model=ImprovePromptResponse)
async def improve_prompt(
    payload: ImprovePromptRequest,
    _user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 1: rewrite the request and say what's missing."""
    if not payload.prompt.strip():
        raise HTTPException(400, "Describe what you want to diagram.")
    try:
        return await ai.improve_prompt(db, payload.prompt, payload.diagram_type)
    except Exception as exc:
        raise HTTPException(502, f"Prompt agent failed: {exc}") from exc


# ~200KB of base64 — comfortably past a phone photo of a whiteboard at
# reasonable resolution, well short of what would make Azure's own per-image
# token cost blow out.
_MAX_IMAGE_DATA_URL = 8_000_000


@router.post("/analyze-image", response_model=ImprovePromptResponse)
async def analyze_image(
    payload: AnalyzeImageRequest,
    _user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 1, alternate form: a sketch instead of a typed description."""
    if not payload.image_data_url.startswith("data:image/"):
        raise HTTPException(400, "That doesn't look like an image.")
    if len(payload.image_data_url) > _MAX_IMAGE_DATA_URL:
        raise HTTPException(400, "That image is too large — try a smaller one.")
    try:
        return await ai.analyze_image(db, payload.image_data_url, payload.prompt)
    except Exception as exc:
        raise HTTPException(502, f"Image analysis failed: {exc}") from exc


@router.post("/generate-icon", response_model=GenerateIconResponse)
async def generate_icon(
    payload: GenerateIconRequest,
    _user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """A small SVG icon for the asset library, drawn from a description."""
    if not payload.prompt.strip():
        raise HTTPException(400, "Describe the icon you want.")
    try:
        return GenerateIconResponse(svg=await ai.generate_icon(db, payload.prompt))
    except ValueError as exc:
        # The model's own output failed the safety/shape check — a 502 (the
        # model, not the caller, did something wrong) with the specific reason.
        raise HTTPException(502, f"Icon generation failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(502, f"Icon generation failed: {exc}") from exc


@router.post("/generate", response_model=GenerateResponse)
async def generate(
    payload: GenerateRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Steps 2-7: pick a template, generate, repair, lay out, review."""
    try:
        doc, report, notes = await ai.generate_diagram(
            db,
            payload.prompt,
            payload.diagram_type,
            payload.template_slug,
            payload.direction,
        )
    except Exception as exc:
        raise HTTPException(502, f"Diagram agent failed: {exc}") from exc

    diagram_id: uuid.UUID | None = None
    if payload.save:
        diagram = Diagram(
            owner_id=user.id,
            project_id=payload.project_id,
            title=doc.title,
            diagram_type=doc.diagram_type.value,
            direction=doc.direction.value,
            source_prompt=payload.prompt,
            data=doc.model_dump(mode="json"),
            tags=[],
            current_version=1,
        )
        db.add(diagram)
        await db.flush()
        db.add(
            DiagramVersion(
                diagram_id=diagram.id,
                version=1,
                origin="generate",
                label="Generated",
                data=diagram.data,
            )
        )
        await db.commit()
        diagram_id = diagram.id

    return GenerateResponse(diagram_id=diagram_id, doc=doc, validation=report, notes=notes)


@router.post("/route", response_model=RouteMessageResponse)
async def route(
    payload: RouteMessageRequest,
    _user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """The copilot chat calls this before /edit, once a diagram already
    exists — decides whether a message is an instruction to change the
    diagram or a question/request for ideas about it, answering the latter
    directly instead of letting it fall through to /edit as a no-op change."""
    if not payload.message.strip():
        raise HTTPException(400, "Say what you'd like to know or change.")
    try:
        return await ai.route_message(db, payload.doc, payload.message)
    except Exception as exc:
        raise HTTPException(502, f"Routing failed: {exc}") from exc


async def _assert_owns(db: AsyncSession, user: User, diagram_id: uuid.UUID | None) -> None:
    """When the client says which diagram a call is about, check it's theirs —
    the id is only used to stamp the AIRun audit row, but an unchecked id
    would let one account write history onto another's diagram."""
    if diagram_id is None:
        return
    owned = await db.execute(
        select(Diagram.id).where(Diagram.id == diagram_id, Diagram.owner_id == user.id)
    )
    if owned.scalar_one_or_none() is None:
        raise HTTPException(404, "Diagram not found.")


@router.post("/agent/stream", response_class=StreamingResponse)
async def agent_stream(
    payload: AgentRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """The streaming form of /ai/agent: same decision pipeline, but progress
    is pushed to the client as Server-Sent Events at each real step so the
    chat can show what's happening as it happens.

    Events (one JSON object per `data:` line):
      {"type": "plan",   "steps": [{"id", "label"}, ...]}  one or more steps
                                                            now known — a run
                                                            can emit this more
                                                            than once (e.g. a
                                                            layout step only
                                                            becomes knowable
                                                            after earlier
                                                            steps have run)
      {"type": "step",   "id", "label"}   that step id is done, real text
      {"type": "result", "result": AgentResponse}
      {"type": "error",  "message"}
    """
    if not payload.message.strip():
        raise HTTPException(400, "Say what you'd like to know or change.")
    await _assert_owns(db, user, payload.diagram_id)

    queue: asyncio.Queue[dict[str, object] | None] = asyncio.Queue()

    async def worker() -> None:
        try:
            body = await ai.run_agent(
                db,
                payload.doc,
                payload.message,
                payload.selection,
                payload.edge_selection,
                diagram_id=payload.diagram_id,
                history=payload.history,
                on_progress=lambda event: queue.put_nowait(event),
            )
            queue.put_nowait({"type": "result", "result": body.model_dump(mode="json")})
        except Exception as exc:
            queue.put_nowait({"type": "error", "message": f"Agent failed: {exc}"})
        finally:
            queue.put_nowait(None)

    task = asyncio.create_task(worker())

    async def stream() -> object:
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            task.cancel()

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/agent", response_model=AgentResponse)
async def agent(
    payload: AgentRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """The copilot chat's front door once a diagram exists.

    One call decides between answering the question, applying a precise list
    of tool calls to the document, and handing off to the whole-document edit
    agent — see ai.run_agent. Supersedes /route + /edit as a pair; both remain
    for callers that want one specific half.
    """
    if not payload.message.strip():
        raise HTTPException(400, "Say what you'd like to know or change.")
    await _assert_owns(db, user, payload.diagram_id)
    try:
        return await ai.run_agent(
            db,
            payload.doc,
            payload.message,
            payload.selection,
            payload.edge_selection,
            diagram_id=payload.diagram_id,
            history=payload.history,
        )
    except Exception as exc:
        raise HTTPException(502, f"Agent failed: {exc}") from exc


@router.post("/edit", response_model=EditResponse)
async def edit(
    payload: EditRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 4 of the MVP: tell the AI what to change, it edits in place."""
    if not payload.instruction.strip():
        raise HTTPException(400, "Say what you'd like to change.")

    # Optional: when the client says which diagram this is, check the caller
    # owns it and stamp the AIRun row so per-diagram history actually works.
    await _assert_owns(db, user, payload.diagram_id)

    try:
        return await ai.edit_diagram(
            db,
            payload.doc,
            payload.instruction,
            payload.selection,
            payload.relayout,
            diagram_id=payload.diagram_id,
        )
    except Exception as exc:
        raise HTTPException(502, f"Edit agent failed: {exc}") from exc


@router.post("/restyle-template", response_model=EditResponse)
async def restyle_template(
    payload: RestyleTemplateRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reorganize the open diagram to follow a template's structure, keeping
    the user's own content — what the toolbar's Template menu calls once a
    diagram already has content (as opposed to loading a template's static
    example onto a blank canvas, which is a plain client-side swap)."""
    await _assert_owns(db, user, payload.diagram_id)
    try:
        return await ai.restyle_to_template(
            db, payload.doc, payload.template_slug, diagram_id=payload.diagram_id
        )
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Restyle failed: {exc}") from exc


@router.post("/validate", response_model=ValidationReport)
async def check(doc: DiagramDoc, _user: User = Depends(current_user)):
    """Runs locally — no model call, so it's free to call on every change."""
    return validate(doc)


@router.post("/layout", response_model=DiagramDoc)
async def layout(payload: LayoutRequest, _user: User = Depends(current_user)):
    """Auto arrange. Also free, also instant."""
    return apply_layout(payload.doc, payload.direction, payload.algorithm, payload.width, payload.height)


@router.post("/documentation", response_model=DocumentationResponse)
async def documentation(
    payload: DocumentationRequest,
    _user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await ai.generate_documentation(db, payload.doc, payload.audience, payload.language)
    except Exception as exc:
        raise HTTPException(502, f"Documentation failed: {exc}") from exc


@router.post("/explain")
async def explain(
    doc: DiagramDoc,
    _user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return {"text": await ai.explain_diagram(db, doc)}
    except Exception as exc:
        raise HTTPException(502, f"Explain failed: {exc}") from exc
