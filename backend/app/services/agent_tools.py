"""The agent's hands.

`edit_diagram` asks a model to re-emit the whole document, which is the right
shape for a structural change ("add a rejection path throughout") and the wrong
one for a small, precise one ("make these three red") — a full rewrite there
risks collateral damage to everything the user didn't mention, and its
changelog is whatever the model claims it did rather than what actually
happened.

This module is the other half: a fixed set of narrow operations the model picks
from, applied here in Python. What comes back is a real changelog, because it's
written by the code that made the change.

Two kinds of tool live here:
  * doc tools    — mutate the DiagramDoc server-side (add_node, connect, ...)
  * client tools — can only happen in the browser (undo, fit_view, select);
                   these are handed back untouched for the store to run.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.schemas.diagram import (
    AgentAction,
    DiagramDoc,
    Direction,
    Edge,
    EdgeArrow,
    EdgeStyle,
    Lane,
    Node,
    NodeKind,
)

# Mirrors frontend/src/lib/pagePresets.ts — keep the two in step.
PAGE_PRESETS: dict[str, tuple[float, float]] = {
    "slide-16-9": (1920, 1080),
    "slide-4-3": (1280, 960),
    "a4-portrait": (794, 1123),
    "a4-landscape": (1123, 794),
    "square": (1080, 1080),
}

# Named accents the node renderer understands, alongside raw #rrggbb.
NAMED_COLORS = {
    "teal",
    "emerald",
    "blue",
    "indigo",
    "violet",
    "fuchsia",
    "rose",
    "orange",
    "amber",
    "slate",
}

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

# Stands in for "whatever the user has selected on the canvas" so a five-node
# selection is one call, not five. Expanded before anything is applied.
SELECTION_TOKEN = "@selection"

# A runaway plan is a sign the model misread the request; applying 200 half-
# reasoned calls is worse than applying none and saying so.
MAX_CALLS = 40

CLIENT_TOOLS = {"undo", "redo", "fit_view", "zoom_in", "zoom_out", "select"}


TOOL_CATALOGUE = """
Tools that change the document:

  add_node     {label, kind?, after?, before?, id?, lane?, icon?, color?,
                description?}
               `after` / `before` are existing node ids — the new node is wired
               in after (or before) that one. Give at least one of them unless
               the node genuinely stands alone. Pass your own short `id` when a
               later call in the same list needs to refer to this new node.
  update_node  {id, label?, kind?, icon?, color?, description?, lane?, locked?,
                width?, height?}
  delete_node  {id}                 also removes every connector touching it
  connect      {source, target, label?, style?, condition?, curve?, color?,
                width?, start_arrow?, end_arrow?}
  update_edge  {id, label?, style?, condition?, curve?, color?, width?,
                label_color?, label_font_size?, start_arrow?, end_arrow?}
  delete_edge  {id}
  set_title    {title}
  set_direction {direction}         LR | RL | TB | BT — also re-runs layout
  add_lane     {label, order?}
  delete_lane  {id}                 nodes in it keep their place, lose the lane
  relayout     {direction?}         recompute every position from scratch
  set_page     {preset} or {width, height}
               preset: slide-16-9 | slide-4-3 | a4-portrait | a4-landscape | square
               Reshapes the flow to fit that page box.
  clear_page   {}                   drop the page box, back to free-form

Tools that act on the canvas, not the document:

  undo         {}
  redo         {}
  fit_view     {}                   zoom so the whole diagram is visible
  zoom_in      {}
  zoom_out     {}
  select       {ids}                highlight these nodes for the user

Field values:
  kind        start | end | process | decision | document | data | database |
              actor | system | service | queue | cloud | note
  style       solid | dashed | dotted | dashdot | longdash | animated
  curve       smoothstep | step | straight | bezier
  start_arrow / end_arrow
              none | arrow | triangle | circle | diamond
  color / label_color
              teal | emerald | blue | indigo | violet | fuchsia | rose |
              orange | amber | slate, or a "#rrggbb" string. Edge colors must
              be "#rrggbb".
  width       stroke width in px (1-8); label_font_size in px (8-24)

Anywhere a node `id` is expected you may write "@selection" instead, meaning
every node the user currently has selected. Use it whenever they said "these",
"this", "them", or "the selected ones". A node's exact label works in place of
its id too, but prefer the id — labels aren't unique.
"""


@dataclass
class ToolOutcome:
    changes: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    client_actions: list[AgentAction] = field(default_factory=list)
    new_node_ids: set[str] = field(default_factory=set)
    relayout: bool = False
    # None = leave the page box alone, "clear" = drop it, tuple = fit to it.
    page: tuple[float, float] | str | None = None

    @property
    def touched_doc(self) -> bool:
        return bool(self.changes)


# --------------------------------------------------------------------------
# Coercion helpers — a tool call is model output, so nothing is trusted
# --------------------------------------------------------------------------


def _fresh_id(prefix: str, taken: set[str]) -> str:
    i = len(taken) + 1
    while f"{prefix}{i}" in taken:
        i += 1
    new = f"{prefix}{i}"
    taken.add(new)
    return new


def _color(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    if value.lower() in NAMED_COLORS:
        return value.lower()
    return value if _HEX.match(value) else None


def _hex_only(value: Any) -> str | None:
    """Edges take a real stroke colour, not a palette name."""
    if not isinstance(value, str):
        return None
    return value.strip() if _HEX.match(value.strip()) else None


def _number(value: Any, low: float, high: float) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(min(max(value, low), high))


def _enum(enum_cls: Any, value: Any) -> Any | None:
    if not isinstance(value, str):
        return None
    try:
        return enum_cls(value.strip().lower())
    except ValueError:
        return None


def _direction(value: Any) -> Direction | None:
    """Direction is the one enum whose values are uppercase."""
    if not isinstance(value, str):
        return None
    try:
        return Direction(value.strip().upper())
    except ValueError:
        return None


def _text(value: Any, limit: int = 200) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned[:limit] if cleaned else None


def _expand_ids(raw: Any, selection: list[str]) -> list[str]:
    """One id, a list of them, or the selection token."""
    values = raw if isinstance(raw, list) else [raw]
    out: list[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        if value.strip() == SELECTION_TOKEN:
            out.extend(selection)
        else:
            out.append(value.strip())
    # Preserve order, drop repeats.
    return list(dict.fromkeys(out))


# --------------------------------------------------------------------------
# The applier
# --------------------------------------------------------------------------


def apply_tools(
    doc: DiagramDoc,
    calls: list[AgentAction],
    selection: list[str] | None = None,
) -> ToolOutcome:
    """Run `calls` against `doc` in order, mutating it in place.

    A call that can't be applied — an unknown tool, a node id that isn't
    there — is recorded as a warning and skipped, rather than aborting the
    rest. A partially applied instruction the user can see is better than a
    silent no-op, and every change is one undo away on the client.
    """
    selection = selection or []
    out = ToolOutcome()

    if len(calls) > MAX_CALLS:
        out.warnings.append(
            f"That needed {len(calls)} separate changes — too many to apply safely "
            "in one go. Try asking for it a piece at a time."
        )
        return out

    nodes = {n.id: n for n in doc.nodes}
    edges = {e.id: e for e in doc.edges}
    # These indexes are the working copy every handler reads and writes, so a
    # later call in the batch sees what an earlier one did. `doc` is filtered
    # down to them once at the end rather than re-scanned on every delete.
    ctx = _Ctx(doc, nodes, edges, set(nodes), set(edges), selection, out)

    for call in calls:
        tool = (call.tool or "").strip().lower()
        args = call.args if isinstance(call.args, dict) else {}

        if tool in CLIENT_TOOLS:
            if tool == "select":
                ids = [n.id for n in ctx.resolve_nodes(args.get("ids"))]
                if not ids:
                    out.warnings.append("Couldn't work out which nodes to select.")
                    continue
                out.client_actions.append(AgentAction(tool="select", args={"ids": ids}))
            else:
                out.client_actions.append(AgentAction(tool=tool, args={}))
            continue

        handler = _HANDLERS.get(tool)
        if handler is None:
            out.warnings.append(f"Don't know how to '{tool}'.")
            continue
        handler(ctx, args)

    doc.nodes = [n for n in doc.nodes if n.id in ctx.node_ids]
    doc.edges = [e for e in doc.edges if e.id in ctx.edge_ids]
    return out


@dataclass
class _Ctx:
    doc: DiagramDoc
    nodes: dict[str, Node]
    edges: dict[str, Edge]
    node_ids: set[str]
    edge_ids: set[str]
    selection: list[str]
    out: ToolOutcome

    def resolve_nodes(self, raw: Any) -> list[Node]:
        """Turn whatever the model wrote into real nodes.

        Ids are the contract, but a model that has just been shown a diagram
        full of labels will sometimes write the label instead — and it has no
        id at all for a node an earlier call in the same batch created. Both
        are cheap to accept here, and the alternative is a warning the user
        reads as "the agent is broken" over a naming quibble.
        """
        found: list[Node] = []
        for token in _expand_ids(raw, self.selection):
            if token in self.node_ids:
                found.append(self.nodes[token])
                continue
            match = next(
                (n for n in self.nodes.values() if n.label.casefold() == token.casefold()),
                None,
            )
            if match is not None:
                found.append(match)
        # Same node named twice (by id and by label) is still one node.
        return list({n.id: n for n in found}.values())

    def node(self, raw: Any) -> Node | None:
        found = self.resolve_nodes(raw)
        return found[0] if found else None

    def resolve_edges(self, raw: Any) -> list[Edge]:
        return [self.edges[i] for i in _expand_ids(raw, self.selection) if i in self.edge_ids]


def _t_add_node(ctx: _Ctx, args: dict[str, Any]) -> None:
    label = _text(args.get("label"))
    if not label:
        ctx.out.warnings.append("Skipped a new step with no label.")
        return

    # The model may name the node itself so a later call in the same batch can
    # refer to it ("add Pack items, then connect it to Ship"). A collision
    # falls back to a generated id rather than silently overwriting.
    wanted = _text(args.get("id"), 60)
    node = Node(
        id=wanted if wanted and wanted not in ctx.node_ids else _fresh_id("n", ctx.node_ids),
        label=label,
        kind=_enum(NodeKind, args.get("kind")) or NodeKind.process,
        description=_text(args.get("description"), 400),
    )
    lane = _text(args.get("lane"))
    if lane and any(current.id == lane for current in ctx.doc.lanes):
        node.lane = lane
    if icon := _text(args.get("icon"), 60):
        node.icon = icon
    if color := _color(args.get("color")):
        node.style = {**node.style, "color": color}

    ctx.doc.nodes.append(node)
    ctx.nodes[node.id] = node
    ctx.node_ids.add(node.id)  # a model-supplied id skipped _fresh_id's bookkeeping
    ctx.out.new_node_ids.add(node.id)

    wired = []
    for key, forward in (("after", True), ("before", False)):
        anchor = ctx.node(args.get(key))
        if anchor is None:
            continue
        source, target = (anchor.id, node.id) if forward else (node.id, anchor.id)
        edge = Edge(id=_fresh_id("e", ctx.edge_ids), source=source, target=target)
        ctx.doc.edges.append(edge)
        ctx.edges[edge.id] = edge
        wired.append(anchor.label)

    ctx.out.changes.append(
        f"Added '{label}'" + (f" after {' and before '.join(wired)}." if wired else ".")
    )


def _t_update_node(ctx: _Ctx, args: dict[str, Any]) -> None:
    targets = ctx.resolve_nodes(args.get("id"))
    if not targets:
        ctx.out.warnings.append(f"No step called '{args.get('id')}' to change.")
        return

    for node in targets:
        edits: list[str] = []
        if (label := _text(args.get("label"))) and label != node.label:
            edits.append(f"renamed to '{label}'")
            node.label = label
        if kind := _enum(NodeKind, args.get("kind")):
            edits.append(f"turned into a {kind.value}")
            node.kind = kind
        if icon := _text(args.get("icon"), 60):
            edits.append(f"icon set to {icon}")
            node.icon = icon
        if color := _color(args.get("color")):
            edits.append(f"coloured {color}")
            node.style = {**node.style, "color": color}
        if description := _text(args.get("description"), 400):
            edits.append("description updated")
            node.description = description
        if (lane := _text(args.get("lane"))) and any(c.id == lane for c in ctx.doc.lanes):
            edits.append("moved lane")
            node.lane = lane
        if isinstance(args.get("locked"), bool):
            node.locked = args["locked"]
            edits.append("locked" if node.locked else "unlocked")
        if width := _number(args.get("width"), 80, 600):
            node.size.width = width
            edits.append("resized")
        if height := _number(args.get("height"), 40, 400):
            node.size.height = height
            if "resized" not in edits:
                edits.append("resized")

        if edits:
            ctx.out.changes.append(f"'{node.label}' — {', '.join(edits)}.")
        else:
            ctx.out.warnings.append(f"Nothing recognisable to change on '{node.label}'.")


def _t_delete_node(ctx: _Ctx, args: dict[str, Any]) -> None:
    targets = ctx.resolve_nodes(args.get("id"))
    if not targets:
        ctx.out.warnings.append(f"No step called '{args.get('id')}' to remove.")
        return
    for node in targets:
        ctx.node_ids.discard(node.id)
        ctx.nodes.pop(node.id, None)
        orphaned = [e.id for e in ctx.doc.edges if node.id in (e.source, e.target)]
        for edge_id in orphaned:
            ctx.edge_ids.discard(edge_id)
            ctx.edges.pop(edge_id, None)
        count = len(orphaned)
        tail = f" and {count} connector{'' if count == 1 else 's'}" if orphaned else ""
        ctx.out.changes.append(f"Removed '{node.label}'{tail}.")


def _edge_fields(ctx: _Ctx, edge: Edge, args: dict[str, Any]) -> list[str]:
    edits: list[str] = []
    if label := _text(args.get("label"), 120):
        edge.label = label
        edits.append(f"labelled '{label}'")
    if style := _enum(EdgeStyle, args.get("style")):
        edge.style = style
        edits.append(style.value)
    if condition := _text(args.get("condition"), 120):
        edge.condition = condition
    if curve := _text(args.get("curve"), 20):
        if curve in ("smoothstep", "step", "straight", "bezier"):
            edge.curve = curve
            edits.append(curve)
    if color := _hex_only(args.get("color")):
        edge.color = color
        edits.append(f"coloured {color}")
    if width := _number(args.get("width"), 1, 8):
        edge.width = width
        edits.append("thicker" if width > 1.5 else "thinner")
    if label_color := _hex_only(args.get("label_color")):
        edge.label_color = label_color
    if size := _number(args.get("label_font_size"), 8, 24):
        edge.label_font_size = size
    if start := _enum(EdgeArrow, args.get("start_arrow")):
        edge.start_arrow = start
        edits.append(f"start arrow {start.value}")
    if end := _enum(EdgeArrow, args.get("end_arrow")):
        edge.end_arrow = end
        edits.append(f"end arrow {end.value}")
    return edits


def _t_connect(ctx: _Ctx, args: dict[str, Any]) -> None:
    source = ctx.node(args.get("source"))
    target = ctx.node(args.get("target"))
    if source is None or target is None:
        ctx.out.warnings.append(
            f"Couldn't connect '{args.get('source')}' to '{args.get('target')}' — "
            "one of them isn't in the diagram."
        )
        return
    if source.id == target.id:
        ctx.out.warnings.append(f"Skipped connecting '{source.label}' to itself.")
        return

    edge = Edge(id=_fresh_id("e", ctx.edge_ids), source=source.id, target=target.id)
    _edge_fields(ctx, edge, args)
    ctx.doc.edges.append(edge)
    ctx.edges[edge.id] = edge
    label = f" ({edge.label})" if edge.label else ""
    ctx.out.changes.append(f"Connected '{source.label}' to '{target.label}'{label}.")


def _t_update_edge(ctx: _Ctx, args: dict[str, Any]) -> None:
    targets = ctx.resolve_edges(args.get("id"))
    if not targets:
        ctx.out.warnings.append(f"No connector called '{args.get('id')}' to change.")
        return
    for edge in targets:
        edits = _edge_fields(ctx, edge, args)
        name = _edge_name(ctx, edge)
        if edits:
            ctx.out.changes.append(f"Connector {name} — {', '.join(edits)}.")
        else:
            ctx.out.warnings.append(f"Nothing recognisable to change on connector {name}.")


def _edge_name(ctx: _Ctx, edge: Edge) -> str:
    """'Check stock → Ship order' — a connector as the user sees it, not e7."""
    source = ctx.nodes.get(edge.source)
    target = ctx.nodes.get(edge.target)
    return f"{source.label if source else edge.source} → {target.label if target else edge.target}"


def _t_delete_edge(ctx: _Ctx, args: dict[str, Any]) -> None:
    targets = ctx.resolve_edges(args.get("id"))
    if not targets:
        ctx.out.warnings.append(f"No connector called '{args.get('id')}' to remove.")
        return
    for edge in targets:
        name = _edge_name(ctx, edge)
        ctx.edges.pop(edge.id, None)
        ctx.edge_ids.discard(edge.id)
        ctx.out.changes.append(f"Removed the connector {name}.")


def _t_set_title(ctx: _Ctx, args: dict[str, Any]) -> None:
    title = _text(args.get("title"), 120)
    if not title:
        ctx.out.warnings.append("No title given.")
        return
    ctx.doc.title = title
    ctx.out.changes.append(f"Retitled to '{title}'.")


def _t_set_direction(ctx: _Ctx, args: dict[str, Any]) -> None:
    # Direction values are uppercase (LR/TB), unlike every other enum here.
    direction = _direction(args.get("direction"))
    if direction is None:
        ctx.out.warnings.append(f"'{args.get('direction')}' isn't a flow direction.")
        return
    ctx.doc.direction = direction
    ctx.out.relayout = True
    ctx.out.changes.append(f"Flow direction set to {direction.value}.")


def _t_add_lane(ctx: _Ctx, args: dict[str, Any]) -> None:
    label = _text(args.get("label"), 80)
    if not label:
        ctx.out.warnings.append("Skipped a lane with no name.")
        return
    taken = {lane.id for lane in ctx.doc.lanes}
    slug = "lane_" + re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")
    lane_id = slug if slug not in taken else _fresh_id("lane_", taken)
    order = args.get("order")
    ctx.doc.lanes.append(
        Lane(
            id=lane_id,
            label=label,
            order=int(order) if isinstance(order, int) else len(ctx.doc.lanes),
        )
    )
    ctx.out.relayout = True
    ctx.out.changes.append(f"Added the '{label}' lane.")


def _t_delete_lane(ctx: _Ctx, args: dict[str, Any]) -> None:
    lane_id = _text(args.get("id"), 80)
    lane = next((current for current in ctx.doc.lanes if current.id == lane_id), None)
    if lane is None:
        ctx.out.warnings.append(f"No lane called '{lane_id}'.")
        return
    ctx.doc.lanes = [current for current in ctx.doc.lanes if current.id != lane_id]
    for node in ctx.doc.nodes:
        if node.lane == lane_id:
            node.lane = None
    ctx.out.relayout = True
    ctx.out.changes.append(f"Removed the '{lane.label}' lane.")


def _t_relayout(ctx: _Ctx, args: dict[str, Any]) -> None:
    if args.get("direction"):
        _t_set_direction(ctx, args)
        return
    ctx.out.relayout = True
    ctx.out.changes.append("Rearranged the layout.")


def _t_set_page(ctx: _Ctx, args: dict[str, Any]) -> None:
    preset = _text(args.get("preset"), 40)
    if preset and preset in PAGE_PRESETS:
        ctx.out.page = PAGE_PRESETS[preset]
        ctx.out.relayout = True
        ctx.out.changes.append(f"Fitted the diagram to {preset}.")
        return
    width = _number(args.get("width"), 200, 8000)
    height = _number(args.get("height"), 200, 8000)
    if width and height:
        ctx.out.page = (width, height)
        ctx.out.relayout = True
        ctx.out.changes.append(f"Fitted the diagram to {int(width)}×{int(height)}.")
        return
    ctx.out.warnings.append(f"'{preset or args}' isn't a page size I know.")


def _t_clear_page(ctx: _Ctx, _args: dict[str, Any]) -> None:
    ctx.out.page = "clear"
    ctx.out.relayout = True
    ctx.out.changes.append("Dropped the page box — back to free-form layout.")


_HANDLERS: dict[str, Any] = {
    "add_node": _t_add_node,
    "update_node": _t_update_node,
    "delete_node": _t_delete_node,
    "connect": _t_connect,
    "update_edge": _t_update_edge,
    "delete_edge": _t_delete_edge,
    "set_title": _t_set_title,
    "set_direction": _t_set_direction,
    "add_lane": _t_add_lane,
    "delete_lane": _t_delete_lane,
    "relayout": _t_relayout,
    "set_page": _t_set_page,
    "clear_page": _t_clear_page,
}
