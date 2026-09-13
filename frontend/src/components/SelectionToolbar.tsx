import { Copy, GitBranch, LinkIcon, Pencil, Shuffle, Trash } from "./icons";

export interface SelectionToolbarProps {
  x: number;
  y: number;
  onEdit: () => void;
  onDuplicate: () => void;
  onChangeShape: () => void;
  onConnect: () => void;
  onDelete: () => void;
}

export function SelectionToolbar({
  x,
  y,
  onEdit,
  onDuplicate,
  onChangeShape,
  onConnect,
  onDelete,
}: SelectionToolbarProps) {
  return (
    <div
      className="sel-toolbar"
      role="toolbar"
      aria-label="Node actions"
      style={{ left: x, top: y - 10, transform: "translate(-50%, -100%)" }}
    >
      <button className="sel-toolbar__item" onClick={onEdit}>
        <Pencil />
        Edit
      </button>
      <button className="sel-toolbar__item" onClick={onDuplicate}>
        <Copy />
        Duplicate
      </button>
      <button className="sel-toolbar__item" onClick={onChangeShape}>
        <Shuffle />
        Change Shape
      </button>
      <span className="sel-toolbar__sep" />
      <button className="sel-toolbar__item" onClick={onConnect}>
        <LinkIcon />
        Connect
      </button>
      <button className="sel-toolbar__item" onClick={onConnect}>
        <GitBranch />
      </button>
      <button className="sel-toolbar__item sel-toolbar__item--danger" onClick={onDelete}>
        <Trash />
        Delete
      </button>
    </div>
  );
}