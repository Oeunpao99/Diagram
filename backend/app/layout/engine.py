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

from app.schemas.diagram import DiagramDoc, Direction, NodeKind

# Spacing, in px. Tuned for the default 180x64 node.
LAYER_GAP = 110  # along the flow axis, between layers
NODE_GAP = 46  # across the flow axis, between siblings
LANE_PADDING = 40
LANE_HEADER = 160  # room for the lane title strip

DEFAULT_SIZES: dict[NodeKind, tuple[float, float]] = {
    NodeKind.start: (140, 56),
    NodeKind.end: (140, 56),
    NodeKind.decision: (170, 100),
    NodeKind.database: (170, 80),
    NodeKind.actor: (130, 90),
    NodeKind.note: (200, 80),
}


def _sizes(doc: DiagramDoc) -> None:
    """Give every node a sensible box before we measure anything."""
    for node in doc.nodes:
        w, h = DEFAULT_SIZES.get(node.kind, (180, 64))
        # Long labels need a wider box or the text overflows the shape.
        if node.size.width in (0, 180):
            node.size.width = max(w, min(300, 22 + len(node.label) * 8.2))
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
) -> DiagramDoc:
    """Position every node. Returns the same doc, mutated."""
    if not doc.nodes:
        return doc

    direction = direction or doc.direction
    doc.direction = direction
    _sizes(doc)

    node_ids = [n.id for n in doc.nodes]
    valid = set(node_ids)
    edges = [(e.source, e.target) for e in doc.edges if e.source in valid and e.target in valid]

    depth_of = _layer(node_ids, edges)
    layers: dict[int, list[str]] = defaultdict(list)
    for node_id in node_ids:
        layers[depth_of[node_id]].append(node_id)

    if algorithm == "swimlane" and doc.lanes:
        _place_swimlane(doc, layers, direction)
    elif algorithm == "grid":
        _place_grid(doc)
    else:
        _order(layers, edges)
        _place_layered(doc, layers, direction)
    return doc


def _place_layered(doc: DiagramDoc, layers: dict[int, list[str]], direction: Direction) -> None:
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
        # Nodes sharing a layer *and* a lane get nudged apart so they don't stack.
        seen_in_lane: dict[int, int] = defaultdict(int)
        for node_id in ids:
            node = by_id[node_id]
            row = lane_index.get(node.lane or "", 0)
            offset = seen_in_lane[row] * (extent * 0.5)
            seen_in_lane[row] += 1
            slot = row * lane_thickness + LANE_PADDING
            if horizontal:
                node.position.x = flow + offset
                node.position.y = slot
            else:
                node.position.x = slot
                node.position.y = flow + offset
        flow += extent + LAYER_GAP

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
