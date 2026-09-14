import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import type { Project } from "../api/types";
import { DashboardShell } from "../components/DashboardShell";
import { Layers, Plus, X } from "../components/icons";

const PRESET_COLORS = ["#5B4BE0", "#0D9F6E", "#2563EB", "#B06F0E", "#C4372F", "#6D5AE0", "#2B8A94"];

function NewProjectForm({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const project = await api.createProject(name.trim(), description.trim() || undefined, color);
      onCreated(project);
    } catch {
      setError("Couldn't create the project — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[420px] rounded-xl border border-line bg-surface p-4 shadow-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-[15px] font-bold text-ink">New Project</h2>
          <button
            className="grid size-7 place-items-center rounded-md border-none bg-transparent text-slate-soft hover:bg-surface-2 hover:text-ink [&_svg]:size-3.5"
            onClick={onClose}
            aria-label="Close"
          >
            <X />
          </button>
        </div>

        <label className="mb-2.5 block">
          <span className="mb-1 block text-[11.5px] font-[600] text-slate">Name</span>
          <input
            autoFocus
            className="w-full rounded-md border border-line bg-paper px-2.5 py-2 text-[13px] text-ink outline-none focus:border-green"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Logistics Q1"
            onKeyDown={(event) => event.key === "Enter" && void submit()}
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-[11.5px] font-[600] text-slate">Description (optional)</span>
          <input
            className="w-full rounded-md border border-line bg-paper px-2.5 py-2 text-[13px] text-ink outline-none focus:border-green"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What's this project for?"
          />
        </label>

        <div className="mb-4 flex items-center gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={`size-6 shrink-0 rounded-full border-2 transition-transform ${color === c ? "scale-110 border-ink" : "border-transparent"}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
            />
          ))}
        </div>

        {error && <p className="mb-2.5 text-[12px] text-red">{error}</p>}

        <button
          className="w-full rounded-md border border-green bg-green py-2 text-[12.5px] font-semibold text-on-accent transition-colors hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!name.trim() || busy}
          onClick={() => void submit()}
        >
          {busy ? "Creating…" : "Create Project"}
        </button>
      </div>
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [failed, setFailed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    api
      .listProjects()
      .then(setProjects)
      .catch(() => setFailed(true));
  };

  useEffect(load, []);

  return (
    <DashboardShell>
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="m-0 text-[22px] font-bold tracking-[-0.01em] text-ink">Projects</h1>
            <p className="m-0 mt-1 text-[13px] text-slate">
              Group related diagrams into folders — a client, a system, a round of work.
            </p>
          </div>
          <button
            className="inline-flex shrink-0 items-center gap-[7px] rounded-lg border border-green bg-green px-3.5 py-2 text-[12.5px] font-semibold text-on-accent transition-colors hover:bg-green-strong"
            onClick={() => setShowForm(true)}
          >
            <Plus />
            New Project
          </button>
        </div>

        {failed && <p className="text-[13px] text-slate">Couldn&apos;t load your projects.</p>}

        {!failed && projects.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
            <span className="grid size-9 place-items-center rounded-full bg-green-soft text-green [&_svg]:size-4">
              <Layers />
            </span>
            <p className="m-0 text-[13px] font-[600] text-ink">No projects yet</p>
            <p className="m-0 max-w-[360px] text-[12px] leading-[1.5] text-slate">
              Create one to start grouping diagrams — a client, a system, a round of work.
            </p>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
          {projects.map((project) => (
            <button
              key={project.id}
              className="flex flex-col items-start gap-2 rounded-xl border border-line bg-surface p-4 text-left transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-2"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <span
                className="grid size-9 place-items-center rounded-lg text-white [&_svg]:size-4"
                style={{ background: project.color }}
              >
                <Layers />
              </span>
              <span className="text-[14px] font-semibold text-ink">{project.name}</span>
              {project.description && (
                <span className="line-clamp-2 text-[11.5px] leading-[1.5] text-slate">
                  {project.description}
                </span>
              )}
              <span className="mt-auto pt-1 text-[11px] font-[550] text-slate-soft">
                {project.diagram_count} {project.diagram_count === 1 ? "diagram" : "diagrams"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <NewProjectForm
          onClose={() => setShowForm(false)}
          onCreated={(project) => {
            setShowForm(false);
            navigate(`/projects/${project.id}`);
          }}
        />
      )}
    </DashboardShell>
  );
}
