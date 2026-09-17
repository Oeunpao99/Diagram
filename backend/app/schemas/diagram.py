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
    wedge = "wedge"
    hub = "hub"
    circle = "circle"
    hexagon = "hexagon"
    octagon = "octagon"
    triangle = "triangle"
    pentagon = "pentagon"
    star = "star"
    tag = "tag"
    arrow = "arrow"


class EdgeStyle(str, Enum):
    solid = "solid"
    dashed = "dashed"
    dotted = "dotted"
    dashdot = "dashdot"
    longdash = "longdash"
    animated = "animated"


class EdgeArrow(str, Enum):
    none = "none"
    arrow = "arrow"
    triangle = "triangle"
    circle = "circle"
    diamond = "diamond"


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
    tree = "tree"
    radial = "radial"


class Position(BaseModel):
    x: float = 0
    y: float = 0


class Size(BaseModel):
    width: float = 180
    height: float = 64


class Rect(BaseModel):
    x: float = 0
    y: float = 0
    width: float = 0
    height: float = 0


class Node(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    label: str
    kind: NodeKind = NodeKind.process
    description: str | None = None
    lane: str | None = Field(default=None, description="Swimlane / group id this node belongs to")
    group: str | None = Field(default=None, description="Nested container id this node sits in")
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
    source_handle: str | None = Field(
        default=None,
        description="Port used on the source node: null/None = right, 'b' = bottom",
    )
    target_handle: str | None = Field(
        default=None,
        description="Port used on the target node: null/None = left, 't' = top",
    )
    label: str | None = None
    style: EdgeStyle = EdgeStyle.solid
    condition: str | None = Field(default=None, description="e.g. 'approved' / 'rejected'")
    bidirectional: bool = Field(
        default=False,
        description="Legacy double-arrow flag; superseded by start_arrow/end_arrow. Kept "
        "as a fallback for diagrams saved before those fields existed.",
    )
    start_arrow: EdgeArrow | None = Field(
        default=None,
        description="Marker at the source end. Null defers to the legacy `bidirectional` flag.",
    )
    end_arrow: EdgeArrow | None = Field(
        default=None,
        description="Marker at the target end. Null defaults to a filled triangle.",
    )
    curve: str | None = Field(
        default=None,
        description="Connector shape: 'smoothstep' | 'step' | 'straight' | 'bezier'",
    )
    color: str | None = Field(default=None, description="Stroke colour, a hex string")
    width: float | None = Field(default=None, description="Stroke width in pixels")
    label_color: str | None = Field(default=None, description="Label text colour, a hex string")
    label_font_size: float | None = Field(default=None, description="Label text size in pixels")


class Lane(BaseModel):
    """A swimlane, an actor row, or an architecture tier."""

    id: str
    label: str
    order: int = 0
    color: str | None = None


class Group(BaseModel):
    """A nested container — an architecture boundary (a subscription, a VNet, a
    subnet) that encloses nodes and other groups.

    Unlike a Lane, which is a flat band perpendicular to the flow, a group nests
    to arbitrary depth via `parent` and takes its shape from whatever it holds.
    `rect` is derived by the layout engine from the members' bounds; authoring
    one by hand is pointless because the next layout pass overwrites it.
    """

    id: str
    label: str
    parent: str | None = Field(default=None, description="Enclosing group id; None = top level")
    collapsed: bool = False
    rect: Rect | None = None


class DiagramDoc(BaseModel):
    """The whole document."""

    title: str = "Untitled diagram"
    diagram_type: DiagramType = DiagramType.process_flow
    direction: Direction = Direction.LR
    summary: str | None = None
    nodes: list[Node] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)
    lanes: list[Lane] = Field(default_factory=list)
    groups: list[Group] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


# --------------------------------------------------------------------------
# AI request / response envelopes
# --------------------------------------------------------------------------


class ImprovePromptRequest(BaseModel):
    prompt: str
    diagram_type: DiagramType | None = None


class AnalyzeImageRequest(BaseModel):
    # A full "data:image/png;base64,..." string — the same shape the browser's
    # FileReader already produces for the image nodes dropped on the canvas.
    image_data_url: str
    # Optional context alongside the picture ("this is the checkout flow").
    prompt: str = ""


class GenerateIconRequest(BaseModel):
    prompt: str


class GenerateIconResponse(BaseModel):
    svg: str


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


class RestyleTemplateRequest(BaseModel):
    """Reorganize an existing diagram to follow a template's structure,
    keeping the user's own content — see ai.restyle_to_template. Distinct
    from GenerateRequest's `template_slug`, which only ever seeds a brand
    new diagram."""

    doc: DiagramDoc
    template_slug: str
    diagram_id: uuid.UUID | None = None


class RouteMessageRequest(BaseModel):
    """What the copilot chat sends before deciding whether a message is an
    edit instruction or a question — same input either way, one classifier
    call decides which pipeline actually runs."""

    doc: DiagramDoc
    message: str


class RouteMessageResponse(BaseModel):
    intent: Literal["modify", "ask"]
    # Only set when intent is "ask" — the conversational answer itself, so a
    # question resolves in one round trip instead of classify-then-fetch.
    answer: str | None = None


class AgentAction(BaseModel):
    """One step the agent decided to take — a doc tool the server applies, or
    a client action (undo, fit view, select) the browser runs."""

    tool: str
    args: dict[str, Any] = Field(default_factory=dict)


class ChatTurn(BaseModel):
    """One earlier line of the conversation, trimmed to what the agent needs
    to resolve a short follow-up ("all", "yes", "the second one") against
    its own last question — not a transcript, just enough context."""

    role: Literal["user", "ai"]
    text: str


class AgentRequest(BaseModel):
    """The copilot chat's single front door. Everything the agent needs to
    resolve "these", "it", and "that step" is in here — the doc, the message,
    whatever the user currently has picked on the canvas, and a little of
    what was said just before this message."""

    doc: DiagramDoc
    message: str
    selection: list[str] = Field(default_factory=list)
    edge_selection: list[str] = Field(default_factory=list)
    diagram_id: uuid.UUID | None = None
    history: list[ChatTurn] = Field(default_factory=list)


class AgentResponse(BaseModel):
    intent: Literal["ask", "act", "rewrite"]
    # "ask": the reply, diagram untouched.
    answer: str | None = None
    # "act"/"rewrite": the updated document. None when nothing was changed.
    doc: DiagramDoc | None = None
    changes: list[str] = Field(default_factory=list)
    # Steps the agent wanted but couldn't take (a node it named doesn't
    # exist, an unknown tool) — surfaced rather than swallowed, so a
    # half-applied instruction doesn't read as a complete one.
    warnings: list[str] = Field(default_factory=list)
    # Actions that live in the browser, not the document: undo, fit view,
    # zoom, change the canvas selection.
    client_actions: list[AgentAction] = Field(default_factory=list)
    validation: ValidationReport | None = None


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
    group_count: int = 0
    issues: list[Issue] = Field(default_factory=list)


class LayoutRequest(BaseModel):
    doc: DiagramDoc
    direction: Direction | None = None
    algorithm: Literal["layered", "tree", "grid", "swimlane", "radial"] = "layered"
    width: float | None = Field(
        default=None,
        description="Target page width in flow px. When set (with height) the layout reshapes itself to fit inside this box — e.g. a 16:9 slide or an A4 page.",
    )
    height: float | None = Field(default=None, description="Target page height in flow px")


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
    # `Project.diagrams` is eager-loaded (lazy="selectin"), so reading this
    # property is free of an extra query.
    diagram_count: int


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
    # Moves the diagram into a project, or back out via an explicit null —
    # unlike the other optional fields here, the route checks
    # `model_fields_set` rather than `is not None` for this one, so "omitted"
    # (leave alone) and "sent as null" (clear it) read differently.
    project_id: uuid.UUID | None = None
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
    project_id: uuid.UUID | None
    updated_at: datetime


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version: int
    label: str | None
    origin: str
    created_at: datetime


class DiagramMessageCreate(BaseModel):
    """One line of the Copilot chat, as the frontend already has it the
    moment it's shown — `changes`/`warnings` mirror the finished-edit
    checklist card so a restored message renders the same way live."""

    role: Literal["user", "ai"]
    text: str
    changes: list[str] | None = None
    warnings: list[str] | None = None


class DiagramMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: Literal["user", "ai"]
    text: str
    changes: list[str] | None
    warnings: list[str] | None
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
AgentResponse.model_rebuild()
