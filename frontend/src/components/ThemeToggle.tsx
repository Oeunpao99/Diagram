import { useAuth } from "../store/useAuth";
import { THEMES } from "../theme";

/** Three-way light / dark / system switch. Used on the auth screens and TopBar. */
export function ThemeToggle() {
  const theme = useAuth((s) => s.theme);
  const setAppearance = useAuth((s) => s.setAppearance);

  return (
    <div
      className="inline-flex gap-0.5 rounded-full border border-line bg-surface-2 p-0.5"
      role="group"
      aria-label="Colour theme"
    >
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
  );
}
