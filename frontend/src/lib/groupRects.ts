import type { DiagramDoc, Group, Rect } from "../api/types";

/** Only used when a document has never been through the backend layout — it
 *  publishes the real values in `doc.meta`, which is what keeps this file from
 *  drifting away from `engine.py`'s GROUP_PAD / GROUP_HEADER. */
const FALLBACK_PAD = 26;
const FALLBACK_HEADER = 30;

/** The container tree with self-parents, unknown parents and cycles broken.
 *  Mirrors `_group_parents` in the layout engine: a cycle here would hang the
 *  browser, and this runs on every commit. */
function parentMap(groups: Group[]): Map<string, string | null> {
  const known = new Set(groups.map((g) => g.id));
  const parent = new Map<string, string | null>(
    groups.map((g) => [
      g.id,
      g.parent && g.parent !== g.id && known.has(g.parent) ? g.parent : null,
    ]),
  );
  for (const id of [...parent.keys()]) {
    const seen = new Set([id]);
    let cursor = parent.get(id) ?? null;
    while (cursor) {
      if (seen.has(cursor)) {
        parent.set(id, null);
        break;
      }
      seen.add(cursor);
      cursor = parent.get(cursor) ?? null;
    }
  }
  return parent;
}

/** Recompute every container's rectangle from what it currently holds.
 *
 *  The backend owns this geometry, but a drag has to redraw the box in the
 *  same frame the nodes move, which a round trip can't do. The next layout
 *  pass replaces whatever this produces. */
export function computeGroupRects(doc: DiagramDoc): Group[] {
  const groups = doc.groups ?? [];
  if (!groups.length) return groups;

  const pad = Number(doc.meta?.group_pad ?? FALLBACK_PAD);
  const header = Number(doc.meta?.group_header ?? FALLBACK_HEADER);
  const parent = parentMap(groups);

  const depth = new Map<string, number>();
  for (const id of parent.keys()) {
    let d = 0;
    let cursor = parent.get(id) ?? null;
    while (cursor) {
      d += 1;
      cursor = parent.get(cursor) ?? null;
    }
    depth.set(id, d);
  }

  const rects = new Map<string, Rect | null>();
  // Deepest first, so a parent sees its children already sized.
  const order = [...parent.keys()].sort(
    (a, b) => (depth.get(b) ?? 0) - (depth.get(a) ?? 0),
  );

  for (const id of order) {
    const boxes: Rect[] = [];
    for (const node of doc.nodes) {
      if (node.group === id) {
        boxes.push({
          x: node.position.x,
          y: node.position.y,
          width: node.size.width,
          height: node.size.height,
        });
      }
    }
    for (const [child, p] of parent) {
      const r = p === id ? rects.get(child) : null;
      if (r) boxes.push(r);
    }
    if (!boxes.length) {
      // An empty container has no natural size; drawing one leaves a stray box.
      rects.set(id, null);
      continue;
    }
    const x1 = Math.min(...boxes.map((b) => b.x)) - pad;
    const y1 = Math.min(...boxes.map((b) => b.y)) - pad - header;
    const x2 = Math.max(...boxes.map((b) => b.x + b.width)) + pad;
    const y2 = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
    rects.set(id, { x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
  }

  return groups.map((g) => ({ ...g, rect: rects.get(g.id) ?? null }));
}

/** How deeply a container is nested — 0 for an outermost one. */
export function groupDepth(groups: Group[], id: string): number {
  const parent = parentMap(groups);
  let depth = 0;
  let cursor = parent.get(id) ?? null;
  while (cursor) {
    depth += 1;
    cursor = parent.get(cursor) ?? null;
  }
  return depth;
}

/** Is `candidate` nested anywhere inside `ancestor`? */
export function isInside(
  doc: DiagramDoc,
  candidate: string,
  ancestor: string,
): boolean {
  const parent = parentMap(doc.groups ?? []);
  let cursor = parent.get(candidate) ?? null;
  while (cursor) {
    if (cursor === ancestor) return true;
    cursor = parent.get(cursor) ?? null;
  }
  return false;
}

/** Ids of every node inside `groupId`, including those in containers nested
 *  within it — what has to move when the container itself is dragged. */
export function membersOf(doc: DiagramDoc, groupId: string): Set<string> {
  const groups = doc.groups ?? [];
  const parent = parentMap(groups);
  const family = new Set([groupId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const g of groups) {
      const p = parent.get(g.id) ?? null;
      if (p && family.has(p) && !family.has(g.id)) {
        family.add(g.id);
        grew = true;
      }
    }
  }
  return new Set(
    doc.nodes.filter((n) => n.group && family.has(n.group)).map((n) => n.id),
  );
}
