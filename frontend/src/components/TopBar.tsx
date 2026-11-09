import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../store/useAuth";
import { useSettings } from "../store/useSettings";
import { useDiagram } from "../store/useDiagram";
import { CreditBadge } from "./CreditBadge";
import { ExportMenu } from "./ExportMenu";
import { ImportMenu } from "./ImportMenu";
import { ThemeIconButton } from "./ThemeToggle";
import {
  ChevronDown,
  Grid,
  LogoMark,
  MessageSquare,
  Redo,
  Share,
  Sparkles,
  Undo,
} from "./icons";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AccountMenu() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <InlineMenu
      label={
        <span className="ml-1.5 grid size-7 place-items-center rounded-full border border-green-line bg-surface text-[11px] font-[650] text-green-deep">
          {initials(user.name)}
        </span>
      }
    >
      <div className="flex flex-col gap-0.5 border-b border-line px-3 py-2.5">
        <strong className="text-[13px] text-ink-strong">{user.name}</strong>
        <span className="text-[11px] text-slate">{user.email}</span>
      </div>
      <button
        className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-ink hover:bg-surface-2 [&_svg]:size-[15px] [&_svg]:text-slate"
        onClick={() => useSettings.getState().openSettings("profile")}
      >
        Settings
      </button>
      <button
        className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-red hover:bg-surface-2 [&_svg]:size-[15px] [&_svg]:text-slate"
        onClick={() => {
          logout();
          navigate("/login", { replace: true });
        }}
      >
        Sign out
      </button>
    </InlineMenu>
  );
}

function InlineMenu({
  label,
  children,
  align = "right",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  align?: "right" | "left";
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

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        className="inline-flex items-center justify-center gap-1.5 rounded-[7px] border-none bg-transparent p-1.5 text-slate transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {label}
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[200px] rounded-xl border border-line bg-surface p-[5px] shadow-3 animate-[menu-in_130ms_ease]"
          style={align === "left" ? { right: "auto", left: 0 } : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const doc = useDiagram((s) => s.doc);
  const busy = useDiagram((s) => s.busy);
  const past = useDiagram((s) => s.past);
  const future = useDiagram((s) => s.future);
  const undo = useDiagram((s) => s.undo);
  const redo = useDiagram((s) => s.redo);
  const projectId = useDiagram((s) => s.projectId);
  const diagramId = useDiagram((s) => s.diagramId);
  const access = useDiagram((s) => s.access);
  const shareToken = useDiagram((s) => s.shareToken);
  const shareRole = useDiagram((s) => s.shareRole);
  const shareDiagram = useDiagram((s) => s.shareDiagram);
  const unshareDiagram = useDiagram((s) => s.unshareDiagram);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);

  // There's no GET /projects/{id} — the list is cheap (a user's own
  // projects), so finding the one we need there is simpler than a dedicated
  // endpoint just for this label.
  useEffect(() => {
    if (!projectId) {
      setProjectName(null);
      return;
    }
    let alive = true;
    api
      .listProjects()
      .then((projects) => {
        if (alive) setProjectName(projects.find((p) => p.id === projectId)?.name ?? null);
      })
      .catch(() => alive && setProjectName(null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Only real once the diagram is saved (diagramId) and the owner has
  // turned sharing on (shareToken) — nothing to copy before either.
  const shareUrl = diagramId && shareToken ? `${window.location.origin}/shared/${shareToken}` : null;

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const setRole = async (role: "view" | "edit") => {
    if (!diagramId) return;
    setSharing(true);
    try {
      await shareDiagram(role);
    } finally {
      setSharing(false);
    }
  };

  const stopSharing = async () => {
    setSharing(true);
    try {
      await unshareDiagram();
    } finally {
      setSharing(false);
    }
  };

  const focusCopilot = () =>
    document.querySelector<HTMLElement>("[data-copilot]")?.scrollIntoView({ behavior: "smooth" });

  return (
    <header className="flex h-[var(--topbar)] shrink-0 items-center gap-4 border-b border-line bg-surface px-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex items-center gap-[9px] text-ink">
          <span className="grid size-5 place-items-center rounded-[6px] bg-green text-on-accent [&_svg]:size-3">
            <LogoMark />
          </span>
          <span className="flex items-center gap-[3px] text-[13.5px] font-[650] tracking-[-0.01em]">
            Kumnous-គំនូស
            <span className="ml-1.5 border-l border-line pl-2 text-[11px] font-[450] text-slate-soft">
              editable diagrams
            </span>
          </span>
        </span>

        <button
          className="inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-[7px] border-none bg-transparent px-2 py-1.5 text-[12.5px] font-[550] text-slate transition-colors hover:bg-surface-2 hover:text-ink [&_svg]:size-4"
          onClick={() => navigate("/templates")}
          title="Back to the Template Library"
        >
          <Grid />
          Templates
        </button>

        <span className="h-5 w-px bg-line" />

        <div className="flex min-w-0 items-center gap-1.5">
          <input
            className="w-[210px] rounded-md border border-transparent p-1 text-[13px] font-semibold text-ink outline-none transition-colors hover:border-line hover:bg-surface-2 focus:border-line focus:bg-surface-2"
            value={doc.title}
            disabled={doc.nodes.length === 0}
            aria-label="Diagram name"
            onChange={(event) =>
              useDiagram
                .getState()
                .setDoc({ ...useDiagram.getState().doc, title: event.target.value }, { silent: true })
            }
          />
          <span className="grid place-items-center text-slate-soft [&_svg]:size-3">
            <ChevronDown />
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 whitespace-nowrap pr-1.5 text-[11.5px] font-medium text-slate-soft max-[1240px]:hidden">
          <span className="size-1.5 rounded-full bg-green" />
          Saved
        </span>
      </div>

      {/* Only shown once the open diagram actually belongs to a project —
          the title input just left of this already names the diagram, so
          there's nothing worth adding here otherwise. */}
      {projectId && projectName && (
        <div className="ml-3 flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-xs text-slate-soft max-[1240px]:hidden">
          <Link className="text-slate hover:text-green-deep" to="/projects">
            Projects
          </Link>
          <span className="text-line-strong">/</span>
          <Link className="font-[550] text-ink hover:text-green-deep" to={`/projects/${projectId}`}>
            {projectName}
          </Link>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-[7px] border-none bg-transparent p-1.5 text-slate transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4"
          disabled={!past.length}
          onClick={undo}
          title="Undo (Ctrl+Z)"
        >
          <Undo />
        </button>
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-[7px] border-none bg-transparent p-1.5 text-slate transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4"
          disabled={!future.length}
          onClick={redo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo />
        </button>

        <span className="h-5 w-px bg-line" />

        <InlineMenu label={<MessageSquare />}>
          <div className="px-2.5 pb-[5px] pt-1.5 text-[10.5px] font-[650] uppercase tracking-[0.06em] text-slate-soft">
            Comments
          </div>
          <button
            className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-ink hover:bg-surface-2 disabled:opacity-45 [&_svg]:size-[15px] [&_svg]:text-slate"
            disabled
          >
            <MessageSquare />
            No comments yet
          </button>
          <div className="mx-1 my-1.5 h-px bg-line" />
          <button className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-slate hover:bg-surface-2 [&_svg]:size-[15px] [&_svg]:text-slate">
            <Sparkles />
            Ask AI to summarize feedback
          </button>
        </InlineMenu>

        {access === "owner" ? (
          <InlineMenu label={<Share />}>
            <div className="px-2.5 pb-[5px] pt-1.5 text-[10.5px] font-[650] uppercase tracking-[0.06em] text-slate-soft">
              Share
            </div>
            {!diagramId ? (
              <div className="px-2.5 pb-2 pt-1 text-[12px] text-slate-soft">
                Saves automatically as you type — try again in a moment.
              </div>
            ) : (
              <>
                <div className="flex gap-[5px] px-[5px] pb-1 pt-1.5">
                  <button
                    className={`flex-1 rounded-[7px] border px-2.5 py-1 text-xs font-[550] transition-colors ${shareToken && shareRole === "view" ? "border-green bg-green-soft text-green-deep" : "border-line text-ink hover:bg-surface-2"}`}
                    disabled={sharing}
                    onClick={() => void setRole("view")}
                  >
                    Can view
                  </button>
                  <button
                    className={`flex-1 rounded-[7px] border px-2.5 py-1 text-xs font-[550] transition-colors ${shareToken && shareRole === "edit" ? "border-green bg-green-soft text-green-deep" : "border-line text-ink hover:bg-surface-2"}`}
                    disabled={sharing}
                    onClick={() => void setRole("edit")}
                  >
                    Can edit
                  </button>
                </div>
                {shareUrl ? (
                  <>
                    <div className="flex gap-[7px] px-[5px] pb-0.5 pt-1">
                      <input
                        className="min-w-0 flex-1 rounded-[7px] border border-line p-[6px] text-[12px] text-slate outline-none focus:border-green"
                        readOnly
                        value={shareUrl}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <button
                        className="inline-flex items-center justify-center gap-[5px] whitespace-nowrap rounded-[7px] border border-line bg-surface px-2.5 py-1 text-xs font-[550] text-ink transition-[background,border-color,box-shadow] hover:border-line-strong hover:bg-surface-2"
                        onClick={() => void copyLink()}
                      >
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="mx-1 my-1.5 h-px bg-line" />
                    <button
                      className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-red hover:bg-surface-2 disabled:opacity-45"
                      disabled={sharing}
                      onClick={() => void stopSharing()}
                    >
                      Stop sharing
                    </button>
                  </>
                ) : (
                  <div className="px-2.5 pb-1.5 pt-1 text-[12px] text-slate-soft">
                    Pick Can view or Can edit to turn on a link.
                  </div>
                )}
              </>
            )}
          </InlineMenu>
        ) : (
          <span
            className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-[600] text-slate"
            title="Opened through a share link — only the owner can change sharing."
          >
            {access === "edit" ? "Shared · can edit" : "Shared · view only"}
          </span>
        )}

        {access !== "view" && <ImportMenu />}
        <ExportMenu doc={doc} />
        <span className="h-5 w-px bg-line" />

        <button
          className="inline-flex items-center justify-center gap-[7px] rounded-lg border border-green bg-green px-3.5 py-1.5 text-[12.5px] font-semibold text-on-accent transition-colors hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5"
          onClick={focusCopilot}
          disabled={busy !== null}
        >
          <Sparkles />
          Kumnous AI
        </button>

        <CreditBadge />
        <ThemeIconButton />
        <AccountMenu />
      </div>
    </header>
  );
}