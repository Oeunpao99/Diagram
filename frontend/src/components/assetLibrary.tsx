import type { ReactNode } from "react";

import type { NodeKind } from "../api/types";
import { BoxIcon, CloudIcon, DatabaseIcon, FileText, GitBranch, ServerIcon, Square, UserIcon } from "./icons";

export interface AssetSpec {
  kind: NodeKind;
  label: string;
  icon: () => ReactNode;
}

/**
 * The shape palette offered by both the floating on-canvas dock and the
 * sidebar's Assets tab. Kept in one place so dragging an icon and clicking it
 * always produce the same node.
 */
export const ASSET_LIBRARY: AssetSpec[] = [
  { kind: "actor", label: "User", icon: UserIcon },
  { kind: "service", label: "Server", icon: ServerIcon },
  { kind: "database", label: "Database", icon: DatabaseIcon },
  { kind: "cloud", label: "Cloud", icon: CloudIcon },
  { kind: "process", label: "Process", icon: BoxIcon },
  { kind: "decision", label: "Decision", icon: GitBranch },
  { kind: "document", label: "Document", icon: FileText },
  { kind: "queue", label: "Queue", icon: Square },
];
