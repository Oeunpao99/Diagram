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
    <div className="settings">
      <header className="settings__bar">
        <Link className="btn btn--ghost" to="/">
          ← Back to canvas
        </Link>
        <h1 className="settings__title">Settings</h1>
      </header>

      <div className="settings__body">
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}

        <section className="card">
          <h2 className="card__title">Appearance</h2>
          <p className="card__hint">Saved to your account, so it follows you between devices.</p>

          <div className="card__row">
            <span className="card__label">Theme</span>
            <div className="segmented" role="group" aria-label="Colour theme">
              {THEMES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`segmented__btn${theme === option.value ? " is-active" : ""}`}
                  aria-pressed={theme === option.value}
                  onClick={() => void setAppearance({ theme: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card__row">
            <span className="card__label">Accent</span>
            <div className="swatches" role="group" aria-label="Accent colour">
              {ACCENTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`swatch${accent === option.value ? " is-active" : ""}`}
                  style={{ ["--swatch" as string]: option.swatch }}
                  aria-pressed={accent === option.value}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => void setAppearance({ accent: option.value })}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="card__title">Profile</h2>
          <div className="card__row">
            <span className="card__label">Email</span>
            <span className="card__value">{user?.email}</span>
          </div>
          <form
            className="card__row"
            onSubmit={(e) => {
              e.preventDefault();
              void updateName(name.trim());
            }}
          >
            <span className="card__label">Name</span>
            <div className="card__inline">
              <input
                className="field__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <button
                className="btn btn--accent"
                type="submit"
                disabled={busy || !name.trim() || name.trim() === user?.name}
              >
                Save
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2 className="card__title">Password</h2>
          <form className="card__stack" onSubmit={savePassword}>
            <label className="field">
              <span className="field__label">Current password</span>
              <input
                className="field__input"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">New password</span>
              <input
                className="field__input"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <span className="field__hint">At least 8 characters.</span>
            </label>

            {passwordNote && (
              <p className={passwordNote.ok ? "field__ok" : "field__error"} role="alert">
                {passwordNote.text}
              </p>
            )}

            <div>
              <button
                className="btn btn--accent"
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
