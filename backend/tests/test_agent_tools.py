"""Tests for the agent's hands.

Every tool call is model output, so the applier's job is as much refusing
nonsense as applying the good cases. These run without touching a model.

Run with:  uv run pytest -q
"""

from app.schemas.diagram import AgentAction, DiagramDoc, Direction, EdgeStyle, NodeKind
from app.services.agent_tools import MAX_CALLS, apply_tools


def make_doc() -> DiagramDoc:
    return DiagramDoc.model_validate(
        {
            "nodes": [
                {"id": "a", "label": "Receive order", "kind": "start"},
                {"id": "b", "label": "Check stock", "kind": "process"},
                {"id": "c", "label": "Ship order", "kind": "end"},
            ],
            "edges": [
                {"id": "e1", "source": "a", "target": "b"},
                {"id": "e2", "source": "b", "target": "c"},
            ],
            "lanes": [{"id": "lane_ops", "label": "Operations", "order": 0}],
        }
    )


def call(tool: str, **args) -> AgentAction:
    return AgentAction(tool=tool, args=args)


class TestNodes:
    def test_add_node_wires_itself_in(self):
        doc = make_doc()
        out = apply_tools(doc, [call("add_node", label="Pick items", after="b")])

        added = next(n for n in doc.nodes if n.label == "Pick items")
        assert added.id not in ("a", "b", "c")
        assert any(e.source == "b" and e.target == added.id for e in doc.edges)
        assert out.new_node_ids == {added.id}
        assert out.changes and not out.warnings

    def test_add_node_without_a_label_is_refused(self):
        doc = make_doc()
        out = apply_tools(doc, [call("add_node", after="b")])

        assert len(doc.nodes) == 3
        assert out.warnings and not out.changes

    def test_delete_node_takes_its_connectors_with_it(self):
        doc = make_doc()
        apply_tools(doc, [call("delete_node", id="b")])

        assert [n.id for n in doc.nodes] == ["a", "c"]
        assert doc.edges == []

    def test_update_node_applies_only_recognised_fields(self):
        doc = make_doc()
        out = apply_tools(
            doc,
            [call("update_node", id="b", label="Verify stock", color="rose", kind="decision")],
        )

        node = next(n for n in doc.nodes if n.id == "b")
        assert node.label == "Verify stock"
        assert node.kind is NodeKind.decision
        assert node.style["color"] == "rose"
        assert not out.warnings

    def test_unknown_colour_is_dropped_not_stored(self):
        doc = make_doc()
        apply_tools(doc, [call("update_node", id="b", color="chartreuse-ish")])

        assert "color" not in next(n for n in doc.nodes if n.id == "b").style

    def test_naming_a_node_that_is_not_there_warns(self):
        doc = make_doc()
        out = apply_tools(doc, [call("update_node", id="nope", label="X")])

        assert out.warnings and not out.changes


class TestSelection:
    def test_selection_token_fans_out_to_every_selected_node(self):
        doc = make_doc()
        out = apply_tools(doc, [call("update_node", id="@selection", color="amber")], ["a", "c"])

        colors = {n.id: n.style.get("color") for n in doc.nodes}
        assert colors == {"a": "amber", "b": None, "c": "amber"}
        assert len(out.changes) == 2

    def test_selection_token_with_nothing_selected_warns(self):
        doc = make_doc()
        out = apply_tools(doc, [call("delete_node", id="@selection")], [])

        assert len(doc.nodes) == 3
        assert out.warnings


class TestEdges:
    def test_connect_accepts_the_styling_the_prompt_used_to_hide(self):
        doc = make_doc()
        apply_tools(
            doc,
            [
                call(
                    "connect",
                    source="c",
                    target="a",
                    label="returns",
                    style="dashed",
                    color="#ff0000",
                    end_arrow="circle",
                    curve="straight",
                )
            ],
        )

        edge = next(e for e in doc.edges if e.source == "c" and e.target == "a")
        assert edge.label == "returns"
        assert edge.style is EdgeStyle.dashed
        assert edge.color == "#ff0000"
        assert edge.end_arrow.value == "circle"
        assert edge.curve == "straight"

    def test_edge_colour_must_be_hex(self):
        doc = make_doc()
        apply_tools(doc, [call("update_edge", id="e1", color="rose")])

        assert next(e for e in doc.edges if e.id == "e1").color is None

    def test_self_connection_is_refused(self):
        doc = make_doc()
        out = apply_tools(doc, [call("connect", source="b", target="b")])

        assert len(doc.edges) == 2
        assert out.warnings

    def test_connecting_a_missing_node_is_refused(self):
        doc = make_doc()
        out = apply_tools(doc, [call("connect", source="b", target="ghost")])

        assert len(doc.edges) == 2
        assert out.warnings


class TestCanvasAndLayout:
    def test_set_direction_asks_for_a_relayout(self):
        doc = make_doc()
        out = apply_tools(doc, [call("set_direction", direction="tb")])

        assert doc.direction is Direction.TB
        assert out.relayout

    def test_set_page_resolves_a_preset(self):
        doc = make_doc()
        out = apply_tools(doc, [call("set_page", preset="slide-16-9")])

        assert out.page == (1920, 1080)
        assert out.relayout

    def test_unknown_page_preset_warns(self):
        doc = make_doc()
        out = apply_tools(doc, [call("set_page", preset="billboard")])

        assert out.page is None
        assert out.warnings

    def test_client_actions_are_passed_through_untouched(self):
        doc = make_doc()
        out = apply_tools(doc, [call("fit_view"), call("select", ids=["a", "b"])], [])

        assert [a.tool for a in out.client_actions] == ["fit_view", "select"]
        assert out.client_actions[1].args == {"ids": ["a", "b"]}
        assert not out.touched_doc

    def test_select_filters_out_ids_that_do_not_exist(self):
        doc = make_doc()
        out = apply_tools(doc, [call("select", ids=["a", "ghost"])], [])

        assert out.client_actions[0].args == {"ids": ["a"]}


class TestGuards:
    def test_unknown_tool_warns_rather_than_raising(self):
        doc = make_doc()
        out = apply_tools(doc, [call("drop_database"), call("update_node", id="b", label="Ok")])

        assert out.warnings
        # The call after the bad one still ran.
        assert next(n for n in doc.nodes if n.id == "b").label == "Ok"

    def test_a_runaway_plan_applies_nothing(self):
        doc = make_doc()
        calls = [call("add_node", label=f"Step {i}") for i in range(MAX_CALLS + 1)]
        out = apply_tools(doc, calls)

        assert len(doc.nodes) == 3
        assert out.warnings and not out.changes

    def test_calls_see_the_results_of_earlier_ones(self):
        doc = make_doc()
        out = apply_tools(
            doc,
            [
                call("add_node", label="Pack items", after="b", id="pack"),
                call("connect", source="pack", target="c", label="ready"),
            ],
        )

        packed = next(n for n in doc.nodes if n.label == "Pack items")
        assert packed.id == "pack"
        assert any(e.source == "pack" and e.target == "c" for e in doc.edges)
        assert not out.warnings

    def test_a_model_supplied_id_never_overwrites_an_existing_node(self):
        doc = make_doc()
        apply_tools(doc, [call("add_node", label="Impostor", id="b")])

        assert len(doc.nodes) == 4
        assert next(n for n in doc.nodes if n.id == "b").label == "Check stock"


class TestLabelFallback:
    def test_a_node_can_be_named_by_its_label(self):
        doc = make_doc()
        out = apply_tools(doc, [call("update_node", id="Check stock", color="blue")])

        assert next(n for n in doc.nodes if n.id == "b").style["color"] == "blue"
        assert not out.warnings

    def test_label_matching_ignores_case(self):
        doc = make_doc()
        apply_tools(doc, [call("connect", source="ship order", target="a", style="dashed")])

        assert any(e.source == "c" and e.target == "a" for e in doc.edges)

    def test_the_same_node_named_twice_is_changed_once(self):
        doc = make_doc()
        out = apply_tools(doc, [call("delete_node", id=["b", "Check stock"])])

        assert len(out.changes) == 1
        assert [n.id for n in doc.nodes] == ["a", "c"]
