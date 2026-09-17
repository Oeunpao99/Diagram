import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "../api/client";
import type { Template } from "../api/types";
import { useDiagram } from "../store/useDiagram";
import { ChevronDown, ExtractNote, Search } from "./icons";
import { categoryLabel, TYPE_LABEL } from "./templateVisuals";

/** Reorganizes the open diagram to follow a chosen template's structure —
 *  lanes, stage grouping, overall shape — while keeping its own content.
 *  Only ever shown for a diagram that already has content (disabled
 *  otherwise), so unlike the Templates rail's picker (which loads a
 *  template's static example onto a blank canvas) this always calls the AI
 *  restyle endpoint rather than discarding what's there. */
export function TemplateMenu() {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const restyleToTemplate = useDiagram((s) => s.restyleToTemplate);
  const empty = useDiagram((s) => s.doc.nodes.length === 0);
  const busy = useDiagram((s) => s.busy);

  // Fetched lazily on first open rather than on mount — this menu can sit
  // in the toolbar for a whole session without ever being opened.
  useEffect(() => {
    if (open && templates.length === 0) {
      api
        .templates()
        .then(setTemplates)
        .catch(() => {
          /* the search box just shows "no matches" if this never loads */
        });
    }
  }, [open, templates.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return templates;
    return templates.filter((template) =>
      [template.name, template.description ?? "", categoryLabel(template.category), TYPE_LABEL[template.diagram_type]]
        .concat(template.keywords)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [templates, needle]);

  const pick = (template: Template) => {
    setOpen(false);
    setQuery("");
    void restyleToTemplate(template.slug);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        className="group relative inline-flex items-center gap-1.5 rounded-[7px] border-none bg-transparent px-[7px] py-[5px] text-[11.5px] font-[550] text-slate transition-[background,color] hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5"
        title="Reshape to a template"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={empty || busy !== null}
      >
        <ExtractNote />
        Template
        <ChevronDown />
      </button>
      {open && (
        <div
          className="absolute left-1/2 top-[calc(100%+6px)] z-50 w-[280px] -translate-x-1/2 rounded-xl border border-line bg-surface p-2 shadow-3 animate-[menu-in_130ms_ease]"
          role="menu"
        >
          <p className="m-0 mb-1.5 px-0.5 text-[11px] leading-[1.4] text-slate">
            Reshapes your diagram — keeps your content.
          </p>
          <label className="relative mb-1.5 block">
            <span className="pointer-events-none absolute left-[9px] top-1/2 -translate-y-1/2 text-slate-soft [&_svg]:size-[13px]">
              <Search />
            </span>
            <input
              type="search"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- this only
              // mounts once the popover is opened by a deliberate click
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates…"
              className="w-full rounded-md border border-line bg-paper py-[7px] pl-[27px] pr-2.5 text-[12px] text-ink outline-none transition-[border-color,background,box-shadow] placeholder:text-slate-soft focus:border-green focus:bg-surface focus:shadow-[0_0_0_3px_var(--green-ring)]"
              aria-label="Search templates"
            />
          </label>
          <div className="no-scrollbar max-h-[280px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="m-0 px-1 py-2 text-xs text-slate">
                {templates.length === 0 ? "Loading…" : `Nothing matches “${query}”.`}
              </p>
            ) : (
              filtered.map((template) => (
                <button
                  key={template.slug}
                  role="menuitem"
                  className="flex w-full items-start gap-2 rounded-[7px] px-2 py-[7px] text-left hover:bg-surface-2"
                  onClick={() => pick(template)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="truncate text-[12.5px] font-semibold text-ink">
                      {template.name}
                    </span>
                    {/* line-clamp-1 already sets its own `display` (a
                        -webkit-box, not a plain block) — adding `block`
                        alongside it fights that and silently breaks the
                        clamp/ellipsis, which is why this was overflowing
                        instead of truncating. */}
                    <span className="mt-0.5 line-clamp-1 text-[10.5px] text-slate">
                      {template.description}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
