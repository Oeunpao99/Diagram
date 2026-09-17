"""Diagram checker.

Runs without the model: deterministic, instant, and it catches exactly the
class of problem that made the generated diagrams feel wrong — orphan nodes,
approvals with no rejection path, boxes sitting on top of each other.
"""

from __future__ import annotations

from collections import Counter, defaultdict

from app.schemas.diagram import DiagramDoc, DiagramType, Issue, NodeKind, ValidationReport

APPROVAL_WORDS = ("approve", "verify", "check", "review", "inspect", "validate", "confirm")
REJECT_WORDS = ("reject", "fail", "deny", "return", "decline", "hold", "exception", "no")

# Decision and approval rules only make sense where a diagram describes a
# progression through time. An architecture or network diagram isn't "approving"
# anything — "Inspection service" is not a step that needs a rejection branch.
FLOW_TYPES = frozenset({DiagramType.process_flow, DiagramType.swimlane, DiagramType.data_flow})


def validate(doc: DiagramDoc) -> ValidationReport:
    issues: list[Issue] = []
    issues += _structural(doc)
    issues += _business(doc)
    issues += _visual(doc)

    return ValidationReport(
        ok=not any(i.level == "error" for i in issues),
        node_count=len(doc.nodes),
        edge_count=len(doc.edges),
        lane_count=len(doc.lanes),
        group_count=len(doc.groups),
        issues=issues,
    )


def _structural(doc: DiagramDoc) -> list[Issue]:
    issues: list[Issue] = []
    ids = [n.id for n in doc.nodes]
    id_set = set(ids)

    for node_id, count in Counter(ids).items():
        if count > 1:
            issues.append(
                Issue(
                    level="error",
                    category="structural",
                    message=f"Node id '{node_id}' is used {count} times.",
                    node_ids=[node_id],
                    fixable=True,
                )
            )

    for edge in doc.edges:
        missing = [end for end in (edge.source, edge.target) if end not in id_set]
        if missing:
            issues.append(
                Issue(
                    level="error",
                    category="structural",
                    message=f"Connector '{edge.id}' points at a node that doesn't exist: "
                    + ", ".join(missing),
                    edge_ids=[edge.id],
                    fixable=True,
                )
            )
        if edge.source == edge.target:
            issues.append(
                Issue(
                    level="warning",
                    category="structural",
                    message=f"Connector '{edge.id}' loops a node back to itself.",
                    edge_ids=[edge.id],
                )
            )

    # `note`, `wedge` and `hub` are never expected to hang off an edge — a
    # sticky note annotates rather than participates in the flow, and a
    # radial diagram's wedges/hub are positioned by angle, not by connector.
    UNCONNECTED_OK = frozenset({NodeKind.note, NodeKind.wedge, NodeKind.hub})
    connected = {e.source for e in doc.edges} | {e.target for e in doc.edges}
    for node in doc.nodes:
        if node.id not in connected and len(doc.nodes) > 1 and node.kind not in UNCONNECTED_OK:
            issues.append(
                Issue(
                    level="warning",
                    category="structural",
                    message=f"'{node.label}' isn't connected to anything.",
                    node_ids=[node.id],
                    fixable=True,
                )
            )

    lane_ids = {lane.id for lane in doc.lanes}
    for node in doc.nodes:
        if node.lane and node.lane not in lane_ids:
            issues.append(
                Issue(
                    level="warning",
                    category="structural",
                    message=f"'{node.label}' sits in lane '{node.lane}', which isn't defined.",
                    node_ids=[node.id],
                    fixable=True,
                )
            )

    issues += _groups(doc)
    return issues


def _groups(doc: DiagramDoc) -> list[Issue]:
    """Container-tree invariants.

    The layout engine breaks cycles and dangling parents on its own so it can
    never hang, but it does so silently — these turn the same problems into
    something the user (and the AI's self-correction pass) actually sees.
    """
    if not doc.groups:
        return []
    issues: list[Issue] = []
    group_ids = {g.id for g in doc.groups}

    for group_id, count in Counter(g.id for g in doc.groups).items():
        if count > 1:
            issues.append(
                Issue(
                    level="error",
                    category="structural",
                    message=f"Container id '{group_id}' is used {count} times.",
                    fixable=True,
                )
            )

    for node in doc.nodes:
        if node.group and node.group not in group_ids:
            issues.append(
                Issue(
                    level="warning",
                    category="structural",
                    message=f"'{node.label}' sits in container '{node.group}', which isn't defined.",
                    node_ids=[node.id],
                    fixable=True,
                )
            )

    parent = {g.id: g.parent for g in doc.groups}
    for group in doc.groups:
        if group.parent and group.parent not in group_ids:
            issues.append(
                Issue(
                    level="warning",
                    category="structural",
                    message=f"Container '{group.label}' is nested in '{group.parent}', "
                    "which isn't defined.",
                    fixable=True,
                )
            )
            continue
        seen = {group.id}
        cursor, depth = parent.get(group.id), 0
        while cursor is not None and cursor in group_ids:
            if cursor in seen:
                issues.append(
                    Issue(
                        level="error",
                        category="structural",
                        message=f"Container '{group.label}' ends up nested inside itself.",
                        fixable=True,
                    )
                )
                break
            seen.add(cursor)
            cursor = parent.get(cursor)
            depth += 1
        else:
            if depth > 5:
                issues.append(
                    Issue(
                        level="warning",
                        category="structural",
                        message=f"Container '{group.label}' is nested {depth} deep — "
                        "past about five the boxes get too thin to read.",
                    )
                )
    return issues


def _business(doc: DiagramDoc) -> list[Issue]:
    issues: list[Issue] = []
    outgoing: dict[str, list] = defaultdict(list)
    incoming: dict[str, list] = defaultdict(list)
    for edge in doc.edges:
        outgoing[edge.source].append(edge)
        incoming[edge.target].append(edge)

    starts = [n for n in doc.nodes if n.kind == NodeKind.start]
    ends = [n for n in doc.nodes if n.kind == NodeKind.end]
    if doc.nodes and not starts and not any(not incoming[n.id] for n in doc.nodes):
        issues.append(
            Issue(
                level="warning",
                category="business",
                message="No entry point — every node has something flowing into it.",
            )
        )
    if doc.nodes and not ends and not any(not outgoing[n.id] for n in doc.nodes):
        issues.append(
            Issue(
                level="warning",
                category="business",
                message="No exit point — the flow never terminates.",
            )
        )

    if doc.diagram_type in FLOW_TYPES:
        for node in doc.nodes:
            outs = outgoing[node.id]
            label = node.label.lower()

            if node.kind == NodeKind.decision:
                if len(outs) < 2:
                    issues.append(
                        Issue(
                            level="warning",
                            category="business",
                            message=f"Decision '{node.label}' has only one way out.",
                            node_ids=[node.id],
                            fixable=True,
                        )
                    )
                elif not any(e.label or e.condition for e in outs):
                    issues.append(
                        Issue(
                            level="info",
                            category="business",
                            message=f"The branches out of '{node.label}' aren't labelled.",
                            node_ids=[node.id],
                            fixable=True,
                        )
                    )

            if node.kind != NodeKind.actor and any(w in label for w in APPROVAL_WORDS):
                # The rejection branch usually hangs off a decision node one hop
                # downstream ("Verify docs" -> "Docs complete?" -> "Request again"),
                # so look through decisions before calling it missing.
                reachable = list(outs)
                for edge in outs:
                    if _kind_of(doc, edge.target) == NodeKind.decision:
                        reachable += outgoing[edge.target]
                branch_text = " ".join(
                    " ".join(filter(None, [e.label, e.condition, _target_label(doc, e.target)]))
                    for e in reachable
                ).lower()
                if outs and not any(w in branch_text for w in REJECT_WORDS):
                    issues.append(
                        Issue(
                            level="warning",
                            category="business",
                            message=f"'{node.label}' has no rejection or failure path.",
                            node_ids=[node.id],
                            fixable=True,
                        )
                    )

    for node in doc.nodes:
        if node.kind == NodeKind.actor and not outgoing[node.id] and not incoming[node.id]:
            issues.append(
                Issue(
                    level="warning",
                    category="business",
                    message=f"Actor '{node.label}' never takes part in the flow.",
                    node_ids=[node.id],
                )
            )
    return issues


def _kind_of(doc: DiagramDoc, node_id: str) -> NodeKind | None:
    for node in doc.nodes:
        if node.id == node_id:
            return node.kind
    return None


def _target_label(doc: DiagramDoc, node_id: str) -> str:
    for node in doc.nodes:
        if node.id == node_id:
            return node.label
    return ""


def _visual(doc: DiagramDoc) -> list[Issue]:
    issues: list[Issue] = []
    # A wedge's box is the bounding rectangle of one pie slice, and
    # neighbouring slices' rectangles legitimately overlap near the hub even
    # though the visible arcs never touch — not the "boxes drawn on top of
    # each other" mistake this check exists to catch.
    positioned = [
        n
        for n in doc.nodes
        if (n.position.x or n.position.y) and n.kind not in (NodeKind.wedge, NodeKind.hub)
    ]

    overlaps: list[str] = []
    for i, a in enumerate(positioned):
        for b in positioned[i + 1 :]:
            if (
                a.position.x < b.position.x + b.size.width
                and a.position.x + a.size.width > b.position.x
                and a.position.y < b.position.y + b.size.height
                and a.position.y + a.size.height > b.position.y
            ):
                overlaps += [a.id, b.id]
    if overlaps:
        issues.append(
            Issue(
                level="warning",
                category="visual",
                message=f"{len(set(overlaps))} elements overlap. Run auto layout to separate them.",
                node_ids=sorted(set(overlaps)),
                fixable=True,
            )
        )

    # A container is drawn as the union of its members, so a node that merely
    # happens to sit inside one reads as belonging to it. That is the visible
    # symptom of layout failing to keep a group contiguous, and it is worth
    # reporting because nothing else in the document is wrong.
    ancestors: dict[str, set[str]] = {}
    parent = {g.id: g.parent for g in doc.groups}
    for group in doc.groups:
        chain: set[str] = set()
        cursor = group.id
        while cursor is not None and cursor not in chain:
            chain.add(cursor)
            cursor = parent.get(cursor)
        ancestors[group.id] = chain

    intruders: list[str] = []
    for group in doc.groups:
        rect = group.rect
        if rect is None:
            continue
        for node in doc.nodes:
            if group.id in ancestors.get(node.group or "", set()):
                continue
            cx = node.position.x + node.size.width / 2
            cy = node.position.y + node.size.height / 2
            if rect.x <= cx <= rect.x + rect.width and rect.y <= cy <= rect.y + rect.height:
                intruders.append(node.id)
    if intruders:
        issues.append(
            Issue(
                level="warning",
                category="visual",
                message=f"{len(set(intruders))} nodes sit inside a container they don't "
                "belong to. Run auto layout to separate them.",
                node_ids=sorted(set(intruders)),
                fixable=True,
            )
        )

    long_labels = [n.id for n in doc.nodes if len(n.label) > 48]
    if long_labels:
        issues.append(
            Issue(
                level="info",
                category="visual",
                message=f"{len(long_labels)} labels are long enough to overflow their shape.",
                node_ids=long_labels,
            )
        )

    crossings = _count_crossings(doc)
    if crossings:
        issues.append(
            Issue(
                level="info",
                category="visual",
                message=f"{crossings} connectors cross. Auto layout usually clears most of these.",
                fixable=True,
            )
        )
    return issues


def _count_crossings(doc: DiagramDoc) -> int:
    """Segment-intersection count on straight centre-to-centre lines."""
    centres = {
        n.id: (n.position.x + n.size.width / 2, n.position.y + n.size.height / 2) for n in doc.nodes
    }
    segs = [
        (centres[e.source], centres[e.target])
        for e in doc.edges
        if e.source in centres and e.target in centres
    ]

    def ccw(a, b, c) -> bool:
        return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])

    count = 0
    for i, (p1, p2) in enumerate(segs):
        for q1, q2 in segs[i + 1 :]:
            if p1 in (q1, q2) or p2 in (q1, q2):
                continue  # shared endpoint isn't a crossing
            if ccw(p1, q1, q2) != ccw(p2, q1, q2) and ccw(p1, p2, q1) != ccw(p1, p2, q2):
                count += 1
    return count
