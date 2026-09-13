import { useAuth } from "../store/useAuth";
import { useSettings } from "../store/useSettings";
import { ChevronRight } from "./icons";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function UserChip() {
  const user = useAuth((s) => s.user);
  const openSettings = useSettings((s) => s.openSettings);

  if (!user) return null;

  return (
    <button
      className="flex w-full cursor-pointer items-center gap-[9px] rounded-[10px] border border-line bg-surface-2 px-[9px] py-[7px] text-inherit transition-[border-color,background,box-shadow] hover:border-line-strong hover:bg-surface hover:shadow-2"
      onClick={() => openSettings("profile")}
      title="Open settings"
      aria-label="User settings"
    >
      <span className="grid size-[26px] shrink-0 place-items-center rounded-lg bg-green-soft text-[11px] font-bold uppercase text-green-strong">
        {initials(user.name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left leading-[1.25]">
        <strong className="truncate text-[11.5px] font-semibold text-ink">{user.name}</strong>
        <span className="truncate text-[10px] text-slate-soft">{user.email}</span>
      </span>
      <span className="shrink-0 text-slate-soft [&_svg]:size-3">
        <ChevronRight />
      </span>
    </button>
  );
}