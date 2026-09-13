import { toPng, toSvg } from "html-to-image";

import type { DiagramDoc, DiagramNode } from "./types";

function viewportElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".react-flow__viewport");
}

function slugify(title: string): string {
  return title.replace(/\s+/g, "-").toLowerCase();
}

async function raster(format: "png" | "svg"): Promise<string> {
  const viewport = viewportElement();
  if (!viewport) throw new Error("Canvas is not ready");
  const options = { backgroundColor: "#FFFFFF", pixelRatio: 2 };
  return format === "png" ? toPng(viewport, options) : toSvg(viewport, options);
}

function download(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export async function exportImage(doc: DiagramDoc, format: "png" | "svg") {
  download(await raster(format), `${slugify(doc.title)}.${format}`);
}

export function exportJson(doc: DiagramDoc) {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
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
    const lane = node.lane ? `\n\tclass ${node.id} node-${ESCAPE(node.lane).toLowerCase().replace(/\W+/g, "-")}` : "";
    lines.push(`    ${node.id}${shape}${lane}`);
  }

  for (const edge of doc.edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    const arrow = edge.bidirectional ? "<-->" : "-->";
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
  const dataUrl = await raster("png");
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