"""Near-miss JSON from the model.

One invented enum value used to fail validation for the whole document, so a
single odd word threw away an entire generation ("security" is not a NodeKind).
Nothing the model writes should be able to do that: coercion nudges, it never
rejects.

Run with:  uv run python -m pytest -q
"""

import pytest

from app.schemas.diagram import Direction
from app.services.ai import _coerce_doc


def _doc(**overrides):
    payload = {
        "title": "T",
        "diagram_type": "architecture",
        "direction": "LR",
        "nodes": [{"id": "a", "label": "A"}],
        "edges": [],
    }
    payload.update(overrides)
    return _coerce_doc(payload, fallback_direction=Direction.LR)


@pytest.mark.parametrize(
    ("written", "expected"),
    [
        ("security", "service"),  # the one that actually broke a run
        ("firewall", "service"),
        ("api", "service"),
        ("storage", "database"),
        ("server", "system"),
        ("customer", "actor"),
        ("DATABASE", "database"),  # casing
        ("data-flow-ish-nonsense", "process"),  # unknown falls back, never raises
        ("", "process"),
        (None, "process"),
        (42, "process"),
    ],
)
def test_node_kind_is_always_coerced(written, expected):
    doc = _doc(nodes=[{"id": "a", "label": "A", "kind": written}])
    assert doc.nodes[0].kind.value == expected


def test_an_invented_kind_does_not_lose_the_other_nodes():
    doc = _doc(
        nodes=[
            {"id": "a", "label": "A", "kind": "actor"},
            {"id": "b", "label": "B", "kind": "security"},
            {"id": "c", "label": "C", "kind": "database"},
        ]
    )
    assert [n.kind.value for n in doc.nodes] == ["actor", "service", "database"]


def test_edge_style_is_coerced():
    doc = _doc(
        nodes=[{"id": "a", "label": "A"}, {"id": "b", "label": "B"}],
        edges=[
            {"id": "e1", "source": "a", "target": "b", "style": "bold-dotted"},
            {"id": "e2", "source": "a", "target": "b", "style": "dashed"},
        ],
    )
    assert [e.style.value for e in doc.edges] == ["solid", "dashed"]


def test_top_level_enums_fall_back():
    doc = _coerce_doc(
        {"title": "X", "diagram_type": "flowchart", "direction": "left-to-right",
         "nodes": [{"id": "a", "label": "A"}], "edges": []},
        fallback_direction=Direction.TB,
    )
    assert doc.diagram_type.value == "process_flow"
    assert doc.direction.value == "TB"
