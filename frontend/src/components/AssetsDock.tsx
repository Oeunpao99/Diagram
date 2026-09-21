import { useRef, useState } from "react";

import { ASSET_LIBRARY } from "./assetLibrary";
import { useCanvasAssets } from "../hooks/useCanvasAssets";
import { ImageIcon, TypeIcon, Upload } from "./icons";

export function AssetsDock() {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addImage } = useCanvasAssets();

  return (
    <>
      <div
        className="absolute left-4 top-[62px] z-[8] flex flex-col gap-1 rounded-[11px] border border-line bg-surface p-[5px] shadow-2"
        role="toolbar"
        aria-label="Assets"
      >
        <button
          className="grid size-[30px] place-items-center rounded-lg border-none bg-transparent text-slate transition-colors hover:bg-paper hover:text-green-deep [&_svg]:size-[15px]"
          title="Upload image"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon />
        </button>
        <button className="grid size-[30px] place-items-center rounded-lg border-none bg-transparent text-slate transition-colors hover:bg-paper hover:text-green-deep [&_svg]:size-[15px]" title="Add text" onClick={() => setOpen((v) => !v)}>
          <TypeIcon />
        </button>
        <span className="h-px w-full bg-line" />
        {ASSET_LIBRARY.slice(0, 4).map((asset) => (
          <button
            key={asset.kind}
            className="grid size-[30px] place-items-center rounded-lg border-none bg-transparent text-slate transition-colors hover:bg-paper hover:text-green-deep [&_svg]:size-[15px]"
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
        <button className="grid size-[30px] place-items-center rounded-lg border-none bg-transparent text-slate transition-colors hover:bg-paper hover:text-green-deep" title="More assets" onClick={() => setOpen((v) => !v)}>
          <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>+</span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) addImage(file);
          event.target.value = "";
        }}
      />

      {open && (
        <div className="absolute left-[calc(100%+8px)] top-0 z-30 w-[224px] animate-[menu-in_130ms_ease] rounded-xl border border-line bg-surface p-3 shadow-3">
          <h4 className="m-0 mb-0.5 text-[13px] text-ink">Assets</h4>
          <p className="m-0 mb-[9px] text-[11.5px] leading-[1.45] text-slate">
            Upload an image, or drag an icon onto the canvas to place it.
          </p>
          <button
            className="flex w-full items-center justify-center gap-[7px] rounded-[9px] border-[1.5px] border-dashed border-line bg-surface-2 px-2 py-[9px] text-xs font-[550] text-slate transition-all hover:border-green hover:bg-green-soft hover:text-green-deep [&_svg]:size-3.5"
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
            Upload image
          </button>
          <div className="mt-2.5 grid grid-cols-4 gap-1">
            {ASSET_LIBRARY.map((asset) => (
              <span
                key={asset.kind}
                className="grid aspect-square cursor-grab place-items-center rounded-lg text-[9.5px] text-slate transition-[color,background-color] hover:bg-green-soft hover:text-green-deep [&_svg]:size-4"
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
