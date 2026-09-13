import {
  cloneElement,
  useEffect,
  useMemo,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

import type { DiagramDoc, NodeKind } from "../api/types";

export interface RehearsalOverlayProps {
  doc: DiagramDoc;
  transform: [number, number, number];
  onDone: () => void;
}

const FADE_MS = 320;

/** @returns the outline element (in centred, local node coordinates). */
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
          <path d={`M ${-w / 2 + 4},${h / 2} A ${w / 2 - 6} ${h * 0.55} 0 0 1 ${w / 2 - 4},${h / 2}`} pathLength={1} />
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

/** An overlay that "writes" the freshly generated diagram in pen strokes. */
export function RehearsalOverlay({ doc, transform, onDone }: RehearsalOverlayProps) {
  const [tx, ty, zoom] = transform;

  // Large diagrams draw faster so the whole rehearsal stays brisk.
  const count = doc.nodes.length;
  const perNode = count > 35 ? 80 : count > 14 ? 120 : 165;
  const perEdge = Math.max(70, perNode - 50);
  const nodeBase = count * perNode;
  const total = nodeBase + doc.edges.length * perEdge;

  const drawn = useMemo(() => {
    const nodeX = new Map(doc.nodes.map((n) => [n.id, n]));
    const item: { delay: number; ms: number; el: ReactNode; key: string }[] = [];

    doc.nodes.forEach((node, index) => {
      item.push({
        key: node.id,
        delay: index * perNode,
        ms: perNode,
        el: outline(node.kind, node.size.width, node.size.height),
      });
    });

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

      const delay = nodeBase + index * perEdge;
      item.push({
        key: `line_${edge.id}`,
        delay,
        ms: perEdge,
        el: (
          <path
            d={`M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${typ} L ${txp} ${typ}`}
            pathLength={1}
          />
        ),
      });
      item.push({
        key: `arrow_${edge.id}`,
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
    return item;
  }, [doc, nodeBase, perNode, perEdge]);

  useEffect(() => {
    const id = window.setTimeout(onDone, total + FADE_MS + 80);
    return () => window.clearTimeout(id);
  }, [onDone, total]);

  return (
    <div className="rehearse" aria-hidden>
      <svg>
        <g transform={`translate(${tx} ${ty}) scale(${zoom})`}>
          {drawn.map((item) =>
            cloneElement(item.el as ReactElement, {
              style: drawStyle(item.delay, item.ms),
            }),
          )}
        </g>
      </svg>
    </div>
  );
}

function drawStyle(delay: number, ms: number): CSSProperties {
  return {
    strokeDasharray: 1,
    strokeDashoffset: 1,
    animation: `rehearse-stroke ${ms}ms linear forwards, rehearse-pop ${ms}ms linear forwards`,
    animationDelay: `${delay}ms, ${delay}ms`,
  };
}