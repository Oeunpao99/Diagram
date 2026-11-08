import {
  Background,
  BackgroundVariant,
  ReactFlow,
  useReactFlow,
  useStoreApi,
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";

import { toFlow } from "../../api/adapter";
import type { DiagramDoc } from "../../api/types";
import { FlowEdge } from "../../components/FlowEdge";
import { nodeTypes } from "../../components/nodes";

const edgeTypes = { smoothstep: FlowEdge };

/** Zoom the explorable canvases sit at: close enough to read every label,
 *  so a wide diagram runs past the card and is worth moving around. */
const EXPLORE_ZOOM = 0.95;
const PAD = 40;

/** Slowly drifts the view from one end of the diagram to the other and back,
 *  centred vertically, until the visitor moves it themselves. Only runs when
 *  the diagram is wider than the card. */
function AutoPan({ paused }: { paused: boolean }) {
  const { setViewport } = useReactFlow();
  const store = useStoreApi();

  useEffect(() => {
    if (paused) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const { width, height, nodeLookup } = store.getState();
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const node of nodeLookup.values()) {
        const w = node.measured?.width;
        const h = node.measured?.height;
        if (!w || !h) continue;
        const { x, y } = node.internals.positionAbsolute;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      }
      if (width && height && Number.isFinite(minX)) {
        const zoom = EXPLORE_ZOOM;
        const y = (height - (maxY - minY) * zoom) / 2 - minY * zoom;
        const overflow = (maxX - minX + PAD * 2) * zoom - width;
        let x = (width - (maxX - minX) * zoom) / 2 - minX * zoom;
        if (overflow > 0) {
          // Ease out and back: one full sweep every ~overflow/35 seconds.
          const period = Math.max(10, overflow / 35) * 1000;
          const p = 0.5 - 0.5 * Math.cos(((now - start) / period) * Math.PI * 2);
          x = -(minX - PAD) * zoom - p * overflow;
        }
        setViewport({ x, y, zoom });
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [paused, setViewport, store]);

  return null;
}

function usePrefersReducedMotion() {
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  return reduced;
}

/** A read-only canvas built from the editor's own pieces — the same node
 *  renderers, edge router, theme tokens and dotted grid. `revealed` shows
 *  only the first N nodes (and the links between them) so a diagram can be
 *  drawn in step by step.
 *
 *  With `explore`, the diagram sits at reading size instead of being shrunk
 *  to fit, drifts slowly across the card, and can be dragged; wheel scrolling
 *  is left to the page so the card never traps it. */
export function DemoCanvas({
  doc,
  revealed,
  explore = false,
  hints = { explore: "Drag to explore", move: "Drag to move around" },
}: {
  doc: DiagramDoc;
  revealed?: number;
  explore?: boolean;
  hints?: { explore: string; move: string };
}) {
  const flow = useMemo(() => toFlow(doc), [doc]);
  const reduced = usePrefersReducedMotion();
  const [touched, setTouched] = useState(false);
  const limit = revealed ?? doc.nodes.length;

  useEffect(() => setTouched(false), [doc]);

  // Rebuilt only when the doc or the number of shapes shown changes. The
  // hero re-renders this every animation tick (50ms); handing React Flow
  // fresh node and edge objects each time made it re-measure and redraw every
  // connector and label on every tick, which read as labels jittering.
  const { nodes, edges } = useMemo(() => {
    const shown = new Set(doc.nodes.slice(0, limit).map((node) => node.id));

    // Build order, the way the editor rehearses an AI result: a connector
    // draws itself from a shape that's already there, and the shape it leads
    // to pops in where the line lands. So a newly shown node waits for its
    // incoming link to finish drawing before it appears.
    const fedByShown = new Set(
      flow.edges.filter((e) => shown.has(e.source) && e.source !== e.target).map((e) => e.target),
    );

    const nodes = flow.nodes
      .filter((node) => node.type === "diagram")
      .map((node) => {
        const on = shown.has(node.id);
        return {
          ...node,
          draggable: false,
          selectable: false,
          focusable: false,
          className: on ? "kf-node-in" : "",
          // Opacity and a CSS variable only — never `transform`. React Flow
          // places each node with its own `transform: translate(…)` and
          // spreads `style` over it, so any transform key here (even
          // `undefined`) stacks every node at 0,0.
          style: {
            opacity: on ? 1 : 0,
            "--pop-delay": fedByShown.has(node.id) ? "0.5s" : "0s",
          } as React.CSSProperties,
        };
      });

    const edges = flow.edges.map((edge) => {
      const on = shown.has(edge.source) && shown.has(edge.target);
      return {
        ...edge,
        className: on ? "kf-edge-in" : "",
        label: on ? edge.label : undefined,
        style: { ...edge.style, opacity: on ? 1 : 0 },
      };
    });
    return { nodes, edges };
  }, [flow, limit, doc.nodes]);

  return (
    <div
      className={`relative h-full w-full ${explore ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
      aria-hidden="true"
    >
      <ReactFlow
        key={doc.title}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={explore}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={explore}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        onMoveStart={(event) => {
          // A null event is our own setViewport; a real one is the visitor.
          if (event) setTouched(true);
        }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.6}
        fitView={!explore}
        fitViewOptions={{ padding: 0.14 }}
        defaultViewport={{ x: 0, y: 0, zoom: EXPLORE_ZOOM }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          style={{ background: "var(--paper)" }}
        />
        {explore && <AutoPan paused={touched || reduced} />}
      </ReactFlow>
      {explore && (
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-line bg-surface/90 px-2.5 py-1 text-[12px] text-slate">
          {touched ? hints.move : hints.explore}
        </span>
      )}
    </div>
  );
}
