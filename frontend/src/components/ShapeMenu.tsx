import { useEffect, useRef, useState } from "react";

import { useCanvasAssets } from "../hooks/useCanvasAssets";
import { ASSET_LIBRARY } from "./assetLibrary";
import { BoxIcon, ChevronDown } from "./icons";

/** The toolbar's "insert a shape" button. Used to only ever place one fixed
 *  shape (a decision diamond) no matter what you clicked — this opens the
 *  same shape set the sidebar's Assets tab and the floating dock already
 *  offer, so all three stay in sync. Every option is click-to-place *and*
 *  drag-to-place, exactly like those two — dragging out of a popover works
 *  the same as dragging out of a docked panel. */
export function ShapeMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { addShape } = useCanvasAssets();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        className="group relative inline-flex items-center gap-1 rounded-[7px] border-none bg-transparent px-[7px] py-[5px] text-[11.5px] font-[550] text-slate transition-[background,color] hover:bg-paper hover:text-ink [&_svg]:size-3.5"
        title="Insert a shape"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <BoxIcon />
        <ChevronDown />
        <span className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-20 -translate-x-1/2 -translate-y-0.5 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10.5px] font-medium text-on-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Shape
        </span>
      </button>
      {open && (
        <div
          className="absolute left-1/2 top-[calc(100%+6px)] z-50 w-[236px] -translate-x-1/2 rounded-xl border border-line bg-surface p-3 shadow-3 animate-[menu-in_130ms_ease]"
          role="menu"
        >
          <p className="m-0 mb-2 text-[11px] leading-[1.4] text-slate">
            Click to drop one in the middle of the view, or drag it onto the
            canvas.
          </p>
          <div className="grid grid-cols-4 gap-[7px]">
            {ASSET_LIBRARY.map((asset) => (
              <button
                key={asset.kind}
                role="menuitem"
                className="grid aspect-square cursor-grab place-items-center rounded-md text-slate transition-[color,background-color] hover:bg-green-soft hover:text-green active:cursor-grabbing [&_svg]:size-[17px]"
                title={`${asset.label} — click or drag onto the canvas`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/copilot-asset", asset.kind);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                // Closed here rather than on dragstart — the drag has to
                // actually begin (the browser has already snapshotted the
                // element and data) before it's safe to unmount the popover
                // out from under it.
                onDragEnd={() => setOpen(false)}
                onClick={() => {
                  addShape(asset.kind, asset.label, undefined, asset.size);
                  setOpen(false);
                }}
              >
                {asset.icon()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
