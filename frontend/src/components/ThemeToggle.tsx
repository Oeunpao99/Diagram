import { useAuth } from "../store/useAuth";
import { THEMES } from "../theme";

/** Three-way light / dark / system switch. Used on the auth screens and TopBar. */
export function ThemeToggle() {
  const theme = useAuth((s) => s.theme);
  const setAppearance = useAuth((s) => s.setAppearance);

  return (
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
  );
}
