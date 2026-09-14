import { useReactFlow } from "@xyflow/react";

import { makeNode, type NewNodeSpec } from "../api/adapter";
import type { NodeKind } from "../api/types";
import { useDiagram } from "../store/useDiagram";

/**
 * Shared "drop something onto the canvas" logic — used by the floating
 * AssetsDock and the sidebar's Assets tab, so there is one place that knows
 * how to size a new shape or image and land it in the middle of the view.
 */
export function useCanvasAssets() {
  const { screenToFlowPosition } = useReactFlow();

  const centerPoint = () =>
    screenToFlowPosition({
      x: (document.querySelector<HTMLElement>(".stage")?.offsetWidth ?? 800) / 2,
      y: (document.querySelector<HTMLElement>(".stage")?.offsetHeight ?? 600) / 2,
    });

  const addNode = (spec: NewNodeSpec) => {
    const doc = useDiagram.getState().doc;
    useDiagram.getState().setDoc({
      ...doc,
      nodes: [...doc.nodes, makeNode(spec)],
    });
  };

  const addShape = (kind: NodeKind, label: string, position?: { x: number; y: number }) => {
    addNode({
      id: `${kind}_${Date.now().toString(36)}`,
      label,
      kind,
      position: position ?? centerPoint(),
    });
  };

  /** Any already-encoded "data:..." URL — an uploaded file after FileReader,
   *  or an AI-generated SVG built straight from a string, no File involved. */
  const addImageDataUrl = (
    dataUrl: string,
    label: string,
    position?: { x: number; y: number },
    size?: { width: number; height: number },
  ) => {
    addNode({
      id: `img_${Date.now().toString(36)}`,
      label,
      kind: "note",
      position: position ?? centerPoint(),
      imageUrl: dataUrl,
      size,
    });
  };

  const addImage = (file: File, position?: { x: number; y: number }) => {
    const reader = new FileReader();
    reader.onload = () => addImageDataUrl(String(reader.result), file.name, position);
    reader.readAsDataURL(file);
  };

  return { addShape, addImage, addImageDataUrl };
}
