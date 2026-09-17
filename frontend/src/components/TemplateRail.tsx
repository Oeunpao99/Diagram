import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "../api/client";
import {
  emptyDoc,
  normalizeDoc,
  type DiagramListItem,
  type DiagramType,
  type Template,
} from "../api/types";
import { useCanvasAssets } from "../hooks/useCanvasAssets";
import { iconToDataUrl } from "../lib/iconToDataUrl";
import { useDiagram } from "../store/useDiagram";
import { ASSET_LIBRARY } from "./assetLibrary";
import { ICON_CATALOG, type IconAsset } from "./iconCatalog";
import {
  Alert,
  Check,
  ChevronDown,
  CircleDot,
  ExtractNote,
  FileImage,
  Grid,
  Layers,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash,
  Upload,
} from "./icons";
import {
  categoryLabel,
  TemplateGlyph,
  timeAgo,
  tintFor,
  TYPE_LABEL,
  TypeGlyph,
} from "./templateVisuals";
import { UserChip } from "./UserChip";

/* -------------------------------------------------------------- templates */

function TemplatesPane() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const [diagrams, setDiagrams] = useState<DiagramListItem[]>([]);
  const [diagramsOpen, setDiagramsOpen] = useState(true);
  const [diagramsFailed, setDiagramsFailed] = useState(false);

  const setDoc = useDiagram((s) => s.setDoc);
  const autoLayout = useDiagram((s) => s.autoLayout);
  const busy = useDiagram((s) => s.busy);
  const docTitle = useDiagram((s) => s.doc.title);
  const hasNodes = useDiagram((s) => s.doc.nodes.length > 0);
  const diagramId = useDiagram((s) => s.diagramId);
  const savedRev = useDiagram((s) => s.savedRev);

  useEffect(() => {
    api
      .templates()
      .then(setTemplates)
      .catch(() => setFailed(true));
  }, []);

  // Re-fetch the saved list whenever the store says a diagram was created,
  // saved, opened or removed (savedRev bumps), so ordering stacks stay current.
  useEffect(() => {
    let alive = true;
    api
      .listDiagrams(40)
      .then((items) => {
        if (alive) {
          setDiagrams(items);
          setDiagramsFailed(false);
        }
      })
      .catch(() => {
        if (alive) setDiagramsFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [savedRev]);

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

  const grouped = useMemo(() => {
    const groups = new Map<string, Template[]>();
    for (const template of filtered) {
      const key = categoryLabel(template.category);
      const list = groups.get(key);
      if (list) list.push(template);
      else groups.set(key, [template]);
    }
    return groups;
  }, [filtered]);

  const toggleGroup = (category: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  const use = async (template: Template) => {
    useDiagram.getState().beginNew();
    setDoc(normalizeDoc(template.data));
    await autoLayout(template.data.direction);
  };

  const startBlank = () => {
    // A blank canvas belongs to no saved diagram: the first real edit will
    // autosave as a brand-new record instead of overwriting the open one.
    useDiagram.getState().beginNew();
    setDoc(emptyDoc());
  };

  const openSaved = (id: string) => void useDiagram.getState().loadDiagram(id);

  const removeSaved = async (id: string) => {
    try {
      await api.deleteDiagram(id);
      const state = useDiagram.getState();
      // Dropping the diagram that's on screen detaches it too, so the next
      // edit starts fresh rather than recreating the row just deleted.
      if (state.diagramId === id) state.beginNew();
      else state.bumpSaved();
    } catch {
      // A failed delete just leaves the row alone.
    }
  };

  const creating = busy === "laying-out";
  const empty = !failed && templates.length === 0;

  return (
    <>
      <label className="relative">
        <span className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-slate-soft [&_svg]:size-[14px]">
          <Search />
        </span>
        <input
          ref={searchRef}
          type="search"
          className="w-full rounded-md border border-line bg-paper py-2.5 pl-[30px] pr-2.5 text-[13px] text-ink outline-none transition-[border-color,background,box-shadow] placeholder:text-slate-soft focus:border-green focus:bg-surface focus:shadow-[0_0_0_3px_var(--green-ring)]"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search templates…"
          aria-label="Search templates"
        />
      </label>

      <button
        className="group flex w-full items-center gap-2.5 rounded-[10px] border-[1.5px] border-dashed border-line bg-surface p-2 px-2.5 text-left transition-colors hover:border-green hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-50"
        onClick={startBlank}
        disabled={busy !== null}
        aria-pressed={!hasNodes}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-paper text-slate transition-colors group-hover:bg-surface group-hover:text-green [&_svg]:size-4">
          <Plus />
        </span>
        <span>
          <span className="block text-[12.5px] font-semibold leading-[1.25] text-ink">
            Blank diagram
          </span>
          <span className="mt-0.5 block text-[10.5px] leading-[1.4] text-slate-soft">
            Start from an empty canvas
          </span>
        </span>
        {!hasNodes && (
          <span
            className="ml-auto grid size-[18px] shrink-0 place-items-center rounded-full text-green [&_svg]:size-3 [&_svg]:stroke-[2.4]"
            title="Blank canvas active"
          >
            <Check />
          </span>
        )}
      </button>

      {diagrams.length > 0 && (
        <section
          className="border-b border-line pb-[9px]"
          aria-label="My diagrams"
        >
          <button
            className="group flex w-full items-center justify-between gap-2 border-none bg-transparent p-1 px-0.5 text-left"
            onClick={() => setDiagramsOpen((v) => !v)}
            aria-expanded={diagramsOpen}
          >
            <span className="flex items-center gap-1.5 text-[11.5px] font-[650] text-slate transition-colors group-hover:text-ink">
              My diagrams
              <span className="rounded-[10px] bg-paper px-[6px] text-[10px] font-[550] text-slate-soft">
                {diagrams.length}
              </span>
            </span>
            <span
              className={`text-slate-soft transition-transform duration-200 [&_svg]:size-3.5 ${diagramsOpen ? "" : "-rotate-90"}`}
            >
              <ChevronDown />
            </span>
          </button>
          {diagramsOpen && (
            <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
              {diagrams.map((item) => {
                const type = item.diagram_type as DiagramType;
                const active = item.id === diagramId;
                return (
                  <li key={item.id} className="group flex items-stretch gap-1">
                    <button
                      className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-[9px] border p-[7px] text-left transition-[background,border-color,box-shadow] hover:border-line hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none ${active ? "border-green-line bg-green-soft shadow-[0_0_0_3px_var(--green-ring)] hover:bg-green-soft" : "border-transparent"}`}
                      onClick={() => openSaved(item.id)}
                      aria-current={active ? "true" : undefined}
                      title={`Open “${item.title}”`}
                      style={(() => {
                        const [bg, line, ink] = tintFor(type);
                        return {
                          "--tint": bg,
                          "--tint-line": line,
                          "--tint-ink": ink,
                        } as CSSProperties;
                      })()}
                    >
                      <span
                        className="grid size-[30px] shrink-0 place-items-center rounded-[7px] border border-[var(--tint-line)] bg-[var(--tint)] text-[var(--tint-ink)]"
                        aria-hidden="true"
                      >
                        <TypeGlyph type={type} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold leading-[1.3] text-ink group-hover:text-green-deep">
                          {item.title}
                        </span>
                        <span className="mt-[2px] block truncate text-[10.5px] leading-[1.4] text-slate-soft">
                          {TYPE_LABEL[type] ?? "Diagram"} ·{" "}
                          {timeAgo(item.updated_at)}
                        </span>
                      </span>
                      {active && (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-green"
                          aria-label="Open"
                        />
                      )}
                    </button>
                    <button
                      className="grid w-7 shrink-0 place-items-center self-center rounded-[8px] border-none text-slate-soft opacity-0 transition-opacity hover:bg-paper hover:text-red max-[1240px]:hidden [&_svg]:size-3.5 group-focus-within:opacity-100 group-hover:opacity-100 -translate-x-0.5"
                      onClick={() => void removeSaved(item.id)}
                      title="Delete"
                      aria-label={`Delete “${item.title}”`}
                    >
                      <Trash />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {diagramsFailed && (
        <p className="text-xs leading-[1.55] text-slate">
          Couldn&apos;t load your saved diagrams.
        </p>
      )}

      {failed && (
        <p className="text-xs leading-[1.55] text-slate">
          Templates didn&apos;t load. Check the API is running on port 8000,
          then reload.
        </p>
      )}

      {empty && (
        <p className="text-xs leading-[1.55] text-slate">
          No templates yet. Run{" "}
          <code className="rounded-[3px] bg-paper px-1 py-px font-mono text-[11px]">
            uv run python -m scripts.seed_templates
          </code>{" "}
          in the backend.
        </p>
      )}

      {!failed && templates.length > 0 && filtered.length === 0 && (
        <p className="m-0 text-xs leading-[1.5] text-slate">
          Nothing matches “{query}”.
          <button
            className="border-none bg-transparent p-0 text-xs font-[550] text-green-deep underline"
            onClick={() => setQuery("")}
          >
            Clear search
          </button>
        </p>
      )}

      {[...grouped].map(([category, items]) => {
        const isClosed = collapsed.has(category);
        return (
          <section
            key={category}
            className="border-b border-line pb-[9px] last:border-b-0"
            aria-label={category}
          >
            <button
              className="group flex w-full items-center justify-between gap-2 border-none bg-transparent p-1 px-0.5 text-left"
              onClick={() => toggleGroup(category)}
              aria-expanded={!isClosed}
            >
              <span className="flex items-center gap-1.5 text-[11.5px] font-[650] capitalize tracking-[-0.003em] text-slate transition-colors group-hover:text-ink">
                {category}
                <span className="rounded-[10px] bg-paper px-[6px] text-[10px] font-[550] text-slate-soft">
                  {items.length}
                </span>
              </span>
              <span
                className={`text-slate-soft transition-transform duration-200 [&_svg]:size-3.5 ${isClosed ? "-rotate-90" : ""}`}
              >
                <ChevronDown />
              </span>
            </button>
            {!isClosed && (
              <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                {items.map((template) => {
                  const active = template.name === docTitle;
                  const loading = active && creating;
                  return (
                    <li key={template.slug}>
                      <button
                        className={`group relative flex w-full items-start gap-2.5 rounded-[9px] border p-[7px] text-left transition-[background,border-color,box-shadow] hover:border-line hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none ${active ? "border-green-line bg-green-soft shadow-[0_0_0_3px_var(--green-ring)] hover:bg-green-soft" : "border-transparent"} ${loading ? "pointer-events-none" : ""}`}
                        disabled={creating}
                        aria-current={active ? "true" : undefined}
                        onClick={() => void use(template)}
                        style={(() => {
                          const [bg, line, ink] = tintFor(
                            template.diagram_type,
                          );
                          return {
                            "--tint": bg,
                            "--tint-line": line,
                            "--tint-ink": ink,
                          } as CSSProperties;
                        })()}
                      >
                        <span
                          className="grid h-[38px] w-[46px] shrink-0 place-items-center overflow-hidden rounded-[7px] border border-[var(--tint-line)] bg-[var(--tint)] text-[var(--tint-ink)]"
                          aria-hidden="true"
                        >
                          <TemplateGlyph
                            slug={template.slug}
                            type={template.diagram_type}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="block truncate text-[12.5px] font-semibold leading-[1.3] text-ink group-hover:text-green-deep">
                              {template.name}
                            </span>
                            {active && (
                              <span className="size-1.5 shrink-0 rounded-full bg-green" />
                            )}
                          </span>
                          <span className="mt-[3px] line-clamp-2 text-[10.5px] leading-[1.45] text-slate">
                            {template.description}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-[20px] bg-[var(--tint)] px-[7px] py-[2px] text-[9px] font-[650] uppercase leading-[1.35] tracking-[0.045em] text-[var(--tint-ink)]">
                              {TYPE_LABEL[template.diagram_type]}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-[10px] leading-none text-slate-soft [&_svg]:size-2.5">
                              <CircleDot />
                              {template.data.nodes?.length ?? 0} steps
                            </span>
                            {(template.data.lanes?.length ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] leading-none text-slate-soft [&_svg]:size-2.5">
                                <Layers />
                                {template.data.lanes.length}
                              </span>
                            )}
                          </span>
                        </span>
                        <span
                          className={`grid size-5 shrink-0 place-items-center self-center rounded-md border bg-surface text-slate transition-opacity duration-150 [&_svg]:size-[11px] ${active ? "border-green-line text-green opacity-100" : "border-line translate-x-0 opacity-0 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 group-hover:translate-x-0 group-hover:opacity-100"} ${loading ? "border-green-line text-green opacity-100 animate-[rail-pulse_900ms_ease-in-out_infinite]" : ""}`}
                        >
                          {active ? <Check /> : <ExtractNote />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {!empty && (
        <div className="mt-auto border-t border-line pt-2.5">
          <button
            className="flex w-full items-center justify-center gap-[7px] rounded-md border border-line bg-surface p-[7px] text-xs font-semibold text-slate transition-all hover:border-green hover:bg-green-soft hover:text-green-deep disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5"
            onClick={startBlank}
            disabled={busy !== null}
          >
            <Plus />
            Create Custom Template
          </button>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ assets */

type AssetTab = "shapes" | "icons" | "image";
type IconFilter =
  | "all"
  | IconAsset["category"]
  | "aws"
  | "azure";

const ICON_FILTERS: { key: IconFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "business", label: "Business" },
  { key: "it", label: "IT" },
  { key: "data", label: "Data" },
  { key: "logistics", label: "Logistics" },
  { key: "general", label: "General" },
  { key: "aws", label: "AWS" },
  { key: "azure", label: "Azure" },
];

const iconFilterOf = (asset: IconAsset): IconFilter => {
  if (asset.key.startsWith("aws-")) return "aws";
  if (asset.key.startsWith("az-")) return "azure";
  return asset.category;
};

const RECENT_KEY = "diagramcopilot.recent-icons";
function loadRecentIcons(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    const parsed = stored ? (JSON.parse(stored) as unknown) : null;
    return Array.isArray(parsed)
      ? parsed.filter((k): k is string => typeof k === "string")
      : [];
  } catch {
    return [];
  }
}
function saveRecentIcons(keys: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(keys));
  } catch {
    // private mode / quota — the session just won't remember recents
  }
}

function AssetsPane() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [tab, setTab] = useState<AssetTab>("icons");
  const { addShape, addImage, addImageDataUrl } = useCanvasAssets();
  // Select the stable `nodes` reference and filter in a memo — filtering
  // inline inside the selector hands zustand a new array every render, which
  // it reads as "state changed" and re-renders forever.
  const nodes = useDiagram((s) => s.doc.nodes);
  const images = useMemo(() => nodes.filter((n) => n.image_url), [nodes]);

  const [iconPrompt, setIconPrompt] = useState("");
  const [iconBusy, setIconBusy] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);
  const [iconResult, setIconResult] = useState<{
    prompt: string;
    svg: string;
  } | null>(null);

  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<IconFilter>("all");
  const [recentKeys, setRecentKeys] = useState<string[]>(loadRecentIcons);

  const libraryNeedle = libraryQuery.trim().toLowerCase();
  const filteredIcons = useMemo(() => {
    return ICON_CATALOG.filter((asset) => {
      if (libraryFilter !== "all" && iconFilterOf(asset) !== libraryFilter)
        return false;
      if (!libraryNeedle) return true;
      return [asset.label, asset.category]
        .concat(asset.keywords)
        .join(" ")
        .toLowerCase()
        .includes(libraryNeedle);
    });
  }, [libraryFilter, libraryNeedle]);

  const recentAssets = useMemo(() => {
    const byKey = new Map(ICON_CATALOG.map((asset) => [asset.key, asset]));
    return recentKeys
      .map((key) => byKey.get(key))
      .filter((asset): asset is IconAsset => Boolean(asset));
  }, [recentKeys]);

  const categoryCounts = useMemo(() => {
    const counts: Record<IconFilter, number> = {
      all: ICON_CATALOG.length,
      business: 0,
      it: 0,
      data: 0,
      logistics: 0,
      general: 0,
      cloud: 0,
      aws: 0,
      azure: 0,
    };
    for (const asset of ICON_CATALOG) counts[iconFilterOf(asset)] += 1;
    return counts;
  }, []);

  const recordRecent = (key: string) => {
    setRecentKeys((prev) => {
      const next = [key, ...prev.filter((k) => k !== key)].slice(0, 10);
      saveRecentIcons(next);
      return next;
    });
  };

  const addLibraryIcon = (asset: IconAsset) => {
    recordRecent(asset.key);
    addImageDataUrl(iconToDataUrl(asset.Icon), asset.label, undefined, {
      width: 56,
      height: 56,
    });
  };

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file?.type.startsWith("image/")) addImage(file);
  };

  const iconDataUrl = (svg: string) =>
    `data:image/svg+xml,${encodeURIComponent(svg)}`;

  const generateIcon = async () => {
    const prompt = iconPrompt.trim();
    if (!prompt || iconBusy) return;
    setIconBusy(true);
    setIconError(null);
    try {
      const { svg } = await api.generateIcon(prompt);
      setIconResult({ prompt, svg });
    } catch (error) {
      setIconError(
        error instanceof Error ? error.message : "Couldn't draw that icon.",
      );
    } finally {
      setIconBusy(false);
    }
  };

  const addIconToCanvas = () => {
    if (!iconResult) return;
    addImageDataUrl(iconDataUrl(iconResult.svg), iconResult.prompt, undefined, {
      width: 72,
      height: 72,
    });
    setIconResult(null);
    setIconPrompt("");
  };

  const tabBtn = (key: AssetTab, label: string, icon: ReactNode) => (
    <button
      role="tab"
      aria-selected={tab === key}
      className={`inline-flex items-center justify-center gap-1.5 rounded-[7px] border-none px-1.5 py-[5px] text-[11px] font-[650] tracking-[0.01em] transition-colors [&_svg]:size-[12px] ${tab === key ? "bg-green-soft text-green-strong shadow-2" : "text-slate hover:bg-surface hover:text-ink"}`}
      onClick={() => setTab(key)}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="mb-3 grid shrink-0 grid-cols-3 gap-[3px] rounded-xl border border-line bg-surface-2 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.035)]"
        role="tablist"
        aria-label="What to add"
      >
        {tabBtn("shapes", "Shapes", <Square />)}
        {tabBtn("icons", "Icons", <Grid />)}
        {tabBtn("image", "Image", <Upload />)}
      </div>

      {tab === "shapes" && (
        <div>
          <p className="mx-0.5 mt-1 flex items-center gap-1.5 text-[10.5px] font-[650] uppercase tracking-[0.07em] text-slate-soft">
            <Sparkles /> Shapes
          </p>
          <div className="mt-2 grid grid-cols-4 gap-[7px]">
            {ASSET_LIBRARY.map((asset) => (
              <button
                key={asset.kind}
                className="grid aspect-square cursor-grab place-items-center rounded-md border border-line bg-surface text-slate transition-[border-color,color,background] hover:border-green hover:bg-green-soft hover:text-green active:cursor-grabbing [&_svg]:size-[17px]"
                title={`${asset.label} — click or drag onto the canvas`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "application/copilot-asset",
                    asset.kind,
                  );
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => addShape(asset.kind, asset.label, undefined, asset.size)}
              >
                {asset.icon()}
              </button>
            ))}
          </div>
          <p className="m-0 mt-1.5 text-[10.5px] leading-[1.45] text-slate-soft">
            Click a shape to add it, or drag it onto the canvas.
          </p>
        </div>
      )}

      {tab === "icons" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <label className="relative block shrink-0">
            <span className="pointer-events-none absolute left-[9px] top-1/2 -translate-y-1/2 text-slate-soft [&_svg]:size-[13px]">
              <Search />
            </span>
            <input
              type="search"
              value={libraryQuery}
              onChange={(event) => setLibraryQuery(event.target.value)}
              placeholder="Search icons… (cloud, truck, lock…)"
              className="w-full rounded-md border border-line bg-paper py-[7px] pl-[27px] pr-2.5 text-[12px] text-ink outline-none transition-[border-color,background,box-shadow] placeholder:text-slate-soft focus:border-green focus:bg-surface focus:shadow-[0_0_0_3px_var(--green-ring)]"
              aria-label="Search icon library"
            />
          </label>

          <div className="no-scrollbar -mx-0.5 mt-2 flex shrink-0 gap-1 overflow-x-auto px-0.5 pb-0.5">
            {ICON_FILTERS.map((filter) => {
              const count = categoryCounts[filter.key];
              const active = libraryFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-[600] leading-none transition-colors ${active ? "border-green-line bg-green-soft text-green-strong" : "border-line bg-surface text-slate hover:border-line-strong hover:text-ink"}`}
                  onClick={() => setLibraryFilter(filter.key)}
                >
                  {filter.label}
                  <span
                    className={`text-[9.5px] font-[550] ${active ? "text-green" : "text-slate-soft"}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {recentAssets.length > 0 && (
            <div className="mt-2.5 shrink-0">
              <p className="mx-0.5 flex items-center justify-between text-[10.5px] font-[650] uppercase tracking-[0.07em] text-slate-soft">
                Recently used
                <button
                  className="border-none bg-transparent p-0 text-[10px] font-[550] text-slate-soft underline hover:text-red"
                  onClick={() => {
                    setRecentKeys([]);
                    saveRecentIcons([]);
                  }}
                >
                  Clear
                </button>
              </p>
              <div className="mt-1.5 grid grid-cols-8 gap-[5px]">
                {recentAssets.map((asset) => (
                  <button
                    key={asset.key}
                    className="grid aspect-square cursor-pointer place-items-center rounded-md border border-line bg-surface text-slate transition-[border-color,color,background] hover:border-green hover:bg-green-soft hover:text-green [&_svg]:size-4"
                    title={`${asset.label} — click to add again`}
                    onClick={() => addLibraryIcon(asset)}
                  >
                    <asset.Icon size={16} strokeWidth={1.7} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mx-0.5 mt-2.5 shrink-0 text-[10.5px] font-[650] uppercase tracking-[0.07em] text-slate-soft">
            Icon library
          </p>

          {filteredIcons.length === 0 ? (
            <p className="m-0 mt-2 text-xs leading-[1.5] text-slate">
              Nothing matches &ldquo;{libraryQuery}&rdquo;.
            </p>
          ) : (
            <div className="mt-1.5 grid min-h-0 flex-1 grid-cols-4 content-start gap-[7px] overflow-y-auto pb-1 pr-0.5 no-scrollbar">
              {filteredIcons.map((asset) => (
                <button
                  key={asset.key}
                  className="grid aspect-square cursor-grab place-items-center rounded-md border border-line bg-surface text-slate transition-[border-color,color,background] hover:border-green hover:bg-green-soft hover:text-green active:cursor-grabbing [&_svg]:size-[16px]"
                  title={`${asset.label} — click or drag onto the canvas`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/copilot-icon",
                      asset.key,
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => addLibraryIcon(asset)}
                >
                  <asset.Icon size={16} strokeWidth={1.7} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "image" && (
        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 pb-1 no-scrollbar">
          <div
            className={`cursor-pointer rounded-xl border-[1.5px] border-dashed border-line-strong bg-paper p-[22px] text-center transition-colors hover:border-green hover:bg-green-soft [&_svg]:mx-auto [&_svg]:size-5 [&_svg]:text-green ${dragOver ? "border-green bg-green-soft" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ")
                fileRef.current?.click();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              onFiles(event.dataTransfer.files);
            }}
          >
            <Upload />
            <p className="mb-0.5 mt-[9px] text-[12.5px] font-semibold text-ink">
              Upload image
            </p>
            <small className="text-[11px] leading-[1.4] text-slate">
              Drag &amp; drop, or click to browse · PNG, JPG, SVG
            </small>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              onFiles(event.target.files);
              event.target.value = "";
            }}
          />

          <div>
            <p className="mx-0.5 mt-1 flex items-center gap-1.5 text-[10.5px] font-[650] uppercase tracking-[0.07em] text-slate-soft">
              <Sparkles /> Generate an icon
            </p>
            <div className="mt-2 space-y-1.5">
              <input
                value={iconPrompt}
                onChange={(event) => setIconPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void generateIcon();
                  }
                }}
                placeholder="e.g. a padlock, a forklift…"
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none placeholder:text-slate-soft focus-visible:border-green"
              />
              <button
                type="button"
                onClick={() => void generateIcon()}
                disabled={!iconPrompt.trim() || iconBusy}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-green bg-green px-3 py-2 text-[12.5px] font-semibold text-on-accent transition-colors hover:border-green-strong hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-45"
              >
                {iconBusy ? (
                  <span className="icon-gen__spin" aria-hidden="true" />
                ) : (
                  "Generate icon"
                )}
              </button>
            </div>

            {iconError && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-[550] text-red">
                <Alert /> {iconError}
              </p>
            )}

            {iconResult && (
              <div className="mt-2 flex items-center gap-2.5 rounded-md border border-line bg-surface p-1.5">
                <span
                  className="h-[42px] w-[42px] shrink-0 rounded-[6px] border border-line bg-paper bg-contain bg-center bg-no-repeat p-1.5"
                  style={{ backgroundImage: `url(${iconDataUrl(iconResult.svg)})` }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                  {iconResult.prompt}
                </span>
                <button
                  type="button"
                  onClick={addIconToCanvas}
                  className="shrink-0 rounded-md border border-green bg-green-soft px-2 py-1 text-[11.5px] font-semibold text-green transition-colors hover:bg-green hover:text-white"
                >
                  Add to canvas
                </button>
              </div>
            )}
          </div>

          {images.length > 0 && (
            <div>
              <p className="mx-0.5 mt-3.5 text-[10.5px] font-[650] uppercase tracking-[0.07em] text-slate-soft">
                In this diagram
              </p>
              <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                {images.map((node) => (
                  <li
                    key={node.id}
                    className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-surface-2"
                  >
                    <span
                      className="h-[30px] w-[42px] shrink-0 rounded-[6px] border border-line bg-paper bg-cover bg-center"
                      style={{ backgroundImage: `url(${node.image_url})` }}
                      aria-hidden="true"
                    />
                    <span className="flex min-w-0 flex-col gap-px">
                      <b className="truncate text-[12.5px] font-medium text-ink">
                        {node.label}
                      </b>
                      <small className="text-[11px] text-slate-soft">
                        {node.size.width} × {node.size.height} · on canvas
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ rail itself */

export function TemplateRail() {
  const [pane, setPane] = useState<"templates" | "assets">("templates");

  return (
    <nav
      className="flex min-h-0 flex-col border-r border-line bg-surface max-[900px]:hidden"
      aria-label="Template and asset library"
    >
      <div
        className="mx-2.5 mb-1 mt-2.5 grid shrink-0 grid-cols-2 gap-[3px] rounded-xl border border-line bg-surface-2 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.035)]"
        role="tablist"
      >
        <button
          role="tab"
          aria-selected={pane === "templates"}
          className={`inline-flex items-center justify-center gap-1.5 rounded-[9px] border-none px-2 pb-2 pt-[7px] text-xs font-[650] tracking-[0.01em] transition-colors [&_svg]:size-[13px] ${pane === "templates" ? "bg-green-soft text-green-strong shadow-2" : "text-slate hover:bg-surface hover:text-ink"}`}
          onClick={() => setPane("templates")}
        >
          <Layers />
          Templates
        </button>
        <button
          role="tab"
          aria-selected={pane === "assets"}
          className={`inline-flex items-center justify-center gap-1.5 rounded-[9px] border-none px-2 pb-2 pt-[7px] text-xs font-[650] tracking-[0.01em] transition-colors [&_svg]:size-[13px] ${pane === "assets" ? "bg-green-soft text-green-strong shadow-2" : "text-slate hover:bg-surface hover:text-ink"}`}
          onClick={() => setPane("assets")}
        >
          <FileImage />
          Assets
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-[18px] pt-3.5 no-scrollbar">
        {pane === "templates" ? <TemplatesPane /> : <AssetsPane />}
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-3 pb-3 pt-2.5">
        <UserChip />
      </div>
    </nav>
  );
}
