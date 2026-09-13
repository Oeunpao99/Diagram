import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.db.session import get_db
from app.layout.engine import apply_layout
from app.models import Diagram, DiagramVersion, User
from app.schemas.diagram import (
    DiagramDoc,
    DocumentationRequest,
    DocumentationResponse,
    EditRequest,
    EditResponse,
    GenerateRequest,
    GenerateResponse,
    ImprovePromptRequest,
    ImprovePromptResponse,
    LayoutRequest,
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
    if payload.diagram_id:
        owned = await db.execute(
            select(Diagram.id).where(
                Diagram.id == payload.diagram_id, Diagram.owner_id == user.id
            )
        )
        if owned.scalar_one_or_none() is None:
            raise HTTPException(404, "Diagram not found.")

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


@router.post("/validate", response_model=ValidationReport)
async def check(doc: DiagramDoc, _user: User = Depends(current_user)):
    """Runs locally — no model call, so it's free to call on every change."""
    return validate(doc)


@router.post("/layout", response_model=DiagramDoc)
async def layout(payload: LayoutRequest, _user: User = Depends(current_user)):
    """Auto arrange. Also free, also instant."""
    return apply_layout(payload.doc, payload.direction, payload.algorithm)


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
