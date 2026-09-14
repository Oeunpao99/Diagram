"""The canonical diagram contract.

Everything in the system speaks this shape: the AI returns it, the validator
checks it, the layout engine adds coordinates to it, React Flow renders it,
Postgres stores it. Change it here and nowhere else.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class NodeKind(str, Enum):
    start = "start"
    end = "end"
    process = "process"
    decision = "decision"
    document = "document"
    data = "data"
    database = "database"
    actor = "actor"
    system = "system"
    service = "service"
    queue = "queue"
    cloud = "cloud"
    note = "note"


class EdgeStyle(str, Enum):
    solid = "solid"
    dashed = "dashed"
    dotted = "dotted"
    animated = "animated"


class Direction(str, Enum):
    LR = "LR"
    RL = "RL"
    TB = "TB"
    BT = "BT"


class DiagramType(str, Enum):
    process_flow = "process_flow"
    swimlane = "swimlane"
    architecture = "architecture"
    network = "network"
    sequence = "sequence"
    er = "er"
    data_flow = "data_flow"
    org_chart = "org_chart"
    mind_map = "mind_map"


class Position(BaseModel):
    x: float = 0
    y: float = 0


class Size(BaseModel):
    width: float = 180
    height: float = 64


class Node(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    label: str
    kind: NodeKind = NodeKind.process
    description: str | None = None
    lane: str | None = Field(default=None, description="Swimlane / group id this node belongs to")
    position: Position = Field(default_factory=Position)
    size: Size = Field(default_factory=Size)
    style: dict[str, Any] = Field(default_factory=dict)
    icon: str | None = None
    image_url: str | None = None
    locked: bool = False


class Edge(BaseModel):
    id: str
    source: str
    target: str
    label: str | None = None
    style: EdgeStyle = EdgeStyle.solid
    condition: str | None = Field(default=None, description="e.g. 'approved' / 'rejected'")
    bidirectional: bool = False
    curve: str | None = Field(
        default=None,
        description="Connector shape: 'smoothstep' | 'step' | 'straight' | 'bezier'",
    )
    color: str | None = Field(default=None, description="Stroke colour, a hex string")
    width: float | None = Field(default=None, description="Stroke width in pixels")


class Lane(BaseModel):
    """A swimlane, an actor row, or an architecture tier."""

    id: str
    label: str
    order: int = 0
    color: str | None = None


class DiagramDoc(BaseModel):
    """The whole document."""

    title: str = "Untitled diagram"
    diagram_type: DiagramType = DiagramType.process_flow
    direction: Direction = Direction.LR
    summary: str | None = None
    nodes: list[Node] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)
    lanes: list[Lane] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


# --------------------------------------------------------------------------
# AI request / response envelopes
# --------------------------------------------------------------------------


class ImprovePromptRequest(BaseModel):
    prompt: str
    diagram_type: DiagramType | None = None


class ImprovePromptResponse(BaseModel):
    original: str
    improved: str
    missing_information: list[str] = Field(default_factory=list)
    recommended_type: DiagramType
    recommended_template_slug: str | None = None
    reasoning: str | None = None


class GenerateRequest(BaseModel):
    prompt: str
    diagram_type: DiagramType | None = None
    template_slug: str | None = None
    direction: Direction = Direction.LR
    project_id: uuid.UUID | None = None
    save: bool = True


class GenerateResponse(BaseModel):
    diagram_id: uuid.UUID | None = None
    doc: DiagramDoc
    validation: ValidationReport
    notes: list[str] = Field(default_factory=list)


class EditRequest(BaseModel):
    """Natural-language edit against an existing document.

    `selection` scopes the change — pass the node ids the user has selected and
    the model is told to leave everything else alone.
    """

    doc: DiagramDoc
    instruction: str
    selection: list[str] = Field(default_factory=list)
    relayout: bool = True
    # Optional: lets the AIRun audit row be attached to the diagram it edited.
    diagram_id: uuid.UUID | None = None


class EditResponse(BaseModel):
    doc: DiagramDoc
    changes: list[str] = Field(default_factory=list)
    validation: ValidationReport


class Issue(BaseModel):
    level: Literal["error", "warning", "info"] = "warning"
    category: Literal["structural", "business", "visual"] = "structural"
    message: str
    node_ids: list[str] = Field(default_factory=list)
    edge_ids: list[str] = Field(default_factory=list)
    fixable: bool = False


class ValidationReport(BaseModel):
    ok: bool = True
    node_count: int = 0
    edge_count: int = 0
    lane_count: int = 0
    issues: list[Issue] = Field(default_factory=list)


class LayoutRequest(BaseModel):
    doc: DiagramDoc
    direction: Direction | None = None
    algorithm: Literal["layered", "tree", "grid", "swimlane"] = "layered"


class DocumentationRequest(BaseModel):
    doc: DiagramDoc
    audience: Literal["internal", "customer", "developer"] = "internal"
    language: str = "en"


class DocumentationResponse(BaseModel):
    markdown: str


# --------------------------------------------------------------------------
# CRUD schemas
# --------------------------------------------------------------------------


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    color: str = "#5B4BE0"


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    color: str
    created_at: datetime


class DiagramCreate(BaseModel):
    title: str = "Untitled diagram"
    project_id: uuid.UUID | None = None
    doc: DiagramDoc = Field(default_factory=DiagramDoc)
    source_prompt: str | None = None


class DiagramUpdate(BaseModel):
    title: str | None = None
    doc: DiagramDoc | None = None
    tags: list[str] | None = None
    is_favorite: bool | None = None
    keep_version: bool = True
    version_label: str | None = None


class DiagramOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID | None
    title: str
    diagram_type: str
    direction: str
    source_prompt: str | None
    improved_prompt: str | None
    tags: list[str]
    is_favorite: bool
    current_version: int
    created_at: datetime
    updated_at: datetime
    data: dict[str, Any]


class DiagramListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    diagram_type: str
    is_favorite: bool
    updated_at: datetime


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version: int
    label: str | None
    origin: str
    created_at: datetime


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    category: str
    diagram_type: str
    description: str | None
    keywords: list[str]
    data: dict[str, Any]


GenerateResponse.model_rebuild()
EditResponse.model_rebuild()
