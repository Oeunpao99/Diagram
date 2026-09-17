import type { SlashCommand } from "../lib/slashCommands";

/** The popover that appears above the composer once its text starts with
 *  "/" — filtered to whatever's typed so far. Purely presentational:
 *  keyboard navigation (arrows/Enter/Escape) lives in Copilot.tsx's own
 *  textarea handler, since that's what already owns focus and Enter-to-send. */
export function SlashCommandMenu({
  matches,
  highlightedIndex,
  onHover,
  onPick,
}: {
  matches: SlashCommand[];
  highlightedIndex: number;
  onHover: (index: number) => void;
  onPick: (cmd: string) => void;
}) {
  if (matches.length === 0) return null;

  return (
    <div
      className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-3 animate-[menu-in_130ms_ease]"
      role="listbox"
    >
      {matches.map((command, index) => (
        <button
          key={command.cmd}
          type="button"
          role="option"
          aria-selected={index === highlightedIndex}
          className={`flex w-full items-center justify-between gap-3 px-3 py-[7px] text-left text-[12.5px] transition-colors ${
            index === highlightedIndex ? "bg-green-soft text-green-deep" : "text-ink hover:bg-paper"
          }`}
          onMouseEnter={() => onHover(index)}
          onClick={() => onPick(command.cmd)}
        >
          <span className="font-[600]">{command.cmd}</span>
          <span className="truncate text-[11px] text-slate-soft">{command.description}</span>
        </button>
      ))}
    </div>
  );
}
