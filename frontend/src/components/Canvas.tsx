import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { fromFlow, makeNode, toFlow, type FlowNode } from "../api/adapter";
import type { NodeKind } from "../api/types";
import { useDiagram } from "../store/useDiagram";
import { useSettings } from "../store/useSettings";
import { AiSuggestion } from "./AiSuggestion";
import { AssetsDock } from "./AssetsDock";
import { CanvasToolbar, type Tool } from "./CanvasToolbar";
import { SelectionToolbar } from "./SelectionToolbar";
import { nodeTypes } from "./nodes";

const SHAPE_CYCLE: NodeKind[] = [
  "process",
  "decision",
  "document",
  "database",
  "data",
  "note",
];

export function Canvas() {
  const doc = useDiagram((s) => s.doc);
  const setDoc = useDiagram((s) => s.setDoc);
  const prefs = useSettings((s) => s.prefs);
  const setSelection = useDiagram((s) => s.setSelection);
  const selection = useDiagram((s) => s.selection);

  const { fitView, screenToFlowPosition } = useReactFlow();
  const transform = useStore((s) => s.transform);
  const selectedId = useDiagram((s) => s.selection.at(-1) ?? null);
  const selectedNode = useStore((s) => (selectedId ? s.nodeLookup.get(selectedId) : null));

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [dropActive, setDropActive] = useState(false);

  // The doc is the source of truth; the canvas mirrors it. A ref guards against
  // the write-back effect bouncing our own change straight back at us.
  const syncing = useRef(false);

  useEffect(() => {
    const flow = toFlow(doc);
    syncing.current = true;
    setNodes(flow.nodes);
    setEdges(flow.edges);
    const id = window.setTimeout(() => {
      syncing.current = false;
      if (doc.nodes.length) void fitView({ padding: 0.16, duration: 350 });
    }, 60);
    return () => window.clearTimeout(id);
  }, [doc, setNodes, setEdges, fitView]);

  const commit = useCallback(() => {
    if (syncing.current) return;
    setDoc(fromFlow(useDiagram.getState().doc, nodes, edges), { silent: true });
  }, [nodes, edges, setDoc]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          { ...connection, id: `e_${Date.now().toString(36)}`, type: "smoothstep" },
          current,
        ),
      );
      if (tool === "connector") setTool("select");
    },
    [setEdges, tool],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) =>
      setSelection(selected.filter((n) => n.type === "diagram").map((n) => n.id)),
    [setSelection],
  );

  const insertAt = (spec: Parameters<typeof makeNode>[0]) => {
    const current = useDiagram.getState().doc;
    setDoc({ ...current, nodes: [...current.nodes, makeNode(spec)] });
  };

  const onCanvasDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDropActive(false);
    const kind = event.dataTransfer.getData("application/copilot-asset") as NodeKind | "";
    if (!kind) return;
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const labels: Partial<Record<NodeKind, string>> = {
      actor: "User",
      service: "Server",
      database: "Database",
      cloud: "Cloud",
    };
    insertAt({
      id: `node_${Date.now().toString(36)}`,
      label: labels[kind] ?? "New node",
      kind,
      position: point,
    });
  };

  /* ------------------------------------------------ selected-node actions */

  const selNodeIds = () => selection.filter((id) =>
    useDiagram.getState().doc.nodes.some((n) => n.id === id),
  );

  const duplicateSelected = () => {
    const current = useDiagram.getState().doc;
    const copies = current.nodes
      .filter((n) => selection.includes(n.id))
      .map((n) => ({
        ...makeNode({
          id: `${n.id}__copy`,
          label: `${n.label} copy`,
          kind: n.kind,
          position: { x: n.position.x + 36, y: n.position.y + 46 },
          imageUrl: n.image_url,
          description: n.description,
          lane: n.lane,
          size: n.size,
        }),
        lane: n.lane,
      }));
    if (!copies.length) return;
    setDoc({ ...current, nodes: [...current.nodes, ...copies] });
  };

  const deleteSelected = () => {
    const current = useDiagram.getState().doc;
    const ids = selNodeIds();
    setDoc({
      ...current,
      nodes: current.nodes.filter((n) => !ids.includes(n.id)),
      edges: current.edges.filter((e) => !ids.includes(e.source) && !ids.includes(e.target)),
    });
    setSelection([]);
  };

  const cycleSelectedShape = () => {
    const current = useDiagram.getState().doc;
    const ids = selNodeIds();
    const nodes = current.nodes.map((n) => {
      if (!ids.includes(n.id)) return n;
      const index = SHAPE_CYCLE.indexOf(n.kind);
      return { ...n, kind: SHAPE_CYCLE[(index + 1) % SHAPE_CYCLE.length] };
    });
    setDoc({ ...current, nodes });
  };

  const editSelected = () => {
    const current = useDiagram.getState().doc;
    const labels = current.nodes
      .filter((n) => selection.includes(n.id))
      .map((n) => n.label);
    if (!labels.length) return;
    window.dispatchEvent(
      new CustomEvent("copilot:focus", { detail: `Improve the selected node "${labels[0]}": ` }),
    );
  };

  /* -------------------------------------------------- selection toolbar pos */

  const marker =
    selectedNode?.measured
      ? {
          x:
            selectedNode.position.x * transform[2] +
            transform[0] +
            ((selectedNode.measured.width ?? 0) / 2) * transform[2],
          y: selectedNode.position.y * transform[2] + transform[1],
        }
      : null;

  const panOnDrag = tool !== "select";

  return (
    <div
      className="canvas-wrap"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDropActive(false);
      }}
      onDrop={onCanvasDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={commit}
        onEdgesDelete={commit}
        onNodesDelete={commit}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodesDraggable={tool === "select"}
        nodesConnectable={tool === "select" || tool === "connector"}
        elementsSelectable={tool === "select" || tool === "hand"}
        panOnDrag={panOnDrag}
        selectionOnDrag={tool === "select"}
        panOnScroll
        snapToGrid={prefs.snap}
        snapGrid={[8, 8]}
        zoomOnDoubleClick={tool === "select"}
        deleteKeyCode={["Backspace", "Delete"]}
        proOptions={{ hideAttribution: true }}
        minZoom={0.15}
        maxZoom={3}
        fitView
      >
        {/* Dot, node and mask colours are themed in app.css so they follow
            light/dark and the accent without a re-render. */}
        {prefs.grid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.2}
            style={{ background: "var(--paper)" }}
          />
        )}
        {prefs.minimap && <MiniMap pannable zoomable nodeStrokeWidth={2} />}
      </ReactFlow>

      {dropActive && <div className="drop-hint">Drop asset onto canvas</div>}

      <CanvasToolbar tool={tool} onTool={setTool} />
      <AssetsDock />
      <AiSuggestion />

      {marker && tool === "select" && (
        <SelectionToolbar
          x={marker.x}
          y={marker.y}
          onEdit={editSelected}
          onDuplicate={duplicateSelected}
          onChangeShape={cycleSelectedShape}
          onConnect={() => setTool("connector")}
          onDelete={deleteSelected}
        />
      )}
    </div>
  );
}