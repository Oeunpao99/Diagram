import { makeNode } from "../../api/adapter";
import type { DiagramDoc, DiagramEdge, DiagramNode, NodeKind } from "../../api/types";

/** Sample diagrams for the landing page. They are plain DiagramDocs, rendered
 *  by the same node components and edge router as the editor, so what a
 *  visitor sees on the page is what they get in the app. */

function n(
  id: string,
  label: string,
  kind: NodeKind,
  x: number,
  y: number,
  width: number,
  height: number,
): DiagramNode {
  return makeNode({ id, label, kind, position: { x, y }, size: { width, height } });
}

function e(
  source: string,
  target: string,
  label?: string,
  sourceHandle?: string,
): DiagramEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    label: label ?? null,
    source_handle: sourceHandle ?? null,
    target_handle: null,
    style: "solid",
  };
}

function doc(
  title: string,
  diagram_type: DiagramDoc["diagram_type"],
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): DiagramDoc {
  return {
    title,
    diagram_type,
    direction: "LR",
    summary: null,
    nodes,
    edges,
    lanes: [],
    groups: [],
    meta: {},
  };
}

export const ORDER_FLOW = doc(
  "Order approval",
  "process_flow",
  [
    n("start", "Order placed", "start", 0, 52, 120, 46),
    n("stock", "Check stock", "process", 170, 46, 150, 58),
    n("avail", "In stock?", "decision", 370, 26, 150, 98),
    n("charge", "Charge card", "process", 590, 0, 150, 58),
    n("save", "Save order", "database", 800, -8, 130, 74),
    n("notify", "Tell customer", "process", 590, 138, 150, 58),
    n("end", "Closed", "end", 800, 144, 120, 46),
  ],
  [
    e("start", "stock"),
    e("stock", "avail"),
    e("avail", "charge", "Yes"),
    e("charge", "save"),
    e("avail", "notify", "No", "b"),
    e("notify", "end"),
  ],
);

export const ARCHITECTURE = doc(
  "Web app architecture",
  "architecture",
  [
    n("web", "Web app", "system", 0, 78, 140, 58),
    n("api", "API gateway", "service", 200, 78, 150, 58),
    n("auth", "Auth service", "service", 420, 0, 150, 58),
    n("orders", "Orders service", "service", 420, 156, 150, 58),
    n("db", "Postgres", "database", 650, 76, 130, 74),
    n("queue", "Job queue", "queue", 650, 220, 140, 58),
    n("worker", "Worker", "service", 850, 220, 130, 58),
  ],
  [
    e("web", "api"),
    e("api", "auth"),
    e("api", "orders"),
    e("orders", "db"),
    e("orders", "queue", undefined, "b"),
    e("queue", "worker"),
  ],
);

export const DATA_FLOW = doc(
  "Analytics pipeline",
  "data_flow",
  [
    n("crm", "CRM export", "data", 0, 0, 150, 56),
    n("events", "Web events", "data", 0, 110, 150, 56),
    n("etl", "Clean & join", "process", 230, 50, 150, 58),
    n("wh", "Warehouse", "database", 460, 40, 130, 74),
    n("dash", "Dashboard", "system", 670, 49, 150, 58),
  ],
  [
    e("crm", "etl"),
    e("events", "etl"),
    e("etl", "wh"),
    e("wh", "dash"),
  ],
);

export const SHOWCASE = [
  {
    id: "flow",
    label: "Process flow",
    blurb: "Decisions, branches and hand-offs, laid out so the happy path reads left to right.",
    doc: ORDER_FLOW,
  },
  {
    id: "arch",
    label: "Architecture",
    blurb: "Services, databases and queues, with connectors that route around shapes instead of through them.",
    doc: ARCHITECTURE,
  },
  {
    id: "data",
    label: "Data flow",
    blurb: "Follow a record from source to dashboard and see every transformation in between.",
    doc: DATA_FLOW,
  },
] as const;
