import {
  cloneElement,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

import type { DiagramDoc, DiagramNode, NodeKind } from "../api/types";
import { resolveNodeColor } from "../lib/nodeColor";

export interface RehearsalOverlayProps {
  doc: DiagramDoc;
  transform: [number, number, number];
  onDone: () => void;
  /** Fired the moment each shape's outline starts drawing (phase 1) — lets a
   *  caller narrate the same thing the canvas is visibly doing right now,
   *  in the same order and on the same clock as the sketch itself, rather
   *  than a separate approximation of it. */
  onNodeStart?: (node: DiagramNode, index: number, total: number) => void;
}

const FADE_MS = 320;
const FILL_MS = 380;

/** Fallback for the kinds that render via plain CSS rather than an inline
 *  colour — resolveNodeColor() returns undefined for exactly those (the
 *  amber decision, the green database, …), since there's no single colour
 *  value to hand back for "whatever .node--kind-decision's stylesheet rule
 *  says". The sketch still needs *some* concrete colour to animate a fill
 *  with, so this is that stylesheet's colour, restated as a value. */
const KIND_FILL: Partial<Record<NodeKind, string>> = {
  decision: "var(--amber)",
  database: "#3f7a63",
  data: "#3f7a63",
  service: "#3d6c8c",
  system: "#3d6c8c",
};
const DEFAULT_FILL = "var(--green)";

/** What colour a node's phase-3 fill should actually animate to — the same
 *  resolution nodes.tsx uses for the real, live canvas (an explicit
 *  style.color, or the diagram-type accent for the kinds that adopt one),
 *  falling back to the plain CSS look's colour only when neither applies.
 *  Getting this wrong is exactly what used to make the reveal look broken:
 *  the sketch would fill a node one colour, and the instant it handed off
 *  to the real canvas, that node would visibly snap to a *different* colour
 *  — the node's actual one, which the sketch had never known about. */
function fillColorFor(node: DiagramNode, diagramType: string): string {
  const color = typeof node.style?.color === "string" ? node.style.color : null;
  const resolved = resolveNodeColor(node.kind, color, !!node.image_url, diagramType);
  return resolved?.bg ?? KIND_FILL[node.kind] ?? DEFAULT_FILL;
}

/** @returns the outline element, in coordinates centred on the node itself. */
function outline(kind: NodeKind, w: number, h: number): ReactNode {
  switch (kind) {
    case "start":
    case "end":
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} pathLength={1} />;
    case "decision":
      return (
        <polygon
          points={`0,${-h / 2 - 6} ${w / 2 + 6},0 0,${h / 2 + 6} ${-w / 2 - 6},0`}
          pathLength={1}
        />
      );
    case "document":
      return (
        <path
          d={`M ${-w / 2},${-h / 2} H ${w / 2 - 12} L ${w / 2},${-h / 2 + 12} V ${h / 2} H ${-w / 2} Z`}
          pathLength={1}
        />
      );
    case "data":
    case "queue":
      return (
        <polygon
          points={`${-w / 2 + 14},${-h / 2} ${w / 2},${-h / 2} ${w / 2 - 14},${h / 2} ${-w / 2},${h / 2}`}
          pathLength={1}
        />
      );
    case "database":
      return (
        <path
          d={`M ${-w / 2},${-h / 2} A ${w / 2} ${h * 0.22} 0 0 1 ${w / 2},${-h / 2} V ${h / 2} A ${w / 2} ${h * 0.22} 0 0 1 ${-w / 2},${h / 2} Z`}
          pathLength={1}
        />
      );
    case "actor":
      return (
        <g>
          <circle cx={0} cy={-h * 0.2} r={Math.min(w / 4, h * 0.3)} pathLength={1} />
          <path
            d={`M ${-w / 2 + 4},${h / 2} A ${w / 2 - 6} ${h * 0.55} 0 0 1 ${w / 2 - 4},${h / 2}`}
            pathLength={1}
          />
        </g>
      );
    case "cloud":
      return <ellipse cx={0} cy={0} rx={w / 2} ry={h * 0.62} pathLength={1} />;
    case "note":
      return (
        <path d={`M ${-w / 2},${-h / 2} H 0 L ${w / 2},0 V ${h / 2} H ${-w / 2} Z`} pathLength={1} />
      );
    default:
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={9} pathLength={1} />;
  }
}

interface Item {
  key: string;
  x: number;
  y: number;
  delay: number;
  ms: number;
  el: ReactNode;
  /** Only set on the phase-3 fill pass. */
  fill?: string;
}

/** One place the pencil cursor visits — where, when, and what colour it's
 *  "holding" there. Phases 1-2 hold the sketch's own outline colour;
 *  phase 3 holds each node's actual fill, the same colour fillColorFor()
 *  hands the shape itself — the pencil visibly picks up that colour before
 *  the shape does, rather than the fill just appearing on its own. */
interface PencilStop {
  x: number;
  y: number;
  delay: number;
  color: string;
}

/** An overlay that "writes" the freshly generated diagram in three beats:
 *  every shape's outline first, then the connectors linking them, then a
 *  final pass where each shape gets its colour filled in. */
export function RehearsalOverlay({ doc, transform, onDone, onNodeStart }: RehearsalOverlayProps) {
  const [tx, ty, zoom] = transform;

  // Large diagrams draw faster so the whole rehearsal stays brisk.
  const count = doc.nodes.length;
  const perNode = count > 35 ? 130 : count > 14 ? 190 : 260;
  const perEdge = Math.max(110, perNode - 70);
  const fillStagger = Math.max(90, perNode * 0.45);

  // Phase 1: outlines. Phase 2: connectors. Phase 3: colour sweep.
  const outlinesEnd = count * perNode;
  const edgesEnd = outlinesEnd + doc.edges.length * perEdge;
  const fillStart = edgesEnd + 140; // a beat of "sketch is done" before colour starts
  const total = fillStart + (count > 0 ? (count - 1) * fillStagger + FILL_MS : 0);

  const { drawn, pencilStops } = useMemo(() => {
    const nodeX = new Map(doc.nodes.map((n) => [n.id, n]));
    const item: Item[] = [];
    const stops: PencilStop[] = [];

    // Phase 1 — every shape's outline, one at a time.
    doc.nodes.forEach((node, index) => {
      const cx = node.position.x + node.size.width / 2;
      const cy = node.position.y + node.size.height / 2;
      item.push({
        key: `outline_${node.id}`,
        x: cx,
        y: cy,
        delay: index * perNode,
        ms: perNode,
        el: outline(node.kind, node.size.width, node.size.height),
      });
      stops.push({ x: cx, y: cy, delay: index * perNode, color: "var(--green)" });
    });

    // Phase 2 — connectors, one at a time, only once every shape exists.
    doc.edges.forEach((edge, index) => {
      const s = nodeX.get(edge.source);
      const t = nodeX.get(edge.target);
      if (!s || !t) return;
      const sCy = s.position.y + s.size.height / 2;
      const tCy = t.position.y + t.size.height / 2;
      const dir = t.position.x + t.size.width / 2 >= s.position.x + s.size.width / 2 ? 1 : -1;
      // Every outline() shape is horizontally symmetric and reaches its full
      // half-width exactly at its own vertical centre, so leaving from the
      // node's left/right edge (instead of its centre) lands the line right
      // on the silhouette for every shape, not just rectangles — the sketch
      // line never has to cross the shape's translucent fill to get there.
      const sx = dir === 1 ? s.position.x + s.size.width : s.position.x;
      const sy = sCy;
      const txp = dir === 1 ? t.position.x : t.position.x + t.size.width;
      const typ = tCy;
      const mx = (sx + txp) / 2;

      const delay = outlinesEnd + index * perEdge;
      item.push({
        key: `line_${edge.id}`,
        x: 0,
        y: 0,
        delay,
        ms: perEdge,
        el: <path d={`M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${typ} L ${txp} ${typ}`} pathLength={1} />,
      });
      stops.push({ x: mx, y: (sy + typ) / 2, delay, color: "var(--green)" });
      item.push({
        key: `arrow_${edge.id}`,
        x: 0,
        y: 0,
        delay: delay + perEdge * 0.7,
        ms: Math.max(60, perEdge * 0.3),
        el: (
          <polygon
            points={`${txp},${typ} ${txp - 7 * dir},${typ - 4} ${txp - 7 * dir},${typ + 4}`}
            pathLength={1}
            fill="currentColor"
          />
        ),
      });
    });

    // Phase 3 — the pencil goes back over the finished sketch, one shape at a
    // time, filling each in with the colour it'll actually render in.
    doc.nodes.forEach((node, index) => {
      const cx = node.position.x + node.size.width / 2;
      const cy = node.position.y + node.size.height / 2;
      const delay = fillStart + index * fillStagger;
      const color = fillColorFor(node, doc.diagram_type);
      item.push({
        key: `fill_${node.id}`,
        x: cx,
        y: cy,
        delay,
        ms: FILL_MS,
        el: outline(node.kind, node.size.width, node.size.height),
        fill: color,
      });
      stops.push({ x: cx, y: cy, delay, color });
    });

    return { drawn: item, pencilStops: stops };
  }, [doc, outlinesEnd, fillStart, perNode, perEdge, fillStagger]);

  useEffect(() => {
    const id = window.setTimeout(onDone, total + FADE_MS + 80);
    return () => window.clearTimeout(id);
  }, [onDone, total]);

  // Same clock as phase 1's own outline strokes above (`index * perNode`) —
  // whoever's listening finds out a shape is being drawn at the exact
  // moment its stroke actually starts, not on some approximation of it.
  useEffect(() => {
    if (!onNodeStart) return;
    const ids = doc.nodes.map((node, index) =>
      window.setTimeout(() => onNodeStart(node, index, count), index * perNode),
    );
    return () => ids.forEach(window.clearTimeout);
  }, [doc.nodes, onNodeStart, perNode, count]);

  // A visible cursor "doing the drawing" — glides to wherever the sketch is
  // currently working (an outline, a connector, then each shape's colour
  // fill), on the exact same schedule those strokes themselves already run
  // on. Null hides it entirely, before the first stroke and after the last.
  const [pencilPos, setPencilPos] = useState<PencilStop | null>(null);
  useEffect(() => {
    const ids = pencilStops.map((stop) => window.setTimeout(() => setPencilPos(stop), stop.delay));
    const hideId = window.setTimeout(() => setPencilPos(null), total);
    return () => {
      ids.forEach(window.clearTimeout);
      window.clearTimeout(hideId);
    };
  }, [pencilStops, total]);

  return (
    <div className="rehearse" aria-hidden>
      <svg>
        <g transform={`translate(${tx} ${ty}) scale(${zoom})`}>
          {drawn.map((item) => (
            <g key={item.key} transform={`translate(${item.x} ${item.y})`}>
              <StrokeShape item={item} />
            </g>
          ))}
          {pencilPos && <PencilCursor pos={pencilPos} />}
        </g>
      </svg>
    </div>
  );
}

/** The cursor itself: a small tilted pencil, its tip carrying whatever
 *  colour the current stop says it's "holding" — the sketch's own outline
 *  colour while tracing, a node's real fill colour once phase 3 reaches it.
 *  Glides between stops via a plain CSS transition on transform rather than
 *  generated keyframes, since the stops themselves are arbitrary diagram
 *  positions, not a fixed path.
 *
 *  Every fill/stroke below is set via `style`, not the plain SVG attribute —
 *  the shared `.rehearse rect/path/circle {...}` rule elsewhere in this file
 *  hard-codes stroke/fill for every shape the sketch draws, and a CSS rule
 *  always beats a bare presentation attribute; only an inline style wins
 *  over it (see StrokeShape's own note on the same thing, below). */
function PencilCursor({ pos }: { pos: PencilStop }) {
  return (
    <g
      className="rehearse-pencil"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, transition: "transform 220ms ease-out" }}
    >
      <g transform="rotate(-42) translate(-3, -30)">
        <rect
          x={-4}
          y={0}
          width={8}
          height={22}
          rx={2}
          style={{ fill: "#f0b93d", stroke: "var(--ink)", strokeWidth: 1.1 }}
        />
        <path
          d="M -4 22 L 0 31 L 4 22 Z"
          style={{ fill: "#caa06a", stroke: "var(--ink)", strokeWidth: 1 }}
        />
        <circle
          cx={0}
          cy={30.5}
          r={2.2}
          style={{ fill: pos.color, stroke: "var(--ink)", strokeWidth: 0.6 }}
        />
      </g>
    </g>
  );
}

/** Renders one item's element with the right animation for its phase — a
 *  pencil-drawn outline stroke, or (phase 3) a colour fading in.
 *
 *  This goes directly on the shape via cloneElement, not a wrapping <g>:
 *  app.css hard-codes `fill`/`stroke` for polygon and circle specifically (so
 *  the arrowhead reads as a solid triangle rather than an outline), and an
 *  *inherited* value from a parent's style never wins against those — only a
 *  value specified directly on the element does.
 */
function StrokeShape({ item }: { item: Item }) {
  const style: CSSProperties = item.fill
    ? {
        fill: item.fill,
        fillOpacity: 0,
        stroke: "none",
        animation: `rehearse-fill ${item.ms}ms ease-out forwards`,
        animationDelay: `${item.delay}ms`,
      }
    : {
        // Explicit, not left to the shared .rehearse rule: app.css overrides
        // fill for polygon and circle specifically (so the edge arrowhead
        // reads solid), which otherwise wins over an outline that hasn't set
        // its own fill — a decision diamond would show solid green from the
        // moment it appears, well before phase 3 ever starts.
        fill: "none",
        strokeDasharray: 1,
        strokeDashoffset: 1,
        stroke: "var(--green)",
        animation: `rehearse-stroke ${item.ms}ms linear forwards, rehearse-pop ${item.ms}ms linear forwards`,
        animationDelay: `${item.delay}ms, ${item.delay}ms`,
      };

  return cloneElement(item.el as ReactElement, { style });
}
