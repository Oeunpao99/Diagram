import { useEffect, useRef, useState } from "react";

import { importDiagramFile, importDiagramText, ImportError } from "../api/importUtils";
import { useDiagram } from "../store/useDiagram";
import { Alert, ClipboardPaste, FileUp, Upload } from "./icons";

type Mode = "menu" | "paste";

/** Loads a diagram from a file on disk or pasted text — this app's own JSON
 *  export (full round-trip: styling, positions, everything) or a Mermaid
 *  flowchart (nodes/edges only; auto-layout fills in positions afterward,
 *  same as clicking "Auto Layout" would). Mirrors ExportMenu's dropdown. */
export function ImportMenu() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setDoc = useDiagram((s) => s.setDoc);
  const autoLayout = useDiagram((s) => s.autoLayout);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    setMode("menu");
    setPasted("");
    setError(null);
  };

  const apply = async (doc: Parameters<typeof setDoc>[0], needsLayout: boolean) => {
    setWorking(true);
    try {
      // Silent — the auto-layout call right after (or, for a JSON import
      // that's already positioned, this alone) is the one undo step that
      // should take the user back to whatever they had before importing.
      setDoc(doc, { silent: true });
      if (needsLayout) await autoLayout(doc.direction);
      close();
    } catch (err) {
      setError(err instanceof ImportError ? err.message : "Couldn't import that diagram.");
    } finally {
      setWorking(false);
    }
  };

  const onFileChosen = async (file: File) => {
    setError(null);
    try {
      const { doc, needsLayout } = await importDiagramFile(file);
      await apply(doc, needsLayout);
    } catch (err) {
      setError(err instanceof ImportError ? err.message : "Couldn't read that file.");
    }
  };

  const runPaste = async () => {
    if (!pasted.trim()) return;
    setError(null);
    try {
      const { doc, needsLayout } = importDiagramText(pasted);
      await apply(doc, needsLayout);
    } catch (err) {
      setError(err instanceof ImportError ? err.message : "Couldn't parse that.");
    }
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        className="inline-flex items-center justify-center gap-[7px] rounded-[7px] border border-line bg-surface px-[11px] py-[7px] text-[12.5px] font-[520] text-ink transition-colors hover:border-line-strong hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-[15px] [&_svg]:text-slate"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <FileUp />
        Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.mmd,.mermaid,.txt,application/json,text/plain"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void onFileChosen(file);
        }}
      />
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[300px] rounded-xl border border-line bg-surface p-[5px] shadow-3 animate-[menu-in_130ms_ease]" role="menu">
          {mode === "menu" ? (
            <>
              <div className="px-2.5 pb-[5px] pt-1.5 text-[10.5px] font-[650] uppercase tracking-[0.06em] text-slate-soft">
                Import diagram
              </div>
              <button
                role="menuitem"
                className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-[15px] [&_svg]:shrink-0 [&_svg]:text-slate"
                onClick={() => fileInputRef.current?.click()}
                disabled={working}
              >
                <Upload />
                <span>From device</span>
                <span className="ml-auto text-[11px] text-slate-soft">.json / .mmd</span>
              </button>
              <button
                role="menuitem"
                className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-[15px] [&_svg]:shrink-0 [&_svg]:text-slate"
                onClick={() => setMode("paste")}
                disabled={working}
              >
                <ClipboardPaste />
                <span>Paste code</span>
                <span className="ml-auto text-[11px] text-slate-soft">Mermaid / JSON</span>
              </button>
            </>
          ) : (
            <div className="p-[5px]">
              <div className="mb-1.5 px-1 text-[10.5px] font-[650] uppercase tracking-[0.06em] text-slate-soft">
                Paste Mermaid or diagram JSON
              </div>
              <textarea
                autoFocus
                className="h-[240px] w-full resize-y rounded-[7px] border border-line bg-paper p-2 font-mono text-[11.5px] text-ink outline-none focus:border-green"
                placeholder={"graph LR\n  A[Start] --> B[Do the thing]\n\nsequenceDiagram\n  HR->>NH: Send offer & paperwork\n  IT-->>NH: Deliver laptop & credentials"}
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
              />
              <div className="mt-1.5 flex justify-end gap-[7px]">
                <button
                  className="rounded-[7px] border border-line bg-surface px-2.5 py-1 text-xs font-[550] text-slate hover:bg-surface-2"
                  onClick={() => setMode("menu")}
                >
                  Back
                </button>
                <button
                  className="rounded-[7px] border border-green bg-green px-2.5 py-1 text-xs font-[550] text-on-accent hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => void runPaste()}
                  disabled={working || !pasted.trim()}
                >
                  {working ? "Importing…" : "Import"}
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="mx-[5px] mb-[5px] flex items-start gap-[7px] rounded-[7px] bg-red-soft px-2.5 py-2 text-[11.5px] leading-[1.4] text-red [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0">
              <Alert />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
