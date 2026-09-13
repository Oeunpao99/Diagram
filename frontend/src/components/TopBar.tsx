import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../store/useAuth";
import { useSettings } from "../store/useSettings";
import { useDiagram } from "../store/useDiagram";
import { ExportMenu } from "./ExportMenu";
import {
  ChevronDown,
  LogoMark,
  MessageSquare,
  Redo,
  Share,
  Sparkles,
  Undo,
} from "./icons";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function AccountMenu() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const openSettings = useSettings((s) => s.openSettings);
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <InlineMenu label={<span className="avatar">{initials(user.name)}</span>}>
      <div className="menu__header">
        <strong className="menu__name">{user.name}</strong>
        <span className="menu__email">{user.email}</span>
      </div>
      <button className="menu__item" onClick={() => openSettings("profile")}>
        Settings
      </button>
      <button
        className="menu__item menu__item--danger"
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
      <button className="iconbtn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {label}
      </button>
      {open && (
        <div className="menu" style={align === "left" ? { right: "auto", left: 0 } : undefined}>
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
  const [link, setLink] = useState("https://app.diagramcopilot.app/import-cargo-process");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setLink("Copied to clipboard");
      window.setTimeout(() => setLink("https://app.diagramcopilot.app/import-cargo-process"), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const focusCopilot = () =>
    document.querySelector<HTMLElement>(".copilot")?.scrollIntoView({ behavior: "smooth" });

  return (
    <header className="topbar">
      <div className="topbar__identity">
        <span className="topbar__logo">
          <span className="topbar__mark">
            <LogoMark />
          </span>
          <span className="topbar__wordmark">
            Diagram Copilot
            <span className="tagline">editable diagrams</span>
          </span>
        </span>

        <span className="topbar__divider" />

        <div className="topbar__project">
          <input
            value={doc.title}
            disabled={doc.nodes.length === 0}
            aria-label="Diagram name"
            onChange={(event) =>
              useDiagram
                .getState()
                .setDoc({ ...useDiagram.getState().doc, title: event.target.value }, { silent: true })
            }
          />
          <span className="topbar__caret">
            <ChevronDown />
          </span>
        </div>

        <span className="topbar__save">
          <span className="topbar__save-dot" />
          Saved
        </span>
      </div>

      <div className="topbar__crumb">
        <a href="#projects">Projects</a>
        <span className="sep">/</span>
        <a href="#logistics">Logistics</a>
        <span className="sep">/</span>
        <span>Import Cargo Process</span>
      </div>

      <div className="topbar__actions">
        <button className="iconbtn" disabled={!past.length} onClick={undo} title="Undo (Ctrl+Z)">
          <Undo />
        </button>
        <button className="iconbtn" disabled={!future.length} onClick={redo} title="Redo (Ctrl+Shift+Z)">
          <Redo />
        </button>

        <span className="topbar__divider" />

        <InlineMenu
          label={<MessageSquare />}
        >
          <div className="menu__heading">Comments</div>
          <button className="menu__item" disabled>
            <MessageSquare />
            No comments yet
          </button>
          <div className="menu__sep" />
          <button className="menu__item is-muted">
            <Sparkles />
            Ask AI to summarize feedback
          </button>
        </InlineMenu>

        <InlineMenu label={<Share />}>
          <div className="menu__heading">Share</div>
          <div className="menu__footer">
            <input
              className="topbar__share-input"
              style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 7, padding: "6px 8px", fontSize: 12, color: "var(--slate)" }}
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button className="btn btn--sm" onClick={() => void copyLink()}>
              Copy
            </button>
          </div>
        </InlineMenu>

        <ExportMenu doc={doc} />
        <span className="topbar__divider" />

        <button className="btn btn--ai" onClick={focusCopilot} disabled={busy !== null}>
          <Sparkles />
          AI Copilot
        </button>

        <AccountMenu />
      </div>
    </header>
  );
}