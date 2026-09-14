import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { normalizeDoc, type Template } from "../api/types";
import { CATEGORIES, DashboardShell } from "../components/DashboardShell";
import { ChevronRight, Plus, Sparkles } from "../components/icons";
import {
  categoryLabel,
  TemplateGlyph,
  tintFor,
  TYPE_LABEL,
} from "../components/templateVisuals";
import { useDiagram } from "../store/useDiagram";

const CATEGORY_BLURB: Record<string, string> = {
  business: "For business processes, workflows and organizational diagrams.",
  it: "For system architecture, application design and technical diagrams.",
  data: "For data modeling, pipelines and data flow visualization.",
  project: "For planning, tracking and team collaboration.",
  logistics: "For supply chain, shipping and transportation processes.",
};

const PREVIEW_COUNT = 5;

function TemplateCard({
  template,
  onUse,
}: {
  template: Template;
  onUse: (template: Template) => void;
}) {
  const [bg, line, ink] = tintFor(template.diagram_type);
  return (
    <div
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-2"
      style={
        {
          "--tint": bg,
          "--tint-line": line,
          "--tint-ink": ink,
        } as CSSProperties
      }
    >
      <div className="grid aspect-[16/9] place-items-center border-b border-line bg-[var(--tint)] text-[var(--tint-ink)] [&_svg]:size-9">
        <TemplateGlyph slug={template.slug} type={template.diagram_type} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="m-0 text-[13.5px] font-semibold leading-[1.3] text-ink">
            {template.name}
          </h3>
          <span className="shrink-0 rounded-[20px] bg-[var(--tint)] px-[7px] py-px text-[9px] font-[650] uppercase tracking-[0.04em] text-[var(--tint-ink)]">
            {TYPE_LABEL[template.diagram_type]}
          </span>
        </div>
        <p className="m-0 line-clamp-2 flex-1 text-[11.5px] leading-[1.5] text-slate">
          {template.description}
        </p>
        <button
          className="mt-1 w-full rounded-md border border-line bg-surface py-[7px] text-[12px] font-[600] text-ink transition-colors group-hover:border-green group-hover:bg-green-soft group-hover:text-green-deep"
          onClick={() => onUse(template)}
        >
          Use Template
        </button>
      </div>
    </div>
  );
}

function CategorySection({
  slug,
  label,
  templates,
  onViewAll,
  onUse,
}: {
  slug: string;
  label: string;
  templates: Template[];
  onViewAll: () => void;
  onUse: (template: Template) => void;
}) {
  const shown = templates.slice(0, PREVIEW_COUNT);
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold text-ink">
            {label} Templates
          </h2>
          <p className="m-0 mt-0.5 text-[11.5px] text-slate-soft">
            {CATEGORY_BLURB[slug]}
          </p>
        </div>
        {templates.length > PREVIEW_COUNT && (
          <button
            className="flex shrink-0 items-center gap-1 border-none bg-transparent p-0 text-[12px] font-[600] text-green-deep hover:underline [&_svg]:size-3.5"
            onClick={onViewAll}
          >
            View all
            <ChevronRight />
          </button>
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">
        {shown.map((template) => (
          <TemplateCard key={template.slug} template={template} onUse={onUse} />
        ))}
      </div>
    </section>
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

  const setCategory = (slug: string) =>
    setParams(slug === "all" ? {} : { category: slug });

  const visibleCategories =
    activeCategory === "all"
      ? CATEGORIES
      : CATEGORIES.filter((c) => c.slug === activeCategory);

  const empty = !failed && templates.length === 0;

  return (
    <DashboardShell
      search={{
        value: query,
        onChange: setQuery,
        placeholder: "Search templates…",
      }}
      onCategory={setCategory}
    >
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="m-0 text-[22px] font-bold tracking-[-0.01em] text-ink">
              Template Library
            </h1>
            <p className="m-0 mt-1 text-[13px] text-slate">
              Choose from our professionally designed templates or create your
              own.
            </p>
          </div>
          <button
            className="inline-flex shrink-0 items-center gap-[7px] rounded-lg border border-green bg-green px-3.5 py-2 text-[12.5px] font-semibold text-on-accent transition-colors hover:bg-green-strong"
            onClick={() => {
              // Nothing to save as a template yet — an empty canvas is the
              // closest thing to "start a custom one" until saving the
              // current diagram back as a Template has a backend endpoint.
              useDiagram.getState().beginNew();
              navigate("/");
            }}
            title="Template creation from a saved diagram is coming soon — this starts a blank canvas for now"
          >
            <Plus />
            Create Custom Template
          </button>
        </div>

        <div className="no-scrollbar mb-6 flex gap-1.5 overflow-x-auto border-b border-line pb-3">
          <button
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-[600] transition-colors ${
              activeCategory === "all"
                ? "border-green bg-green text-on-accent"
                : "border-line bg-surface text-slate hover:border-line-strong"
            }`}
            onClick={() => setCategory("all")}
          >
            All Templates
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category.slug}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-[600] transition-colors [&_svg]:size-3.5 ${
                activeCategory === category.slug
                  ? "border-green bg-green text-on-accent"
                  : "border-line bg-surface text-slate hover:border-line-strong"
              }`}
              onClick={() => setCategory(category.slug)}
            >
              <category.icon />
              {category.label}
            </button>
          ))}
        </div>

        {failed && (
          <p className="text-[13px] text-slate">
            Templates didn&apos;t load. Check the API is running on port 8000,
            then reload.
          </p>
        )}

        {empty && (
          <p className="text-[13px] text-slate">
            No templates yet. Run{" "}
            <code className="rounded-[3px] bg-surface-2 px-1 py-px font-mono text-[12px]">
              uv run python -m scripts.seed_templates
            </code>{" "}
            in the backend.
          </p>
        )}

        {!failed && templates.length > 0 && filtered.length === 0 && (
          <p className="text-[13px] text-slate">
            Nothing matches &ldquo;{query}&rdquo;.{" "}
            <button
              className="border-none bg-transparent p-0 text-[13px] font-[550] text-green-deep underline"
              onClick={() => setQuery("")}
            >
              Clear search
            </button>
          </p>
        )}

        {visibleCategories.map((category) => {
          const items = byCategory.get(category.slug) ?? [];
          if (items.length === 0) return null;
          return (
            <CategorySection
              key={category.slug}
              slug={category.slug}
              label={category.label}
              templates={items}
              onViewAll={() => setCategory(category.slug)}
              onUse={(template) => void use(template)}
            />
          );
        })}

        <div className="mt-2 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface p-8 text-center">
          <span className="grid size-9 place-items-center rounded-full bg-green-soft text-green [&_svg]:size-4">
            <Sparkles />
          </span>
          <p className="m-0 text-[13px] font-[600] text-ink">
            Not sure which template fits?
          </p>
          <p className="m-0 max-w-[420px] text-[12px] leading-[1.5] text-slate">
            Describe what you&apos;re trying to diagram to Kumnous AI
            instead — it reads your description and picks (or builds) the right
            structure for you.
          </p>
          <button
            className="mt-1 inline-flex items-center gap-[7px] rounded-lg border border-green bg-green px-3.5 py-1.5 text-[12.5px] font-semibold text-on-accent transition-colors hover:bg-green-strong"
            onClick={() => navigate("/")}
          >
            <Sparkles />
            Ask Kumnous AI
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
