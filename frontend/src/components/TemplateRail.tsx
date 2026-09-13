import { useEffect, useMemo, useRef, useState } from "react";

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
import { useDiagram } from "../store/useDiagram";
import {
  Check,
  ChevronDown,
  CircleDot,
  ExtractNote,
  Layers,
  Plus,
  Search,
} from "./icons";

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

/* ------------------------------------------------------------ rail itself */

export function TemplateRail() {
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
    <nav className="rail" aria-label="Template library">
      <h2 className="rail__heading">
        Templates
        {templates.length > 0 && <span className="rail__count">{templates.length}</span>}
      </h2>

      <label className="rail__search">
        <Search />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search templates…"
          aria-label="Search templates"
        />
      </label>

      <button
        className="rail__blank"
        onClick={startBlank}
        disabled={busy !== null}
        aria-pressed={!hasNodes}
      >
        <span className="rail__glyph">
          <Plus />
        </span>
        <span>
          <span className="rail__blank-label">Blank diagram</span>
          <span className="rail__blank-desc">Start from an empty canvas</span>
        </span>
        {!hasNodes && (
          <span className="rail__blank-dot" title="Blank canvas active">
            <Check />
          </span>
        )}
      </button>

      {failed && (
        <p className="rail__empty">
          Templates didn&apos;t load. Check the API is running on port 8000, then reload.
        </p>
      )}

      {empty && (
        <p className="rail__empty">
          No templates yet. Run <code>uv run python -m scripts.seed_templates</code> in the backend.
        </p>
      )}

      {!failed && templates.length > 0 && filtered.length === 0 && (
        <p className="rail__none">
          Nothing matches “{query}”.
          <button onClick={() => setQuery("")}>Clear search</button>
        </p>
      )}

      {[...grouped].map(([category, items]) => {
        const isClosed = collapsed.has(category);
        return (
          <section
            key={category}
            className={`rail__group ${isClosed ? "is-closed" : "is-open"}`}
            aria-label={category}
          >
            <button
              className="rail__group-head"
              onClick={() => toggleGroup(category)}
              aria-expanded={!isClosed}
            >
              <span className="rail__group-title">
                {category}
                <span className="rail__group-count">{items.length}</span>
              </span>
              <span className="rail__group-chevron">
                <ChevronDown />
              </span>
            </button>
            {!isClosed && (
              <ul className="rail__list">
                {items.map((template) => {
                  const active = template.name === docTitle;
                  const loading = active && creating;
                  return (
                    <li key={template.slug}>
                      <button
                        className={`rail__card ${active ? "is-active" : ""} ${loading ? "is-busy" : ""}`}
                        disabled={creating}
                        aria-current={active ? "true" : undefined}
                        onClick={() => void use(template)}
                      >
                        <span
                          className={`rail__thumb rail__thumb--${TYPE_HUE[template.diagram_type]}`}
                          aria-hidden="true"
                        >
                          <MiniPreview data={template.data} />
                        </span>
                        <span className="rail__card-body">
                          <span className="rail__card-name-row">
                            <span className="rail__card-name">{template.name}</span>
                            {active && <span className="rail__card-live" />}
                          </span>
                          <span className="rail__card-desc">{template.description}</span>
                          <span className="rail__card-meta">
                            <span
                              className={`rail__tag rail__thumb--${TYPE_HUE[template.diagram_type]}`}
                            >
                              {TYPE_LABEL[template.diagram_type]}
                            </span>
                            <span className="rail__stat">
                              <CircleDot />
                              {(template.data.nodes?.length ?? 0)} steps
                            </span>
                            {(template.data.lanes?.length ?? 0) > 0 && (
                              <span className="rail__stat">
                                <Layers />
                                {template.data.lanes.length}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="rail__card-action">
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
        <div className="rail__footer">
          <button className="rail__create" onClick={startBlank} disabled={busy !== null}>
            <Plus />
            Create Custom Template
          </button>
        </div>
      )}
    </nav>
  );
}