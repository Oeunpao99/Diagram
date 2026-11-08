import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { api } from "../../api/client";
import { normalizeDoc, type Template } from "../../api/types";
import { CATEGORIES } from "../../components/DashboardShell";
import { TemplateGlyph, tintFor, TYPE_LABEL } from "../../components/templateVisuals";
import type { LandingCopy } from "./copy";
import { DemoCanvas } from "./DemoCanvas";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

/** "What it draws": every built-in template, laid out by the real layout
 *  engine on the server, browsable by category. Pick one from the list and
 *  it opens on the canvas, where it can be dragged around. Shows `fallback`
 *  (the three built-in demos) if the templates can't be loaded. */
export function TemplateBrowser({ copy, fallback }: { copy: LandingCopy["examples"]; fallback: ReactNode }) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState("all");
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    api
      .templatesLaidOut()
      .then((list) => (list.length ? setTemplates(list) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  const shown = useMemo(
    () => (templates ?? []).filter((t) => category === "all" || t.category === category),
    [templates, category],
  );
  const selected = shown.find((t) => t.slug === slug) ?? shown[0];
  const doc = useMemo(() => (selected ? normalizeDoc(selected.data) : null), [selected]);

  if (failed) return <>{fallback}</>;

  const chips = [
    { slug: "all", label: copy.all, icon: null as null | (() => ReactNode) },
    ...CATEGORIES.map((c) => ({ slug: c.slug, label: copy.categories[c.slug] ?? c.label, icon: c.icon })),
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={copy.title}>
        {chips.map((chip) => {
          const active = category === chip.slug;
          const count =
            chip.slug === "all" ? templates?.length : templates?.filter((t) => t.category === chip.slug).length;
          return (
            <button
              key={chip.slug}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setCategory(chip.slug);
                setSlug(null);
              }}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-colors ${FOCUS} ${
                active
                  ? "border-green bg-green text-on-accent"
                  : "border-line-strong bg-surface text-ink hover:bg-surface-2"
              }`}
            >
              {chip.icon && (
                <span className="[&_svg]:size-4">
                  <chip.icon />
                </span>
              )}
              {chip.label}
              {count !== undefined && (
                <span className={`text-[12px] ${active ? "text-on-accent/80" : "text-slate-soft"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Templates in the chosen category, as a row of tabs that scrolls
          sideways: each with its type's solid colour and icon. */}
      <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 py-1" role="tablist" aria-label={copy.title}>
        {templates === null &&
          Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="h-10 w-44 shrink-0 animate-pulse rounded-xl bg-surface-2" />
          ))}
        {shown.map((template) => {
          const [bg, border, ink] = tintFor(template.diagram_type);
          const active = template.slug === selected?.slug;
          return (
            <button
              key={template.slug}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSlug(template.slug)}
              className={`flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border pl-1.5 pr-3 text-[13.5px] font-medium transition-colors ${FOCUS} ${
                active
                  ? "border-ink-strong bg-ink-strong text-paper"
                  : "border-line-strong bg-surface text-ink hover:bg-surface-2"
              }`}
            >
              <span
                className="grid size-7 shrink-0 place-items-center rounded-lg border [&_svg]:size-4"
                style={{ background: bg, borderColor: border, color: ink }}
              >
                <TemplateGlyph slug={template.slug} type={template.diagram_type} />
              </span>
              {template.name}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex h-[620px] flex-col overflow-hidden rounded-[14px] border border-line-strong bg-surface max-[860px]:h-[520px]">
        {/* The selected template, open on the canvas. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selected ? (
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <p className="m-0 flex flex-wrap items-center gap-2 text-[16px] font-semibold text-ink-strong">
                  {selected.name}
                  <span
                    className="rounded-md px-2 py-0.5 text-[12px] font-medium"
                    style={{
                      background: tintFor(selected.diagram_type)[0],
                      color: tintFor(selected.diagram_type)[2],
                    }}
                  >
                    {TYPE_LABEL[selected.diagram_type]}
                  </span>
                </p>
                {selected.description && (
                  <p lang="en" className="mb-0 mt-1 max-w-[60ch] text-[14px] leading-[1.6] text-slate">
                    {selected.description}
                  </p>
                )}
              </div>
              <Link
                to="/register"
                className={`inline-flex h-9 shrink-0 items-center rounded-lg bg-green px-4 text-[14px] font-medium text-on-accent no-underline transition-[background-color,translate] hover:-translate-y-0.5 hover:bg-green-strong ${FOCUS}`}
              >
                {copy.use}
              </Link>
            </div>
          ) : (
            <div className="border-b border-line px-5 py-4 text-[14px] text-slate">{copy.loading}</div>
          )}
          <div className="min-h-[420px] flex-1">
            {doc && <DemoCanvas key={selected?.slug} doc={doc} explore hints={{ explore: copy.dragExplore, move: copy.dragMove }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
