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

from collections import defaultdict, deque

from app.schemas.diagram import DiagramDoc, Direction, Node, NodeKind, Position

# Spacing, in px. Tuned for the default 196x70 node.
LAYER_GAP = 130  # along the flow axis, between layers
NODE_GAP = 54  # across the flow axis, between siblings
LANE_PADDING = 44
LANE_HEADER = 160  # room for the lane title strip

DEFAULT_SIZES: dict[NodeKind, tuple[float, float]] = {
    NodeKind.start: (150, 60),
    NodeKind.end: (150, 60),
    NodeKind.decision: (184, 108),
    NodeKind.database: (184, 88),
    NodeKind.actor: (140, 96),
    NodeKind.note: (210, 88),
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


def _order(
    layers: dict[int, list[str]],
    edges: list[tuple[str, str]],
    sweeps: int = 4,
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
        for key in ("page_x", "page_y", "page_width", "page_height"):
            doc.meta.pop(key, None)

    node_ids = [n.id for n in doc.nodes]
    valid = set(node_ids)
    edges = [(e.source, e.target) for e in doc.edges if e.source in valid and e.target in valid]

    depth_of = _layer(node_ids, edges)
    layers: dict[int, list[str]] = defaultdict(list)
    for node_id in node_ids:
        layers[depth_of[node_id]].append(node_id)
    _route_edges(doc, depth_of)

    if algorithm == "swimlane" and doc.lanes:
        _place_swimlane(doc, layers, direction)
        if target:
            _fit_to_box(doc, width or 0, height or 0)
    elif algorithm == "grid":
        _place_grid(doc)
        if target:
            _fit_to_box(doc, width or 0, height or 0)
    else:
        _order(layers, edges)
        _place_layered(doc, layers, direction, width if target else None, height if target else None)

    if target:
        doc.meta["page_x"] = 0.0
        doc.meta["page_y"] = 0.0
    return doc


def _route_edges(doc: DiagramDoc, depth_of: dict[str, int]) -> None:
    """Keep back/lateral edges out of the main flow's corridor.

    Every edge defaults to the same pair of ports — right side out, left side
    in — because that's what a *forward* edge along the flow axis wants. A
    decision's rejection branch, a hand-off back to an earlier step, a retry
    loop — anything that doesn't advance to a later layer — wants that same
    pair too, so it ends up riding the exact same corridor as the forward
    flow and visually fuses with it (or with every other such edge). Routing
    it through the node's top/bottom ports instead — unused by the forward
    flow, which stays on left/right — gives it its own lane.

    Only touches edges that have never had a handle chosen (by a user's
    manual drag, or by an earlier run of this same step) — a deliberate
    choice is never silently reverted.
    """
    for edge in doc.edges:
        s_depth = depth_of.get(edge.source)
        t_depth = depth_of.get(edge.target)
        if s_depth is None or t_depth is None:
            continue
        forward = t_depth > s_depth
        if forward or edge.source_handle is not None or edge.target_handle is not None:
            continue
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
    # Cross-axis length of each layer, so layers can be centred against each other.
    cross_len = {
        d: sum((by_id[n].size.height if horizontal else by_id[n].size.width) for n in ids)
        + NODE_GAP * (len(ids) - 1)
        for d, ids in layers.items()
    }

    if width is not None and height is not None:
        _place_layered_fit(doc, layers, by_id, layer_extent, cross_len, direction, width, height)
    else:
        widest = max(cross_len.values()) if cross_len else 0
        flow = 0.0
        for depth in sorted(layers):
            ids = layers[depth]
            cross = (widest - cross_len[depth]) / 2
            for node_id in ids:
                node = by_id[node_id]
                if horizontal:
                    node.position.x = flow
                    node.position.y = cross
                    cross += node.size.height + NODE_GAP
                else:
                    node.position.x = cross
                    node.position.y = flow
                    cross += node.size.width + NODE_GAP
            flow += layer_extent[depth] + LAYER_GAP

    if direction in (Direction.RL, Direction.BT):
        _mirror(doc, horizontal)

    if width is not None and height is not None:
        _fit_to_box(doc, width, height)


def _place_layered_fit(
    doc: DiagramDoc,
    layers: dict[int, list[str]],
    by_id: dict[str, Node],
    layer_extent: dict[int, float],
    cross_len: dict[int, float],
    direction: Direction,
    width: float,
    height: float,
) -> None:
    """Layered placement constrained to a page box.

    The straight pipeline stacks every layer along the flow axis, so a narrow
    page (a portrait A4, a vertical slide) leaves a long, scrawny flow. Here
    the layer sequence is broken into *chunks*: consecutive layers still stack
    along the flow axis inside a chunk, and the chunks themselves stack along
    the cross axis — a flow that "wraps" like text to stay inside the box.
    """
    horizontal = direction in (Direction.LR, Direction.RL)
    flow_limit = width if horizontal else height
    layer_ids = sorted(layers)

    # Greedy wrap: keep adding layers to the current chunk until the next one
    # would push the chunk past the flow limit.
    chunks: list[list[int]] = []
    current: list[int] = []
    current_flow = 0.0
    for depth in layer_ids:
        ext = layer_extent[depth]
        nxt = current_flow + (LAYER_GAP if current else 0) + ext
        if current and nxt > flow_limit:
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
            cross = cross_cursor + (chunk_cross_extent - cross_len[depth]) / 2
            for node_id in ids:
                node = by_id[node_id]
                if horizontal:
                    node.position.x = flow
                    node.position.y = cross
                    cross += node.size.height + NODE_GAP
                else:
                    node.position.x = cross
                    node.position.y = flow
                    cross += node.size.width + NODE_GAP
            flow += layer_extent[depth] + LAYER_GAP
        cross_cursor += chunk_cross_extent + NODE_GAP


def _fit_to_box(doc: DiagramDoc, width: float, height: float) -> None:
    """Shrink (never stretch) node positions and centre them inside the box.

    Only coordinates are touched — node boxes keep their real sizes, so the
    graph always fits the target page while staying readable.
    """
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
        for node in doc.nodes:
            node.position.x *= scale
            node.position.y *= scale
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
