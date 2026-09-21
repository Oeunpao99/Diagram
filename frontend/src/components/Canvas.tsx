import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  fromFlow,
  makeNode,
  toFlow,
  type FlowNode,
  type FlowNodeData,
} from "../api/adapter";
import { registerExportRuntime } from "../api/exportUtils";
import type {
  DiagramDoc,
  DiagramEdge,
  EdgeArrow,
  EdgeCurve,
  EdgeStyle,
  NodeKind,
} from "../api/types";
import { takeSkipNextDocFit } from "../lib/docFit";
import { computeGroupRects, isInside, membersOf } from "../lib/groupRects";
import { iconToDataUrl } from "../lib/iconToDataUrl";
import { pageRectFromMeta } from "../lib/pagePresets";
import type { TextFormat } from "../lib/textFormat";
import { CANVAS_ACTION_EVENT, useDiagram } from "../store/useDiagram";
import { useSettings } from "../store/useSettings";
import { AiSuggestion } from "./AiSuggestion";
import { ASSET_LIBRARY } from "./assetLibrary";
import { AssetsDock } from "./AssetsDock";
import { CanvasToolbar, type Tool } from "./CanvasToolbar";
import { EdgeToolbar } from "./EdgeToolbar";
import { ICON_CATALOG } from "./iconCatalog";
import { nodeTypes } from "./nodes";
import { RehearsalOverlay } from "./RehearsalOverlay";
import { StylePanel } from "./StylePanel";

/** AI operations whose result gets the full "pen is drawing this" rehearsal —
 *  a brand-new or fully re-laid-out diagram, where hiding the canvas and
 *  redrawing the whole thing reads as a reveal. An edit lands instantly
 *  instead, with a quick cross-fade rather than a multi-second replay — see
 *  the busy-transition effect below. */
const REHEARSE_ON_BUSY = new Set(["generating", "laying-out"]);

// Pencil tool — see the "pencil tool" section below for why a stroke becomes
// a plain image node rather than a new kind of canvas content.
const DRAW_STROKE = "#1e293b"; // var(--ink)'s light-mode value, baked into the
// SVG at commit time — a static raster/vector image, not something a
// stylesheet can reach into, so this can't just be the CSS variable itself.
const DRAW_PAD = 10; // px of breathing room around the stroke's own bounds

export function Canvas() {
  const doc = useDiagram((s) => s.doc);
  const setDoc = useDiagram((s) => s.setDoc);
  const prefs = useSettings((s) => s.prefs);
  const setSelection = useDiagram((s) => s.setSelection);
  const selection = useDiagram((s) => s.selection);
  const edgeSelection = useDiagram((s) => s.edgeSelection);
  const setEdgeSelection = useDiagram((s) => s.setEdgeSelection);
  const undo = useDiagram((s) => s.undo);
  const redo = useDiagram((s) => s.redo);

  const { fitView, zoomIn, zoomOut, screenToFlowPosition, getNodes, getNodesBounds, getEdges } =
    useReactFlow<FlowNode, Edge>();
  const transform = useStore((s) => s.transform);
  const selectedId = useDiagram((s) => s.selection.at(-1) ?? null);
  const selectedNode = useStore((s) =>
    selectedId ? s.nodeLookup.get(selectedId) : null,
  );

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
  // True from the instant generation/layout finishes until the rehearsal
  // sketch is done — a separate flag from `rehearsal` itself (which only
  // exists once the sketch is actually ready to play) because the real
  // canvas needs to hide *before* that, not once it starts. See the
  // busy-transition effect below. Lives in the store, not local state — the
  // Copilot panel needs to read it too, to hold its own "done" summary
  // until the sketch actually finishes instead of the instant busy clears.
  const rehearsing = useDiagram((s) => s.rehearsing);
  const setRehearsing = useDiagram((s) => s.setRehearsing);
  const setGenerationProgress = useDiagram((s) => s.setGenerationProgress);
  const setGenerationPlan = useDiagram((s) => s.setGenerationPlan);

  const syncing = useRef(false);
  const prevBusy = useRef<string | null>(null);
  // Snapshot of the doc right as an AI-driven busy period (generate/layout/
  // edit) starts, so completion can tell whether anything actually changed —
  // a chat message that turns out to be a question rather than an edit
  // instruction still cycles busy through "editing" and back to null with
  // the doc untouched, and neither the rehearsal nor the edit cross-fade
  // below should play for that.
  const rehearseDocRef = useRef<DiagramDoc | null>(null);
  const [editFade, setEditFade] = useState(false);
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

  // Expose a content-bounds reader for image export. Export must capture every
  // node/edge regardless of the on-screen pan/zoom, so the rasteriser asks the
  // live React Flow store for the current bounding box instead of the DOM.
  useEffect(() => {
    registerExportRuntime({
      getFlowBounds: () => {
        // Containers count: they start above and outside their members, so
        // measuring only the nodes would crop every boundary box in half.
        const content = getNodes().filter(
          (n) => n.type === "diagram" || n.type === "group",
        );
        if (!content.length) return null;
        return getNodesBounds(content);
      },
    });
    return () => registerExportRuntime(null);
  }, [getNodes, getNodesBounds]);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z — the TopBar's undo/redo buttons already
  // advertise these in their tooltips, but nothing actually listened for them.
  // Deletion needs no matching wiring here: React Flow's own `deleteKeyCode`
  // prop (set below) handles Backspace/Delete for whichever nodes/edges are
  // selected, since selection already round-trips through the controlled
  // nodes/edges state same as everything else.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "z" || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      // Typing in a text field gets its own native undo — hijacking that into
      // a diagram-level undo would revert the last diagram action instead of
      // the character the user just typed.
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  // Viewport actions the copilot agent asked for ("zoom out a bit", "show me
  // the whole thing"). They can't go through the store like undo/redo does —
  // the viewport belongs to the React Flow instance, which only exists here.
  useEffect(() => {
    const onAction = (event: Event) => {
      switch ((event as CustomEvent<string>).detail) {
        case "fit_view":
          void fitView({ padding: 0.18, duration: 320 });
          return;
        case "zoom_in":
          void zoomIn({ duration: 220 });
          return;
        case "zoom_out":
          void zoomOut({ duration: 220 });
      }
    };
    window.addEventListener(CANVAS_ACTION_EVENT, onAction);
    return () => window.removeEventListener(CANVAS_ACTION_EVENT, onAction);
  }, [fitView, zoomIn, zoomOut]);

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
    // One-shot marker for a node placed by double-click-to-add-text, so its
    // component can open the editor as soon as it renders (nodes.tsx reads
    // it). Consumed here rather than left dangling on the next sync.
    const pendingEditId = pendingEditRef.current;
    pendingEditRef.current = null;

    // Carry over `measured`/`selected` for nodes that already existed: toFlow
    // builds fresh objects every call, and handing React Flow an "unmeasured"
    // node it already knows about triggers a dimensions remeasure — harmless
    // on its own, but see the fitView note below for why it used to look like
    // a drag was being undone.
    // Bail out of the write when the sync produced nothing new — same ids,
    // positions, sizes, labels and highlight flags. Handing React Flow a
    // brand-new array with identical content each time is what feeds the
    // classic xyflow "Maximum update depth exceeded" crash-on-setNodes loop
    // (xyflow #2571 / #4521): each write wobbles the internal store, the
    // wobble re-runs this effect, and the re-run writes again. Returning the
    // previous array reference lets React and React Flow both see "nothing
    // changed" and bail, so that cascade dies instead of amplifying.
    setNodes((prevNodes) => {
      const prevById = new Map(prevNodes.map((n) => [n.id, n]));
      let changed = prevNodes.length !== flow.nodes.length;
      const next = flow.nodes.map((n) => {
        const prev = prevById.get(n.id);
        const merged = prev
          ? { ...n, measured: prev.measured, selected: prev.selected }
          : n;
        const targetForAutoEdit = pendingEditId === n.id;
        const flagged =
          !targetForAutoEdit && justAdded.has(n.id)
            ? { ...merged, data: { ...merged.data, justAdded: true } }
            : merged;
        // The just-placed double-click text node gets a one-shot pick-me-up:
        // its editor opens as soon as it renders (see nodes.tsx), instead of
        // the transient just-added pulse — typing takes over as the cue. It's
        // a transient flag on the controlled flow node, never synced to the
        // doc.
        const withEdit = targetForAutoEdit
          ? { ...flagged, data: { ...flagged.data, autoEdit: true } }
          : flagged;
        if (!changed) {
          const nd = withEdit.data;
          changed = !prev;
          if (prev && !changed) {
            const pd = prev.data;
            // Every field the node actually renders with. A style-only change
            // (colour, line style, opacity, font size) round-trips through
            // setDoc and only reaches React Flow if this diff notices it — a
            // shallow check that skipped `style` was how "pick a colour,
            // nothing happens until you switch the shape" used to feel.
            changed =
              prev.position.x !== n.position.x ||
              prev.position.y !== n.position.y ||
              pd.width !== nd.width ||
              pd.height !== nd.height ||
              pd.label !== nd.label ||
              pd.kind !== nd.kind ||
              pd.description !== nd.description ||
              pd.lane !== nd.lane ||
              pd.group !== nd.group ||
              pd.imageUrl !== nd.imageUrl ||
              pd.icon !== nd.icon ||
              pd.justAdded !== nd.justAdded ||
              JSON.stringify(pd.style ?? null) !== JSON.stringify(nd.style ?? null);
          }
        }
        return withEdit;
      });
      return changed ? next : prevNodes;
    });
    // Same carry-over for edges: toFlow builds fresh objects every call, and
    // replacing `selected`-carrying edges with bare ones would drop the
    // highlight the user is actively working against each time a style
    // change round-trips through setDoc. Same bail-out as the nodes above —
    // a re-run that has nothing new to say returns the same array reference
    // instead of feeding the re-render loop.
    setEdges((prevEdges) => {
      const prevById = new Map(prevEdges.map((e) => [e.id, e]));
      let changed = prevEdges.length !== flow.edges.length;
      const next = flow.edges.map((e) => {
        const prev = prevById.get(e.id);
        const merged = prev ? { ...e, selected: prev.selected } : e;
        if (!changed) {
          // Same principle as the node diff above: edge style fields beyond
          // the stroke colour (dash pattern, width, arrowheads, animated
          // curve) only land on the canvas when this check notices them.
          changed =
            !prev ||
            prev.source !== e.source ||
            prev.target !== e.target ||
            prev.sourceHandle !== e.sourceHandle ||
            prev.targetHandle !== e.targetHandle ||
            prev.label !== e.label ||
            prev.type !== e.type ||
            prev.animated !== e.animated ||
            (prev.markerStart ?? null) !== (e.markerStart ?? null) ||
            (prev.markerEnd ?? null) !== (e.markerEnd ?? null) ||
            (prev.style?.stroke ?? null) !== (e.style?.stroke ?? null) ||
            (prev.style?.strokeDasharray ?? null) !== (e.style?.strokeDasharray ?? null) ||
            (prev.style?.strokeWidth ?? null) !== (e.style?.strokeWidth ?? null);
        }
        return merged;
      });
      return changed ? next : prevEdges;
    });
    const skipFit = takeSkipNextDocFit() || skipNextFitView.current;
    skipNextFitView.current = false;
    const id = window.setTimeout(() => {
      syncing.current = false;
      // fitView reframes from its own internal node bounds, which can still
      // reflect the pre-drag layout for a moment after a manual commit — the
      // data was never wrong, but re-fitting against that stale snapshot
      // visibly snaps the node you just dragged back toward where it was.
      if (!skipFit && doc.nodes.length)
        void fitView({ padding: 0.16, duration: 350 });
    }, 60);
    return () => window.clearTimeout(id);
  }, [doc, setNodes, setEdges, fitView]);

  // Selections whose edges no longer exist (deleted, or an AI rewrite
  // replaced the graph) can't point at anything — drop them. Kept out of the
  // doc-sync effect above so selecting/deselecting an edge never re-triggers
  // the fitView that lives there.
  useEffect(() => {
    if (edgeSelection.some((id) => !doc.edges.some((e) => e.id === id))) {
      setEdgeSelection(
        edgeSelection.filter((id) => doc.edges.some((e) => e.id === id)),
      );
    }
  }, [doc, edgeSelection, setEdgeSelection]);

  // When a generate/layout settles, replay the new diagram as a hand-drawn
  // sketch. An edit lands on the canvas instantly instead — a full replay
  // would redraw the whole diagram for what's often a one-line change — but
  // still gets a quick cross-fade so the change doesn't read as an abrupt cut.
  useEffect(() => {
    const was = prevBusy.current;
    prevBusy.current = busy;

    if (busy !== null && was === null && (REHEARSE_ON_BUSY.has(busy) || busy === "editing")) {
      rehearseDocRef.current = useDiagram.getState().doc;
    }
    if (busy !== null || !was) return;

    if (REHEARSE_ON_BUSY.has(was)) {
      // Hide the real canvas *now*, in this same tick — not once the sketch
      // is actually ready 560ms from now. `doc` finishes updating to the new
      // diagram in the same store update that clears `busy`, so the doc-sync
      // effect above is about to render the complete result in full; without
      // this, that full render paints first and sits on screen for the
      // entire 560ms wait, and only then does the sketch hide it and start
      // "redrawing" something the user just watched finish — reading as a
      // replay of an animation that already happened, not the reveal it's
      // meant to be.
      setRehearsing(true);
      const id = window.setTimeout(() => {
        // Let React Flow finish swapping nodes + the fitView settle, then
        // capture a stable snapshot so the strokes land exactly on the diagram.
        const current = useDiagram.getState().doc;
        if (current.nodes.length < 2 || current === rehearseDocRef.current) {
          setRehearsing(false); // nothing to rehearse — reveal what's already there
          setGenerationProgress(null);
          setGenerationPlan(null);
          return;
        }
        // Known up front, before the first `onNodeStart` fires below — the
        // same order RehearsalOverlay will draw them in, so the Copilot
        // panel can show the whole todo list immediately instead of
        // learning it one label at a time.
        setGenerationPlan(current.nodes.map((node) => node.label));
        setRehearsal({
          key: Date.now(),
          doc: current,
          transform: transformRef.current,
        });
      }, 560);
      return () => window.clearTimeout(id);
    }

    if (was === "editing" && useDiagram.getState().doc !== rehearseDocRef.current) {
      setEditFade(true);
      const id = window.setTimeout(() => setEditFade(false), 220);
      return () => window.clearTimeout(id);
    }
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
    setDoc(fromFlow(useDiagram.getState().doc, getNodes(), getEdges()), {
      silent: true,
    });
  }, [setDoc, getNodes, getEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const id = `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      setEdges((current) =>
        addEdge({ ...connection, id, type: "smoothstep" }, current),
      );
      // Persist to the doc immediately — unlike node drags there's no later
      // commit() event here, so without this the edge lives only in React
      // Flow's local state and silently vanishes on the next doc sync
      // (undo/redo, autosave, an AI edit, or a reload).
      const currentDoc = useDiagram.getState().doc;
      setDoc({
        ...currentDoc,
        edges: [
          ...currentDoc.edges,
          {
            id,
            source: connection.source,
            target: connection.target,
            source_handle: connection.sourceHandle ?? null,
            target_handle: connection.targetHandle ?? null,
            label: null,
            style: "solid",
            condition: null,
            bidirectional: false,
            start_arrow: null,
            end_arrow: null,
            curve: "smoothstep",
            color: null,
            width: null,
          },
        ],
      });
      if (tool === "connector") setTool("select");
    },
    [setEdges, tool, setDoc],
  );

  // Drag an existing connector's end onto a different node/port to
  // re-target it. Same reason as onConnect above for editing the doc by
  // hand instead of calling commit(): getEdges() reads React Flow's own
  // store, which a setEdges() call earlier in this same tick hasn't
  // reached yet, so reading it back immediately would still see the old
  // endpoint — updating the matching doc edge directly is what actually
  // lands the change, and it keeps every other field (colour, style,
  // arrows, label) untouched.
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((current) => reconnectEdge(oldEdge, newConnection, current));
      const currentDoc = useDiagram.getState().doc;
      setDoc({
        ...currentDoc,
        edges: currentDoc.edges.map((e) =>
          e.id === oldEdge.id
            ? {
                ...e,
                source: newConnection.source,
                target: newConnection.target,
                source_handle: newConnection.sourceHandle ?? null,
                target_handle: newConnection.targetHandle ?? null,
              }
            : e,
        ),
      });
    },
    [setEdges, setDoc],
  );

  const onSelectionChange = useCallback(
    ({
      nodes: selectedNodes,
      edges: selectedEdges,
    }: OnSelectionChangeParams) => {
      setSelection(
        selectedNodes.filter((n) => n.type === "diagram").map((n) => n.id),
      );
      const box = selectedNodes.find((n) => n.type === "group");
      setSelectedGroup(box ? box.id.replace(/^group__/, "") : null);
      setEdgeSelection(selectedEdges.map((e) => e.id));
    },
    [setSelection, setEdgeSelection],
  );

  const insertAt = (spec: Parameters<typeof makeNode>[0]) => {
    const current = useDiagram.getState().doc;
    setDoc({ ...current, nodes: [...current.nodes, makeNode(spec)] });
  };

  // Double-click detection for the pane in select mode: React Flow has no
  // onPaneDoubleClick, so two pane clicks within ~350ms and ~8px read as the
  // double-click that drops a text node (and opens its editor — see
  // pendingEditRef). Single clicks keep their usual select/deselect job.
  const lastPaneClick = useRef<{ time: number; x: number; y: number } | null>(null);
  // The node id that should open its label editor the moment it reaches the
  // canvas — set alongside insertAt so the doc-sync effect can tag exactly
  // that flow node with autoEdit.
  const pendingEditRef = useRef<string | null>(null);

  const addTextNodeAt = (event: React.MouseEvent) => {
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const id = `node_${Date.now().toString(36)}`;
    pendingEditRef.current = id;
    insertAt({
      id,
      label: "Text",
      kind: "note",
      position: point,
      style: { textOnly: true },
    });
  };

  /* --------------------------------------------- click-to-place tools */
  // "select", "hand" and "connector" don't place anything on a pane click —
  // connector's whole job is dragging between two ports, and click-placing
  // under it would fight that. Everything else drops one element and hops
  // back to "select" so you don't keep stamping out copies by accident.

  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageDropPoint = useRef<{ x: number; y: number } | null>(null);

  const onPaneClick = (event: React.MouseEvent) => {
    // In select mode a double-click on empty canvas is "place a text node",
    // not React Flow's default zoom — see addTextNodeAt above.
    if (tool === "select") {
      const now = Date.now();
      const prev = lastPaneClick.current;
      const isDouble =
        !!prev &&
        now - prev.time < 350 &&
        Math.hypot(event.clientX - prev.x, event.clientY - prev.y) < 8;
      lastPaneClick.current = { time: now, x: event.clientX, y: event.clientY };
      if (isDouble) {
        lastPaneClick.current = null; // a third click isn't another double-click
        addTextNodeAt(event);
      }
      return;
    }
    if (
      tool === "hand" ||
      tool === "connector" ||
      tool === "group"
    )
      return;
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });

    if (tool === "image") {
      imageDropPoint.current = point;
      imageInputRef.current?.click();
      return;
    }

    const PLACEMENT: Partial<
      Record<Tool, { kind: NodeKind; label: string; textOnly?: boolean }>
    > = {
      node: { kind: "process", label: "Process" },
      text: { kind: "note", label: "Text", textOnly: true },
    };
    const spec = PLACEMENT[tool];
    if (!spec) return;

    const id = `node_${Date.now().toString(36)}`;
    // A placed text label opens its label editor the moment it lands, the
    // same as the double-click-add path — see pendingEditRef / addTextNodeAt.
    if (spec.textOnly) pendingEditRef.current = id;
    insertAt({
      id,
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
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });

    const iconKey = event.dataTransfer.getData("application/copilot-icon");
    if (iconKey) {
      const asset = ICON_CATALOG.find((a) => a.key === iconKey);
      if (!asset) return;
      insertAt({
        id: `img_${Date.now().toString(36)}`,
        label: asset.label,
        kind: "note",
        position: point,
        imageUrl: iconToDataUrl(asset.Icon),
        size: { width: 56, height: 56 },
      });
      return;
    }

    const kind = event.dataTransfer.getData("application/copilot-asset") as
      | NodeKind
      | "";
    if (!kind) return;
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
    const assetSpec = ASSET_LIBRARY.find((a) => a.kind === kind);
    insertAt({
      id: `node_${Date.now().toString(36)}`,
      label: labels[kind] ?? "New node",
      kind,
      position: point,
      ...(assetSpec?.size ? { size: assetSpec.size } : {}),
    });
  };

  /* --------------------------------------------------------- pencil tool */
  // Freehand ink, captured as raw screen points while the pointer is down
  // and only turned into anything real on release — a small standalone SVG
  // sized to exactly what was drawn, dropped in as an image node the same
  // way a dragged-in icon or pasted picture already lands. That reuses every
  // bit of existing machinery (move, resize, delete, export, undo) instead
  // of teaching the schema, the backend, and every consumer of DiagramDoc a
  // second kind of canvas content.

  const [drawPoints, setDrawPoints] = useState<{ x: number; y: number }[] | null>(null);
  const lastDrawPoint = useRef<{ x: number; y: number } | null>(null);

  /** A light quadratic smoothing pass — each segment curves through the
   *  midpoint of its two neighbours instead of a hard corner at every
   *  sampled point, which is what makes a raw pointer trail look hand-drawn
   *  rather than faceted. */
  const smoothPath = (points: { x: number; y: number }[]): string => {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i + 1].x) / 2;
      const my = (points[i].y + points[i + 1].y) / 2;
      d += ` Q ${points[i].x} ${points[i].y} ${mx} ${my}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  };

  const onDrawPointerDown = (event: React.PointerEvent) => {
    if (tool !== "draw") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY };
    lastDrawPoint.current = start;
    setDrawPoints([start]);
  };

  const onDrawPointerMove = (event: React.PointerEvent) => {
    if (!drawPoints) return;
    const last = lastDrawPoint.current;
    // A small minimum step keeps the point list (and later, the path string)
    // from growing by one entry per pixel of mouse jitter.
    if (last && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 2) return;
    const next = { x: event.clientX, y: event.clientY };
    lastDrawPoint.current = next;
    setDrawPoints((points) => (points ? [...points, next] : points));
  };

  const onDrawPointerUp = () => {
    const points = drawPoints;
    setDrawPoints(null);
    lastDrawPoint.current = null;
    // A stray click, not a stroke — nothing worth turning into a node.
    if (!points || points.length < 3) return;

    const flowPoints = points.map((p) => screenToFlowPosition(p));
    const minX = Math.min(...flowPoints.map((p) => p.x));
    const minY = Math.min(...flowPoints.map((p) => p.y));
    const maxX = Math.max(...flowPoints.map((p) => p.x));
    const maxY = Math.max(...flowPoints.map((p) => p.y));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    // Shifted to start at (0,0) so the SVG's own viewBox — not an absolute
    // canvas coordinate — is what the path is drawn against.
    const local = flowPoints.map((p) => ({ x: p.x - minX + DRAW_PAD, y: p.y - minY + DRAW_PAD }));
    const boxW = width + DRAW_PAD * 2;
    const boxH = height + DRAW_PAD * 2;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${boxW} ${boxH}">` +
      `<path d="${smoothPath(local)}" fill="none" stroke="${DRAW_STROKE}" ` +
      `stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    insertAt({
      id: `draw_${Date.now().toString(36)}`,
      label: "Drawing",
      kind: "note",
      position: { x: minX - DRAW_PAD, y: minY - DRAW_PAD },
      imageUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      size: { width: boxW, height: boxH },
      style: { textOnly: true },
    });
    // Stays in "draw" — a sketch is rarely one stroke, so switching back to
    // "select" after every single line would undo the tool pick constantly.
  };

  /* ------------------------------------------------ selected-node actions */

  const selNodeIds = () =>
    selection.filter((id) =>
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
    if (!ids.length && selectedGroup) {
      deleteSelectedGroup();
      return;
    }
    setDoc({
      ...current,
      nodes: current.nodes.filter((n) => !ids.includes(n.id)),
      edges: current.edges.filter(
        (e) => !ids.includes(e.source) && !ids.includes(e.target),
      ),
    });
    setSelection([]);
    setEdgeSelection([]);
  };

  /* ------------------------------------------------ selected-edge actions */

  const selEdgeIds = () =>
    edgeSelection.filter((id) =>
      useDiagram.getState().doc.edges.some((e) => e.id === id),
    );

  const patchSelectedEdges = (patch: Partial<DiagramEdge>) => {
    const current = useDiagram.getState().doc;
    const ids = selEdgeIds();
    if (!ids.length) return;
    setDoc({
      ...current,
      edges: current.edges.map((e) =>
        ids.includes(e.id) ? { ...e, ...patch } : e,
      ),
    });
  };

  const setSelectedEdgeCurve = (curve: EdgeCurve) =>
    patchSelectedEdges({ curve });
  const setSelectedEdgeColor = (color: string | null) =>
    patchSelectedEdges({ color });
  const setSelectedEdgeLineStyle = (style: EdgeStyle) =>
    patchSelectedEdges({ style });
  const setSelectedEdgeStartArrow = (start_arrow: EdgeArrow) =>
    patchSelectedEdges({ start_arrow });
  const setSelectedEdgeEndArrow = (end_arrow: EdgeArrow) =>
    patchSelectedEdges({ end_arrow });
  const setSelectedEdgeWidth = (width: number | null) =>
    patchSelectedEdges({ width });
  const setSelectedEdgeLabel = (label: string) =>
    patchSelectedEdges({ label: label || null });
  const setSelectedEdgeLabelColor = (label_color: string | null) =>
    patchSelectedEdges({ label_color });
  const setSelectedEdgeLabelFontSize = (label_font_size: number | null) =>
    patchSelectedEdges({ label_font_size });

  const deleteSelectedEdges = () => {
    const current = useDiagram.getState().doc;
    const ids = selEdgeIds();
    if (!ids.length) return;
    setDoc({
      ...current,
      edges: current.edges.filter((e) => !ids.includes(e.id)),
    });
    setEdgeSelection([]);
  };

  const setSelectedShape = (kind: NodeKind) => {
    const current = useDiagram.getState().doc;
    const ids = selNodeIds();
    if (!ids.length) return;
    const spec = ASSET_LIBRARY.find((a) => a.kind === kind);
    setDoc({
      ...current,
      nodes: current.nodes.map((n) =>
        ids.includes(n.id)
          ? { ...n, kind, ...(spec?.size ? { size: spec.size } : {}) }
          : n,
      ),
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

  const setSelectedLineStyle = (borderStyle: "solid" | "dashed" | "dotted") => {
    const current = useDiagram.getState().doc;
    const ids = selNodeIds();
    if (!ids.length) return;
    setDoc({
      ...current,
      nodes: current.nodes.map((n) => {
        if (!ids.includes(n.id)) return n;
        const style = { ...(n.style ?? {}) };
        if (borderStyle === "solid") delete style.borderStyle;
        else style.borderStyle = borderStyle;
        return { ...n, style };
      }),
    });
  };

  const setSelectedOpacity = (opacity: number) => {
    const current = useDiagram.getState().doc;
    const ids = selNodeIds();
    if (!ids.length) return;
    setDoc({
      ...current,
      nodes: current.nodes.map((n) => {
        if (!ids.includes(n.id)) return n;
        const style = { ...(n.style ?? {}) };
        if (opacity >= 1) delete style.opacity;
        else style.opacity = opacity;
        return { ...n, style };
      }),
    });
  };

  const setSelectedFontSize = (fontSize: number | null) => {
    const current = useDiagram.getState().doc;
    const ids = selNodeIds();
    if (!ids.length) return;
    setDoc({
      ...current,
      nodes: current.nodes.map((n) => {
        if (!ids.includes(n.id)) return n;
        const style = { ...(n.style ?? {}) };
        if (fontSize === null) delete style.fontSize;
        else style.fontSize = fontSize;
        return { ...n, style };
      }),
    });
  };

  /** Shared by the wedge/hub "Title text" and "Description text" panels —
   *  same merge-a-patch-into-one-style-key shape as every setter above,
   *  just one level deeper since each field's format is its own object
   *  rather than a single flat value. */
  const setSelectedTextFormat = (field: "titleFormat" | "descFormat", patch: Partial<TextFormat>) => {
    const current = useDiagram.getState().doc;
    const ids = selNodeIds();
    if (!ids.length) return;
    setDoc({
      ...current,
      nodes: current.nodes.map((n) => {
        if (!ids.includes(n.id)) return n;
        const existing = { ...((n.style?.[field] as TextFormat | undefined) ?? {}) };
        for (const [key, val] of Object.entries(patch)) {
          if (val === undefined) delete (existing as Record<string, unknown>)[key];
          else (existing as Record<string, unknown>)[key] = val;
        }
        const style = { ...(n.style ?? {}), [field]: existing };
        return { ...n, style };
      }),
    });
  };
  const setSelectedTitleFormat = (patch: Partial<TextFormat>) => setSelectedTextFormat("titleFormat", patch);
  const setSelectedDescFormat = (patch: Partial<TextFormat>) => setSelectedTextFormat("descFormat", patch);

  /** Wrap the current multi-selection in a container, or — if they are
   *  already all in the same one — take them back out of it. The container is
   *  a real part of the document: the backend lays it out, the AI can edit it,
   *  and it exports with the diagram. */
  const groupSelected = () => {
    const current = useDiagram.getState().doc;
    const ids = selNodeIds();
    if (ids.length < 2) return;

    const targets = current.nodes.filter((n) => ids.includes(n.id));
    const existing = new Set(targets.map((n) => n.group).filter(Boolean));
    const alreadyOne = existing.size === 1 && targets.every((n) => n.group);

    if (alreadyOne) {
      const freed = [...existing][0];
      const next = {
        ...current,
        nodes: current.nodes.map((n) =>
          ids.includes(n.id) ? { ...n, group: null } : n,
        ),
        // The container is left in place only if something else still sits in
        // it; an emptied one would draw nothing, so drop it.
        groups: (current.groups ?? []).filter(
          (g) =>
            g.id !== freed ||
            current.nodes.some((n) => !ids.includes(n.id) && n.group === freed) ||
            (current.groups ?? []).some((g2) => g2.parent === freed),
        ),
      };
      setDoc({ ...next, groups: computeGroupRects(next) });
      return;
    }

    // Nest inside whatever container already holds all of the selection, so
    // grouping two nodes in a subnet makes a box inside that subnet.
    const shared = targets[0].group ?? null;
    const parent = targets.every((n) => (n.group ?? null) === shared)
      ? shared
      : null;
    const id = `group_${Date.now().toString(36)}`;
    const next = {
      ...current,
      nodes: current.nodes.map((n) =>
        ids.includes(n.id) ? { ...n, group: id } : n,
      ),
      groups: [
        ...(current.groups ?? []),
        { id, label: "Group", parent, collapsed: false, rect: null },
      ],
    };
    setDoc({ ...next, groups: computeGroupRects(next) });
  };

  /* ------------------------------------------------- container selection */
  // Local rather than in the store: `selection` there means "selected nodes",
  // which the style panel and toolbar both rely on.
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const deleteSelectedGroup = () => {
    const current = useDiagram.getState().doc;
    const doomed = (current.groups ?? []).find((g) => g.id === selectedGroup);
    if (!doomed) return;
    // Removing a boundary shouldn't flatten what it held: children rise to
    // the deleted container's own parent, mirroring the agent's delete_group.
    const next = {
      ...current,
      nodes: current.nodes.map((n) =>
        n.group === doomed.id ? { ...n, group: doomed.parent ?? null } : n,
      ),
      groups: (current.groups ?? [])
        .filter((g) => g.id !== doomed.id)
        .map((g) =>
          g.parent === doomed.id ? { ...g, parent: doomed.parent ?? null } : g,
        ),
    };
    setDoc({ ...next, groups: computeGroupRects(next) });
    setSelectedGroup(null);
  };


  /* -------------------------------------------------- container dragging */
  // Dragging a container's header strip carries everything inside it.
  // Dragging a node *within* a container just moves that node, and the box
  // regrows around it — that's computeGroupRects, applied in fromFlow.
  // Positions are captured on drag start so the applied delta stays exact
  // even after snap-to-grid rounding on the element actually being dragged.
  const dragStart = useRef<Map<string, { x: number; y: number }> | null>(null);
  // Every React Flow element that rides along with the container being
  // dragged: its member nodes plus the boxes of any container nested inside
  // it. Resolved once on drag start rather than recomputed per frame.
  const dragRiders = useRef<Set<string>>(new Set());

  const draggedGroupId = (node: FlowNode) =>
    node.type === "group" ? node.id.replace(/^group__/, "") : null;

  const onNodeDragStart = useCallback(
    (_event: unknown, node: FlowNode) => {
      const groupId = draggedGroupId(node);
      if (!groupId) return;
      const doc = useDiagram.getState().doc;
      const members = membersOf(doc, groupId);
      const boxes = (doc.groups ?? [])
        .filter((g) => g.id !== groupId && isInside(doc, g.id, groupId))
        .map((g) => `group__${g.id}`);
      dragRiders.current = new Set([...members, ...boxes]);
      // Read start positions from React Flow's own store rather than the
      // closed-over controlled `nodes` state: getNodes() is exactly the set of
      // elements being dragged right now (group boxes included), and it keeps
      // this callback — and every child callback that depends on it — stable
      // across renders. A fresh handler identity on every render while
      // dragging is what used to pin the classic "Maximum update depth
      // exceeded" crash when riding sibling nodes along.
      dragStart.current = new Map(getNodes().map((n) => [n.id, n.position]));
    },
    [getNodes],
  );

  // Rider positions aren't written on every pointer event. Each pointermove
  // only records the latest delta, and one requestAnimationFrame flush applies
  // it to the controlled `nodes`. Writing synchronously inside the gesture was
  // re-entering React Flow's own store while it was mid-drag-update (each
  // write notifies every internal subscriber in the same tick), which is the
  // same nested-update loop the resize used to trip over. Frame-coalescing
  // keeps the group gliding at the same 60fps with none of the re-entrancy.
  const riderFrame = useRef<number | null>(null);
  const riderDelta = useRef<{ dx: number; dy: number } | null>(null);

  const flushRiders = useCallback(() => {
    riderFrame.current = null;
    const delta = riderDelta.current;
    riderDelta.current = null;
    if (!delta) return;
    const starts = dragStart.current;
    if (!starts) return;
    const { dx, dy } = delta;
    setNodes((current) => {
      let moved = false;
      const next = current.map((n) => {
        if (!dragRiders.current.has(n.id)) return n;
        const start = starts.get(n.id);
        if (!start) return n;
        const shifted = { ...n, position: { x: start.x + dx, y: start.y + dy } };
        if (shifted.position.x === n.position.x && shifted.position.y === n.position.y) {
          return n; // already there — keep the reference, nothing to re-render
        }
        moved = true;
        return shifted;
      });
      return moved ? next : current;
    });
  }, [setNodes]);

  const onNodeDrag = useCallback(
    (_event: unknown, node: FlowNode) => {
      const starts = dragStart.current;
      if (!draggedGroupId(node) || !starts) return;
      const from = starts.get(node.id);
      if (!from) return;
      riderDelta.current = { dx: node.position.x - from.x, dy: node.position.y - from.y };
      if (riderFrame.current === null) {
        riderFrame.current = requestAnimationFrame(flushRiders);
      }
    },
    [flushRiders],
  );

  const onNodeDragStopWithGroup = useCallback(
    (_event: unknown, node: FlowNode) => {
      const groupId = draggedGroupId(node);
      const starts = dragStart.current;
      if (riderFrame.current !== null) {
        cancelAnimationFrame(riderFrame.current);
        riderFrame.current = null;
      }
      riderDelta.current = null;
      dragStart.current = null;
      dragRiders.current = new Set();

      // A plain node drag needs nothing but the usual commit; fromFlow
      // regrows whatever container it landed in.
      if (!groupId || !starts) {
        commit();
        return;
      }

      const from = starts.get(node.id);
      if (!from) {
        commit();
        return;
      }
      const dx = node.position.x - from.x;
      const dy = node.position.y - from.y;
      if (dx === 0 && dy === 0) return;

      // Recomputing each member's final position from the drag's own delta
      // sidesteps a race: drag-stop can fire before the last in-gesture
      // setNodes has reached xyflow's store, so no "current nodes" read here
      // is guaranteed to see it. This is arithmetic on the callback's own
      // arguments — no store read involved. One setDoc, so autosave debounces
      // once rather than twice.
      const current = useDiagram.getState().doc;
      const moving = membersOf(current, groupId);
      skipNextFitView.current = true;
      const movedNodes = current.nodes.map((n) => {
        if (!moving.has(n.id)) return n;
        const start = starts.get(n.id);
        if (!start) return n;
        return { ...n, position: { x: start.x + dx, y: start.y + dy } };
      });
      setDoc(
        {
          ...current,
          nodes: movedNodes,
          groups: computeGroupRects({ ...current, nodes: movedNodes }),
        },
        { silent: true },
      );
    },
    [commit, setDoc],
  );

  /** The fitted "page" the flow was laid out to (slide / A4 / …), mapped into
   *  live screen space so the dashed frame tracks pan/zoom like the nodes. */
  const pageRect = (() => {
    const rect = pageRectFromMeta(doc.meta);
    if (!rect) return null;
    return {
      left: rect.x * transform[2] + transform[0],
      top: rect.y * transform[2] + transform[1],
      width: rect.width * transform[2],
      height: rect.height * transform[2],
    };
  })();

  const editSelected = () => {
    const current = useDiagram.getState().doc;
    const labels = current.nodes
      .filter((n) => selection.includes(n.id))
      .map((n) => n.label);
    if (!labels.length) return;
    window.dispatchEvent(
      new CustomEvent("copilot:focus", {
        detail: `Improve the selected node "${labels[0]}": `,
      }),
    );
  };

  const selData = selectedNode?.data as FlowNodeData | undefined;

  // Selected edge this round: exactly one edge, no node, and it must still
  // exist in the doc. Position follows the midpoint between the two connected
  // nodes' centres (available without reading React Flow's internal stores).
  const selEdgeId = edgeSelection.at(-1) ?? null;
  const selEdge = selEdgeId
    ? (doc.edges.find((e) => e.id === selEdgeId) ?? null)
    : null;
  const sourceNode = selEdge
    ? doc.nodes.find((n) => n.id === selEdge.source)
    : null;
  const targetNode = selEdge
    ? doc.nodes.find((n) => n.id === selEdge.target)
    : null;
  const edgeMarker =
    !selectedNode && selEdge && sourceNode && targetNode
      ? (() => {
          const mx =
            sourceNode.position.x +
            sourceNode.size.width / 2 +
            (targetNode.position.x + targetNode.size.width / 2);
          const my =
            sourceNode.position.y +
            sourceNode.size.height / 2 +
            (targetNode.position.y + targetNode.size.height / 2);
          return {
            x: (mx / 2) * transform[2] + transform[0],
            y: (my / 2) * transform[2] + transform[1],
          };
        })()
      : null;

  const panOnDrag = tool !== "select" && tool !== "draw";

  return (
    <div
      className="absolute inset-0"
      // While the pencil rehearsal plays — and for the brief settle-and-fit
      // window just before it starts, see `rehearsing` above — the real
      // nodes/edges are hidden — otherwise they're already fully rendered
      // underneath from the first frame, so the "sketch" reads as a
      // redundant scribble drawn on top of a diagram that's visibly already
      // there, not a reveal.
      data-rehearsing={rehearsing ? "true" : undefined}
      data-edit-fade={editFade ? "true" : undefined}
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
      {/* Circle/diamond connector end markers — not in React Flow's built-in
          MarkerType, so hand-rolled here and referenced by edges as
          url(#edge-marker-…). Defined once; `context-stroke` (with a static
          fallback for browsers that don't support it yet) keeps each marker
          the same colour as the line it terminates, matching every other
          connector end without tracking per-edge marker colours ourselves. */}
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <marker
            id="edge-marker-circle"
            viewBox="-10 -10 20 20"
            refX="0"
            refY="0"
            markerWidth={16}
            markerHeight={16}
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <circle cx="-4" cy="0" r="4" fill="#94a3b8" style={{ fill: "context-stroke" }} />
          </marker>
          <marker
            id="edge-marker-diamond"
            viewBox="-10 -10 20 20"
            refX="0"
            refY="0"
            markerWidth={16}
            markerHeight={16}
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path d="M -8 0 L -4 -4.5 L 0 0 L -4 4.5 Z" fill="#94a3b8" style={{ fill: "context-stroke" }} />
          </marker>
        </defs>
      </svg>

      {/* Fitted-page frame (slide / A4 / …): a soft page outline behind nodes
          so the user sees exactly what the export will crop to. */}
      {pageRect && (
        <div className="pointer-events-none absolute inset-0">
          <div
            style={{
              position: "absolute",
              left: pageRect.left,
              top: pageRect.top,
              width: pageRect.width,
              height: pageRect.height,
              border: "1px solid var(--line-strong)",
              borderRadius: 6,
              boxShadow:
                "inset 0 0 0 9999px color-mix(in srgb, var(--paper) 55%, transparent)",
            }}
          />
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
        // Not commit(): React Flow calls onNodesDelete/onEdgesDelete *before*
        // actually applying the removal to its own store, so a commit() here
        // would read getNodes()/getEdges() a beat too early, still including
        // the node/edge that's about to disappear — that stale snapshot then
        // round-trips back through the doc-sync effect and undoes the
        // deletion. Reusing the toolbar's own delete-by-current-selection
        // logic sidesteps the timing entirely.
        onEdgesDelete={deleteSelectedEdges}
        onNodesDelete={deleteSelected}
        onConnect={onConnect}
        onReconnect={onReconnect}
        edgesReconnectable={tool === "select"}
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
        // Double-click on empty canvas drops a text node, so React Flow's
        // zoom-on-double-click has to stay off — see onPaneClick above.
        zoomOnDoubleClick={false}
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
        {/* bottom-left, not the RF default bottom-right — the new right-docked
            StylePanel spans the full canvas height whenever a node is
            selected, and would sit right on top of a bottom-right minimap. */}
        {prefs.minimap && (
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            nodeStrokeWidth={2}
          />
        )}
      </ReactFlow>

      {/* Captures the actual stroke. Only interactive in "draw" — pointer-
          events stays off otherwise so this transparent sheet never shadows
          normal node interaction. Sits above the canvas (z-6, same tier as
          the drop-target hint below) but under the toolbar (z-8), so the
          toolbar stays clickable — including the one button that gets you
          back out of draw mode — the whole time a stroke is in progress. */}
      <div
        className={`absolute inset-0 z-[6] ${tool === "draw" ? "cursor-crosshair" : "pointer-events-none"}`}
        onPointerDown={onDrawPointerDown}
        onPointerMove={onDrawPointerMove}
        onPointerUp={onDrawPointerUp}
        onPointerCancel={onDrawPointerUp}
      >
        {drawPoints && drawPoints.length > 1 && (
          // `fixed`, not `absolute` — drawPoints are raw viewport
          // client coordinates (what screenToFlowPosition below also
          // expects), and this div's own box doesn't start at the
          // viewport's origin, so `absolute` would draw the preview
          // offset from the actual cursor by however far the canvas
          // itself sits from the top-left of the page.
          <svg className="pointer-events-none fixed inset-0 size-full">
            <path
              d={smoothPath(drawPoints)}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

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
          onNodeStart={(node, index, total) =>
            setGenerationProgress({ label: node.label, index, total })
          }
          onDone={() => {
            setRehearsal(null);
            setRehearsing(false); // reveal the real (now-matching) canvas
            setGenerationProgress(null);
            setGenerationPlan(null);
          }}
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

      {selectedNode && tool === "select" && (
        <StylePanel
          shape={selData?.kind ?? "process"}
          color={
            typeof selData?.style?.color === "string"
              ? selData.style.color
              : null
          }
          lineStyle={
            selData?.style?.borderStyle === "dashed" ||
            selData?.style?.borderStyle === "dotted"
              ? selData.style.borderStyle
              : "solid"
          }
          opacity={
            typeof selData?.style?.opacity === "number"
              ? selData.style.opacity
              : 1
          }
          fontSize={
            typeof selData?.style?.fontSize === "number"
              ? selData.style.fontSize
              : null
          }
          titleFormat={(selData?.style?.titleFormat as TextFormat | undefined) ?? {}}
          descFormat={(selData?.style?.descFormat as TextFormat | undefined) ?? {}}
          onEdit={editSelected}
          onDuplicate={duplicateSelected}
          onConnect={() => setTool("connector")}
          onDelete={deleteSelected}
          onClose={() => setSelection([])}
          onSetShape={setSelectedShape}
          onSetColor={setSelectedColor}
          onSetLineStyle={setSelectedLineStyle}
          onSetOpacity={setSelectedOpacity}
          onSetTitleFormat={setSelectedTitleFormat}
          onSetDescFormat={setSelectedDescFormat}
          onSetFontSize={setSelectedFontSize}
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
          startArrow={selEdge.start_arrow ?? (selEdge.bidirectional ? "triangle" : "none")}
          endArrow={selEdge.end_arrow ?? "triangle"}
          label={selEdge.label ?? ""}
          labelColor={selEdge.label_color ?? null}
          labelFontSize={selEdge.label_font_size ?? null}
          onDelete={deleteSelectedEdges}
          onSetCurve={setSelectedEdgeCurve}
          onSetColor={setSelectedEdgeColor}
          onSetStyle={setSelectedEdgeLineStyle}
          onSetWidth={setSelectedEdgeWidth}
          onSetStartArrow={setSelectedEdgeStartArrow}
          onSetEndArrow={setSelectedEdgeEndArrow}
          onSetLabel={setSelectedEdgeLabel}
          onSetLabelColor={setSelectedEdgeLabelColor}
          onSetLabelFontSize={setSelectedEdgeLabelFontSize}
        />
      )}
    </div>
  );
}
