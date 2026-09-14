import { useEffect, useRef, useState } from "react";

import type { Direction } from "../api/types";
import { useDiagram } from "../store/useDiagram";
import { ArrowRight, Check, ChevronDown } from "./icons";

const DIRECTIONS: { id: Direction; label: string; rotate: number }[] = [
  { id: "LR", label: "Left to right", rotate: 0 },
  { id: "RL", label: "Right to left", rotate: 180 },
  { id: "TB", label: "Top to bottom", rotate: 90 },
  { id: "BT", label: "Bottom to top", rotate: -90 },
];

/** One arrow icon, rotated per direction, instead of four bespoke glyphs. */
function DirectionArrow({ rotate }: { rotate: number }) {
  return (
    <span className="inline-flex" style={{ transform: `rotate(${rotate}deg)` }}>
      <ArrowRight />
    </span>
  );
}

/** Re-run auto layout flowing a different way — the same "layered" hierarchy
 *  the AI already produces, just read left-to-right, right-to-left, top-down
 *  or bottom-up. Swimlane diagrams keep their own axis regardless (autoLayout
 *  picks the "swimlane" algorithm whenever the doc has lanes). */
export function DirectionMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const direction = useDiagram((s) => s.doc.direction);
  const autoLayout = useDiagram((s) => s.autoLayout);
  const empty = useDiagram((s) => s.doc.nodes.length === 0);
  const busy = useDiagram((s) => s.busy);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const current = DIRECTIONS.find((d) => d.id === direction) ?? DIRECTIONS[0];

  const pick = (id: Direction) => {
    setOpen(false);
    if (id !== direction) void autoLayout(id);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        className="group relative inline-flex items-center gap-1.5 rounded-[7px] border-none bg-transparent px-[7px] py-[5px] text-[11.5px] font-[550] text-slate transition-[background,color] hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5"
        title="Flow direction"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={empty || busy !== null}
      >
        <DirectionArrow rotate={current.rotate} />
        Direction
        <ChevronDown />
      </button>
      {open && (
        <div
          className="absolute left-1/2 top-[calc(100%+6px)] z-50 min-w-[180px] -translate-x-1/2 rounded-xl border border-line bg-surface p-[5px] shadow-3 animate-[menu-in_130ms_ease]"
          role="menu"
        >
          {DIRECTIONS.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-ink hover:bg-surface-2 [&_svg]:size-[13px] [&_svg]:shrink-0 [&_svg]:text-slate"
              onClick={() => pick(item.id)}
            >
              <DirectionArrow rotate={item.rotate} />
              <span className="flex-1">{item.label}</span>
              {item.id === direction && (
                <span className="text-green">
                  <Check />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
