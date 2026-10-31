import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, diagram_access
from app.db.session import get_db
from app.models import Diagram, DiagramMessage, DiagramVersion, Project, Template, User
from app.schemas.diagram import (
    DiagramCreate,
    DiagramListItem,
    DiagramMessageCreate,
    DiagramMessageOut,
    DiagramOut,
    DiagramUpdate,
    ProjectCreate,
    ProjectOut,
    ShareUpdate,
    TemplateOut,
    VersionOut,
)

router = APIRouter(tags=["diagrams"])


# --------------------------------------------------------------------------
# Projects
# --------------------------------------------------------------------------


@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Project).where(Project.owner_id == user.id).order_by(Project.created_at.desc())
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


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deletes every diagram in the project too (cascade="all, delete-orphan"
    on Project.diagrams) — the caller is responsible for warning about that,
    this endpoint doesn't ask twice."""
    stmt = select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    project = (await db.execute(stmt)).scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found.")
    await db.delete(project)
    await db.commit()


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


def _out(diagram: Diagram, access: str) -> DiagramOut:
    """DiagramOut.model_validate reads `access` off the ORM object like every
    other field, and Diagram has no such column — so it always lands on the
    schema's own default ("owner") unless overridden here. Every route that
    a shared viewer/editor can reach needs to override it explicitly, or
    they'd see themselves as the owner of someone else's diagram."""
    return DiagramOut.model_validate(diagram).model_copy(update={"access": access})


@router.get("/diagrams/{diagram_id}", response_model=DiagramOut)
async def get_diagram(
    diagram_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    diagram, access = await diagram_access(db, user, diagram_id)
    return _out(diagram, access)


@router.patch("/diagrams/{diagram_id}", response_model=DiagramOut)
async def update_diagram(
    diagram_id: uuid.UUID,
    payload: DiagramUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    diagram, access = await diagram_access(db, user, diagram_id, require_edit=True)

    if payload.title is not None:
        diagram.title = payload.title
    if payload.tags is not None:
        diagram.tags = payload.tags
    if payload.is_favorite is not None:
        diagram.is_favorite = payload.is_favorite
    if "project_id" in payload.model_fields_set:
        # Which project a diagram lives in is the owner's own filing, not
        # something a shared editor should be able to move out from under
        # them — everything else in this route is fair game for an editor.
        if access != "owner":
            raise HTTPException(403, "Only the owner can move a diagram between projects.")
        if payload.project_id is not None:
            owned = (
                await db.execute(
                    select(Project.id).where(
                        Project.id == payload.project_id, Project.owner_id == user.id
                    )
                )
            ).scalar_one_or_none()
            if owned is None:
                raise HTTPException(404, "Project not found.")
        diagram.project_id = payload.project_id

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
    return _out(diagram, access)


@router.delete("/diagrams/{diagram_id}", status_code=204)
async def delete_diagram(
    diagram_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    # Deliberately not diagram_access: deleting is an owner-only action even
    # for someone the diagram was shared with as an editor.
    stmt = select(Diagram).where(Diagram.id == diagram_id, Diagram.owner_id == user.id)
    diagram = (await db.execute(stmt)).scalar_one_or_none()
    if not diagram:
        raise HTTPException(404, "Diagram not found.")
    await db.delete(diagram)
    await db.commit()


# --------------------------------------------------------------------------
# Sharing — one link, one role, per diagram
# --------------------------------------------------------------------------


@router.post("/diagrams/{diagram_id}/share", response_model=DiagramOut)
async def share_diagram(
    diagram_id: uuid.UUID,
    payload: ShareUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Turns sharing on (or changes the role of an existing share) — owner
    only. Reuses the existing token if the diagram is already shared, so
    flipping Viewer <-> Editor doesn't invalidate a link people already
    have."""
    stmt = select(Diagram).where(Diagram.id == diagram_id, Diagram.owner_id == user.id)
    diagram = (await db.execute(stmt)).scalar_one_or_none()
    if not diagram:
        raise HTTPException(404, "Diagram not found.")
    if not diagram.share_token:
        diagram.share_token = secrets.token_urlsafe(24)
    diagram.share_role = payload.role.value
    await db.commit()
    await db.refresh(diagram)
    return _out(diagram, "owner")


@router.delete("/diagrams/{diagram_id}/share", response_model=DiagramOut)
async def unshare_diagram(
    diagram_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revokes the link — owner only. Clears the token itself, not just the
    role, so a previously-shared link can never be reactivated by guessing;
    sharing again issues a fresh one."""
    stmt = select(Diagram).where(Diagram.id == diagram_id, Diagram.owner_id == user.id)
    diagram = (await db.execute(stmt)).scalar_one_or_none()
    if not diagram:
        raise HTTPException(404, "Diagram not found.")
    diagram.share_token = None
    diagram.share_role = None
    await db.commit()
    await db.refresh(diagram)
    return _out(diagram, "owner")


@router.get("/diagrams/shared/{token}", response_model=DiagramOut)
async def open_shared_diagram(
    token: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """What a share link resolves to — any signed-in account, not just the
    owner's team members. A revoked or never-valid token 404s the same way
    an unknown diagram id does."""
    stmt = select(Diagram).where(Diagram.share_token == token)
    diagram = (await db.execute(stmt)).scalar_one_or_none()
    if not diagram or not diagram.share_role:
        raise HTTPException(404, "That link isn't valid anymore.")
    # The owner following their own share link still gets full access, not
    # a downgrade to whatever role they last set it to.
    access = "owner" if diagram.owner_id == user.id else diagram.share_role
    return _out(diagram, access)


# --------------------------------------------------------------------------
# Versions
# --------------------------------------------------------------------------


@router.get("/diagrams/{diagram_id}/versions", response_model=list[VersionOut])
async def list_versions(
    diagram_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await diagram_access(db, user, diagram_id)  # 404s unless owned or shared
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
    diagram, access = await diagram_access(db, user, diagram_id, require_edit=True)
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
    return _out(diagram, access)


# --------------------------------------------------------------------------
# Chat messages — the Copilot thread attached to a diagram
# --------------------------------------------------------------------------


@router.get("/diagrams/{diagram_id}/messages", response_model=list[DiagramMessageOut])
async def list_messages(
    diagram_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await diagram_access(db, user, diagram_id)  # 404s unless owned or shared
    stmt = (
        select(DiagramMessage)
        .where(DiagramMessage.diagram_id == diagram_id)
        .order_by(DiagramMessage.created_at)
    )
    return (await db.execute(stmt)).scalars().all()


@router.post(
    "/diagrams/{diagram_id}/messages", response_model=DiagramMessageOut, status_code=201
)
async def add_message(
    diagram_id: uuid.UUID,
    payload: DiagramMessageCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await diagram_access(db, user, diagram_id, require_edit=True)
    msg = DiagramMessage(diagram_id=diagram_id, **payload.model_dump())
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@router.delete("/diagrams/{diagram_id}/messages", status_code=204)
async def clear_messages(
    diagram_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """What /new calls — clears the chat thread, leaves the diagram itself
    untouched."""
    await diagram_access(db, user, diagram_id, require_edit=True)
    await db.execute(delete(DiagramMessage).where(DiagramMessage.diagram_id == diagram_id))
    await db.commit()


# --------------------------------------------------------------------------
# Templates
# --------------------------------------------------------------------------


@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(category: str | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(Template).order_by(Template.category, Template.name)
    if category:
        stmt = stmt.where(Template.category == category)
    return (await db.execute(stmt)).scalars().all()
