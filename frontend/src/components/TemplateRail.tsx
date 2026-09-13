import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { api } from "../api/client";
import {
  emptyDoc,
  normalizeDoc,
  type DiagramDoc,
  type DiagramEdge,
  type DiagramNode,
  type DiagramType,
  type Template,
} from "../api/types";
import { useCanvasAssets } from "../hooks/useCanvasAssets";
import { useDiagram } from "../store/useDiagram";
import { ASSET_LIBRARY } from "./assetLibrary";
import {
  Check,
  ChevronDown,
  CircleDot,
  ExtractNote,
  FileImage,
  Layers,
  Plus,
  Search,
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

/** Backend categories are lowercase slugs; present them product-first. */
const CATEGORY_LABEL: Record<string, string> = {
  it: "Software",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

/* ------------------------------------------------------------ mini preview */

function layering(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): Map<string, number> {
  const depth = new Map<string, number>();
  for (const n of nodes) depth.set(n.id, 0);
  for (let i = 0; i < nodes.length; i++) {
    let changed = false;
    for (const e of edges) {
      const s = depth.get(e.source);
      const t = depth.get(e.target) ?? 0;
      if (s !== undefined && s + 1 > t) {
        depth.set(e.target, s + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return depth;
}

function MiniPreview({ data }: { data: DiagramDoc }) {
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];
  const W = 46;
  const H = 38;
  const m = 5;

  if (nodes.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <g stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 2.5">
          <line x1="10" y1="12" x2="36" y2="12" />
          <line x1="10" y1="19" x2="31" y2="19" />
          <line x1="10" y1="26" x2="34" y2="26" />
        </g>
      </svg>
    );
  }

  const depth = layering(nodes, edges);
  const columns = new Map<number, string[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0;
    const list = columns.get(d) ?? [];
    list.push(n.id);
    columns.set(d, list);
  }

  const cols = Math.max(0, ...[...depth.values()]);
  const maxN = Math.max(1, ...[...columns.values()].map((ids) => ids.length));
  const f = maxN > 6 ? 0.62 : maxN > 4 ? 0.8 : 1;
  const w = 9.4 * f;
  const h = 6.6 * f;
  const colStep = cols > 1 ? (W - m * 2 - w) / (cols - 1) : 0;

  const geo = new Map<string, { x: number; y: number }>();
  for (const [d, ids] of columns) {
    const step = ids.length > 1 ? (H - m * 2 - h) / (ids.length - 1) : 0;
    ids.forEach((id, i) => {
      geo.set(id, { x: m + d * colStep, y: m + i * step });
    });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <g
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
        opacity="0.55"
        fill="none"
      >
        {edges.map((edge) => {
          const a = geo.get(edge.source);
          const b = geo.get(edge.target);
          if (!a || !b) return null;
          const ax = a.x + w;
          const ay = a.y + h / 2;
          const bx = b.x;
          const by = b.y + h / 2;
          const mx = (ax + bx) / 2;
          const d =
            Math.abs(ay - by) <= 2.5
              ? `M ${ax} ${ay} H ${bx}`
              : `M ${ax} ${ay} H ${mx} V ${by} H ${bx}`;
          return (
            <g key={edge.id}>
              <path d={d} />
              <path
                d={`M ${bx - 3.4} ${by - 2.2} L ${bx - 0.6} ${by} L ${bx - 3.4} ${by + 2.2}`}
                strokeWidth="1"
                opacity="0.9"
              />
            </g>
          );
        })}
      </g>
      {nodes.map((n) => {
        const p = geo.get(n.id);
        if (!p) return null;
        const cx = p.x + w / 2;
        const cy = p.y + h / 2;
        const stroke = { stroke: "currentColor", strokeWidth: 1.2 } as const;
        const fill = { fill: "var(--surface)" } as const;
        switch (n.kind) {
          case "decision": {
            const rx = w * 0.48;
            const ry = h * 0.58;
            return (
              <polygon
                key={n.id}
                points={`${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry} ${cx - rx},${cy}`}
                {...stroke}
                {...fill}
              />
            );
          }
          case "start":
          case "end":
          case "note":
            return (
              <rect
                key={n.id}
                x={p.x}
                y={p.y}
                width={w}
                height={h}
                rx={h / 2}
                {...stroke}
                {...fill}
              />
            );
          case "database": {
            const ry = h * 0.42;
            return (
              <g key={n.id}>
                <path
                  d={`M ${p.x} ${cy - ry} v ${h - ry * 2} a ${w / 2} ${ry} 0 0 0 ${w} 0 v ${-(h - ry * 2)} a ${w / 2} ${ry} 0 0 1 -${w} 0`}
                  {...stroke}
                  {...fill}
                />
                <path
                  d={`M ${p.x} ${cy - ry} a ${w / 2} ${ry} 0 0 0 ${w} 0`}
                  {...stroke}
                  fill="none"
                />
              </g>
            );
          }
          case "document":
          case "data":
          case "queue": {
            const fold = Math.min(3, w * 0.3);
            return (
              <g key={n.id}>
                <path
                  d={`M ${p.x} ${p.y} h ${w - fold} l ${fold} ${fold} v ${h - fold} h -${w} z`}
                  {...stroke}
                  {...fill}
                />
                <path
                  d={`M ${p.x + w - fold} ${p.y} v ${fold} h ${fold}`}
                  {...stroke}
                  fill="none"
                  opacity="0.6"
                />
                <g stroke="currentColor" strokeWidth="0.9" opacity="0.55">
                  <line x1={p.x + 1.5} y1={cy - 1} x2={p.x + w - 1.5} y2={cy - 1} />
                  <line x1={p.x + 1.5} y1={cy + 1} x2={p.x + w - 1.5} y2={cy + 1} />
                </g>
              </g>
            );
          }
          case "actor":
            return (
              <g key={n.id}>
                <circle cx={cx} cy={p.y + 2.1} r={1.6} {...stroke} {...fill} />
                <path
                  d={`M ${p.x + 1} ${p.y + h - 1} a ${w / 2 - 1} ${h * 0.42} 0 0 1 ${w - 2} 0`}
                  {...stroke}
                  fill="none"
                />
              </g>
            );
          case "cloud":
            return (
              <ellipse key={n.id} cx={cx} cy={cy} rx={w * 0.5} ry={h * 0.72} {...stroke} {...fill} />
            );
          default:
            return (
              <rect key={n.id} x={p.x} y={p.y} width={w} height={h} rx={1.8} {...stroke} {...fill} />
            );
        }
      })}
    </svg>
  );
}

/* -------------------------------------------------------------- templates */

function TemplatesPane() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const setDoc = useDiagram((s) => s.setDoc);
  const autoLayout = useDiagram((s) => s.autoLayout);
  const busy = useDiagram((s) => s.busy);
  const docTitle = useDiagram((s) => s.doc.title);
  const hasNodes = useDiagram((s) => s.doc.nodes.length > 0);

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
    setDoc(normalizeDoc(template.data));
    await autoLayout(template.data.direction);
  };

  const startBlank = () => setDoc(emptyDoc());

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
                          {
                            "--tint": TINT[template.diagram_type]?.[0],
                            "--tint-line": TINT[template.diagram_type]?.[1],
                            "--tint-ink": TINT[template.diagram_type]?.[2],
                          } as CSSProperties
                        }
                      >
                        <span
                          className="h-[38px] w-[46px] shrink-0 overflow-hidden rounded-[7px] border border-[var(--tint-line)] bg-[var(--tint)] text-[var(--tint-ink)] [&_svg]:absolute [&_svg]:inset-0 [&_svg]:h-full [&_svg]:w-full"
                          aria-hidden="true"
                        >
                          <MiniPreview data={template.data} />
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
  const { addShape, addImage } = useCanvasAssets();
  // Select the stable `nodes` reference and filter in a memo — filtering
  // inline inside the selector hands zustand a new array every render, which
  // it reads as "state changed" and re-renders forever.
  const nodes = useDiagram((s) => s.doc.nodes);
  const images = useMemo(() => nodes.filter((n) => n.image_url), [nodes]);

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file?.type.startsWith("image/")) addImage(file);
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
        <p className="mx-0.5 mt-1 text-[10.5px] font-[650] uppercase tracking-[0.07em] text-slate-soft">
          Icon library
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
