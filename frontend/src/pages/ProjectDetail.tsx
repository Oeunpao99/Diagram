import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import { emptyDoc, type DiagramListItem, type Project } from "../api/types";
import { DashboardShell } from "../components/DashboardShell";
import { DiagramCard } from "../components/DiagramCard";
import { Layers, Plus, Trash } from "../components/icons";
import { useDiagram } from "../store/useDiagram";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<DiagramListItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [rev, setRev] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    // There's no GET /projects/{id} — list is cheap enough (a user's own
    // projects) that finding it there is simpler than adding an endpoint
    // just for this.
    api
      .listProjects()
      .then((all) => {
        const found = all.find((p) => p.id === id);
        if (!found) {
          setFailed(true);
          return;
        }
        setProject(found);
      })
      .catch(() => setFailed(true));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api
      .listDiagrams(200, undefined, id)
      .then(setItems)
      .catch(() => setFailed(true));
  }, [id, rev]);

  const bump = () => setRev((v) => v + 1);

  const open = (diagramId: string) => {
    void useDiagram.getState().loadDiagram(diagramId);
    navigate("/");
  };

  const newDiagram = () => {
    if (!id) return;
    useDiagram.getState().beginNew(id);
    useDiagram.getState().setDoc(emptyDoc());
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

  const deleteProject = async () => {
    if (!id) return;
    try {
      await api.deleteProject(id);
      navigate("/projects");
    } catch {
      setConfirmDelete(false);
    }
  };

  if (failed) {
    return (
      <DashboardShell>
        <div className="mx-auto max-w-[1400px] px-6 py-6">
          <p className="text-[13px] text-slate">
            That project doesn&apos;t exist, or couldn&apos;t be loaded.{" "}
            <button
              className="border-none bg-transparent p-0 text-[13px] font-[550] text-green-deep underline"
              onClick={() => navigate("/projects")}
            >
              Back to Projects
            </button>
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-lg text-white [&_svg]:size-[18px]"
              style={{ background: project?.color ?? "#5B4BE0" }}
            >
              <Layers />
            </span>
            <div>
              <h1 className="m-0 text-[20px] font-bold tracking-[-0.01em] text-ink">
                {project?.name ?? "Loading…"}
              </h1>
              {project?.description && (
                <p className="m-0 mt-1 max-w-[520px] text-[13px] text-slate">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="inline-flex items-center gap-[7px] rounded-lg border border-green bg-green px-3.5 py-2 text-[12.5px] font-semibold text-on-accent transition-colors hover:bg-green-strong"
              onClick={newDiagram}
            >
              <Plus />
              New Diagram
            </button>
            <button
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-slate-soft transition-colors hover:border-red hover:text-red [&_svg]:size-4"
              onClick={() => setConfirmDelete(true)}
              title="Delete project"
              aria-label="Delete project"
            >
              <Trash />
            </button>
          </div>
        </div>

        {items.length === 0 && (
          <p className="max-w-[420px] text-[13px] leading-[1.5] text-slate">
            No diagrams in this project yet — start one with &ldquo;New Diagram&rdquo; above.
          </p>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
          {items.map((item) => (
            <DiagramCard
              key={item.id}
              item={item}
              onOpen={() => open(item.id)}
              onToggleFavorite={() => void toggleFavorite(item)}
              onDelete={() => void remove(item)}
            />
          ))}
        </div>
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-[380px] rounded-xl border border-line bg-surface p-4 shadow-3"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="m-0 text-[14.5px] font-bold text-ink">Delete “{project?.name}”?</h2>
            <p className="m-0 mt-2 text-[12.5px] leading-[1.5] text-slate">
              This deletes the project <b>and every diagram in it</b> ({items.length}{" "}
              {items.length === 1 ? "diagram" : "diagrams"}). This can&apos;t be undone.
            </p>
            <div className="mt-3.5 flex gap-2">
              <button
                className="flex-1 rounded-md border border-line bg-surface py-2 text-[12.5px] font-[600] text-ink hover:bg-surface-2"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-md border border-red bg-red py-2 text-[12.5px] font-[600] text-white hover:bg-[#a92c25]"
                onClick={() => void deleteProject()}
              >
                Delete everything
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
