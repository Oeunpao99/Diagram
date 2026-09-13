import { useReactFlow, useStore } from "@xyflow/react";
import type { ReactNode } from "react";

import { useDiagram } from "../store/useDiagram";
import {
  BoxIcon,
  GitBranch,
  ImageIcon,
  Layers,
  Maximize,
  MousePointer,
  Pan,
  Square,
  TypeIcon,
  ZoomIn,
  ZoomOut,
} from "./icons";

export type Tool =
  | "select"
  | "hand"
  | "node"
  | "text"
  | "shape"
  | "connector"
  | "image"
  | "group";

const TOOLS: { id: Tool; label: string; icon: () => ReactNode }[] = [
  { id: "select", label: "Select", icon: MousePointer },
  { id: "hand", label: "Hand", icon: Pan },
  { id: "node", label: "Node", icon: Square },
  { id: "text", label: "Text", icon: TypeIcon },
  { id: "shape", label: "Shape", icon: BoxIcon },
  { id: "connector", label: "Connector", icon: GitBranch },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "group", label: "Group", icon: Layers },
];

export function CanvasToolbar({
  tool,
  onTool,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const autoLayout = useDiagram((s) => s.autoLayout);
  const empty = useDiagram((s) => s.doc.nodes.length === 0);
  const busy = useDiagram((s) => s.busy);

  return (
    <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
      {TOOLS.map((item) => (
        <button
          key={item.id}
          className={`tool ${tool === item.id ? "is-active" : ""}`}
          onClick={() => onTool(item.id)}
          title={item.label}
          aria-pressed={tool === item.id}
        >
          {item.icon()}
          <span className="tool__tip">{item.label}</span>
        </button>
      ))}

      <div className="canvas-toolbar__end">
        <button
          className="tool"
          title="Auto layout"
          onClick={() => void autoLayout()}
          disabled={empty || busy !== null}
        >
          <Layers />
          Auto Layout
          <span className="tool__tip">Re-arrange automatically</span>
        </button>
        <span className="tool__sep" />
        <div className="zoom">
          <button
            className="zoom__btn"
            onClick={() => void zoomOut({ duration: 160 })}
            title="Zoom out"
          >
            <ZoomOut />
          </button>
          <span className="zoom__value">{Math.round(zoom * 100)}%</span>
          <button
            className="zoom__btn"
            onClick={() => void zoomIn({ duration: 160 })}
            title="Zoom in"
          >
            <ZoomIn />
          </button>
        </div>
        <button
          className="tool"
          onClick={() => void fitView({ padding: 0.2, duration: 260 })}
          title="Fit canvas"
        >
          <Maximize />
          Fit Canvas
        </button>
      </div>
    </div>
  );
}