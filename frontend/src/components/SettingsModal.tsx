import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../store/useAuth";
import { useBilling } from "../store/useBilling";
import { useSettings, type SettingsSection } from "../store/useSettings";
import { ACCENTS, THEMES } from "../theme";
import {
  Check,
  Lock,
  Monitor,
  Moon,
  Palette,
  Puzzle,
  Settings,
  Sparkles,
  Sun,
  UserIcon,
  X,
} from "./icons";

const NAV: { id: SettingsSection; label: string; icon: () => ReactNode }[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "password", label: "Password", icon: Lock },
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
      className={`relative h-5 w-[34px] shrink-0 cursor-pointer rounded-full border transition-[background,border-color] focus-visible:shadow-[0_0_0_3px_var(--green-ring)] focus-visible:outline-none ${on ? "border-green bg-green" : "border-line-strong bg-surface-2"}`}
      onClick={() => onChange(!on)}
    >
      <span
        className={`absolute left-0.5 top-0.5 size-3.5 rounded-full bg-[#d4dce4] shadow-1 transition-[transform,background] ${on ? "translate-x-[14px] bg-white" : ""}`}
      />
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
    <div className="flex items-center gap-4 border-b border-line py-[13px] last:border-b-0">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-[13px] font-semibold text-ink">{title}</strong>
        <span className="text-xs text-slate">{desc}</span>
      </span>
      {control}
    </div>
  );
}

function ProfilePane() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const updateName = useAuth((s) => s.updateName);
  const closeSettings = useSettings((s) => s.closeSettings);
  const openBilling = useBilling((s) => s.openBilling);
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
        <span className="grid size-[42px] place-items-center rounded-xl bg-green text-[15px] font-bold uppercase text-on-accent">
          {initials(user.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="text-sm font-[650] text-ink">{user.name}</strong>
          <span className="text-xs text-slate">{user.email}</span>
        </span>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-line p-3">
        <span className="grid size-[34px] shrink-0 place-items-center rounded-lg bg-green text-on-accent [&_svg]:size-4">
          <Sparkles />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="text-sm font-[650] text-ink">{user.credits} credits</strong>
          <span className="text-xs text-slate">Used by AI actions. Credits never expire.</span>
        </span>
        <button
          className="inline-flex shrink-0 cursor-pointer items-center rounded-md border border-green bg-green px-3 py-1.5 text-[12.5px] font-[550] text-on-accent transition-colors hover:border-green-strong hover:bg-green-strong"
          onClick={() => {
            closeSettings();
            openBilling("topup");
          }}
        >
          Buy credits
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-[550] text-ink">Display name</span>
        <input
          className="rounded-[9px] border border-line bg-surface px-2.5 py-2 text-[13px] text-ink outline-none transition-[border-color,box-shadow] focus:border-green focus:shadow-[0_0_0_3px_var(--green-ring)] disabled:opacity-60"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-[550] text-ink">Email</span>
        <input
          className="rounded-[9px] border border-line bg-surface px-2.5 py-2 text-[13px] text-ink outline-none transition-[border-color,box-shadow] focus:border-green focus:shadow-[0_0_0_3px_var(--green-ring)] disabled:opacity-60"
          value={user.email ?? "No email on file — signed in via Google or GitHub"}
          readOnly
          disabled
        />
      </label>

      <div className="flex gap-2.5 pt-1">
        <button
          className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-md border border-green bg-green px-3 py-1.5 text-[12.5px] font-[550] text-on-accent transition-colors hover:border-green-strong hover:bg-green-strong [&>svg]:size-3.5"
          onClick={() => void save()}
        >
          {saved ? <Check /> : null}
          {saved ? "Saved" : "Save profile"}
        </button>
        <button
          className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-md border border-red-line bg-transparent px-3 py-1.5 text-[12.5px] font-[550] text-red transition-colors hover:border-red hover:bg-[rgba(196,55,47,0.08)]"
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

function PasswordPane() {
  const busy = useAuth((s) => s.busy);
  const changePassword = useAuth((s) => s.changePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setNote(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setNote({ ok: true, text: "Password updated." });
    } catch (err) {
      setNote({ ok: false, text: (err as Error).message });
    }
  }

  const input =
    "rounded-[9px] border border-line bg-surface px-2.5 py-2 text-[13px] text-ink outline-none transition-[border-color,box-shadow] focus:border-green focus:shadow-[0_0_0_3px_var(--green-ring)]";

  return (
    <form className="flex flex-col gap-4" onSubmit={save}>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-[550] text-ink">Current password</span>
        <input
          className={input}
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-[550] text-ink">New password</span>
        <input
          className={input}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <span className="text-[11px] text-slate-soft">At least 8 characters.</span>
      </label>

      {note && (
        <p
          className={`m-0 rounded-md border px-3 py-2 text-[12.5px] ${note.ok ? "border-green text-green-strong" : "border-red text-red"}`}
          role="alert"
        >
          {note.text}
        </p>
      )}

      <div>
        <button
          className="inline-flex items-center justify-center rounded-md border border-green bg-green px-3 py-1.5 text-[12.5px] font-[550] text-on-accent transition-colors hover:border-green-strong hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-45"
          type="submit"
          disabled={busy || !current || next.length < 8}
        >
          Change password
        </button>
      </div>
    </form>
  );
}

function AppearancePane() {
  const theme = useAuth((s) => s.theme);
  const accent = useAuth((s) => s.accent);
  const setAppearance = useAuth((s) => s.setAppearance);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[11px] font-[650] uppercase tracking-[0.07em] text-slate-soft">Theme</div>
      <div className="grid grid-cols-3 gap-2.5">
        {THEMES.map((t) => (
          <button
            key={t.value}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-[11px] border bg-surface px-2 pb-3 pt-3.5 text-xs font-[550] text-ink transition-[border-color,box-shadow] [&>svg]:size-5 [&>svg]:text-slate ${theme === t.value ? "border-green text-green-strong shadow-[0_0_0_3px_var(--green-ring)] [&>svg]:text-green" : "border-line"}`}
            onClick={() => void setAppearance({ theme: t.value })}
          >
            {t.value === "light" ? <Sun /> : t.value === "dark" ? <Moon /> : <Monitor />}
            {t.label}
            {theme === t.value && <Check />}
          </button>
        ))}
      </div>

      <div className="text-[11px] font-[650] uppercase tracking-[0.07em] text-slate-soft">Accent color</div>
      <div className="flex flex-wrap gap-2.5">
        {ACCENTS.map((a) => (
          <button
            key={a.value}
            className={`flex cursor-pointer items-center gap-[7px] rounded-[9px] border bg-surface py-[7px] pl-2 pr-[11px] text-xs font-[550] text-ink transition-[border-color,box-shadow] [&>svg]:size-3 [&>svg]:text-green ${accent === a.value ? "border-green shadow-[0_0_0_3px_var(--green-ring)]" : "border-line"}`}
            title={a.label}
            onClick={() => void setAppearance({ accent: a.value })}
          >
            <span className="size-4 rounded-[5px] border border-[rgba(0,0,0,0.08)]" style={{ background: a.swatch }} />
            {accent === a.value && <Check />}
            <span className="min-w-0">{a.label}</span>
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
    <div className="flex flex-col gap-0">
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
    <div className="flex flex-col gap-0">
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
      className="fixed inset-0 z-[300] grid place-items-center p-6 bg-[rgba(16,24,32,0.32)] backdrop-blur-[7px] animate-[modal-fade_180ms_ease]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeSettings();
      }}
    >
      <div
        className="flex w-[min(760px,100%)] h-[min(520px,90vh)] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_-16px_rgba(10,20,30,0.35)] animate-[modal-in_200ms_ease] max-[640px]:flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <nav
          className="flex w-[188px] shrink-0 flex-col gap-1 border-r border-line bg-surface-2 p-2.5 max-[640px]:w-full max-[640px]:flex-row max-[640px]:overflow-x-auto max-[640px]:border-r-0 max-[640px]:border-b"
          aria-label="Settings sections"
        >
          <div className="mb-2 flex items-center gap-2 border-b border-line px-2 pb-3 pt-0.5 text-[13px] font-[650] text-ink max-[640px]:hidden">
            <span className="grid size-[22px] place-items-center rounded-[7px] bg-green text-on-accent [&_svg]:size-3">
              <Settings />
            </span>
            Settings
          </div>
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`flex cursor-pointer items-center gap-[9px] rounded-lg border-0 bg-transparent py-2 pl-2 pr-2.5 text-left text-[12.5px] font-medium text-slate transition-[background,color] hover:bg-surface hover:text-ink [&>svg]:size-[15px] ${section === item.id ? "bg-green font-semibold text-on-accent hover:bg-green hover:text-on-accent" : ""}`}
              onClick={() => setSection(item.id)}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-2.5 border-b border-line px-5 pb-3 pt-4">
            <span className="mb-px text-[10px] font-[650] uppercase tracking-[0.09em] text-slate-soft">
              Preferences
            </span>
            <h2 className="m-0 mr-auto text-base font-[650] text-ink">
              {NAV.find((n) => n.id === section)?.label}
            </h2>
            <button
              className="ml-auto inline-flex size-[30px] cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-ink transition-colors hover:bg-surface-2 [&>svg]:size-4"
              onClick={closeSettings}
              aria-label="Close settings"
            >
              <X />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-[18px] no-scrollbar">
            {section === "profile" && <ProfilePane />}
            {section === "password" && <PasswordPane />}
            {section === "appearance" && <AppearancePane />}
            {section === "customization" && <CustomizationPane />}
            {section === "extensions" && <ExtensionsPane />}
          </div>
        </div>
      </div>
    </div>
  );
}