import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../store/useAuth";
import { ACCENTS, THEMES } from "../theme";

export default function Settings() {
  const { user, theme, accent, busy, error, setAppearance, updateName, changePassword } =
    useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [passwordNote, setPasswordNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordNote(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setPasswordNote({ ok: true, text: "Password updated." });
    } catch (err) {
      setPasswordNote({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex h-[var(--topbar)] items-center gap-4 border-b border-line bg-surface px-5">
        <Link
          className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-md border border-line bg-transparent px-3 py-1.5 text-[12.5px] font-[550] text-ink transition-colors hover:border-line-strong hover:bg-surface-2"
          to="/"
        >
          ← Back to canvas
        </Link>
        <h1 className="m-0 text-[15px] font-semibold text-ink-strong">Settings</h1>
      </header>

      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4 px-4 pb-16 pt-7">
        {error && (
          <p className="m-0 rounded-md bg-red-soft px-3 py-[9px] text-[13px] text-red" role="alert">
            {error}
          </p>
        )}

        <section className="rounded-xl border border-line bg-surface p-[22px]">
          <h2 className="m-0 mb-1 text-sm font-semibold text-ink-strong">Appearance</h2>
          <p className="m-0 mb-[18px] text-xs text-slate">
            Saved to your account, so it follows you between devices.
          </p>

          <div className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-2.5">
            <span className="text-[13px] font-medium text-ink">Theme</span>
            <div className="inline-flex gap-0.5 rounded-full border border-line bg-surface-2 p-0.5" role="group" aria-label="Colour theme">
              {THEMES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`cursor-pointer rounded-full border-0 bg-transparent px-[13px] py-[5px] text-xs font-medium transition-colors hover:text-ink ${theme === option.value ? "bg-surface text-ink-strong shadow-1" : "text-slate"}`}
                  aria-pressed={theme === option.value}
                  onClick={() => void setAppearance({ theme: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-2.5">
            <span className="text-[13px] font-medium text-ink">Accent</span>
            <div className="flex gap-2" role="group" aria-label="Accent colour">
              {ACCENTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`size-[26px] cursor-pointer rounded-full border-2 p-0 transition-[transform,box-shadow] hover:scale-105 ${accent === option.value ? "border-surface shadow-[0_0_0_2px_var(--swatch)]" : "border-transparent shadow-[0_0_0_1px_var(--line-strong)]"}`}
                  style={{ ["--swatch" as string]: option.swatch, background: option.swatch }}
                  aria-pressed={accent === option.value}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => void setAppearance({ accent: option.value })}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-[22px]">
          <h2 className="m-0 mb-1 text-sm font-semibold text-ink-strong">Profile</h2>
          <div className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-2.5">
            <span className="text-[13px] font-medium text-ink">Email</span>
            <span className="text-[13px] text-slate">{user?.email}</span>
          </div>
          <form
            className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void updateName(name.trim());
            }}
          >
            <span className="text-[13px] font-medium text-ink">Name</span>
            <div className="flex items-center gap-2">
              <input
                className="w-full rounded-md border border-line-strong bg-surface px-3 py-[9px] text-sm text-ink transition-[border-color,box-shadow] outline-none focus:border-green focus:shadow-[0_0_0_3px_var(--green-ring)]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <button
                className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-md border border-green bg-green px-3 py-1.5 text-[12.5px] font-[550] text-on-accent transition-colors hover:border-green-strong hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-45"
                type="submit"
                disabled={busy || !name.trim() || name.trim() === user?.name}
              >
                Save
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-line bg-surface p-[22px]">
          <h2 className="m-0 mb-1 text-sm font-semibold text-ink-strong">Password</h2>
          <form className="flex flex-col gap-3.5 pt-1" onSubmit={savePassword}>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate">Current password</span>
              <input
                className="w-full rounded-md border border-line-strong bg-surface px-3 py-[9px] text-sm text-ink transition-[border-color,box-shadow] outline-none focus:border-green focus:shadow-[0_0_0_3px_var(--green-ring)]"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate">New password</span>
              <input
                className="w-full rounded-md border border-line-strong bg-surface px-3 py-[9px] text-sm text-ink transition-[border-color,box-shadow] outline-none focus:border-green focus:shadow-[0_0_0_3px_var(--green-ring)]"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <span className="text-[11px] text-slate-soft">At least 8 characters.</span>
            </label>

            {passwordNote && (
              <p
                className={`m-0 rounded-md px-3 py-[9px] text-[13px] ${passwordNote.ok ? "bg-green-soft text-green-deep" : "bg-red-soft text-red"}`}
                role="alert"
              >
                {passwordNote.text}
              </p>
            )}

            <div>
              <button
                className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-md border border-green bg-green px-3 py-1.5 text-[12.5px] font-[550] text-on-accent transition-colors hover:border-green-strong hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-45"
                type="submit"
                disabled={busy || !current || next.length < 8}
              >
                Change password
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
