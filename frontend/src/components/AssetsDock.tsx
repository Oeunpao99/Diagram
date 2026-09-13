import { useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import type { ReactNode } from "react";

import { makeNode, type NewNodeSpec } from "../api/adapter";
import { useDiagram } from "../store/useDiagram";
import type { NodeKind } from "../api/types";
import {
  BoxIcon,
  CloudIcon,
  DatabaseIcon,
  ImageIcon,
  ServerIcon,
  TypeIcon,
  Upload,
  UserIcon,
} from "./icons";

const ASSETS: { kind: NodeKind; label: string; icon: () => ReactNode }[] = [
  { kind: "actor", label: "User", icon: UserIcon },
  { kind: "service", label: "Server", icon: ServerIcon },
  { kind: "database", label: "Database", icon: DatabaseIcon },
  { kind: "cloud", label: "Cloud", icon: CloudIcon },
  { kind: "process", label: "Box", icon: BoxIcon },
  { kind: "document", label: "Shape", icon: TypeIcon },
];

export function AssetsDock() {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const addNode = (spec: NewNodeSpec) => {
    const doc = useDiagram.getState().doc;
    useDiagram.getState().setDoc({
      ...doc,
      nodes: [...doc.nodes, makeNode(spec)],
    });
  };

  const centerPoint = () =>
    screenToFlowPosition({
      x: (document.querySelector<HTMLElement>(".stage")?.offsetWidth ?? 800) / 2,
      y: (document.querySelector<HTMLElement>(".stage")?.offsetHeight ?? 600) / 2,
    });

  const onImagePicked = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      addNode({
        id: `img_${Date.now().toString(36)}`,
        label: file.name,
        kind: "note",
        position: centerPoint(),
        imageUrl: String(reader.result),
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className="assets" role="toolbar" aria-label="Assets">
        <button
          className="assets__item"
          title="Upload image"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon />
        </button>
        <button className="assets__item" title="Add text" onClick={() => setOpen((v) => !v)}>
          <TypeIcon />
        </button>
        <span className="assets__sep" />
        {ASSETS.slice(0, 4).map((asset) => (
          <button
            key={asset.kind}
            className="assets__item"
            title={`Drag ${asset.label}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/copilot-asset", asset.kind);
              event.dataTransfer.effectAllowed = "copy";
            }}
          >
            {asset.icon()}
          </button>
        ))}
        <button className="assets__item" title="More assets" onClick={() => setOpen((v) => !v)}>
          <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>+</span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => onImagePicked(event.target.files?.[0])}
      />

      {open && (
        <div className="assets__panel">
          <h4>Assets</h4>
          <p>Upload an image, or drag an icon onto the canvas to place it.</p>
          <button className="assets__upload" onClick={() => fileRef.current?.click()}>
            <Upload />
            Upload image
          </button>
          <div className="assets__grid">
            {ASSETS.map((asset) => (
              <span
                key={asset.kind}
                className="assets__icon"
                title={`${asset.label} (drag me)`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/copilot-asset", asset.kind);
                  event.dataTransfer.effectAllowed = "copy";
                }}
              >
                {asset.icon()}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}