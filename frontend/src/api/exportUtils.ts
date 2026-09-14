import { toPng, toSvg } from "html-to-image";

import { pageRectFromMeta } from "../lib/pagePresets";
import type { DiagramDoc, DiagramNode } from "./types";

/** React Flow helpers injected by the Canvas while it is mounted.
 *  Exporting must never depend on the on-screen pan/zoom — it should always
 *  capture the whole graph. */
export interface ExportRuntime {
  /** Box (in flow coordinates) that encloses every node on the canvas. */
  getFlowBounds: () => {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

let runtime: ExportRuntime | null = null;

/** Canvas calls this on mount/unmount. */
export function registerExportRuntime(next: ExportRuntime | null): void {
  runtime = next;
}

function viewportElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".react-flow__viewport");
}

function slugify(title: string): string {
  return title.replace(/\s+/g, "-").toLowerCase();
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Choose the crop rectangle for an export. A fitted page (slide / A4)
 *  wins whenever the graph still fits inside it — that's the whole point of a
 *  "fit to page" layout, and it makes the PNG exactly match the medium's ratio.
 *  If nodes have since been dragged outside the page, fall back to a union so
 *  nothing is ever cut off. */
function resolveCrop(bounds: Box | null, page: Box | null): Box | null {
  const pad = (b: Box) =>
    Math.min(64, Math.max(24, Math.max(b.width, b.height) * 0.06));
  if (!page) {
    if (!bounds) return null;
    const p = pad(bounds);
    return {
      x: bounds.x - p,
      y: bounds.y - p,
      width: bounds.width + p * 2,
      height: bounds.height + p * 2,
    };
  }
  if (!bounds) return page;
  const contains =
    page.x <= bounds.x &&
    page.y <= bounds.y &&
    page.x + page.width >= bounds.x + bounds.width &&
    page.y + page.height >= bounds.y + bounds.height;
  if (contains) return page;
  const p = pad(bounds);
  const x1 = Math.min(page.x, bounds.x - p);
  const y1 = Math.min(page.y, bounds.y - p);
  const x2 = Math.max(page.x + page.width, bounds.x + bounds.width + p);
  const y2 = Math.max(page.y + page.height, bounds.y + bounds.height + p);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

interface RasterOptions {
  transparent?: boolean;
}

/** html-to-image clones SVG subtrees with the browser's native
 *  `cloneNode(true)` rather than walking their children itself, so its usual
 *  "read the computed style, write it inline" pass never reaches anything
 *  inside an `<svg>` — only attributes/inline styles survive that clone. Every
 *  connector's line and label get their colour from a plain CSS class
 *  (`.react-flow__edge-path` / `-text`), so without this they rasterise with
 *  no stroke or fill at all: nodes export fine, every link disappears. Bake
 *  each element's live computed value onto its own inline style right before
 *  capture, then restore the original cssText afterwards so hover/selected
 *  styling keeps working once the export is done. */
function inlineEdgeStyles(viewport: HTMLElement): () => void {
  const props = ["stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "fill"];
  const selector = ".react-flow__edge-path, .react-flow__edge-text, .react-flow__edge-textbg";
  const restores: Array<() => void> = [];
  viewport.querySelectorAll<SVGElement>(selector).forEach((el) => {
    const prevCssText = el.style.cssText;
    restores.push(() => {
      el.style.cssText = prevCssText;
    });
    const computed = getComputedStyle(el);
    for (const prop of props) {
      el.style.setProperty(prop, computed.getPropertyValue(prop));
    }
  });
  return () => restores.forEach((restore) => restore());
}

/**
 * Capture the flow viewport and crop it to the given rectangle so every node,
 * edge and label is included (no dependency on the viewer's current pan/zoom).
 * PNG output is transparent unless `transparent` is false.
 *
 * Quality: instead of relying on html-to-image's device pixel ratio we lay the
 * cloned DOM out at 2x CSS size and scale it, so text and strokes are genuinely
 * rasterised at 2x — crisp even on high-DPI screens.
 */
async function raster(
  format: "png" | "svg",
  crop: Box,
  { transparent }: RasterOptions = {},
): Promise<string> {
  const viewport = viewportElement();
  if (!viewport) throw new Error("Canvas is not ready");

  const scale = format === "png" ? 2 : 1;
  const width = crop.width * scale;
  const height = crop.height * scale;
  const options = {
    ...(transparent ? {} : { backgroundColor: "#FFFFFF" }),
    width,
    height,
    pixelRatio: 1,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${-crop.x * scale}px, ${-crop.y * scale}px) scale(${scale})`,
    },
  };
  const restore = inlineEdgeStyles(viewport);
  try {
    return await (format === "png" ? toPng(viewport, options) : toSvg(viewport, options));
  } finally {
    restore();
  }
}

function download(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export async function exportImage(doc: DiagramDoc, format: "png" | "svg") {
  const bounds = runtime?.getFlowBounds() ?? null;
  const page = pageRectFromMeta(doc.meta);
  const crop = resolveCrop(bounds, page);
  if (!crop) throw new Error("Nothing on the canvas to export");
  download(
    await raster(format, crop, { transparent: format === "png" }),
    `${slugify(doc.title)}.${format}`,
  );
}

export function exportJson(doc: DiagramDoc) {
  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: "application/json",
  });
  download(URL.createObjectURL(blob), `${slugify(doc.title)}.json`);
}

const ESCAPE = (text: string) => text.replace(/"/g, '\\"').replace(/\n/g, " ");

const KIND_SHAPE: Partial<Record<DiagramNode["kind"], string>> = {
  decision: '{{"label"}}',
  start: '(("label"))',
  end: '(("label"))',
};

export function toMermaid(doc: DiagramDoc): string {
  const dir = doc.direction === "TB" || doc.direction === "BT" ? "TB" : "LR";
  const lines = [`graph ${dir}`];
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));

  for (const node of doc.nodes) {
    const template = KIND_SHAPE[node.kind] ?? '["label"]';
    const shape = template.replace("label", ESCAPE(node.label));
    const lane = node.lane
      ? `\n\tclass ${node.id} node-${ESCAPE(node.lane).toLowerCase().replace(/\W+/g, "-")}`
      : "";
    lines.push(`    ${node.id}${shape}${lane}`);
  }

  for (const edge of doc.edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    // Mermaid only has directional/bidirectional arrows — no circle/diamond —
    // so any explicit start marker (the newer, more expressive field) counts
    // as "bidirectional" here, same as the legacy flag it can now stand in for.
    const arrow = edge.bidirectional || (edge.start_arrow && edge.start_arrow !== "none") ? "<-->" : "-->";
    const label = edge.label || edge.condition;
    lines.push(
      `    ${edge.source} ${arrow}|"${ESCAPE(label ?? "")}"| ${edge.target}`,
    );
  }
  return lines.join("\n");
}

export function exportMermaid(doc: DiagramDoc) {
  const blob = new Blob([toMermaid(doc)], { type: "text/vnd.mermaid" });
  download(URL.createObjectURL(blob), `${slugify(doc.title)}.mmd`);
}

export async function exportPdf(doc: DiagramDoc) {
  const bounds = runtime?.getFlowBounds() ?? null;
  const page = pageRectFromMeta(doc.meta);
  const crop = resolveCrop(bounds, page);
  if (!crop) throw new Error("Nothing on the canvas to export");
  const dataUrl = await raster("png", crop, { transparent: false });
  const win = window.open("", "_blank", "width=1200,height=900");
  if (!win) return;
  win.document.write(
    `<html><head><title>${doc.title}</title>
       <style>
         body{margin:0;display:grid;place-items:center;min-height:100vh;background:#fff}
         img{max-width:100%;box-shadow:0 2px 24px rgba(0,0,0,.12)}
         @media print { body{display:block} img{box-shadow:none} }
       </style>
     </head><body onload="setTimeout(function(){window.print()},350)">` +
      `<img src="${dataUrl}" alt="${doc.title}" /></body></html>`,
  );
  win.document.close();
}
