import { memo } from "react";

import {
  BaseEdge,
  Position,
  useStore,
  type EdgeProps,
} from "@xyflow/react";

/** How far a routed line stays clear of a shape's box, in px. Lines grazing
 *  the border still read as "touching", same idea as the backend's
 *  CORRIDOR_PAD. */
const CLEARANCE = 9;
/** How far a run sits off a port before turning / clearing an obstacle. */
const STANDOFF = 18;
/** Corner rounding for bends, matching React Flow's smoothstep (radius 5). */
const CORNER = 5;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const OUTWARD: Record<Position, readonly [number, number]> = {
  [Position.Left]: [-1, 0],
  [Position.Right]: [1, 0],
  [Position.Top]: [0, -1],
  [Position.Bottom]: [0, 1],
};

function cornerCommand(
  prev: readonly [number, number],
  cur: readonly [number, number],
  next: readonly [number, number],
  radius: number,
): string {
  const dA = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
  const dB = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
  const r = Math.min(dA / 2, dB / 2, Math.max(0, radius));
  const [px, py] = prev;
  const [x, y] = cur;
  const [nx, ny] = next;
  const straight =
    (px === x && x === nx) || (py === y && y === ny) || r === 0;
  if (straight) return `L ${x} ${y}`;
  if (py === y) {
    const qx = px < nx ? x + r : x - r;
    const qy = py < ny ? y + r : y - r;
    return `L ${qx} ${y} Q ${x} ${y} ${x} ${qy}`;
  }
  const qy = py < ny ? y + r : y - r;
  const qx = px < nx ? x + r : x - r;
  return `L ${x} ${qy} Q ${x} ${y} ${qx} ${y}`;
}

function segmentsClear(
  points: readonly (readonly [number, number])[],
  boxes: readonly Box[],
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const loX = Math.min(ax, bx);
    const hiX = Math.max(ax, bx);
    const loY = Math.min(ay, by);
    const hiY = Math.max(ay, by);
    for (const box of boxes) {
      if (loX <= box.x + box.width && hiX >= box.x && loY <= box.y + box.height && hiY >= box.y) {
        return false;
      }
    }
  }
  return true;
}

function dedup(points: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) {
      const prev = out[out.length - 1];
      if (prev) {
        const before = out[out.length - 2];
        if (
          before &&
          ((before[0] === prev[0] && prev[0] === p[0]) ||
            (before[1] === prev[1] && prev[1] === p[1]))
        ) {
          out.pop();
        }
      }
      out.push([p[0], p[1]]);
    }
  }
  return out;
}

function padded(boxes: readonly Box[], pad: number): Box[] {
  return boxes.map((b) => ({
    x: b.x - pad,
    y: b.y - pad,
    width: b.width + pad * 2,
    height: b.height + pad * 2,
  }));
}

/** Candidate run positions on the axis perpendicular to the main travel,
 *  looking for a y/x the connector can ride that no shape box intrudes on
 *  across the whole corridor. */
function runCandidates(
  blocked: readonly [number, number][],
  preferred: number,
): number[] {
  if (blocked.length === 0) return [preferred];

  const free = (v: number) =>
    !blocked.some(([d, e]) => v >= d && v <= e) &&
    v >= -1e9 &&
    v <= 1e9;

  const candidates: number[] = [];
  const sorted = [...blocked].sort((a, b) => a[0] - b[0]);
  if (free(preferred)) candidates.push(preferred);
  if (free(sorted[0][0] - STANDOFF)) candidates.push(sorted[0][0] - STANDOFF);
  const last = sorted[sorted.length - 1];
  if (free(last[1] + STANDOFF)) candidates.push(last[1] + STANDOFF);
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i][1];
    const start = sorted[i + 1][0];
    if (start - gap >= STANDOFF * 2) {
      const mid = (gap + start) / 2;
      if (free(mid)) candidates.push(mid);
    }
  }
  return candidates.length > 0
    ? candidates.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))
    : [preferred];
}

function routePoints(
  srcX: number,
  srcY: number,
  srcSide: Position,
  tgtX: number,
  tgtY: number,
  tgtSide: Position,
  obstacles: readonly Box[],
): [number, number][] {
  const [sx, sy] = OUTWARD[srcSide];
  const [tx, ty] = OUTWARD[tgtSide];
  const exit: [number, number] = [srcX + sx * STANDOFF, srcY + sy * STANDOFF];
  // Same idea as `exit`, mirrored: step *outward* from the target's port
  // too, so the run approaches from outside the box and turns in cleanly.
  // Subtracting here (the target's outward vector points the other way already)
  // lands the standoff point *inside* the box instead — the last segment then
  // ran from inside back out through the border, which is why the arrowhead
  // (auto-oriented on the path's final tangent) showed up backwards, jammed
  // into the node's edge instead of approaching it from outside.
  const enter: [number, number] = [tgtX + tx * STANDOFF, tgtY + ty * STANDOFF];

  const horizontal = srcSide === Position.Right || srcSide === Position.Left ||
    tgtSide === Position.Right || tgtSide === Position.Left;

  if (horizontal) {
    // Travel along x; the connector snaps to a clear y across the corridor.
    const corridor: [number, number] = [exit[0], enter[0]];
    const scan = obstacles.filter((b) => {
      const lo = Math.min(corridor[0], corridor[1]) - CLEARANCE * 2;
      const hi = Math.max(corridor[0], corridor[1]) + CLEARANCE * 2;
      return b.x < hi && b.x + b.width > lo;
    });
    const runY = runCandidates(
      scan.map((b) => [b.y, b.y + b.height]),
      srcY,
    );
    for (const y of runY) {
      const pts = dedup([
        [srcX, srcY],
        exit,
        [exit[0], y],
        [enter[0], y],
        enter,
        [tgtX, tgtY],
      ]);
      if (segmentsClear(pts, obstacles)) return pts;
    }
    return dedup([[srcX, srcY], exit, [exit[0], srcY], [enter[0], srcY], enter, [tgtX, tgtY]]);
  }

  // Vertical travel (top/bottom ports): the connector picks a clear x.
  const corridor: [number, number] = [exit[1], enter[1]];
  const scan = obstacles.filter((b) => {
    const lo = Math.min(corridor[0], corridor[1]) - CLEARANCE * 2;
    const hi = Math.max(corridor[0], corridor[1]) + CLEARANCE * 2;
    return b.y < hi && b.y + b.height > lo;
  });
const runX = runCandidates(
      scan.map((b) => [b.x, b.x + b.width]),
      srcX,
    );
  for (const x of runX) {
    const pts = dedup([
      [srcX, srcY],
      exit,
      [x, exit[1]],
      [x, enter[1]],
      enter,
      [tgtX, tgtY],
    ]);
    if (segmentsClear(pts, obstacles)) return pts;
  }
  return dedup([[srcX, srcY], exit, [srcX, exit[1]], [srcX, enter[1]], enter, [tgtX, tgtY]]);
}

/** Custom renderer for smoothstep edges: instead of trusting the default
 *  corridor (a straight run at the source's mid-height, which slices straight
 *  through any shape sitting between the two endpoints), the line picks a run
 *  that clears every other node's box — spaced off shapes with CLEARANCE — and
 *  only falls back to the plain route if no clean one exists. */
export const FlowEdge = memo(function FlowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  markerStart,
  markerEnd,
  style,
  interactionWidth,
}: EdgeProps) {
  const all = useStore((state) => {
    const boxes: { box: Box; id: string; type: string | undefined }[] = [];
    for (const [nodeId, node] of state.nodeLookup) {
      const dataSize = (node.data as { width?: number; height?: number } | undefined) ?? {};
      const width = node.measured?.width ?? dataSize.width;
      const height = node.measured?.height ?? dataSize.height;
      if (!width || !height || !isFinite(width) || !isFinite(height)) continue;
      boxes.push({
        id: nodeId,
        type: node.type,
        box: {
          x: node.internals.positionAbsolute.x,
          y: node.internals.positionAbsolute.y,
          width,
          height,
        },
      });
    }
    return boxes;
  });

  const obstacles = all
    .filter((n) => n.id !== source && n.id !== target && n.type !== "group")
    .map((n) => n.box);

  const points = routePoints(
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    padded(obstacles, CLEARANCE),
  );

  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    d += " " + cornerCommand(points[i - 1], points[i], points[i + 1], CORNER);
  }
  d += ` L ${points[points.length - 1][0]} ${points[points.length - 1][1]}`;

  const [labelX, labelY] = points[Math.floor(points.length / 2)];

  return (
    <BaseEdge
      id={id}
      path={d}
      labelX={labelX}
      labelY={labelY}
      label={label}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={style}
      interactionWidth={interactionWidth}
    />
  );
});