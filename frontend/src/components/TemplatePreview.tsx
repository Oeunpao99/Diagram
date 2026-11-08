import { useMemo } from "react";

import type { DiagramDoc, NodeKind } from "../api/types";

/** A thumbnail of a template's actual structure — its own nodes and links,
 *  in its own shapes — rather than one generic glyph per diagram type.
 *
 *  Templates are stored without coordinates (layout runs when one is used),
 *  so this does a pocket-sized layered layout of its own: longest-path
 *  layers along the template's direction, siblings spread across, and a ring
 *  for templates with no links (mind-map spokes, circle diagrams). Nodes pop
 *  in and links draw themselves on mount; links flow while the card is
 *  hovered. All of it is CSS (`.tpl-node` / `.tpl-edge`), so reduced-motion
 *  users get the still picture. */

const W = 160;
const H = 100;
const PAD = 12;
const MAX_NODES = 36;

type Point = { x: number; y: number };

function layout(doc: DiagramDoc) {
  const nodes = doc.nodes.slice(0, MAX_NODES);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = doc.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target,
  );
  const pos = new Map<string, Point>();

  if (edges.length === 0) {
    nodes.forEach((node, i) => {
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
      pos.set(node.id, {
        x: W / 2 + Math.cos(angle) * (W / 2 - PAD - 14),
        y: H / 2 + Math.sin(angle) * (H / 2 - PAD - 4),
      });
    });
    return { nodes, edges, back: new Set<string>(), pos, nodeW: 18, nodeH: 8 };
  }

  // Drop the edges that close a loop, so layering terminates.
  const out = new Map<string, string[]>();
  for (const e of edges) out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
  const state = new Map<string, number>();
  const back = new Set<string>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const next of out.get(id) ?? []) {
      const s = state.get(next);
      if (s === 1) back.add(`${id}>${next}`);
      else if (!s) visit(next);
    }
    state.set(id, 2);
  };
  nodes.forEach((n) => state.get(n.id) || visit(n.id));

  const depth = new Map(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of edges) {
      if (back.has(`${e.source}>${e.target}`)) continue;
      const d = depth.get(e.source)! + 1;
      if (d > depth.get(e.target)!) {
        depth.set(e.target, d);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const layers: string[][] = [];
  for (const n of nodes) (layers[depth.get(n.id)!] ??= []).push(n.id);
  const filled = layers.filter(Boolean);

  const vertical = doc.direction === "TB" || doc.direction === "BT";
  const alongSpan = vertical ? H : W;
  const acrossSpan = vertical ? W : H;
  const widest = Math.max(...filled.map((l) => l.length));
  const step = (alongSpan - PAD * 2) / Math.max(1, filled.length);
  const nodeAlong = Math.max(6, Math.min(26, step * 0.6));
  const nodeAcross = Math.max(4, Math.min(11, ((acrossSpan - PAD * 2) / widest) * 0.55));

  filled.forEach((layer, d) => {
    layer.forEach((id, i) => {
      const along =
        filled.length === 1
          ? alongSpan / 2
          : PAD + nodeAlong / 2 + (d / (filled.length - 1)) * (alongSpan - PAD * 2 - nodeAlong);
      const across = PAD + ((i + 1) / (layer.length + 1)) * (acrossSpan - PAD * 2);
      pos.set(id, vertical ? { x: across, y: along } : { x: along, y: across });
    });
  });

  return {
    nodes,
    edges,
    back,
    pos,
    nodeW: vertical ? Math.max(8, nodeAcross * 2.2) : nodeAlong,
    nodeH: vertical ? Math.max(4, nodeAlong * 0.42) : nodeAcross,
  };
}

function Shape({
  kind,
  x,
  y,
  w,
  h,
}: {
  kind: NodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  if (kind === "decision") {
    const s = h * 0.85;
    return <polygon points={`${x},${y - s} ${x + s * 1.3},${y} ${x},${y + s} ${x - s * 1.3},${y}`} />;
  }
  if (["circle", "hub", "actor", "star", "octagon", "hexagon", "pentagon"].includes(kind)) {
    return <circle cx={x} cy={y} r={h * 0.62} />;
  }
  const rx = kind === "start" || kind === "end" ? h / 2 : kind === "database" ? 3 : 1.6;
  return <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={rx} />;
}

export function TemplatePreview({ doc }: { doc: DiagramDoc }) {
  const { nodes, edges, back, pos, nodeW, nodeH } = useMemo(() => layout(doc), [doc]);
  const vertical = doc.direction === "TB" || doc.direction === "BT";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-hidden="true">
      <g fill="none" stroke="var(--tint-ink)" strokeWidth={0.9} strokeLinecap="round">
        {edges.map((e, i) => {
          const a = pos.get(e.source)!;
          const b = pos.get(e.target)!;
          const looping = back.has(`${e.source}>${e.target}`);
          let d: string;
          if (looping) {
            // Loops bow out to the side so they read as "goes back".
            const bow = vertical ? Math.max(a.x, b.x) + 18 : Math.max(a.y, b.y) + 16;
            d = vertical
              ? `M ${a.x} ${a.y} C ${bow} ${a.y}, ${bow} ${b.y}, ${b.x} ${b.y}`
              : `M ${a.x} ${a.y} C ${a.x} ${bow}, ${b.x} ${bow}, ${b.x} ${b.y}`;
          } else if (vertical) {
            const mid = (a.y + b.y) / 2;
            d = `M ${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`;
          } else {
            const mid = (a.x + b.x) / 2;
            d = `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`;
          }
          return (
            <path
              key={e.id}
              d={d}
              pathLength={1}
              className="tpl-edge"
              opacity={looping ? 0.35 : 0.55}
              style={{ "--i": i } as React.CSSProperties}
            />
          );
        })}
      </g>
      <g
        fill="var(--tint-ink)"
        stroke="var(--tint-ink)"
        strokeWidth={0.9}
      >
        {nodes.map((node, i) => {
          const p = pos.get(node.id)!;
          return (
            <g key={node.id} className="tpl-node" style={{ "--i": i } as React.CSSProperties}>
              <Shape kind={node.kind} x={p.x} y={p.y} w={nodeW} h={nodeH} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
