import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { normalizeDoc, type Template } from "../api/types";
import { CATEGORIES, DashboardShell, Panel } from "../components/DashboardShell";
import { Plus, Sparkles } from "../components/icons";
import { TemplatePreview } from "../components/TemplatePreview";
import { categoryLabel, hueFor, TYPE_LABEL } from "../components/templateVisuals";
import { useDiagram } from "../store/useDiagram";

const CATEGORY_BLURB: Record<string, string> = {
  business: "Business processes, workflows and organizational diagrams.",
  it: "System architecture, application design and technical diagrams.",
  data: "Data modeling, pipelines and data flow.",
  project: "Planning, tracking and team collaboration.",
  logistics: "Supply chain, shipping and transportation processes.",
};

const PREVIEW_COUNT = 6;

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";
const SECONDARY = `inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13.5px] font-medium text-ink-strong hover:bg-surface-2 [&_svg]:size-4 ${FOCUS}`;

/** One template as a cell in its category's panel: a live preview of its
 *  structure on the canvas grid, then what it is and the action. */
function TemplateCell({ template, onUse }: { template: Template; onUse: (template: Template) => void }) {
  const ink = hueFor(template.diagram_type);
  const shapes = template.data.nodes?.length ?? 0;
  const links = template.data.edges?.length ?? 0;
  return (
    <div className="group flex flex-col border-b border-r border-line p-4" style={{ "--tint-ink": ink } as CSSProperties}>
      <div className="aspect-[16/10] overflow-hidden rounded-lg border border-line bg-paper p-2 [background-image:radial-gradient(var(--dot)_1px,transparent_1px)] [background-size:14px_14px]">
        <TemplatePreview doc={template.data} />
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <h3 className="m-0 text-[14px] font-semibold text-ink-strong">{template.name}</h3>
        <span className="shrink-0 text-[12px] text-slate">{TYPE_LABEL[template.diagram_type]}</span>
      </div>
      <p className="m-0 mt-1 line-clamp-2 flex-1 text-[13px] leading-[1.5] text-slate">{template.description}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[12px] text-slate-soft">
          {shapes} shapes, {links} links
        </span>
        <button className={SECONDARY} onClick={() => onUse(template)}>
          Use template
        </button>
      </div>
    </div>
  );
}

export default function TemplateLibrary() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const setDoc = useDiagram((s) => s.setDoc);
  const autoLayout = useDiagram((s) => s.autoLayout);

  const activeCategory = params.get("category") ?? "all";

  useEffect(() => {
    api
      .templates()
      .then(setTemplates)
      .catch(() => setFailed(true));
  }, []);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return templates;
    return templates.filter((template) =>
      [
        template.name,
        template.description ?? "",
        categoryLabel(template.category),
        TYPE_LABEL[template.diagram_type],
      ]
        .concat(template.keywords)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [templates, needle]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, Template[]>();
    for (const template of filtered) {
      const list = groups.get(template.category);
      if (list) list.push(template);
      else groups.set(template.category, [template]);
    }
    return groups;
  }, [filtered]);

  const use = async (template: Template) => {
    useDiagram.getState().beginNew();
    setDoc(normalizeDoc(template.data));
    await autoLayout(template.data.direction);
    navigate("/");
  };

  const setCategory = (slug: string) => setParams(slug === "all" ? {} : { category: slug });

  const visibleCategories =
    activeCategory === "all" ? CATEGORIES : CATEGORIES.filter((c) => c.slug === activeCategory);

  const empty = !failed && templates.length === 0;

  const startBlank = () => {
    // Saving a diagram back as a template has no endpoint yet, so the closest
    // thing to "start your own" is an empty canvas.
    useDiagram.getState().beginNew();
    navigate("/");
  };

  const tabs = [{ slug: "all", label: "All" }, ...CATEGORIES];

  return (
    <DashboardShell
      search={{ value: query, onChange: setQuery, placeholder: "Search templates" }}
      onCategory={setCategory}
    >
      <div className="mx-auto max-w-[1240px] px-8 py-8 max-[560px]:px-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="m-0 text-[24px] font-semibold tracking-[-0.01em] text-ink-strong">Templates</h1>
            <p className="mb-0 mt-1 text-[14px] text-slate">
              Real, editable diagrams to start from. Pick one, then ask Kumnous AI to make it yours.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className={SECONDARY} onClick={startBlank}>
              <Plus />
              Start from blank
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded-lg bg-ink-strong px-3 py-1.5 text-[13.5px] font-medium text-paper hover:opacity-90 [&_svg]:size-4 [&_svg]:text-brand-red ${FOCUS}`}
              onClick={() => navigate("/")}
            >
              <Sparkles />
              Describe it instead
            </button>
          </div>
        </div>

        <div className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
          {tabs.map((tab) => {
            const active = activeCategory === tab.slug;
            const count = tab.slug === "all" ? filtered.length : (byCategory.get(tab.slug)?.length ?? 0);
            return (
              <button
                key={tab.slug}
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(tab.slug)}
                className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-0 border-b-2 border-solid bg-transparent px-3 py-2.5 text-[14px] transition-colors ${FOCUS} ${
                  active
                    ? "border-ink-strong font-medium text-ink-strong"
                    : "border-transparent text-slate hover:text-ink-strong"
                }`}
              >
                {tab.label}
                {templates.length > 0 && <span className="text-[12px] text-slate-soft">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {failed && (
            <Panel title="Templates didn't load">
              <p className="m-0 px-5 py-4 text-[14px] text-slate">
                Check the API is running on port 8000, then reload the page.
              </p>
            </Panel>
          )}

          {empty && (
            <Panel title="No templates yet">
              <p className="m-0 px-5 py-4 text-[14px] text-slate">
                Load the built-in library by running{" "}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">
                  uv run python -m scripts.seed_templates
                </code>{" "}
                in the backend.
              </p>
            </Panel>
          )}

          {!failed && templates.length > 0 && filtered.length === 0 && (
            <Panel
              title={`Nothing matches “${query}”`}
              actions={
                <button className={SECONDARY} onClick={() => setQuery("")}>
                  Clear search
                </button>
              }
            >
              <p className="m-0 px-5 py-4 text-[14px] text-slate">
                Try a shorter word, or describe the diagram to Kumnous AI instead.
              </p>
            </Panel>
          )}

          {visibleCategories.map((category) => {
            const items = byCategory.get(category.slug) ?? [];
            if (items.length === 0) return null;
            const showAll = activeCategory !== "all";
            const shown = showAll ? items : items.slice(0, PREVIEW_COUNT);
            return (
              <Panel
                key={category.slug}
                title={
                  <span className="flex items-center gap-2.5 [&_svg]:size-4 [&_svg]:text-slate">
                    <category.icon />
                    {category.label}
                    <span className="text-[13px] font-normal text-slate-soft">{items.length}</span>
                  </span>
                }
                description={CATEGORY_BLURB[category.slug]}
                actions={
                  !showAll && items.length > PREVIEW_COUNT ? (
                    <button className={SECONDARY} onClick={() => setCategory(category.slug)}>
                      View all {items.length}
                    </button>
                  ) : undefined
                }
              >
                {/* Cells draw their own right/bottom rules; the negative
                    margin tucks the last row's and column's under the
                    panel border so the grid reads as one table. */}
                <div className="-mb-px -mr-px grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
                  {shown.map((template) => (
                    <TemplateCell key={template.slug} template={template} onUse={(t) => void use(t)} />
                  ))}
                </div>
              </Panel>
            );
          })}

          <Panel
            title="Not sure which template fits?"
            description="Describe what you're diagramming. Kumnous picks the right structure, or builds one."
            actions={
              <button
                className={`inline-flex items-center gap-2 rounded-lg bg-ink-strong px-3 py-1.5 text-[13.5px] font-medium text-paper hover:opacity-90 [&_svg]:size-4 [&_svg]:text-brand-red ${FOCUS}`}
                onClick={() => navigate("/")}
              >
                <Sparkles />
                Ask Kumnous AI
              </button>
            }
          >
            <span />
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}
