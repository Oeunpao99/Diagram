"""Nested containers.

The rect on a group is derived, never authored, so these tests are mostly
about containment holding after a real layout pass — a container that doesn't
enclose what it holds is the one failure users would actually see.

Run with:  uv run python -m pytest -q
"""

import pytest

from app.layout.engine import apply_layout
from app.schemas.diagram import AgentAction, DiagramDoc, Direction, Rect
from app.services.agent_tools import apply_tools
from app.services.ai import _coerce_doc, _keep_groups, repair
from app.services.validator import validate

AZURE = {
    "title": "Azure",
    "diagram_type": "architecture",
    "direction": "LR",
    "groups": [
        {"id": "sub", "label": "Subscription"},
        {"id": "vnet", "label": "VNet", "parent": "sub"},
        {"id": "web", "label": "Web subnet", "parent": "vnet"},
        {"id": "data", "label": "Data subnet", "parent": "vnet"},
    ],
    "nodes": [
        {"id": "user", "label": "User", "kind": "actor"},
        {"id": "gw", "label": "Gateway", "kind": "service", "group": "web"},
        {"id": "app", "label": "Web app", "kind": "service", "group": "web"},
        {"id": "sql", "label": "SQL", "kind": "database", "group": "data"},
        {"id": "blob", "label": "Blob", "kind": "database", "group": "data"},
    ],
    "edges": [
        {"id": "e1", "source": "user", "target": "gw"},
        {"id": "e2", "source": "gw", "target": "app"},
        {"id": "e3", "source": "app", "target": "sql"},
        {"id": "e4", "source": "app", "target": "blob"},
    ],
}


def _encloses(outer: Rect, inner: Rect, slack: float = 0.01) -> bool:
    return (
        inner.x >= outer.x - slack
        and inner.y >= outer.y - slack
        and inner.x + inner.width <= outer.x + outer.width + slack
        and inner.y + inner.height <= outer.y + outer.height + slack
    )


def _laid_out(raw: dict, direction: str | None = None) -> DiagramDoc:
    doc = DiagramDoc.model_validate({**raw, **({"direction": direction} if direction else {})})
    apply_layout(doc, doc.direction)
    return doc


@pytest.mark.parametrize("direction", ["LR", "RL", "TB", "BT"])
def test_rect_encloses_every_member(direction):
    doc = _laid_out(AZURE, direction)
    rects = {g.id: g.rect for g in doc.groups}
    for node in doc.nodes:
        if not node.group:
            continue
        box = Rect(
            x=node.position.x,
            y=node.position.y,
            width=node.size.width,
            height=node.size.height,
        )
        assert _encloses(rects[node.group], box), f"{node.id} escapes {node.group} in {direction}"


@pytest.mark.parametrize("direction", ["LR", "RL", "TB", "BT"])
def test_child_rect_nests_inside_its_parent(direction):
    doc = _laid_out(AZURE, direction)
    rects = {g.id: g.rect for g in doc.groups}
    for group in doc.groups:
        if group.parent and group.rect:
            assert _encloses(rects[group.parent], group.rect), (
                f"{group.id} escapes {group.parent} in {direction}"
            )


@pytest.mark.parametrize("direction", ["LR", "RL", "TB", "BT"])
def test_siblings_do_not_overlap_and_hold_no_strangers(direction):
    """The two failures that make a container diagram look broken rather than
    merely imperfect: boxes drawn through each other, and a node rendered
    inside a boundary it has nothing to do with."""
    doc = _laid_out(AZURE, direction)
    report = validate(doc)
    assert not [i for i in report.issues if i.level in ("error", "warning")], [
        i.message for i in report.issues
    ]


def test_empty_group_gets_no_rect():
    doc = _laid_out({**AZURE, "groups": [*AZURE["groups"], {"id": "spare", "label": "Spare"}]})
    assert next(g for g in doc.groups if g.id == "spare").rect is None


def test_layout_survives_a_parent_cycle():
    doc = DiagramDoc.model_validate(
        {
            "title": "Cycle",
            "groups": [
                {"id": "a", "label": "A", "parent": "b"},
                {"id": "b", "label": "B", "parent": "a"},
            ],
            "nodes": [{"id": "n1", "label": "One", "group": "a"}],
            "edges": [],
        }
    )
    apply_layout(doc, Direction.LR)  # must not recurse forever
    assert any(i.level == "error" for i in validate(doc).issues)


def test_ungrouped_layout_is_untouched():
    """The cross-axis spacing rework must reduce to the old formula when no
    group is in play, or every existing diagram shifts."""
    raw = {
        "title": "Plain",
        "nodes": [
            {"id": "a", "label": "A"},
            {"id": "b", "label": "B"},
            {"id": "c", "label": "C"},
        ],
        "edges": [
            {"id": "e1", "source": "a", "target": "b"},
            {"id": "e2", "source": "a", "target": "c"},
        ],
    }
    doc = _laid_out(raw)
    b, c = (next(n for n in doc.nodes if n.id == i) for i in ("b", "c"))
    assert c.position.y - (b.position.y + b.size.height) == pytest.approx(54)  # NODE_GAP


def test_coerce_strips_an_authored_rect():
    doc = _coerce_doc(
        {
            "title": "T",
            "nodes": [{"id": "a", "label": "A", "group": "g"}],
            "edges": [],
            "groups": [{"id": "g", "label": "G", "rect": {"x": 9, "y": 9, "width": 9, "height": 9}}],
        },
        fallback_direction=Direction.LR,
    )
    assert doc.groups[0].rect is None


def test_rewrite_that_forgets_groups_keeps_them():
    previous = DiagramDoc.model_validate(
        {
            "title": "P",
            "groups": [{"id": "g", "label": "G"}],
            "nodes": [{"id": "a", "label": "A", "group": "g"}],
            "edges": [],
        }
    )
    updated = DiagramDoc.model_validate(
        {"title": "P", "groups": [], "nodes": [{"id": "a", "label": "A renamed"}], "edges": []}
    )
    _keep_groups(previous, updated)
    assert [g.id for g in updated.groups] == ["g"]
    assert updated.nodes[0].group == "g"


def test_repair_prunes_empty_groups_up_the_tree():
    doc = DiagramDoc.model_validate(
        {
            "title": "E",
            "edges": [],
            "groups": [
                {"id": "outer", "label": "Outer"},
                {"id": "inner", "label": "Inner", "parent": "outer"},
                {"id": "used", "label": "Used"},
            ],
            "nodes": [{"id": "a", "label": "A", "group": "used"}],
        }
    )
    doc, notes = repair(doc)
    assert [g.id for g in doc.groups] == ["used"]
    assert len(notes) == 2


def test_delete_group_lifts_children_to_the_grandparent():
    doc = DiagramDoc.model_validate(AZURE)
    apply_tools(doc, [AgentAction(tool="delete_group", args={"id": "vnet"})], selection=[])
    parents = {g.id: g.parent for g in doc.groups}
    assert parents == {"sub": None, "web": "sub", "data": "sub"}
    assert {n.id: n.group for n in doc.nodes if n.group} == {
        "gw": "web",
        "app": "web",
        "sql": "data",
        "blob": "data",
    }


CLOUD_NETWORK = {
    "title": "Cloud network",
    "diagram_type": "architecture",
    "direction": "LR",
    "groups": [
        {"id": "sub", "label": "Subscription"},
        {"id": "vnet", "label": "VNet", "parent": "sub"},
        {"id": "web", "label": "Web subnet", "parent": "vnet"},
        {"id": "data", "label": "Data subnet", "parent": "vnet"},
    ],
    "nodes": [
        {"id": "user", "label": "User", "kind": "actor"},
        {"id": "gw", "label": "App Gateway", "kind": "service", "group": "web"},
        {"id": "waf", "label": "WAF", "kind": "service", "group": "web"},
        {"id": "probe", "label": "Health Probe", "kind": "service", "group": "web"},
        {"id": "pool", "label": "Failover Pool", "kind": "service", "group": "web"},
        {"id": "app", "label": "Web App", "kind": "service", "group": "web"},
        {"id": "sql", "label": "SQL Instance", "kind": "database", "group": "data"},
        {"id": "blob", "label": "Blob Storage", "kind": "database", "group": "data"},
        {"id": "nsg", "label": "NSG Policies", "kind": "system"},
        {"id": "mon", "label": "Alerting/Monitoring", "kind": "system"},
    ],
    "edges": [
        {"id": "e1", "source": "user", "target": "gw"},
        {"id": "e2", "source": "gw", "target": "waf"},
        {"id": "e3", "source": "waf", "target": "probe"},
        {"id": "e4", "source": "probe", "target": "pool"},
        {"id": "e5", "source": "pool", "target": "app"},
        {"id": "e6", "source": "app", "target": "sql"},
        {"id": "e7", "source": "app", "target": "blob"},
        {"id": "e8", "source": "gw", "target": "nsg"},
        {"id": "e9", "source": "app", "target": "mon"},
    ],
}

# The actual presets offered in the UI (PAGE_PRESETS in agent_tools.py) — the
# ones a real "fit this to a slide" click will hit.
REAL_PAGE_PRESETS = {
    "slide-16-9": (1920, 1080),
    "slide-4-3": (1280, 960),
    "a4-landscape": (1123, 794),
    "square": (1080, 1080),
}


@pytest.mark.parametrize("preset", list(REAL_PAGE_PRESETS))
def test_page_fit_keeps_containers_apart(preset):
    """Fitting a grouped diagram to a page used to draw sibling containers
    overlapping, with unrelated nodes rendering inside a container they don't
    belong to — the wrap-to-box algorithm chose row breaks with no idea a
    container's own members shouldn't be split across two of them."""
    width, height = REAL_PAGE_PRESETS[preset]
    doc = DiagramDoc.model_validate(CLOUD_NETWORK)
    apply_layout(doc, doc.direction, width=width, height=height)

    rects = {g.id: g.rect for g in doc.groups if g.rect}
    assert not _overlaps(rects["web"], rects["data"]), preset

    # Only containers with direct members of their own are checked for
    # intrusion — an ungrouped actor incidentally falling inside the outer
    # "Subscription" boundary (which holds nothing but the VNet) isn't a false
    # membership the way it would be for a small, specific subnet.
    direct_members = {"web", "data"}
    parent = {g.id: g.parent for g in doc.groups}
    for node in doc.nodes:
        cx = node.position.x + node.size.width / 2
        cy = node.position.y + node.size.height / 2
        chain = set()
        cursor = node.group
        while cursor:
            chain.add(cursor)
            cursor = parent.get(cursor)
        for group_id in direct_members:
            rect = rects[group_id]
            inside = rect.x <= cx <= rect.x + rect.width and rect.y <= cy <= rect.y + rect.height
            assert not (inside and group_id not in chain), f"{preset}: {node.id} in {group_id}"


def _overlaps(a: Rect, b: Rect) -> bool:
    return a.x < b.x + b.width and a.x + a.width > b.x and a.y < b.y + b.height and a.y + a.height > b.y


def test_group_layer_span_blocks_a_chunk_break():
    from app.layout.engine import _group_layer_spans

    # 'web' occupies layers 1 through 4; a chunk break must never land on 2,
    # 3 or 4 (only entering at 1, or leaving after 4, is safe).
    depth_of = {"gw": 1, "waf": 2, "probe": 3, "pool": 4, "sql": 6}
    group_of = {"gw": "web", "waf": "web", "probe": "web", "pool": "web", "sql": "data"}
    assert _group_layer_spans(depth_of, group_of) == {2, 3, 4}


def test_agent_can_build_a_nested_diagram():
    doc = DiagramDoc.model_validate(
        {"title": "A", "diagram_type": "architecture", "nodes": [], "edges": []}
    )
    out = apply_tools(
        doc,
        [
            AgentAction(tool=tool, args=args)
            for tool, args in [
                ("add_group", {"label": "VNet"}),
                ("add_group", {"label": "Web subnet", "parent": "vnet"}),
                ("add_node", {"label": "Gateway", "id": "gw", "group": "web_subnet"}),
                ("add_node", {"label": "Web app", "id": "app", "after": "gw"}),
                ("set_node_group", {"node_id": "app", "group_id": "web_subnet"}),
            ]
        ],
        selection=[],
    )
    assert not out.warnings
    assert {n.id: n.group for n in doc.nodes} == {"gw": "web_subnet", "app": "web_subnet"}
    apply_layout(doc, doc.direction)
    assert next(g for g in doc.groups if g.id == "vnet").rect is not None
