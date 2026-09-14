import { useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "dc.panel-width";
const MIN = 300;
const MAX = 640;
const DEFAULT = 360;

function clamp(width: number): number {
  const viewportCap = window.innerWidth * 0.6; // never eat the whole canvas
  return Math.min(MAX, viewportCap, Math.max(MIN, width));
}

function apply(width: number) {
  document.documentElement.style.setProperty("--panel", `${width}px`);
}

/** Restores the saved Copilot panel width once, before first paint would
 *  otherwise flash the default. Call from the app shell, not the panel
 *  itself, so it runs regardless of whether the panel is mounted yet. */
export function restorePanelWidth() {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    apply(saved > 0 ? clamp(saved) : DEFAULT);
  } catch {
    apply(DEFAULT);
  }
}

/** Drag-to-resize for the right-hand Copilot panel. Returns the props for a
 *  thin handle on the panel's left edge. */
export function usePanelResize() {
  const dragging = useRef(false);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    dragging.current = true;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      // The panel is flush against the right edge of the window, so its
      // width is just the remaining distance from the cursor to that edge.
      apply(clamp(window.innerWidth - event.clientX));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      const width = document.documentElement.style.getPropertyValue("--panel");
      try {
        localStorage.setItem(STORAGE_KEY, width.replace("px", ""));
      } catch {
        /* per-session only */
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return { onPointerDown };
}
