import {
  BarChart3,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  FileText,
  GitBranch,
  Key,
  Layers,
  MapPin,
  PackageCheck,
  Route,
  Router,
  Ship,
  ShoppingCart,
  Truck,
  UserCheck,
  Users,
  Warehouse,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { DiagramType } from "../api/types";

/** Shared per-diagram-type visuals — used by the in-editor Templates rail and
 *  the standalone Template Library page, so a template reads identically in
 *  both places rather than drifting into two separate visual languages. */

export const TYPE_LABEL: Record<DiagramType, string> = {
  process_flow: "Process",
  swimlane: "Swimlane",
  architecture: "Architecture",
  network: "Network",
  sequence: "Sequence",
  er: "Entity-rel.",
  data_flow: "Data flow",
  org_chart: "Org chart",
  mind_map: "Mind map",
  tree: "Tree",
  radial: "Circle diagram",
};

/** Tint (bg, border, ink) per diagram type, matching the old rail thumb hues. */
const TYPE_HUE: Record<DiagramType, string> = {
  process_flow: "violet",
  swimlane: "blue",
  architecture: "navy",
  network: "teal",
  sequence: "amber",
  er: "pink",
  data_flow: "green",
  org_chart: "orange",
  mind_map: "red",
  tree: "emerald",
  radial: "gold",
};

const TINT: Record<string, [string, string, string]> = {
  violet: ["#f1eefc", "#e2dcf8", "#6a5bd5"],
  blue: ["#ebf0fc", "#dae4f7", "#4a76cf"],
  navy: ["#eaf0f6", "#d6e0ea", "#48617e"],
  teal: ["#e4f4f5", "#cfe8ea", "#2b8a94"],
  amber: ["#f8f0de", "#efdfbc", "#b57a22"],
  pink: ["#fae9f1", "#f2d4e2", "#b84b78"],
  green: ["#e2f4ec", "#c9e9d9", "#1d9a6c"],
  orange: ["#faece3", "#f2d7c7", "#c1763a"],
  red: ["#fae8e6", "#f2d2cf", "#c6574f"],
  emerald: ["#e5f3ec", "#cfe8db", "#1f9d6e"],
  gold: ["#fdf3d9", "#f6e3ac", "#a67c1b"],
};

export function tintFor(type: DiagramType) {
  const hue = TYPE_HUE[type];
  return TINT[hue] ?? ["#eaf0f6", "#d6e0ea", "#48617e"];
}

/** Backend categories are lowercase slugs; present them product-first. */
const CATEGORY_LABEL: Record<string, string> = {
  it: "IT & Software",
  project: "Project Management",
};

export function categoryLabel(category: string): string {
  return (
    CATEGORY_LABEL[category] ?? category[0].toUpperCase() + category.slice(1)
  );
}

/** Compact "x min ago"-style age for a saved-diagrams list. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** A clean 20x20 mark per diagram type, drawn in the current tint ink. */
export function TypeGlyph({ type }: { type: DiagramType }) {
  const s = {
    viewBox: "0 0 24 24",
    width: 20,
    height: 20,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (type) {
    case "swimlane":
      return (
        <svg {...s}>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <path d="M9 6v12" opacity="0.45" />
        </svg>
      );
    case "architecture":
      return (
        <svg {...s}>
          <rect x="4" y="4.5" width="16" height="4.6" rx="1.4" />
          <rect x="6" y="14.9" width="12" height="4.6" rx="1.4" />
        </svg>
      );
    case "network":
      return (
        <svg {...s}>
          <circle cx="7" cy="17" r="3.2" />
          <circle cx="17" cy="7" r="3.2" />
          <circle cx="17.7" cy="16.6" r="1.1" opacity="0.5" />
          <path d="M9.2 15.3 14.8 8.7" />
        </svg>
      );
    case "sequence":
      return (
        <svg {...s}>
          <path d="M7 3.5v17M17 3.5v17" strokeDasharray="2 2.4" />
          <path d="M7.6 8.2h6.8M11.6 10.7l2.8-2.5L11.6 5.7" />
          <path d="M16.4 13.8H9.6M12.4 16.3l-2.8 2.5 2.8 2.5" />
        </svg>
      );
    case "er":
      return (
        <svg {...s}>
          <rect x="4" y="3.5" width="16" height="17" rx="2" />
          <path d="M4 8.2h16" />
          <path d="M7.4 8.2V5.4h2.4" />
          <circle cx="8.2" cy="11.6" r="1" fill="currentColor" stroke="none" />
          <path d="M10.8 11.6h7" />
          <circle cx="8.2" cy="15.8" r="1" fill="currentColor" stroke="none" />
          <path d="M10.8 15.8h7" />
        </svg>
      );
    case "org_chart":
      return (
        <svg {...s}>
          <rect x="8" y="3" width="8" height="4.8" rx="1.5" />
          <rect x="3.5" y="16.2" width="7" height="4.8" rx="1.5" />
          <rect x="13.5" y="16.2" width="7" height="4.8" rx="1.5" />
          <path d="M12 7.8v2.2M12 10H7.3M12 10h4.7M7.3 10v6.2M16.7 10v6.2" />
        </svg>
      );
    case "tree":
      // A dendrogram: a root dot with a trunk that forks into two leaves.
      return (
        <svg {...s}>
          <circle cx="3.8" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <path d="M3.8 12V7.4M3.8 12v4.6M3.8 7.4h7.4M3.8 16.6h7.4" />
          <rect x="11.2" y="5" width="8.6" height="4.8" rx="1.5" />
          <rect x="11.2" y="14.2" width="8.6" height="4.8" rx="1.5" />
        </svg>
      );
    case "mind_map":
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="3.6" />
          <path d="M3 6.5h4.4M3 12h4.4M3 17.5h4.4M16.6 6.5H21M16.6 12H21M16.6 17.5H21" />
        </svg>
      );
    case "data_flow":
      return (
        <svg {...s}>
          <path
            d="M5.5 8c0-2.2 2.9-4 6.5-4s6.5 1.8 6.5 4-2.9 4-6.5 4-6.5-1.8-6.5-4Z"
            opacity="0.9"
          />
          <path d="M5.5 8v7c0 2.2 2.9 4 6.5 4s6.5-1.8 6.5-4V8" />
          <path d="M5.5 11.5c0 2.2 2.9 4 6.5 4s6.5-1.8 6.5-4" opacity="0.4" />
          <path d="M12 21v-1.8M9.5 20l2.5 1.6 2.5-1.6" />
        </svg>
      );
    case "radial":
      // A wheel of equal slices around a hub — the ring plus its spokes.
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3.2" opacity="0.5" />
          <path d="M12 4v3.2M20 12h-3.2M12 20v-3.2M4 12h3.2" />
        </svg>
      );
    default:
      return (
        <svg {...s}>
          <rect x="3" y="7" width="6.5" height="10" rx="2" />
          <path d="M12.5 12h5.2M15 9.5l2.7 2.5-2.7 2.5" />
        </svg>
      );
  }
}

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  "approval-flow": ClipboardCheck,
  "customer-journey-map": Route,
  "customer-onboarding": UserCheck,
  "sop-document-processing": FileText,
  "cross-team-task-workflow": Users,
  "api-request-flow": GitBranch,
  "application-architecture": Layers,
  "network-diagram": Router,
  "sequence-user-login": Key,
  "web-app-architecture": Layers,
  "data-architecture": Layers,
  "data-flow-analytics": BarChart3,
  "er-ecommerce": ShoppingCart,
  "etl-pipeline": Workflow,
  "dendrogram": GitBranch,
  "ml-pipeline": Cpu,
  "agile-sprint-workflow": Workflow,
  "project-team-swimlane": Users,
  "organization-chart": Users,
  "family-tree": Users,
  "project-delivery-flow": Route,
  "project-mind-map": Brain,
  "uat-process": CheckCircle2,
  "export-process": Ship,
  "import-cargo-clearance": PackageCheck,
  "warehouse-operations-flow": Warehouse,
  "delivery-last-mile": Truck,
  "cargo-tracking-flow": MapPin,
};

/** A template-specific mark makes cards distinguishable before reading them. */
export function TemplateGlyph({
  slug,
  type,
}: {
  slug: string;
  type: DiagramType;
}) {
  const Icon = TEMPLATE_ICONS[slug];
  if (!Icon) return <TypeGlyph type={type} />;
  return <Icon aria-hidden="true" size="1em" strokeWidth={1.7} />;
}
