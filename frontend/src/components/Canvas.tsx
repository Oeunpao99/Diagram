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
import type { DiagramDoc, DiagramEdge, EdgeCurve, EdgeStyle, NodeKind } from "../api/types";
import { useDiagram } from "../store/useDiagram";
import { useSettings } from "../store/useSettings";
import { AiSuggestion } from "./AiSuggestion";
import { AssetsDock } from "./AssetsDock";
import { CanvasToolbar, type Tool } from "./CanvasToolbar";
import { EdgeToolbar } from "./EdgeToolbar";
import { RehearsalOverlay } from "./RehearsalOverlay";
import { SelectionToolbar } from "./SelectionToolbar";
import { nodeTypes } from "./nodes";
import { takeSkipNextDocFit } from "../lib/docFit";

/** AI operations whose result gets the "pen is drawing this" rehearsal — a
 *  brand-new or fully re-laid-out diagram, where hiding the canvas and
 *  redrawing the whole thing reads as a reveal. An edit ("add one more
 *  step") only touches a corner of an existing diagram; resetting the whole
 *  canvas for that would undo the "keep everything else as it was" premise
 *  of an edit. Edits get their own, much smaller treatment below: a loading
 *  pill while the request is in flight, and a brief highlight on whatever
 *  the edit actually added once it lands. */
const REHEARSE_ON_BUSY = new Set(["generating", "laying-out"]);

export function Canvas() {
  const doc = useDiagram((s) => s.doc);
  const setDoc = useDiagram((s) => s.setDoc);
  const prefs = useSettings((s) => s.prefs);
  const setSelection = useDiagram((s) => s.setSelection);
  const selection = useDiagram((s) => s.selection);
  const edgeSelection = useDiagram((s) => s.edgeSelection);
  const setEdgeSelection = useDiagram((s) => s.setEdgeSelection);

  const { fitView, screenToFlowPosition, getNodes, getEdges } = useReactFlow<FlowNode, Edge>();
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
  // Which node ids existed last sync — diffed against the new doc so a freshly
  // added node (from an edit, not a full generate) can get a brief highlight
  // instead of the whole canvas replaying.
  const prevNodeIds = useRef<Set<string> | null>(null);
  // Manual edits (dragging a node, connecting, deleting) round-trip through
  // this same doc-sync effect via commit(), but should never yank the
  // viewport out from under whoever is mid-drag — only an AI-driven change
  // (generate/layout/edit) re-frames the canvas. commit() sets this right
  // before its setDoc so the very next sync skips the fit.
  const skipNextFitView = useRef(false);

  useEffect(() => {
    const flow = toFlow(doc);
    syncing.current = true;

    // A node id that wasn't around last sync but is now — skip the very
    // first sync (an empty canvas loading its first doc isn't "new" nodes,
    // it's just the initial render) and skip full AI rewrites (generate /
    // layout already get the rehearsal; double-highlighting every node on
    // top of that would just be noise).
    const currentIds = new Set(doc.nodes.map((n) => n.id));
    const justAdded =
      prevNodeIds.current && !REHEARSE_ON_BUSY.has(prevBusy.current ?? "")
        ? new Set([...currentIds].filter((id) => !prevNodeIds.current!.has(id)))
        : new Set<string>();
    prevNodeIds.current = currentIds;

    // Carry over `measured`/`selected` for nodes that already existed: toFlow
    // builds fresh objects every call, and handing React Flow an "unmeasured"
    // node it already knows about triggers a dimensions remeasure — harmless
    // on its own, but see the fitView note below for why it used to look like
    // a drag was being undone.
    setNodes((prevNodes) => {
      const prevById = new Map(prevNodes.map((n) => [n.id, n]));
      return flow.nodes.map((n) => {
        const prev = prevById.get(n.id);
        const merged = prev ? { ...n, measured: prev.measured, selected: prev.selected } : n;
        return justAdded.has(n.id)
          ? { ...merged, data: { ...merged.data, justAdded: true } }
          : merged;
      });
    });
    // Same carry-over for edges: toFlow builds fresh objects every call, and
    // replacing `selected`-carrying edges with bare ones would drop the
    // highlight the user is actively working against each time a style
    // change round-trips through setDoc.
    setEdges((prevEdges) => {
      const prevById = new Map(prevEdges.map((e) => [e.id, e]));
      return flow.edges.map((e) => {
        const prev = prevById.get(e.id);
        return prev ? { ...e, selected: prev.selected } : e;
      });
    });
    const skipFit = takeSkipNextDocFit() || skipNextFitView.current;
    skipNextFitView.current = false;
    const id = window.setTimeout(() => {
      syncing.current = false;
      // fitView reframes from its own internal node bounds, which can still
      // reflect the pre-drag layout for a moment after a manual commit — the
      // data was never wrong, but re-fitting against that stale snapshot
      // visibly snaps the node you just dragged back toward where it was.
      if (!skipFit && doc.nodes.length) void fitView({ padding: 0.16, duration: 350 });
    }, 60);
    return () => window.clearTimeout(id);
  }, [doc, setNodes, setEdges, fitView]);

  // Selections whose edges no longer exist (deleted, or an AI rewrite
  // replaced the graph) can't point at anything — drop them. Kept out of the
  // doc-sync effect above so selecting/deselecting an edge never re-triggers
  // the fitView that lives there.
  useEffect(() => {
    if (edgeSelection.some((id) => !doc.edges.some((e) => e.id === id))) {
      setEdgeSelection(edgeSelection.filter((id) => doc.edges.some((e) => e.id === id)));
    }
  }, [doc, edgeSelection, setEdgeSelection]);

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

  // Read through getNodes()/getEdges() (xyflow's own internal store), not the
  // closed-over `nodes`/`edges` state: React Flow's drag gesture can still be
  // mid-flight when onNodeDragStop fires, and even a ref kept "current" during
  // render can lag by one render behind the store — the store read here never
  // can. That matters once anything (like dragging a group's siblings along)
  // pushes a position update outside React Flow's own change pipeline.
  const commit = useCallback(() => {
    if (syncing.current) return;
    skipNextFitView.current = true;
    setDoc(fromFlow(useDiagram.getState().doc, getNodes(), getEdges()), { silent: true });
  }, [setDoc, getNodes, getEdges]);

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
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      setSelection(selectedNodes.filter((n) => n.type === "diagram").map((n) => n.id));
      setEdgeSelection(selectedEdges.map((e) => e.id));
    },
    [setSelection, setEdgeSelection],
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
    setEdgeSelection([]);
  };

  /* ------------------------------------------------ selected-edge actions */

  const selEdgeIds = () =>
    edgeSelection.filter((id) => useDiagram.getState().doc.edges.some((e) => e.id === id));

  const patchSelectedEdges = (patch: Partial<DiagramEdge>) => {
    const current = useDiagram.getState().doc;
    const ids = selEdgeIds();
    if (!ids.length) return;
    setDoc({
      ...current,
      edges: current.edges.map((e) => (ids.includes(e.id) ? { ...e, ...patch } : e)),
    });
  };

  const setSelectedEdgeCurve = (curve: EdgeCurve) => patchSelectedEdges({ curve });
  const setSelectedEdgeColor = (color: string | null) => patchSelectedEdges({ color });
  const setSelectedEdgeLineStyle = (style: EdgeStyle) => patchSelectedEdges({ style });
  const setSelectedEdgeWidth = (width: number | null) => patchSelectedEdges({ width });

  const deleteSelectedEdges = () => {
    const current = useDiagram.getState().doc;
    const ids = selEdgeIds();
    if (!ids.length) return;
    setDoc({ ...current, edges: current.edges.filter((e) => !ids.includes(e.id)) });
    setEdgeSelection([]);
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

  /** Group (or, on a second click, ungroup) the current multi-selection.
   *  Purely visual: a shared `style.groupId` drives the dashed box below and
   *  lets members drag together — no schema change, nothing the backend or
   *  layout engine needs to know about. */
  const groupSelected = () => {
    const current = useDiagram.getState().doc;
    const ids = selNodeIds();
    if (ids.length < 2) return;

    const targets = current.nodes.filter((n) => ids.includes(n.id));
    const groupIds = new Set(targets.map((n) => n.style?.groupId).filter(Boolean));
    const alreadyOneGroup = groupIds.size === 1 && targets.every((n) => n.style?.groupId);
    const nextGroupId = alreadyOneGroup ? null : `grp_${Date.now().toString(36)}`;

    setDoc({
      ...current,
      nodes: current.nodes.map((n) => {
        if (!ids.includes(n.id)) return n;
        const style = { ...(n.style ?? {}) };
        if (nextGroupId) style.groupId = nextGroupId;
        else delete style.groupId;
        return { ...n, style };
      }),
    });
  };

  /* ------------------------------------------------------ group dragging */
  // Dragging one member of a group carries the rest along. Positions are
  // captured from onNodeDragStart so the applied delta stays exact even
  // after snap-to-grid rounding on the node actually being dragged.
  const dragStart = useRef<Map<string, { x: number; y: number }> | null>(null);

  const onNodeDragStart = useCallback(
    (_event: unknown, node: FlowNode) => {
      if (!node.data.style?.groupId) return;
      dragStart.current = new Map(nodes.map((n) => [n.id, n.position]));
    },
    [nodes],
  );

  const onNodeDrag = useCallback(
    (_event: unknown, node: FlowNode) => {
      const groupId = node.data.style?.groupId;
      const starts = dragStart.current;
      if (!groupId || !starts) return;
      const from = starts.get(node.id);
      if (!from) return;
      const dx = node.position.x - from.x;
      const dy = node.position.y - from.y;

      setNodes((current) =>
        current.map((n) => {
          if (n.id === node.id || n.data.style?.groupId !== groupId) return n;
          const start = starts.get(n.id);
          if (!start) return n;
          return { ...n, position: { x: start.x + dx, y: start.y + dy } };
        }),
      );
    },
    [setNodes],
  );

  const onNodeDragStopWithGroup = useCallback(
    (_event: unknown, node: FlowNode) => {
      commit();

      // commit() just persisted whatever position xyflow's own store had for
      // each node. For siblings shifted by onNodeDrag above, that can still
      // be the pre-drag position — the drag-stop event can fire before that
      // last in-gesture update has made it into the store, so there is no
      // "current nodes" read here that's guaranteed to see it. Recomputing
      // the sibling's final position from the drag's own delta sidesteps the
      // race instead of chasing it: no store or state read involved, just
      // arithmetic on this callback's own arguments.
      const groupId = node.data.style?.groupId;
      const starts = dragStart.current;
      dragStart.current = null;
      if (!groupId || !starts) return;
      const from = starts.get(node.id);
      if (!from) return;
      const dx = node.position.x - from.x;
      const dy = node.position.y - from.y;
      if (dx === 0 && dy === 0) return;

      const current = useDiagram.getState().doc;
      skipNextFitView.current = true;
      setDoc(
        {
          ...current,
          nodes: current.nodes.map((n) => {
            if (n.id === node.id || n.style?.groupId !== groupId) return n;
            const start = starts.get(n.id);
            if (!start) return n;
            return { ...n, position: { x: start.x + dx, y: start.y + dy } };
          }),
        },
        { silent: true },
      );
    },
    [commit, setDoc],
  );

  /** Dashed boundary boxes drawn under grouped nodes, in live screen space —
   *  derived from the same `nodes` state React Flow is already rendering, so
   *  a box tracks a drag in real time instead of only snapping after commit. */
  const groupBoxes = (() => {
    const bounds = new Map<string, { x1: number; y1: number; x2: number; y2: number }>();
    for (const n of nodes) {
      const groupId = n.data.style?.groupId;
      if (typeof groupId !== "string") continue;
      const w = n.data.width ?? 0;
      const h = n.data.height ?? 0;
      const x1 = n.position.x;
      const y1 = n.position.y;
      const x2 = x1 + w;
      const y2 = y1 + h;
      const b = bounds.get(groupId);
      bounds.set(
        groupId,
        b
          ? { x1: Math.min(b.x1, x1), y1: Math.min(b.y1, y1), x2: Math.max(b.x2, x2), y2: Math.max(b.y2, y2) }
          : { x1, y1, x2, y2 },
      );
    }
    const pad = 18;
    return [...bounds.entries()].map(([groupId, b]) => ({
      groupId,
      left: (b.x1 - pad) * transform[2] + transform[0],
      top: (b.y1 - pad) * transform[2] + transform[1],
      width: (b.x2 - b.x1 + pad * 2) * transform[2],
      height: (b.y2 - b.y1 + pad * 2) * transform[2],
    }));
  })();

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

  // Selected edge this round: exactly one edge, no node, and it must still
  // exist in the doc. Position follows the midpoint between the two connected
  // nodes' centres (available without reading React Flow's internal stores).
  const selEdgeId = edgeSelection.at(-1) ?? null;
  const selEdge = selEdgeId ? doc.edges.find((e) => e.id === selEdgeId) ?? null : null;
  const sourceNode = selEdge ? doc.nodes.find((n) => n.id === selEdge.source) : null;
  const targetNode = selEdge ? doc.nodes.find((n) => n.id === selEdge.target) : null;
  const edgeMarker =
    !selectedNode && selEdge && sourceNode && targetNode
      ? (() => {
          const mx =
            sourceNode.position.x + sourceNode.size.width / 2 +
            (targetNode.position.x + targetNode.size.width / 2);
          const my =
            sourceNode.position.y + sourceNode.size.height / 2 +
            (targetNode.position.y + targetNode.size.height / 2);
          return {
            x: (mx / 2) * transform[2] + transform[0],
            y: (my / 2) * transform[2] + transform[1],
          };
        })()
      : null;

  const panOnDrag = tool !== "select";

  return (
    <div
      className="absolute inset-0"
      // While the pencil rehearsal plays, the real nodes/edges are hidden —
      // otherwise they're already fully rendered underneath from the first
      // frame, so the "sketch" reads as a redundant scribble drawn on top of
      // a diagram that's visibly already there, not a reveal.
      data-rehearsing={rehearsal ? "true" : undefined}
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
      {/* Group boundaries paint before the canvas so they sit visually behind
          every node; purely decorative, hence pointer-events: none. */}
      {groupBoxes.length > 0 && (
        <div className="pointer-events-none absolute inset-0">
          {groupBoxes.map((box) => (
            <div
              key={box.groupId}
              style={{
                position: "absolute",
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
                border: "1.5px dashed var(--green-line)",
                borderRadius: 12,
                background: "var(--green-soft)",
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStopWithGroup}
        onEdgesDelete={() => {
          commit();
          setEdgeSelection([]);
        }}
        onNodesDelete={() => {
          commit();
          setEdgeSelection([]);
        }}
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

      <CanvasToolbar
        tool={tool}
        onTool={(next) => (next === "group" ? groupSelected() : setTool(next))}
      />
      <AssetsDock />
      <AiSuggestion />

      {/* An edit is in flight: say so, but leave the diagram exactly as it
          is until the edit actually lands — no reset, no rehearsal. */}
      {busy === "editing" && (
        <div className="canvas-toast" role="status">
          <span className="canvas-toast__spin" aria-hidden="true" />
          Updating your diagram…
        </div>
      )}

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

      {edgeMarker && tool === "select" && selEdge && (
        <EdgeToolbar
          x={edgeMarker.x}
          y={edgeMarker.y}
          curve={selEdge.curve ?? "smoothstep"}
          color={selEdge.color ?? null}
          lineStyle={selEdge.style ?? "solid"}
          width={selEdge.width ?? null}
          onDelete={deleteSelectedEdges}
          onSetCurve={setSelectedEdgeCurve}
          onSetColor={setSelectedEdgeColor}
          onSetStyle={setSelectedEdgeLineStyle}
          onSetWidth={setSelectedEdgeWidth}
        />
      )}
    </div>
  );
}