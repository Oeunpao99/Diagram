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

/** Hero, "Type a prompt" run: what a vague request ends up as once the two
 *  refining questions are answered (retry a failed payment, send tracking). */
export const CHECKOUT_FLOW = doc(
  "Customer orders",
  "process_flow",
  [
    n("order", "Customer order", "start", 0, 52, 140, 46),
    n("paid", "Paid?", "decision", 190, 26, 120, 98),
    n("dispatch", "Dispatch order", "process", 370, 0, 150, 58),
    n("track", "Send tracking ID", "end", 580, 6, 160, 46),
    n("retry", "Retry payment", "process", 370, 140, 150, 58),
  ],
  [
    e("order", "paid"),
    e("paid", "dispatch", "Yes"),
    e("dispatch", "track"),
    e("paid", "retry", "No", "b"),
  ],
);

/** Hero, "Upload a sketch" run: the hand-drawn leave approval, rebuilt. */
export const LEAVE_FLOW = doc(
  "Leave approval",
  "process_flow",
  [
    n("submit", "Submit leave", "start", 0, 52, 130, 46),
    n("approve", "Approve?", "decision", 180, 26, 130, 98),
    n("hr", "HR records", "end", 380, 0, 140, 46),
    n("notify", "Notify employee", "process", 380, 130, 160, 58),
  ],
  [e("submit", "approve"), e("approve", "hr", "Yes"), e("approve", "notify", "No", "b")],
);

export const ARCHITECTURE = doc(
  "Web app architecture",
  "architecture",
  [
    n("web", "Web app", "system", 0, 60, 140, 58),
    n("mobile", "Mobile app", "system", 0, 220, 140, 58),
    n("api", "API gateway", "service", 210, 140, 150, 58),
    n("auth", "Auth service", "service", 440, 0, 150, 58),
    n("orders", "Orders service", "service", 440, 140, 150, 58),
    n("payments", "Payments service", "service", 440, 280, 160, 58),
    n("db", "Postgres", "database", 680, 110, 130, 74),
    n("queue", "Job queue", "queue", 680, 250, 140, 58),
    n("bank", "Bank gateway", "cloud", 680, 380, 150, 70),
    n("worker", "Worker", "service", 900, 250, 130, 58),
    n("notify", "Email and SMS", "cloud", 1110, 244, 150, 70),
  ],
  [
    e("web", "api"),
    e("mobile", "api"),
    e("api", "auth"),
    e("api", "orders"),
    e("api", "payments"),
    e("orders", "db"),
    e("orders", "queue"),
    e("payments", "bank"),
    e("queue", "worker"),
    e("worker", "notify"),
  ],
);

export const DATA_FLOW = doc(
  "Sales analytics pipeline",
  "data_flow",
  [
    n("crm", "CRM export", "data", 0, 0, 150, 56),
    n("events", "Web events", "data", 0, 110, 150, 56),
    n("pos", "POS sales", "data", 0, 220, 150, 56),
    n("etl", "Clean and join", "process", 240, 109, 150, 58),
    n("checks", "Quality checks", "process", 470, 109, 150, 58),
    n("wh", "Warehouse", "database", 700, 101, 130, 74),
    n("dash", "Sales dashboard", "system", 910, 40, 160, 58),
    n("forecast", "Stock forecast", "process", 910, 180, 160, 58),
    n("alerts", "Low-stock alerts", "system", 1150, 180, 160, 58),
  ],
  [
    e("crm", "etl"),
    e("events", "etl"),
    e("pos", "etl"),
    e("etl", "checks"),
    e("checks", "wh"),
    e("wh", "dash"),
    e("wh", "forecast"),
    e("forecast", "alerts"),
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
