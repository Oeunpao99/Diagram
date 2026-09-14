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

    def test_back_edge_is_routed_off_the_forward_corridor(self):
        """A rejection/retry loop back to an earlier step defaults to the same
        right->left ports the forward flow uses, and ends up drawn through the
        same visual corridor — this is what makes long back-references look
        "stuck together" with everything else on a busy diagram. Routing it
        via top/bottom instead keeps it out of that corridor."""
        doc = doc_from(
            nodes=[
                {"id": "a", "label": "Start", "kind": "start"},
                {"id": "b", "label": "Review", "kind": "process"},
                {"id": "c", "label": "Approved?", "kind": "decision"},
                {"id": "d", "label": "Done", "kind": "end"},
            ],
            edges=[
                {"id": "1", "source": "a", "target": "b"},
                {"id": "2", "source": "b", "target": "c"},
                {"id": "3", "source": "c", "target": "d", "label": "Yes"},
                # Rejected -> back to Review. This is the one riding the
                # forward corridor before the fix.
                {"id": "4", "source": "c", "target": "b", "label": "No, revise"},
            ],
        )
        result = apply_layout(doc, Direction.LR)
        by_id = {e.id: e for e in result.edges}

        assert by_id["1"].source_handle is None
        assert by_id["1"].target_handle is None
        assert by_id["4"].source_handle == "b"
        assert by_id["4"].target_handle == "t"

    def test_edge_routing_never_overrides_a_chosen_handle(self):
        """A handle the user (or a previous relayout) already set is never
        silently reverted, even if it now looks like a forward edge."""
        doc = doc_from(
            nodes=[
                {"id": "a", "label": "Start", "kind": "start"},
                {"id": "b", "label": "End", "kind": "end"},
            ],
            edges=[{"id": "1", "source": "a", "target": "b", "target_handle": "t"}],
        )
        result = apply_layout(doc, Direction.LR)
        edge = result.edges[0]
        assert edge.target_handle == "t"
        # Only the one handle was set by hand — the other stays whatever the
        # router would have picked, not silently paired up to match.
        assert edge.source_handle is None

    def test_fit_to_box_keeps_flow_left_to_right(self):
        doc = apply_layout(SIMPLE.model_copy(deep=True), Direction.LR, "layered", 800, 600)
        x = {n.id: n.position.x for n in doc.nodes}
        # Wrapping folds layers into rows, so ordering holds inside a row
        # (a→b→c share the first row) rather than across the whole canvas.
        assert x["a"] < x["b"] < x["c"]
        # d and e are siblings in the same layer — they share x and differ on y.
        assert x["d"] == x["e"]

    def test_fit_to_box_contains_every_node(self):
        doc = apply_layout(SIMPLE.model_copy(deep=True), Direction.LR, "layered", 640, 480)
        for n in doc.nodes:
            assert n.position.x >= 0
            assert n.position.y >= 0
            assert n.position.x + n.size.width <= 640.0 + 1e-6
            assert n.position.y + n.size.height <= 480.0 + 1e-6

    def test_fit_to_box_wraps_long_flows(self):
        """A rigidly tall page must fold a long layered chain into rows
        instead of running off the bottom of the box."""
        many = doc_from(
            nodes=[{"id": f"n{i}", "label": f"Step {i}"} for i in range(14)],
            edges=[
                {"id": str(i), "source": f"n{i}", "target": f"n{i + 1}"}
                for i in range(13)
            ],
        )
        doc = apply_layout(many, Direction.LR, "layered", 600, 400)
        y = [n.position.y for n in doc.nodes]
        assert max(y) - min(y) <= 400.0 + 1e-6

    def test_fit_to_box_is_centred_in_page(self):
        doc = apply_layout(SIMPLE.model_copy(deep=True), Direction.LR, "layered", 2000, 2000)
        xs = [n.position.x for n in doc.nodes]
        xs_max = max(n.position.x + n.size.width for n in doc.nodes)
        assert 0 < min(xs)
        assert xs_max < 2000.0
        # Graph is centred: left margin ~ right margin.
        assert abs(min(xs) - (2000.0 - xs_max)) < 40

    def test_fit_to_box_records_page_meta(self):
        doc = apply_layout(SIMPLE.model_copy(deep=True), Direction.LR, "layered", 1600, 900)
        assert doc.meta["page_width"] == 1600
        assert doc.meta["page_height"] == 900
        assert doc.meta["page_x"] == 0
        assert doc.meta["page_y"] == 0

    def test_clear_target_removes_page_meta(self):
        doc = apply_layout(SIMPLE.model_copy(deep=True), Direction.LR, "layered", 1600, 900)
        assert "page_width" in doc.meta
        apply_layout(doc, Direction.LR, "layered")
        assert not any(k.startswith("page_") for k in doc.meta)

    def test_fit_to_box_swimlane_fits_and_separates(self):
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
        apply_layout(doc, Direction.LR, "swimlane", 800, 600)
        y = {n.id: n.position.y for n in doc.nodes}
        assert y["a"] != y["b"]
        for n in doc.nodes:
            assert n.position.x + n.size.width <= 800.0 + 1e-6
            assert n.position.y + n.size.height <= 600.0 + 1e-6

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
