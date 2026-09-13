import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../store/useAuth";
import { useSettings, type SettingsSection } from "../store/useSettings";
import { ACCENTS, THEMES } from "../theme";
import {
  Check,
  Monitor,
  Moon,
  Palette,
  Puzzle,
  Settings,
  Sun,
  UserIcon,
  X,
} from "./icons";

const NAV: { id: SettingsSection; label: string; icon: () => ReactNode }[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "customization", label: "Customization", icon: Settings },
  { id: "extensions", label: "Extensions", icon: Puzzle },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch ${on ? "is-on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <span className="switch__thumb" />
    </button>
  );
}

function Row({
  title,
  desc,
  control,
}: {
  title: string;
  desc: string;
  control: ReactNode;
}) {
  return (
    <div className="settings-row">
      <span className="settings-row__text">
        <strong>{title}</strong>
        <span>{desc}</span>
      </span>
      {control}
    </div>
  );
}

function ProfilePane() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const updateName = useAuth((s) => s.updateName);
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  if (!user) return null;

  const save = async () => {
    if (name.trim() && name.trim() !== user.name) await updateName(name.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="settings-stack">
      <div className="settings-profile">
        <span className="settings-profile__avatar">{initials(user.name)}</span>
        <span className="settings-profile__meta">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </span>
        <span className="settings-profile__plan">Pro plan</span>
      </div>

      <label className="settings-field">
        <span>Display name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="settings-field">
        <span>Email</span>
        <input value={user.email} readOnly disabled />
      </label>

      <div className="settings-actions">
        <button className="btn btn--accent" onClick={() => void save()}>
          {saved ? <Check /> : null}
          {saved ? "Saved" : "Save profile"}
        </button>
        <button
          className="btn btn--danger"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function AppearancePane() {
  const theme = useAuth((s) => s.theme);
  const accent = useAuth((s) => s.accent);
  const setAppearance = useAuth((s) => s.setAppearance);

  return (
    <div className="settings-stack">
      <div className="settings-section-label">Theme</div>
      <div className="theme-row">
        {THEMES.map((t) => (
          <button
            key={t.value}
            className={`theme-btn ${theme === t.value ? "is-active" : ""}`}
            onClick={() => void setAppearance({ theme: t.value })}
          >
            {t.value === "light" ? <Sun /> : t.value === "dark" ? <Moon /> : <Monitor />}
            {t.label}
            {theme === t.value && <Check />}
          </button>
        ))}
      </div>

      <div className="settings-section-label">Accent color</div>
      <div className="accent-row">
        {ACCENTS.map((a) => (
          <button
            key={a.value}
            className={`accent-btn ${accent === a.value ? "is-active" : ""}`}
            title={a.label}
            onClick={() => void setAppearance({ accent: a.value })}
          >
            <span className="accent-btn__swatch" style={{ background: a.swatch }} />
            {accent === a.value && <Check />}
            <span className="accent-btn__label">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CustomizationPane() {
  const prefs = useSettings((s) => s.prefs);
  const setPref = useSettings((s) => s.setPref);
  return (
    <div className="settings-stack settings-list">
      <Row
        title="Show minimap"
        desc="Navigation preview in the bottom-right of the canvas."
        control={<Switch on={prefs.minimap} label="Minimap" onChange={(v) => setPref("minimap", v)} />}
      />
      <Row
        title="Grid background"
        desc="Dotted grid pattern across the canvas."
        control={<Switch on={prefs.grid} label="Grid" onChange={(v) => setPref("grid", v)} />}
      />
      <Row
        title="Snap to grid"
        desc="Align nodes to the grid while dragging."
        control={<Switch on={prefs.snap} label="Snap" onChange={(v) => setPref("snap", v)} />}
      />
      <Row
        title="Auto-save"
        desc="Keep the diagram saved as you edit."
        control={<Switch on={prefs.autosave} label="Auto save" onChange={(v) => setPref("autosave", v)} />}
      />
    </div>
  );
}

function ExtensionsPane() {
  const extensions = useSettings((s) => s.extensions);
  const setExtension = useSettings((s) => s.setExtension);
  return (
    <div className="settings-stack settings-list">
      <Row
        title="Mermaid & PDF export"
        desc="Extra formats in the Export menu alongside PNG and SVG."
        control={
          <Switch
            on={extensions.mermaidPdfExport}
            label="Mermaid & PDF export"
            onChange={(v) => setExtension("mermaidPdfExport", v)}
          />
        }
      />
      <Row
        title="Presentation mode"
        desc="Slide through your diagram step by step."
        control={
          <Switch
            on={extensions.presentation}
            label="Presentation mode"
            onChange={(v) => setExtension("presentation", v)}
          />
        }
      />
      <Row
        title="Canvas comments"
        desc="Tack comments and @mentions onto nodes."
        control={
          <Switch
            on={extensions.canvasComments}
            label="Canvas comments"
            onChange={(v) => setExtension("canvasComments", v)}
          />
        }
      />
      <Row
        title="Smart spellcheck"
        desc="Flags typos inside diagram labels."
        control={
          <Switch
            on={extensions.smartSpellcheck}
            label="Smart spellcheck"
            onChange={(v) => setExtension("smartSpellcheck", v)}
          />
        }
      />
    </div>
  );
}

export function SettingsModal() {
  const open = useSettings((s) => s.open);
  const section = useSettings((s) => s.section);
  const closeSettings = useSettings((s) => s.closeSettings);
  const setSection = useSettings((s) => s.setSection);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeSettings]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeSettings();
      }}
    >
      <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
        <nav className="settings-modal__nav" aria-label="Settings sections">
          <div className="settings-modal__logo">
            <span className="settings-modal__mark">
              <Settings />
            </span>
            Settings
          </div>
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`settings-nav-item ${section === item.id ? "is-active" : ""}`}
              onClick={() => setSection(item.id)}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings-modal__content">
          <header className="settings-modal__head">
            <span className="settings-modal__eyebrow">Preferences</span>
            <h2>{NAV.find((n) => n.id === section)?.label}</h2>
            <button className="iconbtn settings-modal__close" onClick={closeSettings} aria-label="Close settings">
              <X />
            </button>
          </header>

          <div className="settings-modal__body">
            {section === "profile" && <ProfilePane />}
            {section === "appearance" && <AppearancePane />}
            {section === "customization" && <CustomizationPane />}
            {section === "extensions" && <ExtensionsPane />}
          </div>
        </div>
      </div>
    </div>
  );
}