"""Tests for the two pieces that must never involve the model.

Run with:  uv run pytest -q
"""

import pytest

from app.layout.engine import apply_layout
from app.schemas.diagram import DiagramDoc, Direction
from app.services.validator import validate


def doc_from(nodes, edges, lanes=None, **kwargs) -> DiagramDoc:
    return DiagramDoc.model_validate(
        {"nodes": nodes, "edges": edges, "lanes": lanes or [], **kwargs}
    )


SIMPLE = doc_from(
    nodes=[
        {"id": "a", "label": "Receive documents", "kind": "start"},
        {"id": "b", "label": "Verify documents", "kind": "process"},
        {"id": "c", "label": "Complete?", "kind": "decision"},
        {"id": "d", "label": "Request missing docs", "kind": "process"},
        {"id": "e", "label": "Release cargo", "kind": "end"},
    ],
    edges=[
        {"id": "1", "source": "a", "target": "b"},
        {"id": "2", "source": "b", "target": "c"},
        {"id": "3", "source": "c", "target": "d", "label": "No"},
        {"id": "4", "source": "c", "target": "e", "label": "Yes"},
    ],
)


class TestLayout:
    def test_flow_advances_left_to_right(self):
        doc = apply_layout(SIMPLE.model_copy(deep=True), Direction.LR)
        x = {n.id: n.position.x for n in doc.nodes}
        assert x["a"] < x["b"] < x["c"] < x["e"]

    def test_direction_is_respected(self):
        doc = apply_layout(SIMPLE.model_copy(deep=True), Direction.TB)
        y = {n.id: n.position.y for n in doc.nodes}
        assert y["a"] < y["b"] < y["c"]

    def test_rl_mirrors_lr(self):
        doc = apply_layout(SIMPLE.model_copy(deep=True), Direction.RL)
        x = {n.id: n.position.x for n in doc.nodes}
        assert x["a"] > x["b"] > x["c"]

    def test_no_overlapping_boxes(self):
        doc = apply_layout(SIMPLE.model_copy(deep=True), Direction.LR)
        report = validate(doc)
        assert not [i for i in report.issues if "overlap" in i.message]

    def test_layout_is_deterministic(self):
        first = apply_layout(SIMPLE.model_copy(deep=True), Direction.LR)
        second = apply_layout(SIMPLE.model_copy(deep=True), Direction.LR)
        assert [(n.id, n.position.x, n.position.y) for n in first.nodes] == [
            (n.id, n.position.x, n.position.y) for n in second.nodes
        ]

    def test_pure_cycle_does_not_hang(self):
        doc = doc_from(
            nodes=[{"id": c, "label": c.upper()} for c in "abc"],
            edges=[
                {"id": "1", "source": "a", "target": "b"},
                {"id": "2", "source": "b", "target": "c"},
                {"id": "3", "source": "c", "target": "a"},
            ],
        )
        apply_layout(doc)
        assert len({n.position.x for n in doc.nodes}) == 3

    def test_empty_document(self):
        assert apply_layout(DiagramDoc()).nodes == []

    def test_swimlane_separates_lanes(self):
        doc = doc_from(
            nodes=[
                {"id": "a", "label": "Submit", "lane": "l1"},
                {"id": "b", "label": "Review", "lane": "l2"},
            ],
            edges=[{"id": "1", "source": "a", "target": "b"}],
            lanes=[
                {"id": "l1", "label": "Customer", "order": 0},
                {"id": "l2", "label": "Operations", "order": 1},
            ],
            diagram_type="swimlane",
        )
        apply_layout(doc, Direction.LR, "swimlane")
        y = {n.id: n.position.y for n in doc.nodes}
        assert y["a"] != y["b"]
        assert doc.meta["lane_thickness"] > 0


class TestValidator:
    def test_clean_diagram_passes(self):
        report = validate(apply_layout(SIMPLE.model_copy(deep=True)))
        assert report.ok
        assert not [i for i in report.issues if i.level in ("error", "warning")]

    def test_duplicate_id_is_an_error(self):
        doc = doc_from(
            nodes=[{"id": "a", "label": "One"}, {"id": "a", "label": "Two"}],
            edges=[],
        )
        report = validate(doc)
        assert not report.ok
        assert any("used 2 times" in i.message for i in report.issues)

    def test_dangling_edge_is_an_error(self):
        doc = doc_from(
            nodes=[{"id": "a", "label": "One"}],
            edges=[{"id": "1", "source": "a", "target": "ghost"}],
        )
        assert not validate(doc).ok

    def test_orphan_node_is_flagged(self):
        doc = doc_from(
            nodes=[
                {"id": "a", "label": "One"},
                {"id": "b", "label": "Two"},
                {"id": "lonely", "label": "Nobody links here"},
            ],
            edges=[{"id": "1", "source": "a", "target": "b"}],
        )
        assert any("isn't connected" in i.message for i in validate(doc).issues)

    def test_approval_without_rejection_is_flagged(self):
        doc = doc_from(
            nodes=[
                {"id": "a", "label": "Approve request", "kind": "process"},
                {"id": "b", "label": "Release cargo", "kind": "end"},
            ],
            edges=[{"id": "1", "source": "a", "target": "b"}],
        )
        assert any("rejection" in i.message for i in validate(doc).issues)

    def test_rejection_through_a_decision_counts(self):
        """The reject branch usually sits one hop past the approval step."""
        doc = doc_from(
            nodes=[
                {"id": "a", "label": "Verify documents", "kind": "process"},
                {"id": "d", "label": "Valid?", "kind": "decision"},
                {"id": "r", "label": "Reject and notify", "kind": "end"},
                {"id": "k", "label": "Continue", "kind": "end"},
            ],
            edges=[
                {"id": "1", "source": "a", "target": "d"},
                {"id": "2", "source": "d", "target": "r", "label": "No"},
                {"id": "3", "source": "d", "target": "k", "label": "Yes"},
            ],
        )
        assert not [i for i in validate(doc).issues if "rejection" in i.message]

    def test_decision_with_one_exit_is_flagged(self):
        doc = doc_from(
            nodes=[
                {"id": "d", "label": "Is it valid?", "kind": "decision"},
                {"id": "b", "label": "Next", "kind": "end"},
            ],
            edges=[{"id": "1", "source": "d", "target": "b"}],
        )
        assert any("one way out" in i.message for i in validate(doc).issues)

    @pytest.mark.parametrize("algorithm", ["layered", "grid", "swimlane"])
    def test_every_algorithm_produces_positive_coordinates(self, algorithm):
        doc = apply_layout(SIMPLE.model_copy(deep=True), Direction.LR, algorithm)
        assert all(n.position.x >= 0 and n.position.y >= 0 for n in doc.nodes)
