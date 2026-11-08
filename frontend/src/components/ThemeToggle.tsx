import { useEffect, useState } from "react";

import { useAuth } from "../store/useAuth";
import { Moon, Sun } from "./icons";
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

/** One-click light/dark switch for the top-right of the app. Shows the look
 *  that's on screen now (resolving "system" against the OS) and flips to the
 *  other; the three-way choice including "system" lives in Settings. */
export function ThemeIconButton({
  labels = { toLight: "Switch to light mode", toDark: "Switch to dark mode" },
  className = "size-8 rounded-lg",
}: {
  labels?: { toLight: string; toDark: string };
  className?: string;
}) {
  const theme = useAuth((s) => s.theme);
  const setAppearance = useAuth((s) => s.setAppearance);
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const dark = theme === "dark" || (theme === "system" && systemDark);
  const label = dark ? labels.toLight : labels.toDark;

  return (
    <button
      type="button"
      className={`grid ${className} shrink-0 cursor-pointer place-items-center border border-line bg-surface text-slate transition-colors hover:bg-surface-2 hover:text-ink-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green [&_svg]:size-4`}
      onClick={() => void setAppearance({ theme: dark ? "light" : "dark" })}
      title={label}
      aria-label={label}
    >
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}
