import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "dc.panel-width";
const COLLAPSED_KEY = "dc.panel-collapsed";
const MIN = 300;
const MAX = 640;
const DEFAULT = 360;
const COLLAPSED_WIDTH = 44;

function clamp(width: number): number {
  const viewportCap = window.innerWidth * 0.6; // never eat the whole canvas
  return Math.min(MAX, viewportCap, Math.max(MIN, width));
}

function apply(width: number) {
  document.documentElement.style.setProperty("--panel", `${width}px`);
}

function savedWidth(): number {
  const saved = Number(localStorage.getItem(STORAGE_KEY));
  return saved > 0 ? clamp(saved) : DEFAULT;
}

function isCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Restores the saved Copilot panel width (or its collapsed rail) once,
 *  before first paint would otherwise flash the default. Call from the app
 *  shell, not the panel itself, so it runs regardless of whether the panel
 *  is mounted yet. */
export function restorePanelWidth() {
  try {
    apply(isCollapsed() ? COLLAPSED_WIDTH : savedWidth());
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

/** Collapse the Copilot panel down to a slim icon rail, or restore it to
 *  whatever width it was dragged to before. The width itself keeps living in
 *  the `--panel` CSS var (same one drag-resize writes to) so collapsing is
 *  just "temporarily point that var at a fixed slim width" rather than a
 *  second, competing layout mechanism. */
export function usePanelCollapse() {
  const [collapsed, setCollapsed] = useState(isCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((was) => {
      const next = !was;
      apply(next ? COLLAPSED_WIDTH : savedWidth());
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* per-session only */
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
