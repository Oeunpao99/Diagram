"""Layout engine.

The model decides *what* is in the diagram. This module decides *where* it goes.
Keeping the two apart is why the output stops drifting: a re-generated diagram
with the same nodes lands in the same place every time.

Algorithm is a trimmed Sugiyama pipeline:
  1. break cycles so the graph is a DAG
  2. assign layers (longest path from a source)
  3. order nodes within each layer by barycenter, a few sweeps
  4. assign coordinates, then centre each layer on the axis
Swimlane mode replaces step 3/4: layer drives one axis, lane drives the other.
"""

from __future__ import annotations

import math
from collections import defaultdict, deque

from app.schemas.diagram import DiagramDoc, Direction, Node, NodeKind, Position, Rect

# Spacing, in px. Tuned for the default 196x70 node.
LAYER_GAP = 130  # along the flow axis, between layers
NODE_GAP = 54  # across the flow axis, between siblings
LANE_PADDING = 44
LANE_HEADER = 160  # room for the lane title strip
# Nested containers. Published in doc.meta so the frontend reads these rather
# than keeping its own copy — the lane_* keys below set the same precedent, and
# it's what stops the two sides' padding maths from drifting apart.
GROUP_PAD = 26  # between a container's border and what it holds
GROUP_HEADER = 30  # the container's label strip, added above the contents
# What React Flow's smoothstep stands off from a port before turning. Used to
# reproduce the drawn path when checking what an edge runs over.
PORT_STANDOFF = 20.0
# Slack around a node box when asking "does this line run over it" — a line
# grazing the border still reads as touching.
CORRIDOR_PAD = 6.0

# Radial ("circle diagram") layout. Gap between neighbouring wedges, in
# degrees, and how far past the outer ring a wedge's label starts.
RADIAL_GAP_DEG = 3.0
RADIAL_LABEL_GAP = 26.0
RADIAL_PALETTE = [
    "#f4c53d", "#f0793a", "#d6469a", "#7b5fd6",
    "#3fa9dc", "#2fb6a5", "#7ac943", "#e0574f",
]

DEFAULT_SIZES: dict[NodeKind, tuple[float, float]] = {
    NodeKind.start: (150, 60),
    NodeKind.end: (150, 60),
    NodeKind.decision: (184, 108),
    NodeKind.database: (184, 88),
    NodeKind.actor: (140, 96),
    NodeKind.note: (210, 88),
    NodeKind.circle: (148, 148),
    NodeKind.triangle: (160, 110),
    NodeKind.pentagon: (160, 120),
    NodeKind.star: (150, 150),
    NodeKind.tag: (196, 84),
    NodeKind.arrow: (196, 90),
}


def _sizes(doc: DiagramDoc) -> None:
    """Give every node a sensible box before we measure anything."""
    for node in doc.nodes:
        w, h = DEFAULT_SIZES.get(node.kind, (196, 70))
        # Long labels need a wider box or the text overflows the shape. The
        # `in (0, 180)` / `(0, 64)` checks below are against the Size model's
        # *schema* default (Position/Size never changed) — that's the "still
        # unsized" sentinel, independent of what these boxes actually grow to.
        if node.size.width in (0, 180):
            node.size.width = max(w, min(320, 26 + len(node.label) * 8.6))
        if node.size.height in (0, 64):
            node.size.height = h


def _break_cycles(node_ids: list[str], edges: list[tuple[str, str]]) -> set[tuple[str, str]]:
    """Return the set of edges to ignore for layering (back edges)."""
    adj: dict[str, list[str]] = defaultdict(list)
    for s, t in edges:
        adj[s].append(t)

    WHITE, GREY, BLACK = 0, 1, 2
    color = dict.fromkeys(node_ids, WHITE)
    back: set[tuple[str, str]] = set()

    for root in node_ids:
        if color[root] != WHITE:
            continue
        stack: list[tuple[str, int]] = [(root, 0)]
        color[root] = GREY
        while stack:
            node, idx = stack[-1]
            if idx < len(adj[node]):
                stack[-1] = (node, idx + 1)
                nxt = adj[node][idx]
                if color.get(nxt, WHITE) == WHITE:
                    color[nxt] = GREY
                    stack.append((nxt, 0))
                elif color.get(nxt) == GREY:
                    back.add((node, nxt))  # edge closes a loop
            else:
                color[node] = BLACK
                stack.pop()
    return back


def _layer(node_ids: list[str], edges: list[tuple[str, str]]) -> dict[str, int]:
    """Longest-path layering over the acyclic edge set."""
    back = _break_cycles(node_ids, edges)
    dag = [(s, t) for s, t in edges if (s, t) not in back]

    indeg = dict.fromkeys(node_ids, 0)
    adj: dict[str, list[str]] = defaultdict(list)
    for s, t in dag:
        if s in indeg and t in indeg:
            adj[s].append(t)
            indeg[t] += 1

    layer = dict.fromkeys(node_ids, 0)
    queue = deque([n for n in node_ids if indeg[n] == 0])
    # Fully cyclic component with no source: seed with the first node.
    if not queue and node_ids:
        queue.append(node_ids[0])
        indeg[node_ids[0]] = 0

    seen = set(queue)
    while queue:
        node = queue.popleft()
        for nxt in adj[node]:
            layer[nxt] = max(layer[nxt], layer[node] + 1)
            indeg[nxt] -= 1
            if indeg[nxt] <= 0 and nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)

    # Orphans of a cycle never got visited; pin them after their best predecessor.
    for node in node_ids:
        if node not in seen:
            preds = [s for s, t in dag if t == node]
            layer[node] = max((layer[p] + 1 for p in preds), default=0)
    return layer


def _cluster_by_group(ids: list[str], group_of: dict[str, str]) -> None:
    """Pull same-container nodes in a layer next to each other.

    Barycentre ordering only looks at edges, so two nodes in the same subnet
    that aren't directly connected can settle with a foreign node between them.
    A container is drawn as the union of its members, so that foreign node then
    renders *inside* a box it has nothing to do with. Sorting each group as a
    block, anchored at the group's mean barycentre, keeps the ordering the
    edges asked for while making each container contiguous.
    """
    rank = {n: i for i, n in enumerate(ids)}
    total: dict[str, float] = defaultdict(float)
    count: dict[str, int] = defaultdict(int)
    for n in ids:
        g = group_of.get(n)
        if g:
            total[g] += rank[n]
            count[g] += 1
    mean = {g: total[g] / count[g] for g in count}
    # An ungrouped node anchors on itself, so it keeps its barycentre slot.
    ids.sort(key=lambda n: (mean.get(group_of.get(n, ""), rank[n]), group_of.get(n, ""), rank[n]))


def _order(
    layers: dict[int, list[str]],
    edges: list[tuple[str, str]],
    sweeps: int = 4,
    group_of: dict[str, str] | None = None,
) -> None:
    """Barycenter ordering — the cheap, effective fix for crossing connectors."""
    preds: dict[str, list[str]] = defaultdict(list)
    succs: dict[str, list[str]] = defaultdict(list)
    for s, t in edges:
        succs[s].append(t)
        preds[t].append(s)

    depths = sorted(layers)
    for sweep in range(sweeps):
        order = depths if sweep % 2 == 0 else list(reversed(depths))
        for depth in order:
            neighbours = preds if sweep % 2 == 0 else succs
            ref_depth = depth - 1 if sweep % 2 == 0 else depth + 1
            if ref_depth not in layers:
                continue
            index = {n: i for i, n in enumerate(layers[ref_depth])}
            current = {n: i for i, n in enumerate(layers[depth])}

            def bary(node: str) -> float:
                vals = [index[n] for n in neighbours[node] if n in index]
                return sum(vals) / len(vals) if vals else float(current[node])

            layers[depth].sort(key=bary)
            if group_of:
                _cluster_by_group(layers[depth], group_of)


def apply_layout(
    doc: DiagramDoc,
    direction: Direction | None = None,
    algorithm: str = "layered",
    width: float | None = None,
    height: float | None = None,
) -> DiagramDoc:
    """Position every node. Returns the same doc, mutated.

    `width`/`height` (both set, positive) turn this into a fit-to-box pass:
    the flow is reshaped — and, where it still doesn't reach, scaled and
    centred — to sit inside a target page box (a slide, an A4 sheet, …).
    The page box is recorded in `doc.meta` (`page_*`) so the export and the
    canvas can draw/crop to the same rectangle. Passing neither clears it.
    """
    if not doc.nodes:
        return doc

    direction = direction or doc.direction
    doc.direction = direction
    _sizes(doc)

    target = width is not None and height is not None and width > 0 and height > 0
    if target:
        doc.meta["page_width"] = float(width or 0)
        doc.meta["page_height"] = float(height or 0)
    else:
        for key in ("page_x", "page_y", "page_width", "page_height", "fit_scale"):
            doc.meta.pop(key, None)

    node_ids = [n.id for n in doc.nodes]
    valid = set(node_ids)
    edges = [(e.source, e.target) for e in doc.edges if e.source in valid and e.target in valid]

    depth_of = _layer(node_ids, edges)
    layers: dict[int, list[str]] = defaultdict(list)
    for node_id in node_ids:
        layers[depth_of[node_id]].append(node_id)
    _route_edges(doc, depth_of)

    if algorithm == "radial":
        _place_radial(doc)
        if target:
            _fit_to_box(doc, width or 0, height or 0)
    elif algorithm == "swimlane" and doc.lanes:
        _place_swimlane(doc, layers, direction)
        if target:
            _fit_to_box(doc, width or 0, height or 0)
    elif algorithm == "grid":
        _place_grid(doc)
        if target:
            _fit_to_box(doc, width or 0, height or 0)
    else:
        _order(layers, edges, group_of={n.id: n.group for n in doc.nodes if n.group})
        _place_layered(doc, layers, direction, width if target else None, height if target else None)

    # Runs last, on final coordinates — after fit-to-box and after the
    # RL/BT mirror, both of which move nodes out from under their edges.
    _reroute_crossing_edges(doc)
    _place_groups(doc)

    if target:
        doc.meta["page_x"] = 0.0
        doc.meta["page_y"] = 0.0
    return doc


def _route_edges(doc: DiagramDoc, depth_of: dict[str, int]) -> None:
    """Keep back/lateral and layer-skipping edges out of the main corridor.

    Every edge defaults to the same pair of ports — right side out, left side
    in — because that's what an edge to the *very next* layer wants. Two
    kinds of edge get hurt by that default:

    * Anything that doesn't advance (a decision's rejection branch, a
      hand-off back to an earlier step, a retry loop) rides the exact same
      corridor as the forward flow and visually fuses with it.
    * A forward edge that *skips* layers — a fast path, a cancel, an
      escalation — has to cross every layer in between, and the straight
      right-to-left run puts it directly over whatever nodes sit there.

    Both want the node's top/bottom ports instead, which the layer-to-layer
    flow never uses, so they get their own lane clear of it. An edge to the
    adjacent layer keeps left/right: there is nothing between its endpoints
    to collide with, and it *is* the main flow.

    Only touches edges that have never had a handle chosen (by a user's
    manual drag, or by an earlier run of this same step) — a deliberate
    choice is never silently reverted.
    """
    for edge in doc.edges:
        s_depth = depth_of.get(edge.source)
        t_depth = depth_of.get(edge.target)
        if s_depth is None or t_depth is None:
            continue
        stays_in_corridor = t_depth == s_depth + 1
        if stays_in_corridor or edge.source_handle is not None or edge.target_handle is not None:
            continue
        edge.source_handle = "b"
        edge.target_handle = "t"


def _corridor(source: Node, target: Node, source_handle: str | None, target_handle: str | None):
    """The polyline the canvas actually draws between two ports.

    Ports are fixed sides regardless of flow direction (see nodes.tsx): a
    source leaves right, or bottom for "b"; a target is entered from the
    left, or the top for "t". Smoothstep then turns at right angles — the
    default pair turns on a vertical at the midpoint between them, the
    top/bottom pair runs horizontally clear of both boxes.
    """
    if source_handle is None and target_handle is None:
        p0 = (source.position.x + source.size.width, source.position.y + source.size.height / 2)
        p1 = (target.position.x, target.position.y + target.size.height / 2)
        mid_x = (p0[0] + p1[0]) / 2
        return [p0, (mid_x, p0[1]), (mid_x, p1[1]), p1]

    p0 = (source.position.x + source.size.width / 2, source.position.y + source.size.height)
    p1 = (target.position.x + target.size.width / 2, target.position.y)
    run_y = max(p0[1], p1[1]) + PORT_STANDOFF
    return [p0, (p0[0], run_y), (p1[0], run_y), p1]


def _crossings(points, nodes: list[Node], skip: set[str]) -> int:
    """How many unrelated node boxes that polyline runs over.

    Every segment is axis-aligned, so overlapping the segment's bounding box
    with the (padded) node box is exact, not an approximation.
    """
    hits = 0
    for node in nodes:
        if node.id in skip:
            continue
        bx = node.position.x - CORRIDOR_PAD
        by = node.position.y - CORRIDOR_PAD
        bw = node.size.width + CORRIDOR_PAD * 2
        bh = node.size.height + CORRIDOR_PAD * 2
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            lo_x, hi_x = (x0, x1) if x0 <= x1 else (x1, x0)
            lo_y, hi_y = (y0, y1) if y0 <= y1 else (y1, y0)
            if lo_x <= bx + bw and hi_x >= bx and lo_y <= by + bh and hi_y >= by:
                hits += 1
                break
    return hits


def _reroute_crossing_edges(doc: DiagramDoc) -> None:
    """Last pass, once every node has its final position: move an edge off
    the default ports when the line that draws would run over nodes it has
    nothing to do with.

    `_route_edges` already catches the cases predictable from layer distance
    alone, but it has to run *before* placement, so it can't see the one that
    actually dominates a busy swimlane: two nodes sharing a layer *and* a
    lane sit side by side on the flow axis at the same cross position, so any
    edge passing that lane at that height is drawn straight through whichever
    of them sits in between. Only real coordinates show that.

    Switches only when the top/bottom pair is genuinely better — on a dense
    diagram the alternative route can be just as blocked, and a lateral move
    that doesn't help isn't worth undoing the tidy left-to-right default for.
    Handles chosen by hand are left alone, same as everywhere else.
    """
    for edge in doc.edges:
        if edge.source_handle is not None or edge.target_handle is not None:
            continue
        source = next((n for n in doc.nodes if n.id == edge.source), None)
        target = next((n for n in doc.nodes if n.id == edge.target), None)
        if source is None or target is None:
            continue

        skip = {edge.source, edge.target}
        blocked = _crossings(_corridor(source, target, None, None), doc.nodes, skip)
        if not blocked:
            continue
        if _crossings(_corridor(source, target, "b", "t"), doc.nodes, skip) < blocked:
            edge.source_handle = "b"
            edge.target_handle = "t"


def _place_layered(
    doc: DiagramDoc,
    layers: dict[int, list[str]],
    direction: Direction,
    width: float | None = None,
    height: float | None = None,
) -> None:
    by_id = {n.id: n for n in doc.nodes}
    horizontal = direction in (Direction.LR, Direction.RL)

    # Extent of each layer along the flow axis.
    layer_extent = {
        d: max(by_id[n].size.width if horizontal else by_id[n].size.height for n in ids)
        for d, ids in layers.items()
    }
    # Cross-axis length of each layer, so layers can be centred against each
    # other. Group-aware: neighbours in different containers need room for the
    # borders drawn between them.
    group_of = {n.id: n.group for n in doc.nodes if n.group}
    chains = _group_ancestors(doc)
    spans = {
        d: _cross_offsets(ids, by_id, group_of, chains, horizontal)
        for d, ids in layers.items()
    }
    cross_len = {d: span[1] for d, span in spans.items()}

    if width is not None and height is not None:
        depth_of = {nid: d for d, ids in layers.items() for nid in ids}
        no_break = _group_layer_spans(depth_of, group_of)
        _place_layered_fit(doc, layers, by_id, layer_extent, spans, direction, width, height, no_break)
    else:
        widest = max(cross_len.values()) if cross_len else 0
        flow = 0.0
        for depth in sorted(layers):
            ids = layers[depth]
            offsets, _ = spans[depth]
            base = (widest - cross_len[depth]) / 2
            for node_id, offset in zip(ids, offsets):
                node = by_id[node_id]
                if horizontal:
                    node.position.x = flow
                    node.position.y = base + offset
                else:
                    node.position.x = base + offset
                    node.position.y = flow
            flow += layer_extent[depth] + LAYER_GAP

    if direction in (Direction.RL, Direction.BT):
        _mirror(doc, horizontal)

    if width is not None and height is not None:
        _fit_to_box(doc, width, height)


def _group_layer_spans(depth_of: dict[str, int], group_of: dict[str, str]) -> set[int]:
    """Layer depths a chunk-wrap boundary must not fall on.

    A group's own layer span (the min through max depth its members occupy)
    has to land in one wrapped row, or the rect drawn around it — a union of
    wherever its members ended up — spans two rows and swallows whatever the
    wrap placed between them. Spans that share a depth are merged first: if
    group A's members sit at layers 2 and 4, group B's node at layer 3 is
    already forced to travel with A regardless of B's own span, so keeping
    that consistent needs B's whole span pulled in too.
    """
    per_group: dict[str, list[int]] = defaultdict(list)
    for node_id, group_id in group_of.items():
        if node_id in depth_of:
            per_group[group_id].append(depth_of[node_id])

    spans = sorted([min(ds), max(ds)] for ds in per_group.values() if ds)
    merged: list[list[int]] = []
    for span in spans:
        if merged and span[0] <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], span[1])
        else:
            merged.append(span)

    return {d for start, end in merged for d in range(start + 1, end + 1)}


def _place_layered_fit(
    doc: DiagramDoc,
    layers: dict[int, list[str]],
    by_id: dict[str, Node],
    layer_extent: dict[int, float],
    spans: dict[int, tuple[list[float], float]],
    direction: Direction,
    width: float,
    height: float,
    no_break: set[int] = frozenset(),
) -> None:
    """Layered placement constrained to a page box.

    The straight pipeline stacks every layer along the flow axis, so a narrow
    page (a portrait A4, a vertical slide) leaves a long, scrawny flow. Here
    the layer sequence is broken into *chunks*: consecutive layers still stack
    along the flow axis inside a chunk, and the chunks themselves stack along
    the cross axis — a flow that "wraps" like text to stay inside the box.

    `spans` carries the same group-aware per-node offsets the free-form path
    uses (`_cross_offsets`) — without them, two nodes in different containers
    land exactly NODE_GAP apart regardless of the boundary between them, and
    the container rects drawn around them (sized separately, with that
    boundary's padding) end up overlapping. `no_break` (from
    `_group_layer_spans`) is the depths where wrapping anyway would tear a
    single group across two rows for the same reason.
    """
    cross_len = {d: span[1] for d, span in spans.items()}
    horizontal = direction in (Direction.LR, Direction.RL)
    flow_limit = width if horizontal else height
    layer_ids = sorted(layers)

    # Greedy wrap: keep adding layers to the current chunk until the next one
    # would push the chunk past the flow limit — unless breaking here would
    # split a group's own layer span, in which case the chunk is let to run
    # over rather than tear a container in two.
    chunks: list[list[int]] = []
    current: list[int] = []
    current_flow = 0.0
    for depth in layer_ids:
        ext = layer_extent[depth]
        nxt = current_flow + (LAYER_GAP if current else 0) + ext
        if current and nxt > flow_limit and depth not in no_break:
            chunks.append(current)
            current = [depth]
            current_flow = ext
        else:
            current.append(depth)
            current_flow = nxt
    if current:
        chunks.append(current)

    if not chunks:
        return

    chunk_flow = [
        sum(layer_extent[d] for d in chunk) + LAYER_GAP * (len(chunk) - 1) for chunk in chunks
    ]
    chunk_cross = [max(cross_len[d] for d in chunk) for chunk in chunks]

    cross_cursor = 0.0
    for chunk, chunk_flow_extent, chunk_cross_extent in zip(chunks, chunk_flow, chunk_cross):
        flow = 0.0
        for depth in chunk:
            ids = layers[depth]
            offsets, _ = spans[depth]
            base = cross_cursor + (chunk_cross_extent - cross_len[depth]) / 2
            for node_id, offset in zip(ids, offsets):
                node = by_id[node_id]
                if horizontal:
                    node.position.x = flow
                    node.position.y = base + offset
                else:
                    node.position.x = base + offset
                    node.position.y = flow
            flow += layer_extent[depth] + LAYER_GAP
        cross_cursor += chunk_cross_extent + NODE_GAP


def _fit_to_box(doc: DiagramDoc, width: float, height: float) -> None:
    """Shrink (never stretch) the graph — positions and node sizes both — to
    centre it inside the box.

    Positions and sizes shrink by the same factor, which is what makes this
    safe: scaling position alone while leaving boxes full-size is what used
    to produce overlap, since the pre-fit layout only ever guaranteed enough
    room between two node *positions*, not between two node *edges* once
    their boxes stayed full-size against a compressed gap — any scale below
    roughly size/(size+gap) put adjacent boxes on top of each other. A
    uniform scale preserves the pre-fit layout's own overlap-free spacing
    exactly, the same way shrinking an image never tears it. The applied
    scale is published as `meta.fit_scale` — `_place_groups` runs after this
    and needs it too, to keep its own padding proportional to the same
    compressed graph rather than drawing full-size padding around it.
    """
    doc.meta.pop("fit_scale", None)
    if not doc.nodes:
        return
    min_x = min(n.position.x for n in doc.nodes)
    min_y = min(n.position.y for n in doc.nodes)
    max_x = max(n.position.x + n.size.width for n in doc.nodes)
    max_y = max(n.position.y + n.size.height for n in doc.nodes)
    graph_w = max_x - min_x
    graph_h = max_y - min_y
    if graph_w <= 0 or graph_h <= 0:
        return

    scale = min(1.0, width / graph_w, height / graph_h)
    if scale < 1.0:
        doc.meta["fit_scale"] = scale
        for node in doc.nodes:
            node.position.x *= scale
            node.position.y *= scale
            node.size.width *= scale
            node.size.height *= scale
        min_x *= scale
        min_y *= scale
        graph_w *= scale
        graph_h *= scale

    offset_x = (width - graph_w) / 2 - min_x
    offset_y = (height - graph_h) / 2 - min_y
    for node in doc.nodes:
        node.position.x += offset_x
        node.position.y += offset_y


def _place_swimlane(doc: DiagramDoc, layers: dict[int, list[str]], direction: Direction) -> None:
    """Layer drives the flow axis; the node's lane drives the cross axis."""
    by_id = {n.id: n for n in doc.nodes}
    horizontal = direction in (Direction.LR, Direction.RL)
    lanes = sorted(doc.lanes, key=lambda lane: lane.order)
    lane_index = {lane.id: i for i, lane in enumerate(lanes)}

    lane_thickness = (
        max((n.size.height for n in doc.nodes), default=64) + LANE_PADDING * 2
        if horizontal
        else max((n.size.width for n in doc.nodes), default=180) + LANE_PADDING * 2
    )

    flow = float(LANE_HEADER)
    for depth in sorted(layers):
        ids = layers[depth]
        extent = max(by_id[n].size.width if horizontal else by_id[n].size.height for n in ids)
        # Nodes sharing a layer *and* a lane get pushed further along the flow
        # axis, one full extent + gap apart, so they don't stack on each
        # other — half an extent (the old offset) still leaves two same-sized
        # boxes overlapping by half their width.
        seen_in_lane: dict[int, int] = defaultdict(int)
        for node_id in ids:
            node = by_id[node_id]
            row = lane_index.get(node.lane or "", 0)
            offset = seen_in_lane[row] * (extent + NODE_GAP)
            seen_in_lane[row] += 1
            slot = row * lane_thickness + LANE_PADDING
            if horizontal:
                node.position.x = flow + offset
                node.position.y = slot
            else:
                node.position.x = slot
                node.position.y = flow + offset
        # However many nodes stacked into the deepest lane at this depth,
        # reserve room for all of them before the next layer starts.
        max_stack = max(seen_in_lane.values(), default=1)
        flow += extent + max(0, max_stack - 1) * (extent + NODE_GAP) + LAYER_GAP

    doc.meta["lane_thickness"] = lane_thickness
    doc.meta["lane_span"] = flow + LANE_PADDING
    doc.meta["lane_axis"] = "y" if horizontal else "x"

    if direction in (Direction.RL, Direction.BT):
        _mirror(doc, horizontal)


def _place_grid(doc: DiagramDoc) -> None:
    cols = max(1, round(len(doc.nodes) ** 0.5))
    col_w = max((n.size.width for n in doc.nodes), default=180) + NODE_GAP
    row_h = max((n.size.height for n in doc.nodes), default=64) + NODE_GAP
    for i, node in enumerate(doc.nodes):
        node.position.x = (i % cols) * col_w
        node.position.y = (i // cols) * row_h


def _arc_points(cx: float, cy: float, start: float, end: float, radius: float) -> list[tuple[float, float]]:
    """Sampled points along an arc — used to bound a wedge's box without
    assuming the box's tightest corners sit at the slice's start/end angles
    (they don't, once a slice bulges past either sample toward the arc's
    midpoint)."""
    steps = 6
    return [
        (
            cx + math.cos(math.radians(start + (end - start) * i / steps)) * radius,
            cy + math.sin(math.radians(start + (end - start) * i / steps)) * radius,
        )
        for i in range(steps + 1)
    ]


def _place_radial(doc: DiagramDoc) -> None:
    """Arrange every `wedge` node as an equal slice of a ring, with an
    optional `hub` node centred in the hole.

    Unlike every other placement here, a wedge isn't a rectangle — so instead
    of a box *being* the shape, each wedge's `position`/`size` is just the
    tight bounding box around that one slice plus its label, and the actual
    polar geometry (angles, radii, the shared wheel centre) goes to `style`
    for the frontend to draw the real SVG arc from. Kept out of `_sizes()`
    because nothing about a wedge's box follows from its label length.
    """
    wedges = [n for n in doc.nodes if n.kind == NodeKind.wedge]
    if not wedges:
        return
    hub = next((n for n in doc.nodes if n.kind == NodeKind.hub), None)

    count = len(wedges)
    outer_r = max(220.0, 40.0 + count * 26.0)
    inner_r = outer_r * 0.5
    label_r = outer_r + RADIAL_LABEL_GAP
    slice_deg = (360.0 - count * RADIAL_GAP_DEG) / count

    # A wheel this size, centred with enough clearance on every side for a
    # label swinging out to label_r at any angle.
    half = label_r + 160.0
    cx, cy = half, half

    for i, node in enumerate(wedges):
        start = -90.0 + i * (slice_deg + RADIAL_GAP_DEG)
        end = start + slice_deg
        mid = math.radians((start + end) / 2.0)
        on_right = math.cos(mid) >= 0

        # Dragging one wedge would desync it from the ring everything else on
        # this wheel is drawn relative to — there's nowhere sane for a wedge
        # to move to on its own.
        node.locked = True

        if node.style.get("color") is None:
            node.style["color"] = RADIAL_PALETTE[i % len(RADIAL_PALETTE)]
        node.style.update(
            {
                "shape": "wedge",
                "startAngle": start,
                "endAngle": end,
                "innerRadius": inner_r,
                "outerRadius": outer_r,
                "labelRadius": label_r,
                "labelSide": "right" if on_right else "left",
            }
        )

        label_w = max(90.0, min(220.0, 20.0 + len(node.label) * 7.2))
        label_h = 40.0 if node.description else 22.0
        label_x = cx + math.cos(mid) * label_r
        label_y = cy + math.sin(mid) * label_r
        label_x0 = label_x if on_right else label_x - label_w

        points = (
            _arc_points(cx, cy, start, end, outer_r)
            + _arc_points(cx, cy, start, end, inner_r)
            + [(label_x0, label_y - label_h / 2), (label_x0 + label_w, label_y + label_h / 2)]
        )
        min_x = min(p[0] for p in points)
        min_y = min(p[1] for p in points)
        max_x = max(p[0] for p in points)
        max_y = max(p[1] for p in points)

        node.position.x = min_x
        node.position.y = min_y
        node.size.width = max_x - min_x
        node.size.height = max_y - min_y
        node.style["centerX"] = cx - min_x
        node.style["centerY"] = cy - min_y

    if hub is not None:
        hub_r = max(70.0, inner_r - 30.0)
        hub.position.x = cx - hub_r
        hub.position.y = cy - hub_r
        hub.size.width = hub_r * 2
        hub.size.height = hub_r * 2
        hub.locked = True


def _group_ancestors(doc: DiagramDoc) -> dict[str, list[str]]:
    """Every group's own id followed by its ancestors, outermost last."""
    parent = _group_parents(doc)
    chains: dict[str, list[str]] = {}
    for gid in parent:
        chain, cursor = [gid], parent[gid]
        while cursor is not None:
            chain.append(cursor)
            cursor = parent.get(cursor)
        chains[gid] = chain
    return chains


def _group_gap(
    a: str | None,
    b: str | None,
    chains: dict[str, list[str]],
    horizontal: bool,
) -> float:
    """Extra cross-axis room needed between two neighbouring nodes.

    NODE_GAP alone assumes nothing is drawn between two siblings. When they sit
    in different containers there are borders in between, each wanting its own
    padding, and each container entered also wants room for its header strip —
    without this two adjacent subnets are drawn overlapping each other.
    """
    if a == b:
        return 0.0
    up = [g for g in chains.get(a or "", []) if g not in chains.get(b or "", [])]
    down = [g for g in chains.get(b or "", []) if g not in chains.get(a or "", [])]
    # The header sits above the contents, so it only eats cross-axis room when
    # the cross axis *is* y — i.e. when the flow runs horizontally.
    return (len(up) + len(down)) * GROUP_PAD + (len(down) * GROUP_HEADER if horizontal else 0.0)


def _cross_offsets(
    ids: list[str],
    by_id: dict[str, Node],
    group_of: dict[str, str],
    chains: dict[str, list[str]],
    horizontal: bool,
) -> tuple[list[float], float]:
    """Cross-axis offset of each node in a layer, and the layer's total length.

    With no groups in play this is exactly the old
    `sum(sizes) + NODE_GAP * (n - 1)`, so ungrouped diagrams lay out unchanged.
    """
    offsets: list[float] = []
    cursor = 0.0
    prev: str | None = None
    for nid in ids:
        if prev is not None:
            cursor += NODE_GAP + _group_gap(
                group_of.get(prev), group_of.get(nid), chains, horizontal
            )
        offsets.append(cursor)
        cursor += by_id[nid].size.height if horizontal else by_id[nid].size.width
        prev = nid
    return offsets, cursor


def _group_parents(doc: DiagramDoc) -> dict[str, str | None]:
    """Each group's parent, with dangling references and cycles broken.

    The validator reports both, but layout has to survive them on its own: this
    runs on whatever the model just produced, which hasn't necessarily been
    validated, and a parent cycle would otherwise recurse forever.
    """
    known = {g.id for g in doc.groups}
    parent: dict[str, str | None] = {
        g.id: (g.parent if g.parent in known and g.parent != g.id else None) for g in doc.groups
    }
    for gid in list(parent):
        seen = {gid}
        cursor = parent[gid]
        while cursor is not None:
            if cursor in seen:
                parent[gid] = None  # cycle — promote this one to top level
                break
            seen.add(cursor)
            cursor = parent.get(cursor)
    return parent


def _place_groups(doc: DiagramDoc) -> None:
    """Size every container to whatever it holds.

    Bottom-up: a group's rect is the union of its member nodes and its
    already-sized child groups, padded, with a header strip on top. A group
    holding nothing gets no rect at all — an empty container has no natural
    size, and drawing a placeholder for one just leaves a stray box behind.
    """
    if not doc.groups:
        for key in ("group_pad", "group_header"):
            doc.meta.pop(key, None)
        return

    # A page-fit pass shrinks node *positions* only (box sizes stay real, for
    # readability) — so the gap between two nodes in different containers
    # shrinks by the same factor. Padding has to follow, or it stops fitting
    # inside that shrunk gap and pushes sibling containers into each other.
    scale = float(doc.meta.get("fit_scale", 1.0))
    pad = GROUP_PAD * scale
    header = GROUP_HEADER * scale

    parent = _group_parents(doc)
    depth: dict[str, int] = {}
    for gid in parent:
        d, cursor = 0, parent[gid]
        while cursor is not None:
            d += 1
            cursor = parent.get(cursor)
        depth[gid] = d

    members: dict[str, list[Node]] = defaultdict(list)
    for node in doc.nodes:
        if node.group in parent:
            members[node.group or ""].append(node)
    children: dict[str, list[str]] = defaultdict(list)
    for gid, pid in parent.items():
        if pid is not None:
            children[pid].append(gid)

    by_id = {g.id: g for g in doc.groups}
    for gid in sorted(parent, key=lambda g: depth[g], reverse=True):
        boxes = [
            (n.position.x, n.position.y, n.position.x + n.size.width, n.position.y + n.size.height)
            for n in members[gid]
        ]
        boxes += [
            (r.x, r.y, r.x + r.width, r.y + r.height)
            for r in (by_id[c].rect for c in children[gid])
            if r is not None
        ]
        if not boxes:
            by_id[gid].rect = None
            continue
        x1 = min(b[0] for b in boxes) - pad
        y1 = min(b[1] for b in boxes) - pad - header
        x2 = max(b[2] for b in boxes) + pad
        y2 = max(b[3] for b in boxes) + pad
        by_id[gid].rect = Rect(x=x1, y=y1, width=x2 - x1, height=y2 - y1)

    doc.meta["group_pad"] = pad
    doc.meta["group_header"] = header


def _mirror(doc: DiagramDoc, horizontal: bool) -> None:
    if horizontal:
        far = max(n.position.x + n.size.width for n in doc.nodes)
        for n in doc.nodes:
            n.position.x = far - n.position.x - n.size.width
    else:
        far = max(n.position.y + n.size.height for n in doc.nodes)
        for n in doc.nodes:
            n.position.y = far - n.position.y - n.size.height


# --------------------------------------------------------------------------
# Incremental placement
# --------------------------------------------------------------------------

# Where a new node lands relative to whatever it connects to, per direction —
# one step forward along the flow's own axis.
FORWARD_STEP: dict[Direction, tuple[float, float]] = {
    Direction.LR: (240.0, 0.0),
    Direction.RL: (-240.0, 0.0),
    Direction.TB: (0.0, 150.0),
    Direction.BT: (0.0, -150.0),
}
SIBLING_GAP = 120.0


def place_new_nodes(doc: DiagramDoc, new_ids: set[str]) -> None:
    """Position nodes an edit introduced, without moving anything that was
    already on the canvas. Used instead of a full relayout so "add one more
    step" doesn't also reshuffle every node that already had a place — see
    the needs_relayout note in prompts.py for when a full layout runs instead.
    """
    if not new_ids:
        return
    dx, dy = FORWARD_STEP.get(doc.direction, FORWARD_STEP[Direction.LR])
    by_id = {n.id: n for n in doc.nodes}
    settled = {n.id for n in doc.nodes if n.id not in new_ids}
    anchored_count: dict[str, int] = defaultdict(int)
    pending = [by_id[nid] for nid in new_ids if nid in by_id]

    # A short chain of new nodes (A -> B -> C, all new) can anchor off each
    # other one link at a time, without ever touching an existing node.
    for _ in range(len(pending) or 1):
        remaining = []
        for node in pending:
            neighbor_id = next(
                (
                    (edge.target if edge.source == node.id else edge.source)
                    for edge in doc.edges
                    if node.id in (edge.source, edge.target)
                    and (edge.target if edge.source == node.id else edge.source) in settled
                ),
                None,
            )
            if neighbor_id is None:
                remaining.append(node)
                continue
            anchor = by_id[neighbor_id]
            slot = anchored_count[neighbor_id]
            anchored_count[neighbor_id] += 1
            node.position = Position(
                x=anchor.position.x + dx + (slot * SIBLING_GAP if dx == 0 else 0),
                y=anchor.position.y + dy + (slot * SIBLING_GAP if dy == 0 else 0),
            )
            settled.add(node.id)
        pending = remaining
        if not pending:
            break

    if pending:
        # Nothing positioned to anchor to — an isolated node, or new nodes
        # only connected to each other in a cycle. Cascade off the existing
        # diagram's far edge so they land clear of everything else.
        others = [n for n in doc.nodes if n.id not in new_ids]
        base_x = max((n.position.x for n in others), default=0.0)
        base_y = max((n.position.y for n in others), default=0.0)
        for i, node in enumerate(pending):
            node.position = Position(x=base_x + dx, y=base_y + dy + i * SIBLING_GAP)

    _clamp_into_groups(doc, new_ids)
    _place_groups(doc)


def _clamp_into_groups(doc: DiagramDoc, new_ids: set[str]) -> None:
    """Pull a newly added node back inside the container it was added to.

    The anchoring above steps one hop along the flow from a neighbour, which
    routinely overshoots the group the node was meant to join. Because a
    group's rect is the union of its members, one stray node would drag the
    container — and every ancestor above it — out with it.
    """
    by_id = {g.id: g for g in doc.groups}
    for node in doc.nodes:
        if node.id not in new_ids or not node.group:
            continue
        group = by_id.get(node.group)
        if group is None or group.rect is None:
            continue
        r = group.rect
        left = r.x + GROUP_PAD
        top = r.y + GROUP_PAD + GROUP_HEADER
        # max() guards a container currently narrower than the node itself:
        # clamping still lands it on the inner edge, and _place_groups then
        # grows the rect by exactly the overflow.
        node.position.x = min(max(node.position.x, left), max(left, r.x + r.width - GROUP_PAD - node.size.width))
        node.position.y = min(max(node.position.y, top), max(top, r.y + r.height - GROUP_PAD - node.size.height))
