/** Pure geometry for a `wedge` node's donut-segment shape.
 *
 *  Mirrors the backend's convention exactly (see `_place_radial` in
 *  backend/app/layout/engine.py): angles in degrees, `x = cx + cos(a) * r`,
 *  `y = cy + sin(a) * r` — plain trig, no axis flip. Since screen y already
 *  points down, increasing angle sweeps clockwise, which is what the SVG
 *  arc commands below assume (sweep-flag 1 = clockwise). All coordinates
 *  here are node-local: `cx`/`cy` are the wheel's centre as stored in the
 *  node's own `style.centerX`/`style.centerY`, not the document's absolute
 *  space. */

export interface WedgeGeometry {
  centerX: number;
  centerY: number;
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  labelRadius: number;
  labelSide: "left" | "right";
}

export function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}

/** The `d` attribute for one donut segment — a closed path from the inner
 *  arc, out to the outer arc, around, and back. */
export function wedgePathD(geo: WedgeGeometry): string {
  const { centerX: cx, centerY: cy, startAngle, endAngle, innerRadius: ir, outerRadius: or_ } = geo;
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const oStart = polarPoint(cx, cy, or_, startAngle);
  const oEnd = polarPoint(cx, cy, or_, endAngle);
  const iStart = polarPoint(cx, cy, ir, startAngle);
  const iEnd = polarPoint(cx, cy, ir, endAngle);
  return [
    `M ${iStart.x} ${iStart.y}`,
    `L ${oStart.x} ${oStart.y}`,
    `A ${or_} ${or_} 0 ${large} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${ir} ${ir} 0 ${large} 0 ${iStart.x} ${iStart.y}`,
    "Z",
  ].join(" ");
}

/** Where the icon badge sits — the midpoint of the ring band, at the
 *  slice's centre angle. */
export function wedgeIconAnchor(geo: WedgeGeometry) {
  const mid = (geo.startAngle + geo.endAngle) / 2;
  const r = (geo.innerRadius + geo.outerRadius) / 2;
  return polarPoint(geo.centerX, geo.centerY, r, mid);
}

/** The leader line from the arc's outer edge out to where the label starts,
 *  and the label's own anchor point (one end of that line). */
export function wedgeLeader(geo: WedgeGeometry) {
  const mid = (geo.startAngle + geo.endAngle) / 2;
  const from = polarPoint(geo.centerX, geo.centerY, geo.outerRadius, mid);
  const to = polarPoint(geo.centerX, geo.centerY, geo.labelRadius, mid);
  return { from, to };
}
