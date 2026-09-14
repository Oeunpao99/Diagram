import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { api } from "../api/client";
import {
  emptyDoc,
  normalizeDoc,
  type DiagramListItem,
  type DiagramType,
  type Template,
} from "../api/types";
import { useCanvasAssets } from "../hooks/useCanvasAssets";
import { useDiagram } from "../store/useDiagram";
import { ASSET_LIBRARY } from "./assetLibrary";
import {
  Alert,
  Check,
  ChevronDown,
  CircleDot,
  ExtractNote,
  FileImage,
  Layers,
  Plus,
  Search,
  Sparkles,
  Trash,
  Upload,
} from "./icons";
import { UserChip } from "./UserChip";

const TYPE_LABEL: Record<DiagramType, string> = {
  process_flow: "Process",
  swimlane: "Swimlane",
  architecture: "Architecture",
  network: "Network",
  sequence: "Sequence",
  er: "Entity-rel.",
  data_flow: "Data flow",
  org_chart: "Org chart",
  mind_map: "Mind map",
};

/** Tint (bg, border, ink) per diagram type, matching the old rail thumb hues. */
const TYPE_HUE: Record<DiagramType, string> = {
  process_flow: "violet",
  swimlane: "blue",
  architecture: "navy",
  network: "teal",
  sequence: "amber",
  er: "pink",
  data_flow: "green",
  org_chart: "orange",
  mind_map: "red",
};

const TINT: Record<string, [string, string, string]> = {
  violet: ["#f1eefc", "#e2dcf8", "#6a5bd5"],
  blue: ["#ebf0fc", "#dae4f7", "#4a76cf"],
  navy: ["#eaf0f6", "#d6e0ea", "#48617e"],
  teal: ["#e4f4f5", "#cfe8ea", "#2b8a94"],
  amber: ["#f8f0de", "#efdfbc", "#b57a22"],
  pink: ["#fae9f1", "#f2d4e2", "#b84b78"],
  green: ["#e2f4ec", "#c9e9d9", "#1d9a6c"],
  orange: ["#faece3", "#f2d7c7", "#c1763a"],
  red: ["#fae8e6", "#f2d2cf", "#c6574f"],
};

function tintFor(type: DiagramType) {
  const hue = TYPE_HUE[type];
  return TINT[hue] ?? ["#eaf0f6", "#d6e0ea", "#48617e"];
}

/** Backend categories are lowercase slugs; present them product-first. */
const CATEGORY_LABEL: Record<string, string> = {
  it: "Software",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

/** Compact "x min ago"-style age for the saved-diagrams list. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}


/** A clean 20x20 mark per diagram type, drawn in the current tint ink. */
function TypeGlyph({ type }: { type: DiagramType }) {
  const s = {
    viewBox: "0 0 24 24",
    width: 20,
    height: 20,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (type) {
    case "swimlane":
      return (
        <svg {...s}>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <path d="M9 6v12" opacity="0.45" />
        </svg>
      );
    case "architecture":
      return (
        <svg {...s}>
          <rect x="4" y="4.5" width="16" height="4.6" rx="1.4" />
          <rect x="6" y="14.9" width="12" height="4.6" rx="1.4" />
        </svg>
      );
    case "network":
      return (
        <svg {...s}>
          <circle cx="7" cy="17" r="3.2" />
          <circle cx="17" cy="7" r="3.2" />
          <circle cx="17.7" cy="16.6" r="1.1" opacity="0.5" />
          <path d="M9.2 15.3 14.8 8.7" />
        </svg>
      );
    case "sequence":
      return (
        <svg {...s}>
          <path d="M7 3.5v17M17 3.5v17" strokeDasharray="2 2.4" />
          <path d="M7.6 8.2h6.8M11.6 10.7l2.8-2.5L11.6 5.7" />
          <path d="M16.4 13.8H9.6M12.4 16.3l-2.8 2.5 2.8 2.5" />
        </svg>
      );
    case "er":
      return (
        <svg {...s}>
          <rect x="4" y="3.5" width="16" height="17" rx="2" />
          <path d="M4 8.2h16" />
          <path d="M7.4 8.2V5.4h2.4" />
          <circle cx="8.2" cy="11.6" r="1" fill="currentColor" stroke="none" />
          <path d="M10.8 11.6h7" />
          <circle cx="8.2" cy="15.8" r="1" fill="currentColor" stroke="none" />
          <path d="M10.8 15.8h7" />
        </svg>
      );
    case "org_chart":
      return (
        <svg {...s}>
          <rect x="8" y="3" width="8" height="4.8" rx="1.5" />
          <rect x="3.5" y="16.2" width="7" height="4.8" rx="1.5" />
          <rect x="13.5" y="16.2" width="7" height="4.8" rx="1.5" />
          <path d="M12 7.8v2.2M12 10H7.3M12 10h4.7M7.3 10v6.2M16.7 10v6.2" />
        </svg>
      );
    case "mind_map":
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="3.6" />
          <path d="M3 6.5h4.4M3 12h4.4M3 17.5h4.4M16.6 6.5H21M16.6 12H21M16.6 17.5H21" />
        </svg>
      );
    case "data_flow":
      return (
        <svg {...s}>
          <path d="M5.5 8c0-2.2 2.9-4 6.5-4s6.5 1.8 6.5 4-2.9 4-6.5 4-6.5-1.8-6.5-4Z" opacity="0.9" />
          <path d="M5.5 8v7c0 2.2 2.9 4 6.5 4s6.5-1.8 6.5-4V8" />
          <path d="M5.5 11.5c0 2.2 2.9 4 6.5 4s6.5-1.8 6.5-4" opacity="0.4" />
          <path d="M12 21v-1.8M9.5 20l2.5 1.6 2.5-1.6" />
        </svg>
      );
    default:
      return (
        <svg {...s}>
          <rect x="3" y="7" width="6.5" height="10" rx="2" />
          <path d="M12.5 12h5.2M15 9.5l2.7 2.5-2.7 2.5" />
        </svg>
      );
  }
}
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
      [template.name, template.description ?? "", categoryLabel(template.category), TYPE_LABEL[template.diagram_type]]
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
        <Search />
        <input
          ref={searchRef}
          type="search"
          className="w-full rounded-md border border-line bg-paper py-[7px] pl-[30px] pr-2.5 text-[12.5px] text-ink outline-none transition-[border-color,background,box-shadow] placeholder:text-slate-soft focus:border-green focus:bg-surface focus:shadow-[0_0_0_3px_var(--green-ring)]"
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
          <span className="block text-[12.5px] font-semibold leading-[1.25] text-ink">Blank diagram</span>
          <span className="mt-0.5 block text-[10.5px] leading-[1.4] text-slate-soft">
            Start from an empty canvas
          </span>
        </span>
        {!hasNodes && (
          <span className="ml-auto grid size-[18px] shrink-0 place-items-center rounded-full text-green [&_svg]:size-3 [&_svg]:stroke-[2.4]" title="Blank canvas active">
            <Check />
          </span>
        )}
      </button>

      {diagrams.length > 0 && (
        <section className="border-b border-line pb-[9px]" aria-label="My diagrams">
          <button
            className="group flex w-full items-center justify-between gap-2 border-none bg-transparent p-1 px-0.5 text-left"
            onClick={() => setDiagramsOpen((v) => !v)}
            aria-expanded={diagramsOpen}
          >
            <span className="flex items-center gap-1.5 text-[11.5px] font-[650] text-slate transition-colors group-hover:text-ink">
              My diagrams
              <span className="rounded-[10px] bg-paper px-[6px] text-[10px] font-[550] text-slate-soft">{diagrams.length}</span>
            </span>
            <span className={`text-slate-soft transition-transform duration-200 [&_svg]:size-3.5 ${diagramsOpen ? "" : "-rotate-90"}`}>
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
                      style={
                        (() => {
                          const [bg, line, ink] = tintFor(type);
                          return { "--tint": bg, "--tint-line": line, "--tint-ink": ink } as CSSProperties;
                        })()
                      }
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
                          {TYPE_LABEL[type] ?? "Diagram"} · {timeAgo(item.updated_at)}
                        </span>
                      </span>
                      {active && <span className="size-1.5 shrink-0 rounded-full bg-green" aria-label="Open" />}
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
        <p className="text-xs leading-[1.55] text-slate">Couldn&apos;t load your saved diagrams.</p>
      )}

      {failed && (
        <p className="text-xs leading-[1.55] text-slate">
          Templates didn&apos;t load. Check the API is running on port 8000, then reload.
        </p>
      )}

      {empty && (
        <p className="text-xs leading-[1.55] text-slate">
          No templates yet. Run <code className="rounded-[3px] bg-paper px-1 py-px font-mono text-[11px]">uv run python -m scripts.seed_templates</code> in the backend.
        </p>
      )}

      {!failed && templates.length > 0 && filtered.length === 0 && (
        <p className="m-0 text-xs leading-[1.5] text-slate">
          Nothing matches “{query}”.
          <button className="border-none bg-transparent p-0 text-xs font-[550] text-green-deep underline" onClick={() => setQuery("")}>
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
                <span className="rounded-[10px] bg-paper px-[6px] text-[10px] font-[550] text-slate-soft">{items.length}</span>
              </span>
              <span className={`text-slate-soft transition-transform duration-200 [&_svg]:size-3.5 ${isClosed ? "-rotate-90" : ""}`}>
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
                        style={
                          (() => {
                            const [bg, line, ink] = tintFor(template.diagram_type);
                            return { "--tint": bg, "--tint-line": line, "--tint-ink": ink } as CSSProperties;
                          })()
                        }
                      >
                        <span
                          className="grid h-[38px] w-[46px] shrink-0 place-items-center overflow-hidden rounded-[7px] border border-[var(--tint-line)] bg-[var(--tint)] text-[var(--tint-ink)]"
                          aria-hidden="true"
                        >
                          <TypeGlyph type={template.diagram_type} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="block truncate text-[12.5px] font-semibold leading-[1.3] text-ink group-hover:text-green-deep">{template.name}</span>
                            {active && <span className="size-1.5 shrink-0 rounded-full bg-green" />}
                          </span>
                          <span className="mt-[3px] line-clamp-2 text-[10.5px] leading-[1.45] text-slate">{template.description}</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-[20px] bg-[var(--tint)] px-[7px] py-[2px] text-[9px] font-[650] uppercase leading-[1.35] tracking-[0.045em] text-[var(--tint-ink)]">
                              {TYPE_LABEL[template.diagram_type]}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-[10px] leading-none text-slate-soft [&_svg]:size-2.5">
                              <CircleDot />
                              {(template.data.nodes?.length ?? 0)} steps
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

function AssetsPane() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { addShape, addImage, addImageDataUrl } = useCanvasAssets();
  // Select the stable `nodes` reference and filter in a memo — filtering
  // inline inside the selector hands zustand a new array every render, which
  // it reads as "state changed" and re-renders forever.
  const nodes = useDiagram((s) => s.doc.nodes);
  const images = useMemo(() => nodes.filter((n) => n.image_url), [nodes]);

  const [iconPrompt, setIconPrompt] = useState("");
  const [iconBusy, setIconBusy] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);
  const [iconResult, setIconResult] = useState<{ prompt: string; svg: string } | null>(null);

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file?.type.startsWith("image/")) addImage(file);
  };

  const iconDataUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

  const generateIcon = async () => {
    const prompt = iconPrompt.trim();
    if (!prompt || iconBusy) return;
    setIconBusy(true);
    setIconError(null);
    try {
      const { svg } = await api.generateIcon(prompt);
      setIconResult({ prompt, svg });
    } catch (error) {
      setIconError(error instanceof Error ? error.message : "Couldn't draw that icon.");
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

  return (
    <>
      <div
        className={`cursor-pointer rounded-xl border-[1.5px] border-dashed border-line-strong bg-paper p-[22px] text-center transition-colors hover:border-green hover:bg-green-soft [&_svg]:mx-auto [&_svg]:size-5 [&_svg]:text-green ${dragOver ? "border-green bg-green-soft" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") fileRef.current?.click();
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
        <p className="mb-0.5 mt-[9px] text-[12.5px] font-semibold text-ink">Upload image</p>
        <small className="text-[11px] leading-[1.4] text-slate">Drag &amp; drop, or click to browse · PNG, JPG, SVG</small>
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

      <div className="border-b border-line pb-[9px] last:border-b-0">
        <p className="mx-0.5 mt-1 flex items-center gap-1.5 text-[10.5px] font-[650] uppercase tracking-[0.07em] text-slate-soft">
          <Sparkles /> Generate an icon
        </p>
        <div className="mt-2 flex gap-1.5">
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
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 py-[7px] text-[12.5px] text-ink outline-none placeholder:text-slate-soft focus-visible:border-green"
          />
          <button
            type="button"
            onClick={() => void generateIcon()}
            disabled={!iconPrompt.trim() || iconBusy}
            className="shrink-0 rounded-md border border-green bg-green px-2.5 text-[12px] font-semibold text-on-accent transition-colors hover:border-green-strong hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-45"
          >
            {iconBusy ? <span className="icon-gen__spin" aria-hidden="true" /> : "Generate"}
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
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{iconResult.prompt}</span>
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

      <div className="border-b border-line pb-[9px] last:border-b-0">
        <p className="mx-0.5 mt-1 flex items-center gap-1.5 text-[10.5px] font-[650] uppercase tracking-[0.07em] text-slate-soft">
          <Sparkles /> Icon library
        </p>
        <div className="mt-2 grid grid-cols-4 gap-[7px]">
          {ASSET_LIBRARY.map((asset) => (
            <button
              key={asset.kind}
              className="grid aspect-square cursor-grab place-items-center rounded-md border border-line bg-surface text-slate transition-[border-color,color,background] hover:border-green hover:bg-green-soft hover:text-green active:cursor-grabbing [&_svg]:size-[17px]"
              title={`${asset.label} — click or drag onto the canvas`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/copilot-asset", asset.kind);
                event.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => addShape(asset.kind, asset.label)}
            >
              {asset.icon()}
            </button>
          ))}
        </div>
      </div>

      {images.length > 0 && (
        <div className="border-b border-line pb-[9px] last:border-b-0">
          <p className="mx-0.5 mt-1 text-[10.5px] font-[650] uppercase tracking-[0.07em] text-slate-soft">
            In this diagram
          </p>
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
            {images.map((node) => (
              <li key={node.id} className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-surface-2">
                <span
                  className="h-[30px] w-[42px] shrink-0 rounded-[6px] border border-line bg-paper bg-cover bg-center"
                  style={{ backgroundImage: `url(${node.image_url})` }}
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-col gap-px">
                  <b className="truncate text-[12.5px] font-medium text-ink">{node.label}</b>
                  <small className="text-[11px] text-slate-soft">
                    {node.size.width} × {node.size.height} · on canvas
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------ rail itself */

export function TemplateRail() {
  const [pane, setPane] = useState<"templates" | "assets">("templates");

  return (
    <nav className="flex min-h-0 flex-col border-r border-line bg-surface max-[900px]:hidden" aria-label="Template and asset library">
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
