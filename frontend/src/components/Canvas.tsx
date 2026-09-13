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

import { fromFlow, makeNode, toFlow, type FlowNode, type FlowNodeData } from "../api/adapter";
import type { DiagramDoc, NodeKind } from "../api/types";
import { useDiagram } from "../store/useDiagram";
import { useSettings } from "../store/useSettings";
import { AiSuggestion } from "./AiSuggestion";
import { AssetsDock } from "./AssetsDock";
import { CanvasToolbar, type Tool } from "./CanvasToolbar";
import { RehearsalOverlay } from "./RehearsalOverlay";
import { SelectionToolbar } from "./SelectionToolbar";
import { nodeTypes } from "./nodes";

/** AI operations whose result gets the "pen is drawing this" rehearsal. */
const REHEARSE_ON_BUSY = new Set(["generating", "laying-out", "editing"]);

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
  const busy = useDiagram((s) => s.busy);
  const [rehearsal, setRehearsal] = useState<{
    key: number;
    doc: DiagramDoc;
    transform: [number, number, number];
  } | null>(null);

  const syncing = useRef(false);
  const prevBusy = useRef<string | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;

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

  // When an AI generation / layout / edit settles, replay the new diagram as a
  // hand-drawn sketch: shapes render first, then the connectors trace between.
  useEffect(() => {
    const was = prevBusy.current;
    prevBusy.current = busy;
    if (busy !== null || !was || !REHEARSE_ON_BUSY.has(was)) return;
    const id = window.setTimeout(() => {
      // Let React Flow finish swapping nodes + the fitView settle, then capture
      // a stable snapshot so the strokes land exactly on the diagram.
      const current = useDiagram.getState().doc;
      if (current.nodes.length < 2) return;
      setRehearsal({
        key: Date.now(),
        doc: current,
        transform: transformRef.current,
      });
    }, 560);
    return () => window.clearTimeout(id);
  }, [busy]);

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

  /* --------------------------------------------- click-to-place tools */
  // "select", "hand" and "connector" don't place anything on a pane click —
  // connector's whole job is dragging between two ports, and click-placing
  // under it would fight that. Everything else drops one element and hops
  // back to "select" so you don't keep stamping out copies by accident.

  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageDropPoint = useRef<{ x: number; y: number } | null>(null);

  const onPaneClick = (event: React.MouseEvent) => {
    if (tool === "select" || tool === "hand" || tool === "connector" || tool === "group") return;
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });

    if (tool === "image") {
      imageDropPoint.current = point;
      imageInputRef.current?.click();
      return;
    }

    const PLACEMENT: Partial<Record<Tool, { kind: NodeKind; label: string; textOnly?: boolean }>> = {
      node: { kind: "process", label: "Process" },
      text: { kind: "note", label: "Text", textOnly: true },
      shape: { kind: "decision", label: "Decision" },
    };
    const spec = PLACEMENT[tool];
    if (!spec) return;

    insertAt({
      id: `node_${Date.now().toString(36)}`,
      label: spec.label,
      kind: spec.kind,
      position: point,
      style: spec.textOnly ? { textOnly: true } : undefined,
    });
    setTool("select");
  };

  const onImageFileChosen = (file: File | undefined) => {
    if (file && imageDropPoint.current) {
      const point = imageDropPoint.current;
      const reader = new FileReader();
      reader.onload = () => {
        insertAt({
          id: `img_${Date.now().toString(36)}`,
          label: file.name,
          kind: "note",
          position: point,
          imageUrl: String(reader.result),
        });
      };
      reader.readAsDataURL(file);
    }
    imageDropPoint.current = null;
    setTool("select");
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
      process: "Process",
      decision: "Decision",
      document: "Document",
      queue: "Queue",
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

  const setSelectedShape = (kind: NodeKind) => {
    const current = useDiagram.getState().doc;
    const ids = selNodeIds();
    if (!ids.length) return;
    setDoc({
      ...current,
      nodes: current.nodes.map((n) => (ids.includes(n.id) ? { ...n, kind } : n)),
    });
  };

  const setSelectedColor = (color: string | null) => {
    const current = useDiagram.getState().doc;
    const ids = selNodeIds();
    if (!ids.length) return;
    setDoc({
      ...current,
      nodes: current.nodes.map((n) => {
        if (!ids.includes(n.id)) return n;
        const style = { ...(n.style ?? {}) };
        if (color === null) delete style.color;
        else style.color = color;
        return { ...n, style };
      }),
    });
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

  const selData = selectedNode?.data as FlowNodeData | undefined;

  const panOnDrag = tool !== "select";

  return (
    <div
      className="absolute inset-0"
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
        onPaneClick={onPaneClick}
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

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          onImageFileChosen(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {dropActive && (
        <div className="pointer-events-none absolute inset-0 z-[6] grid place-items-center bg-[rgba(13,159,110,0.1)] text-[13px] font-semibold tracking-[0.01em] text-green-deep">
          Drop asset onto canvas
        </div>
      )}

      {rehearsal && (
        <RehearsalOverlay
          key={rehearsal.key}
          doc={rehearsal.doc}
          transform={rehearsal.transform}
          onDone={() => setRehearsal(null)}
        />
      )}

      <CanvasToolbar tool={tool} onTool={setTool} />
      <AssetsDock />
      <AiSuggestion />

      {marker && tool === "select" && (
        <SelectionToolbar
          x={marker.x}
          y={marker.y}
          shape={selData?.kind ?? "process"}
          color={typeof selData?.style?.color === "string" ? selData.style.color : null}
          onEdit={editSelected}
          onDuplicate={duplicateSelected}
          onConnect={() => setTool("connector")}
          onDelete={deleteSelected}
          onSetShape={setSelectedShape}
          onSetColor={setSelectedColor}
        />
      )}
    </div>
  );
}