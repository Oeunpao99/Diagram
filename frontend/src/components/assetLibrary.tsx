import type { ReactNode } from "react";

import type { NodeKind } from "../api/types";
import {
  BoxIcon,
  CircleIcon,
  CloudIcon,
  Cpu,
  DatabaseIcon,
  DataIcon,
  DiamondIcon,
  FileText,
  HexagonIcon,
  NoteIcon,
  OctagonIcon,
  PentagonIcon,
  PillIcon,
  QueueIcon,
  ServerIcon,
  StarIcon,
  TagIcon,
  TriangleIcon,
  ArrowRightIcon,
  UserIcon,
} from "./icons";

export interface AssetSpec {
  kind: NodeKind;
  label: string;
  icon: () => ReactNode;
  /** Default box for shapes that only read as themselves when square/ranked
   *  (a circle in a wide box is an ellipse; a triangle in a short one is a
   *  sliver). Omitted specs keep the generic 196x70 process box.
   */
  size?: { width: number; height: number };
}

/**
 * The shape palette offered everywhere a shape can be dragged onto the
 * canvas — the floating on-canvas dock, the sidebar's Assets tab, and the
 * toolbar's Shape menu. Kept in one place, covering every NodeKind, so
 * dragging an icon, clicking it, or picking it from any of those three
 * always produces the same node and none of them falls behind the others.
 *
 * Order matters a little: the compact floating dock only ever shows the
 * first four (see AssetsDock's `.slice(0, 4)`), so those four lead with the
 * most-reached-for, most visually distinct shapes rather than two identical
 * pills back to back.
 */
export const ASSET_LIBRARY: AssetSpec[] = [
  { kind: "process", label: "Process", icon: BoxIcon },
  { kind: "decision", label: "Decision", icon: DiamondIcon },
  { kind: "database", label: "Database", icon: DatabaseIcon },
  { kind: "actor", label: "Actor", icon: UserIcon },
  { kind: "service", label: "Service", icon: ServerIcon },
  { kind: "system", label: "System", icon: Cpu },
  { kind: "cloud", label: "Cloud", icon: CloudIcon },
  { kind: "document", label: "Document", icon: FileText },
  { kind: "data", label: "Data", icon: DataIcon },
  { kind: "queue", label: "Queue", icon: QueueIcon },
  { kind: "note", label: "Note", icon: NoteIcon },
  { kind: "start", label: "Start", icon: PillIcon },
  { kind: "end", label: "End", icon: PillIcon },
  { kind: "circle", label: "Circle", icon: CircleIcon, size: { width: 148, height: 148 } },
  { kind: "hexagon", label: "Hexagon", icon: HexagonIcon },
  { kind: "octagon", label: "Octagon", icon: OctagonIcon },
  { kind: "triangle", label: "Triangle", icon: TriangleIcon, size: { width: 160, height: 110 } },
  { kind: "pentagon", label: "Pentagon", icon: PentagonIcon, size: { width: 160, height: 120 } },
  { kind: "star", label: "Star", icon: StarIcon, size: { width: 150, height: 150 } },
  { kind: "tag", label: "Tag", icon: TagIcon, size: { width: 196, height: 84 } },
  { kind: "arrow", label: "Arrow", icon: ArrowRightIcon, size: { width: 196, height: 90 } },
];
