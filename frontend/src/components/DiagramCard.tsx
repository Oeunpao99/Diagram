import type { CSSProperties, ReactNode } from "react";

import type { DiagramListItem, DiagramType } from "../api/types";
import { timeAgo, tintFor, TYPE_LABEL, TypeGlyph } from "./templateVisuals";
import { Star, Trash } from "./icons";

/** One saved-diagram tile — used by My Diagrams, Recent, Favorites and a
 *  Project's own diagram grid, so a diagram looks the same everywhere it's
 *  listed. `trailing` is an extra control slot (e.g. "move to project"). */
export function DiagramCard({
  item,
  onOpen,
  onToggleFavorite,
  onDelete,
  trailing,
}: {
  item: DiagramListItem;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  trailing?: ReactNode;
}) {
  const type = item.diagram_type as DiagramType;
  const [bg, line, ink] = tintFor(type);
  return (
    <div
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-2"
      style={{ "--tint": bg, "--tint-line": line, "--tint-ink": ink } as CSSProperties}
    >
      <button
        className="grid aspect-[16/9] w-full place-items-center border-b border-line bg-[var(--tint)] text-[var(--tint-ink)] [&_svg]:size-9"
        onClick={onOpen}
        title={`Open “${item.title}”`}
      >
        <TypeGlyph type={type} />
      </button>
      <div className="flex items-start gap-2 p-3">
        <button className="min-w-0 flex-1 text-left" onClick={onOpen} title={`Open “${item.title}”`}>
          <span className="block truncate text-[13px] font-semibold leading-[1.3] text-ink group-hover:text-green-deep">
            {item.title}
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-soft">
            {TYPE_LABEL[type] ?? "Diagram"} · {timeAgo(item.updated_at)}
          </span>
        </button>
        {trailing}
        <button
          className={`grid size-7 shrink-0 place-items-center rounded-md border-none transition-colors [&_svg]:size-[14px] ${
            item.is_favorite
              ? "text-amber [&_svg]:fill-current"
              : "text-slate-soft opacity-0 hover:text-amber group-focus-within:opacity-100 group-hover:opacity-100"
          }`}
          onClick={onToggleFavorite}
          title={item.is_favorite ? "Remove from favorites" : "Add to favorites"}
          aria-label={item.is_favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star />
        </button>
        <button
          className="grid size-7 shrink-0 place-items-center rounded-md border-none text-slate-soft opacity-0 transition-colors hover:text-red group-focus-within:opacity-100 group-hover:opacity-100 [&_svg]:size-[13px]"
          onClick={onDelete}
          title="Delete"
          aria-label={`Delete “${item.title}”`}
        >
          <Trash />
        </button>
      </div>
    </div>
  );
}
