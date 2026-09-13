import { useStore } from "@xyflow/react";

import { useDiagram } from "../store/useDiagram";
import { CircleDot, Save, ZoomIn } from "./icons";

function useZoomPercent() {
  return useStore((s) => Math.round(s.transform[2] * 100));
}

export function StatusBar() {
  const doc = useDiagram((s) => s.doc);
  const zoom = useZoomPercent();

  const bounds = doc.nodes.reduce(
    (acc, node) => ({
      x: Math.max(acc.x, node.position.x + node.size.width),
      y: Math.max(acc.y, node.position.y + node.size.height),
    }),
    { x: 0, y: 0 },
  );

  return (
    <footer className="statusbar">
      <div className="statusbar__side">
        <span className="statusbar__item">
          <CircleDot />
          {doc.nodes.length} nodes
        </span>
        <span className="statusbar__item">
          <GitBranchMini />
          {doc.edges.length} connections
        </span>
        <span className="statusbar__divider" />
        <span className="statusbar__item">
          <span className="statusbar__led" />
          Auto-save enabled
        </span>
      </div>

      <div className="statusbar__side statusbar__side--right">
        <span className="statusbar__item">
          <ZoomIn />
          Zoom {zoom}%
        </span>
        <span className="statusbar__item">
          Canvas {Math.round(bounds.x)} × {Math.round(bounds.y)}
        </span>
        <span className="statusbar__item">
          <Save />
          Grid on
        </span>
      </div>
    </footer>
  );
}

function GitBranchMini() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="3.4" />
      <circle cx="7" cy="17" r="3.4" />
      <circle cx="17" cy="8" r="3.4" />
      <path d="M7 10.4v3.2M7 12h6.5a3.5 3.5 0 0 1 3.5 3.5" />
    </svg>
  );
}