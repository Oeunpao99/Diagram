import { normalizeDoc, type DiagramDoc, type Direction, type NodeKind } from "./types";

export class ImportError extends Error {}

/** What a shape delimiter around a Mermaid node label maps to in our own
 *  node vocabulary. Checked longest-delimiter-first (`matchShape` below)
 *  so `((x))` is never mistaken for a bare `(x)`. Mirrors, in reverse,
 *  the KIND_SHAPE table `toMermaid` (exportUtils.ts) writes these from —
 *  including that exporter's own `{{...}}` for a decision (Mermaid's actual
 *  diamond delimiter is the single-brace `{...}`; both are accepted here so
 *  a diagram exported by this app round-trips exactly). */
const SHAPE_DELIMITERS: { open: string; close: string; kind: NodeKind }[] = [
  { open: "((", close: "))", kind: "start" },
  { open: "{{", close: "}}", kind: "decision" },
  { open: "{", close: "}", kind: "decision" },
  { open: "[", close: "]", kind: "process" },
  { open: "(", close: ")", kind: "process" },
];

const ID = "[A-Za-z0-9_-]+";

function unescapeLabel(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    text = text.slice(1, -1);
  }
  return text.replace(/\\"/g, '"');
}

/** Reads a shape delimiter (if any) starting at the front of `text`, e.g.
 *  `{{"Approved?"}} --> B` -> { kind: "decision", label: "Approved?",
 *  rest: " --> B" }. Returns null if `text` doesn't start with a node id or
 *  no delimiter follows it (a bare id with no inline shape). */
function readNode(text: string): { id: string; kind: NodeKind | null; label: string | null; rest: string } | null {
  const idMatch = text.match(new RegExp(`^\\s*(${ID})`));
  if (!idMatch) return null;
  const id = idMatch[1];
  let rest = text.slice(idMatch[0].length);
  for (const { open, close, kind } of SHAPE_DELIMITERS) {
    if (!rest.startsWith(open)) continue;
    const end = rest.indexOf(close, open.length);
    if (end === -1) continue;
    const label = unescapeLabel(rest.slice(open.length, end));
    return { id, kind, label, rest: rest.slice(end + close.length) };
  }
  return { id, kind: null, label: null, rest };
}

const EDGE_ARROW = /^\s*(<?)(--+|-\.+-|==+)(>?)\s*/;

/** A single flowchart line: `A[Label] -->|maybe| B{Label2}`. Standalone node
 *  declarations (`A[Label]` with nothing after) are handled separately. */
function parseEdgeLine(
  line: string,
): { sourceId: string; sourceKind: NodeKind | null; sourceLabel: string | null; targetId: string; targetKind: NodeKind | null; targetLabel: string | null; arrowHead: string; label: string | null } | null {
  const src = readNode(line);
  if (!src) return null;
  const arrowMatch = src.rest.match(EDGE_ARROW);
  if (!arrowMatch) return null;
  let after = src.rest.slice(arrowMatch[0].length);
  let label: string | null = null;
  const pipeMatch = after.match(/^\|([^|]*)\|\s*/);
  if (pipeMatch) {
    // toMermaid (exportUtils.ts) writes an unlabelled edge as `|""|` rather
    // than omitting the pipe segment — treat that the same as no label.
    label = unescapeLabel(pipeMatch[1]) || null;
    after = after.slice(pipeMatch[0].length);
  }
  const tgt = readNode(after);
  if (!tgt) return null;
  return {
    sourceId: src.id,
    sourceKind: src.kind,
    sourceLabel: src.label,
    targetId: tgt.id,
    targetKind: tgt.kind,
    targetLabel: tgt.label,
    arrowHead: arrowMatch[1] + arrowMatch[3], // e.g. "" , ">" , "<>"
    label,
  };
}

const SKIP_LINE = /^\s*(%%|subgraph\b|end\s*$|class(Def)?\b|click\b|style\b|linkStyle\b)/i;

/** Parses a Mermaid flowchart (`graph`/`flowchart` block) into a DiagramDoc.
 *  Deliberately modest — pipe-style edge labels (`-->|text|`, the syntax
 *  this app's own toMermaid export writes) rather than every historical
 *  Mermaid label dialect, and no attempt to rebuild swimlanes from
 *  `subgraph` blocks. Nodes come out with no position; the caller is
 *  expected to run auto-layout afterward. */
export function parseMermaid(text: string): DiagramDoc {
  const dirMatch = text.match(/^\s*(?:graph|flowchart)\s+(TB|TD|BT|RL|LR)\b/im);
  const rawDir = dirMatch?.[1]?.toUpperCase();
  const direction: Direction = rawDir === "TD" ? "TB" : ((rawDir as Direction) ?? "LR");

  const nodes = new Map<string, { id: string; label: string; kind: NodeKind }>();
  const edges: { id: string; source: string; target: string; label: string | null; bidirectional: boolean }[] = [];

  const ensureNode = (id: string, kind: NodeKind | null, label: string | null) => {
    const existing = nodes.get(id);
    if (existing) {
      // A later mention with an explicit shape/label fills in what an
      // earlier bare mention (as just an edge endpoint) couldn't say.
      if (kind && existing.kind === "process" && label === null) existing.kind = kind;
      if (label && existing.label === id) existing.label = label;
      return;
    }
    nodes.set(id, { id, label: label ?? id, kind: kind ?? "process" });
  };

  let edgeIndex = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || SKIP_LINE.test(line) || /^\s*(graph|flowchart)\s+/i.test(line)) continue;

    const edge = parseEdgeLine(line);
    if (edge) {
      ensureNode(edge.sourceId, edge.sourceKind, edge.sourceLabel);
      ensureNode(edge.targetId, edge.targetKind, edge.targetLabel);
      edgeIndex += 1;
      edges.push({
        id: `e_import_${edgeIndex}`,
        source: edge.sourceId,
        target: edge.targetId,
        label: edge.label,
        bidirectional: edge.arrowHead === "<>",
      });
      continue;
    }

    // No arrow on this line — a standalone node declaration, e.g. `A[Label]`.
    const node = readNode(line);
    if (node && node.rest.trim() === "") {
      ensureNode(node.id, node.kind, node.label);
    }
  }

  if (nodes.size === 0) {
    throw new ImportError("No flowchart nodes found — expecting Mermaid `graph`/`flowchart` syntax.");
  }

  return normalizeDoc({
    title: "Imported diagram",
    diagram_type: "process_flow",
    direction,
    nodes: [...nodes.values()].map((n) => ({
      id: n.id,
      label: n.label,
      kind: n.kind,
      position: { x: 0, y: 0 },
      size: { width: 180, height: 64 },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      style: "solid",
      bidirectional: e.bidirectional,
    })),
    lanes: [],
  });
}

/** Parses this app's own JSON export back into a DiagramDoc — a full
 *  round-trip, positions/styling included, since that's exactly what got
 *  written out (see exportJson in exportUtils.ts). */
export function parseDiagramJson(text: string): DiagramDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError("That file isn't valid JSON.");
  }
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { nodes?: unknown }).nodes)) {
    throw new ImportError("That JSON doesn't look like a diagram export (no `nodes` array).");
  }
  return normalizeDoc(raw as Partial<DiagramDoc>);
}

const MERMAID_EXTENSIONS = [".mmd", ".mermaid"];

/** Reads a dropped/picked file and parses it as either this app's JSON
 *  export or a Mermaid flowchart, deciding by extension first and file
 *  content as a fallback (so a `.txt` full of Mermaid still works).
 *  `needsLayout` tells the caller whether to run auto-layout afterward —
 *  Mermaid carries no position data, the JSON export already does. */
export async function importDiagramFile(
  file: File,
): Promise<{ doc: DiagramDoc; needsLayout: boolean }> {
  const text = await file.text();
  const name = file.name.toLowerCase();

  const looksLikeMermaid = MERMAID_EXTENSIONS.some((ext) => name.endsWith(ext)) || /^\s*(graph|flowchart)\s+/im.test(text);
  if (name.endsWith(".json") || (!looksLikeMermaid && text.trim().startsWith("{"))) {
    return { doc: parseDiagramJson(text), needsLayout: false };
  }
  return { doc: parseMermaid(text), needsLayout: true };
}

/** Same as importDiagramFile, for text pasted directly rather than picked
 *  from disk (JSON or Mermaid both auto-detected the same way). */
export function importDiagramText(text: string): { doc: DiagramDoc; needsLayout: boolean } {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return { doc: parseDiagramJson(trimmed), needsLayout: false };
  }
  return { doc: parseMermaid(trimmed), needsLayout: true };
}
