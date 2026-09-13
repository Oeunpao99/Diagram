import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.db.session import get_db
from app.models import Diagram, DiagramVersion, Project, Template, User
from app.schemas.diagram import (
    DiagramCreate,
    DiagramListItem,
    DiagramOut,
    DiagramUpdate,
    ProjectCreate,
    ProjectOut,
    TemplateOut,
    VersionOut,
)

router = APIRouter(tags=["diagrams"])


# --------------------------------------------------------------------------
# Projects
# --------------------------------------------------------------------------


@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Project)
        .where(Project.owner_id == user.id)
        .order_by(Project.created_at.desc())
    )
    return (await db.execute(stmt)).scalars().all()


@router.post("/projects", response_model=ProjectOut, status_code=201)
async def create_project(
    payload: ProjectCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    project = Project(**payload.model_dump(), owner_id=user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


# --------------------------------------------------------------------------
# Diagrams
# --------------------------------------------------------------------------


@router.get("/diagrams", response_model=list[DiagramListItem])
async def list_diagrams(
    project_id: uuid.UUID | None = None,
    favorite: bool | None = None,
    limit: int = Query(50, le=200),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Diagram)
        .where(Diagram.owner_id == user.id)
        .order_by(Diagram.updated_at.desc())
        .limit(limit)
    )
    if project_id:
        stmt = stmt.where(Diagram.project_id == project_id)
    if favorite is not None:
        stmt = stmt.where(Diagram.is_favorite == favorite)
    return (await db.execute(stmt)).scalars().all()


@router.post("/diagrams", response_model=DiagramOut, status_code=201)
async def create_diagram(
    payload: DiagramCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.project_id and not await _owns_project(db, user, payload.project_id):
        raise HTTPException(404, "Project not found.")
    diagram = Diagram(
        owner_id=user.id,
        project_id=payload.project_id,
        title=payload.title,
        diagram_type=payload.doc.diagram_type.value,
        direction=payload.doc.direction.value,
        source_prompt=payload.source_prompt,
        data=payload.doc.model_dump(mode="json"),
        tags=[],
    )
    db.add(diagram)
    await db.flush()
    db.add(
        DiagramVersion(
            diagram_id=diagram.id, version=1, origin="manual", label="Created", data=diagram.data
        )
    )
    await db.commit()
    await db.refresh(diagram)
    return diagram


async def _owns_project(db: AsyncSession, user: User, project_id: uuid.UUID) -> bool:
    stmt = select(Project.id).where(Project.id == project_id, Project.owner_id == user.id)
    return (await db.execute(stmt)).scalar_one_or_none() is not None


async def _get(db: AsyncSession, user: User, diagram_id: uuid.UUID) -> Diagram:
    """Someone else's diagram is reported as missing, not forbidden — a 403
    would confirm the id exists."""
    stmt = select(Diagram).where(Diagram.id == diagram_id, Diagram.owner_id == user.id)
    diagram = (await db.execute(stmt)).scalar_one_or_none()
    if not diagram:
        raise HTTPException(404, "Diagram not found.")
    return diagram


@router.get("/diagrams/{diagram_id}", response_model=DiagramOut)
async def get_diagram(
    diagram_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get(db, user, diagram_id)


@router.patch("/diagrams/{diagram_id}", response_model=DiagramOut)
async def update_diagram(
    diagram_id: uuid.UUID,
    payload: DiagramUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    diagram = await _get(db, user, diagram_id)

    if payload.title is not None:
        diagram.title = payload.title
    if payload.tags is not None:
        diagram.tags = payload.tags
    if payload.is_favorite is not None:
        diagram.is_favorite = payload.is_favorite

    if payload.doc is not None:
        if payload.keep_version:
            diagram.current_version += 1
            db.add(
                DiagramVersion(
                    diagram_id=diagram.id,
                    version=diagram.current_version,
                    origin="manual",
                    label=payload.version_label,
                    data=payload.doc.model_dump(mode="json"),
                )
            )
        diagram.data = payload.doc.model_dump(mode="json")
        diagram.diagram_type = payload.doc.diagram_type.value
        diagram.direction = payload.doc.direction.value

    await db.commit()
    await db.refresh(diagram)
    return diagram


@router.delete("/diagrams/{diagram_id}", status_code=204)
async def delete_diagram(
    diagram_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    diagram = await _get(db, user, diagram_id)
    await db.delete(diagram)
    await db.commit()


# --------------------------------------------------------------------------
# Versions
# --------------------------------------------------------------------------


@router.get("/diagrams/{diagram_id}/versions", response_model=list[VersionOut])
async def list_versions(
    diagram_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get(db, user, diagram_id)  # 404s unless the caller owns it
    stmt = (
        select(DiagramVersion)
        .where(DiagramVersion.diagram_id == diagram_id)
        .order_by(DiagramVersion.version.desc())
    )
    return (await db.execute(stmt)).scalars().all()


@router.post("/diagrams/{diagram_id}/versions/{version}/restore", response_model=DiagramOut)
async def restore_version(
    diagram_id: uuid.UUID,
    version: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    diagram = await _get(db, user, diagram_id)
    stmt = select(DiagramVersion).where(
        DiagramVersion.diagram_id == diagram_id, DiagramVersion.version == version
    )
    snapshot = (await db.execute(stmt)).scalar_one_or_none()
    if not snapshot:
        raise HTTPException(404, f"Version {version} not found.")

    diagram.current_version += 1
    db.add(
        DiagramVersion(
            diagram_id=diagram.id,
            version=diagram.current_version,
            origin="manual",
            label=f"Restored from v{version}",
            data=snapshot.data,
        )
    )
    diagram.data = snapshot.data
    await db.commit()
    await db.refresh(diagram)
    return diagram


# --------------------------------------------------------------------------
# Templates
# --------------------------------------------------------------------------


@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(category: str | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(Template).order_by(Template.category, Template.name)
    if category:
        stmt = stmt.where(Template.category == category)
    return (await db.execute(stmt)).scalars().all()
