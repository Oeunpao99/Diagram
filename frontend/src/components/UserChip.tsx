import { useAuth } from "../store/useAuth";
import { useSettings } from "../store/useSettings";
import { ChevronRight, Settings } from "./icons";

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
      className="user-chip"
      onClick={() => openSettings("profile")}
      title="Open settings"
      aria-label="User settings"
    >
      <span className="user-chip__avatar">{initials(user.name)}</span>
      <span className="user-chip__meta">
        <strong>{user.name}</strong>
        <span>{user.email}</span>
      </span>
      <span className="user-chip__actions">
        <ChevronRight />
      </span>
      <span className="user-chip__gear">
        <Settings />
      </span>
    </button>
  );
}