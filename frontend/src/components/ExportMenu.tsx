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
      <button
        className="inline-flex items-center justify-center gap-[7px] rounded-[7px] border border-line bg-surface px-[11px] py-[7px] text-[12.5px] font-[520] text-ink transition-colors hover:border-line-strong hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-[15px] [&_svg]:text-slate"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Download />
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[210px] rounded-xl border border-line bg-surface p-[5px] shadow-3 animate-[menu-in_130ms_ease]" role="menu">
          <div className="px-2.5 pb-[5px] pt-1.5 text-[10.5px] font-[650] uppercase tracking-[0.06em] text-slate-soft">
            Export diagram
          </div>
          {FORMATS.map((format) => {
            const Icon = format.icon;
            return (
              <button
                key={format.id}
                role="menuitem"
                className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-[15px] [&_svg]:shrink-0 [&_svg]:text-slate"
                onClick={() => void run(format.id)}
                disabled={working !== null}
              >
                <Icon />
                <span>{format.label}</span>
                <span className="ml-auto text-[11px] text-slate-soft">
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