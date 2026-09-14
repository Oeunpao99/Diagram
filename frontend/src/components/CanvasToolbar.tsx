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
  const selectionCount = useDiagram((s) => s.selection.length);

  return (
    <div
      className="absolute left-1/2 top-[14px] z-[8] flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-[10px] border border-line bg-surface p-1 shadow-2"
      role="toolbar"
      aria-label="Canvas tools"
    >
      {TOOLS.map((item) => (
        <button
          key={item.id}
          className={`group relative inline-flex items-center gap-1.5 rounded-[7px] border-none bg-transparent px-[7px] py-[5px] text-[11.5px] font-[550] text-slate transition-[background,color] hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5 ${tool === item.id ? "bg-green-soft text-green-deep" : ""}`}
          onClick={() => onTool(item.id)}
          title={item.id === "group" && selectionCount < 2 ? "Select 2+ nodes to group" : item.label}
          aria-pressed={tool === item.id}
          disabled={item.id === "group" && selectionCount < 2}
        >
          {item.icon()}
          <span className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-20 -translate-x-1/2 -translate-y-0.5 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10.5px] font-medium text-on-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {item.label}
          </span>
        </button>
      ))}

      <div className="ml-1.5 flex items-center gap-0.5 border-l border-line pl-1.5 max-[900px]:hidden">
        <button
          className="group relative inline-flex items-center gap-1.5 rounded-[7px] border-none bg-transparent px-[7px] py-[5px] text-[11.5px] font-[550] text-slate transition-[background,color] hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5"
          title="Auto layout"
          onClick={() => void autoLayout()}
          disabled={empty || busy !== null}
        >
          <Layers />
          Auto Layout
          <span className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-20 -translate-x-1/2 -translate-y-0.5 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10.5px] font-medium text-on-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Re-arrange automatically
          </span>
        </button>
        <span className="mx-1 my-[3px] w-px self-stretch bg-line" />
        <div className="inline-flex items-center gap-px text-slate">
          <button
            className="grid size-6 place-items-center rounded-md border-none bg-transparent text-slate hover:bg-paper hover:text-ink [&_svg]:size-[13px]"
            onClick={() => void zoomOut({ duration: 160 })}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut />
          </button>
          <span className="w-11 text-center text-[11.5px] font-semibold tabular-nums tracking-[0.02em] text-ink">
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="grid size-6 place-items-center rounded-md border-none bg-transparent text-slate hover:bg-paper hover:text-ink [&_svg]:size-[13px]"
            onClick={() => void zoomIn({ duration: 160 })}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn />
          </button>
        </div>
        <button
          className="group relative inline-flex items-center gap-1.5 rounded-[7px] border-none bg-transparent px-[7px] py-[5px] text-[11.5px] font-[550] text-slate transition-[background,color] hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5"
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