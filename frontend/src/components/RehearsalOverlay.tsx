import { cloneElement, useEffect, useMemo, type CSSProperties, type ReactElement, type ReactNode } from "react";

import type { DiagramDoc, NodeKind } from "../api/types";

export interface RehearsalOverlayProps {
  doc: DiagramDoc;
  transform: [number, number, number];
  onDone: () => void;
}

const FADE_MS = 320;
const FILL_MS = 240;

/** Rough match for each shape's real, final look — see nodes.tsx / app.css
 *  kind accents — so the sketch settles into roughly the colour the actual
 *  node will render in, instead of an arbitrary one. */
const KIND_FILL: Partial<Record<NodeKind, string>> = {
  decision: "var(--amber)",
  database: "#3f7a63",
  data: "#3f7a63",
  service: "#3d6c8c",
  system: "#3d6c8c",
};
const DEFAULT_FILL = "var(--green)";

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

/** An overlay that "writes" the freshly generated diagram in three beats:
 *  every shape's outline first, then the connectors linking them, then a
 *  final pass where each shape gets its colour filled in. */
export function RehearsalOverlay({ doc, transform, onDone }: RehearsalOverlayProps) {
  const [tx, ty, zoom] = transform;

  // Large diagrams draw faster so the whole rehearsal stays brisk.
  const count = doc.nodes.length;
  const perNode = count > 35 ? 80 : count > 14 ? 120 : 165;
  const perEdge = Math.max(70, perNode - 50);
  const fillStagger = Math.max(55, perNode * 0.45);

  // Phase 1: outlines. Phase 2: connectors. Phase 3: colour sweep.
  const outlinesEnd = count * perNode;
  const edgesEnd = outlinesEnd + doc.edges.length * perEdge;
  const fillStart = edgesEnd + 140; // a beat of "sketch is done" before colour starts
  const total = fillStart + (count > 0 ? (count - 1) * fillStagger + FILL_MS : 0);

  const drawn = useMemo(() => {
    const nodeX = new Map(doc.nodes.map((n) => [n.id, n]));
    const item: Item[] = [];

    // Phase 1 — every shape's outline, one at a time.
    doc.nodes.forEach((node, index) => {
      item.push({
        key: `outline_${node.id}`,
        x: node.position.x + node.size.width / 2,
        y: node.position.y + node.size.height / 2,
        delay: index * perNode,
        ms: perNode,
        el: outline(node.kind, node.size.width, node.size.height),
      });
    });

    // Phase 2 — connectors, one at a time, only once every shape exists.
    doc.edges.forEach((edge, index) => {
      const s = nodeX.get(edge.source);
      const t = nodeX.get(edge.target);
      if (!s || !t) return;
      const sx = s.position.x + s.size.width / 2;
      const sy = s.position.y + s.size.height / 2;
      const txp = t.position.x + t.size.width / 2;
      const typ = t.position.y + t.size.height / 2;
      const mx = (sx + txp) / 2;
      const dir = txp >= mx ? 1 : -1;

      const delay = outlinesEnd + index * perEdge;
      item.push({
        key: `line_${edge.id}`,
        x: 0,
        y: 0,
        delay,
        ms: perEdge,
        el: <path d={`M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${typ} L ${txp} ${typ}`} pathLength={1} />,
      });
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
    // time, filling each in with roughly the colour it'll actually render in.
    doc.nodes.forEach((node, index) => {
      item.push({
        key: `fill_${node.id}`,
        x: node.position.x + node.size.width / 2,
        y: node.position.y + node.size.height / 2,
        delay: fillStart + index * fillStagger,
        ms: FILL_MS,
        el: outline(node.kind, node.size.width, node.size.height),
        fill: KIND_FILL[node.kind] ?? DEFAULT_FILL,
      });
    });

    return item;
  }, [doc, outlinesEnd, fillStart, perNode, perEdge, fillStagger]);

  useEffect(() => {
    const id = window.setTimeout(onDone, total + FADE_MS + 80);
    return () => window.clearTimeout(id);
  }, [onDone, total]);

  return (
    <div className="rehearse" aria-hidden>
      <svg>
        <g transform={`translate(${tx} ${ty}) scale(${zoom})`}>
          {drawn.map((item) => (
            <g key={item.key} transform={`translate(${item.x} ${item.y})`}>
              <StrokeShape item={item} />
            </g>
          ))}
        </g>
      </svg>
    </div>
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
