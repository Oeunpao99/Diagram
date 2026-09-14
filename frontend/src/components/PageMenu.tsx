import { useEffect, useRef, useState } from "react";

import { useDiagram } from "../store/useDiagram";
import { pageTargetFromMeta, PAGE_PRESETS } from "../lib/pagePresets";
import { Check, ChevronDown, Ratio } from "./icons";

/** Reshape the flow to fit a target page — a 16:9 slide, an A4 sheet, a
 *  square preview — so the diagram sits naturally inside whatever medium the
 *  user is building for (PowerPoint, Word, presentations, …) instead of a
 *  free-floating r2-l shaped blob that needs manual fussing. */
export function PageMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const meta = useDiagram((s) => s.doc.meta);
  const autoLayout = useDiagram((s) => s.autoLayout);
  const empty = useDiagram((s) => s.doc.nodes.length === 0);
  const busy = useDiagram((s) => s.busy);

  const active = pageTargetFromMeta(meta);
  const activePreset =
    PAGE_PRESETS.find((p) => p.id === active?.id) ??
    (active
      ? {
          id: "custom",
          label: "Custom page",
          hint: `${Math.round(active.width)} × ${Math.round(active.height)}`,
          width: active.width,
          height: active.height,
        }
      : null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const pick = (id: string | null) => {
    setOpen(false);
    const preset = id ? PAGE_PRESETS.find((p) => p.id === id) : null;
    void autoLayout(
      undefined,
      preset
        ? { id: preset.id, width: preset.width, height: preset.height }
        : null,
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        className="group relative inline-flex items-center gap-1.5 rounded-[7px] border-none bg-transparent px-[7px] py-[5px] text-[11.5px] font-[550] text-slate transition-[background,color] hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5"
        title="Fit to page / slide ratio"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={empty || busy !== null}
      >
        <Ratio ratio={active ? active.width / active.height : undefined} />
        {activePreset ? activePreset.label : "Page"}
        <ChevronDown />
      </button>
      {open && (
        <div
          className="absolute left-1/2 top-[calc(100%+6px)] z-50 min-w-[210px] -translate-x-1/2 rounded-xl border border-line bg-surface p-[5px] shadow-3 animate-[menu-in_130ms_ease]"
          role="menu"
        >
          <div className="px-2.5 pb-[5px] pt-1.5 text-[10.5px] font-[650] uppercase tracking-[0.06em] text-slate-soft">
            Fit to page
          </div>
          <button
            role="menuitem"
            className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-ink hover:bg-surface-2 [&_svg]:size-[13px] [&_svg]:shrink-0 [&_svg]:text-slate"
            onClick={() => pick(null)}
          >
            <Ratio />
            <span className="flex-1">Free / no page</span>
            {!active && (
              <span className="text-green">
                <Check />
              </span>
            )}
          </button>
          {PAGE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              role="menuitem"
              className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-ink hover:bg-surface-2 [&_svg]:size-[13px] [&_svg]:shrink-0 [&_svg]:text-slate"
              onClick={() => pick(preset.id)}
            >
              <Ratio ratio={preset.width / preset.height} />
              <span className="flex-1">{preset.label}</span>
              <span className="text-[11px] text-slate-soft">{preset.hint}</span>
              {activePreset?.id === preset.id && (
                <span className="text-green">
                  <Check />
                </span>
              )}
            </button>
          ))}
          {activePreset?.id === "custom" && (
            <div className="px-2.5 py-[5px] text-[11px] leading-snug text-slate-soft">
              Current page: {Math.round(activePreset.width)} × {Math.round(activePreset.height)}px
            </div>
          )}
        </div>
      )}
    </div>
  );
}