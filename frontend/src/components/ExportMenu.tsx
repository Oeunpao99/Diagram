import { useEffect, useRef, useState } from "react";

import {
  exportImage,
  exportJson,
  exportMermaid,
  exportPdf,
} from "../api/exportUtils";
import type { DiagramDoc } from "../api/types";
import {
  Download,
  FileCode,
  FileImage,
  FileText,
  Printer,
} from "./icons";

const FORMATS = [
  { id: "png", label: "PNG", hint: "High-res image", icon: FileImage },
  { id: "svg", label: "SVG", hint: "Vector, editable", icon: FileImage },
  { id: "pdf", label: "PDF", hint: "Document handout", icon: Printer },
  { id: "json", label: "JSON", hint: "Full diagram data", icon: FileText },
  { id: "mermaid", label: "Mermaid", hint: "Markdown diagram", icon: FileCode },
] as const;

type FormatId = (typeof FORMATS)[number]["id"];

export function ExportMenu({ doc }: { doc: DiagramDoc }) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState<FormatId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const run = async (format: FormatId) => {
    setWorking(format);
    try {
      if (format === "png" || format === "svg") await exportImage(doc, format);
      else if (format === "pdf") await exportPdf(doc);
      else if (format === "json") exportJson(doc);
      else exportMermaid(doc);
    } finally {
      setWorking(null);
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button className="btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="btn__icon">
          <Download />
        </span>
        Export
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu__heading">Export diagram</div>
          {FORMATS.map((format) => {
            const Icon = format.icon;
            return (
              <button
                key={format.id}
                role="menuitem"
                className="menu__item"
                onClick={() => void run(format.id)}
                disabled={working !== null}
              >
                <Icon />
                <span>{format.label}</span>
                <span style={{ marginLeft: "auto", color: "var(--slate-soft)", fontSize: 11 }}>
                  {working === format.id ? "Waiting…" : format.hint}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}