import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import type { DiagramListItem, Project } from "../api/types";
import { DashboardShell } from "../components/DashboardShell";
import { DiagramCard } from "../components/DiagramCard";
import { Folder } from "../components/icons";
import { useDiagram } from "../store/useDiagram";

type Mode = "all" | "recent" | "favorites";

const COPY: Record<Mode, { title: string; subtitle: string; empty: string }> = {
  all: {
    title: "My Diagrams",
    subtitle: "Every diagram you've saved.",
    empty: "You haven't saved any diagrams yet — start one from the Template Library or a blank canvas.",
  },
  recent: {
    title: "Recent",
    subtitle: "Your most recently updated diagrams.",
    empty: "Nothing recent yet — diagrams you open or edit will show up here.",
  },
  favorites: {
    title: "Favorites",
    subtitle: "Diagrams you've starred for quick access.",
    empty: "No favorites yet — star a diagram from this list to pin it here.",
  },
};

/** A small "move to project" menu — only shown on the My Diagrams view,
 *  since it's the one place that lists diagrams regardless of which project
 *  (or none) they're already in. */
function ProjectMenu({
  item,
  projects,
  onMoved,
}: {
  item: DiagramListItem;
  projects: Project[];
  onMoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const move = async (projectId: string | null) => {
    setOpen(false);
    try {
      await api.setProject(item.id, projectId);
      onMoved();
    } catch {
      /* leave the list as-is on failure */
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        className={`grid size-7 shrink-0 place-items-center rounded-md border-none transition-colors [&_svg]:size-[13px] ${
          item.project_id
            ? "text-green"
            : "text-slate-soft opacity-0 hover:text-ink group-focus-within:opacity-100 group-hover:opacity-100"
        }`}
        onClick={() => setOpen((v) => !v)}
        title={item.project_id ? "Move to a different project" : "Add to a project"}
        aria-label="Assign project"
        aria-expanded={open}
      >
        <Folder />
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[170px] rounded-xl border border-line bg-surface p-[5px] shadow-3 animate-[menu-in_130ms_ease]"
          role="menu"
        >
          {projects.length === 0 && (
            <p className="px-2.5 py-2 text-[11.5px] text-slate-soft">No projects yet.</p>
          )}
          {projects.map((project) => (
            <button
              key={project.id}
              role="menuitem"
              className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-ink hover:bg-surface-2"
              onClick={() => void move(project.id)}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: project.color }}
                aria-hidden="true"
              />
              <span className="truncate">{project.name}</span>
            </button>
          ))}
          {item.project_id && (
            <button
              role="menuitem"
              className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-slate hover:bg-surface-2"
              onClick={() => void move(null)}
            >
              Remove from project
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DiagramsList({ mode }: { mode: Mode }) {
  const [items, setItems] = useState<DiagramListItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [rev, setRev] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    api
      .listDiagrams(mode === "recent" ? 12 : 100, mode === "favorites" ? true : undefined)
      .then((data) => {
        if (alive) setItems(data);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [mode, rev]);

  useEffect(() => {
    if (mode !== "all") return;
    api.listProjects().then(setProjects).catch(() => {});
  }, [mode, rev]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (needle ? items.filter((item) => item.title.toLowerCase().includes(needle)) : items),
    [items, needle],
  );

  const bump = () => setRev((v) => v + 1);

  const open = (id: string) => {
    void useDiagram.getState().loadDiagram(id);
    navigate("/");
  };

  const toggleFavorite = async (item: DiagramListItem) => {
    try {
      await api.setFavorite(item.id, !item.is_favorite);
      bump();
    } catch {
      /* leave the list as-is on failure */
    }
  };

  const remove = async (item: DiagramListItem) => {
    try {
      await api.deleteDiagram(item.id);
      bump();
    } catch {
      /* a failed delete just leaves the row alone */
    }
  };

  const copy = COPY[mode];

  return (
    <DashboardShell search={{ value: query, onChange: setQuery, placeholder: "Search diagrams…" }}>
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <h1 className="m-0 text-[22px] font-bold tracking-[-0.01em] text-ink">{copy.title}</h1>
        <p className="m-0 mt-1 text-[13px] text-slate">{copy.subtitle}</p>

        {failed && <p className="mt-5 text-[13px] text-slate">Couldn&apos;t load your diagrams.</p>}

        {!failed && filtered.length === 0 && (
          <p className="mt-5 max-w-[420px] text-[13px] leading-[1.5] text-slate">
            {needle ? `Nothing matches “${query}”.` : copy.empty}
          </p>
        )}

        <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
          {filtered.map((item) => (
            <DiagramCard
              key={item.id}
              item={item}
              onOpen={() => open(item.id)}
              onToggleFavorite={() => void toggleFavorite(item)}
              onDelete={() => void remove(item)}
              trailing={
                mode === "all" ? (
                  <ProjectMenu item={item} projects={projects} onMoved={bump} />
                ) : undefined
              }
            />
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
