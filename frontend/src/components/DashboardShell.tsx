import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { emptyDoc } from "../api/types";
import { useAuth } from "../store/useAuth";
import { useDiagram } from "../store/useDiagram";
import { AccountMenu, initials } from "./TopBar";
import {
  Briefcase,
  ClipboardList,
  Clock,
  Cpu,
  DatabaseIcon,
  Folder,
  Grid,
  Home,
  Layers,
  LogoMark,
  Plus,
  Search,
  Settings,
  Share,
  Sparkles,
  Star,
  Truck,
} from "./icons";

/** The five built-in template categories, in the order the library groups
 *  them — shared by the sidebar's quick links and the page's own tabs. */
export const CATEGORIES: { slug: string; label: string; icon: () => ReactNode }[] = [
  { slug: "business", label: "Business", icon: Briefcase },
  { slug: "it", label: "IT & Software", icon: Cpu },
  { slug: "data", label: "Data", icon: DatabaseIcon },
  { slug: "project", label: "Project Management", icon: ClipboardList },
  { slug: "logistics", label: "Logistics", icon: Truck },
];

const NAV_ITEMS: { to: string; label: string; icon: () => ReactNode }[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/projects", label: "Projects", icon: Layers },
  { to: "/templates", label: "Templates", icon: Grid },
  { to: "/diagrams", label: "My Diagrams", icon: Folder },
  { to: "/recent", label: "Recent", icon: Clock },
  { to: "/favorites", label: "Favorites", icon: Star },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 rounded-[9px] px-2.5 py-[7px] text-[12.5px] font-[550] transition-colors [&_svg]:size-4 ${
    isActive
      ? "bg-green-soft text-green-deep [&_svg]:text-green"
      : "text-slate hover:bg-surface-2 hover:text-ink"
  }`;
}

function Sidebar({ onCategory }: { onCategory?: (slug: string) => void }) {
  const location = useLocation();
  // NavLink's own `isActive` only compares pathname, so all five category
  // links (same "/templates" path, different "?category=") would otherwise
  // light up together. Match the query param by hand instead.
  const activeCategory =
    location.pathname === "/templates"
      ? new URLSearchParams(location.search).get("category")
      : undefined;

  return (
    <nav
      className="flex w-[220px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-surface px-3 py-4 max-[900px]:hidden"
      aria-label="Dashboard"
    >
      <div className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass} end={item.to === "/"}>
            <item.icon />
            {item.label}
          </NavLink>
        ))}
        <button
          className="flex items-center gap-2.5 rounded-[9px] px-2.5 py-[7px] text-left text-[12.5px] font-[550] text-slate-soft [&_svg]:size-4"
          disabled
          title="Sharing isn't available yet"
        >
          <Share />
          Shared
          <span className="ml-auto rounded-[20px] bg-paper px-[7px] py-px text-[9px] font-[650] uppercase tracking-[0.04em] text-slate-soft">
            Soon
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="mx-2.5 mb-1 text-[10.5px] font-[650] uppercase tracking-[0.07em] text-slate-soft">
          Categories
        </p>
        {CATEGORIES.map((category) => (
          <Link
            key={category.slug}
            to={`/templates?category=${category.slug}`}
            className={navLinkClass({ isActive: activeCategory === category.slug })}
            onClick={() => onCategory?.(category.slug)}
          >
            <category.icon />
            {category.label}
          </Link>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <CopilotPromo />
        <SidebarProfile />
      </div>
    </nav>
  );
}

/** The account entry pinned at the bottom of the sidebar — same identity as
 *  the compact avatar in the top bar, just with room for a name and email,
 *  the way Notion/Slack/VS Code anchor account controls in the nav rail. */
function SidebarProfile() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={rootRef} className="relative border-t border-line pt-3">
      <button
        className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-green-line bg-surface text-[11px] font-[650] text-green-deep">
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-[600] text-ink">{user.name}</span>
          <span className="block truncate text-[10.5px] text-slate-soft">{user.email}</span>
        </span>
      </button>
      {open && (
        <div
          className="absolute inset-x-0 bottom-[calc(100%+6px)] z-50 rounded-xl border border-line bg-surface p-[5px] shadow-3 animate-[menu-in_130ms_ease]"
          role="menu"
        >
          <button
            role="menuitem"
            className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-ink hover:bg-surface-2 [&_svg]:size-[15px] [&_svg]:text-slate"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
          >
            <Settings />
            Settings
          </button>
          <button
            role="menuitem"
            className="flex w-full items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-left text-[12.5px] text-red hover:bg-surface-2"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** The top bar every dashboard-style page (outside the editor) shares: logo,
 *  an optional search box, "New Diagram", and the account menu. */
function Topbar({
  search,
}: {
  search?: { value: string; onChange: (value: string) => void; placeholder: string };
}) {
  const navigate = useNavigate();

  const newDiagram = () => {
    useDiagram.getState().beginNew();
    useDiagram.getState().setDoc(emptyDoc());
    navigate("/");
  };

  return (
    <header className="flex h-[var(--topbar)] shrink-0 items-center gap-4 border-b border-line bg-surface px-4">
      <span className="flex shrink-0 items-center gap-[9px] text-ink">
        <span className="grid size-5 place-items-center rounded-[6px] bg-green text-on-accent [&_svg]:size-3">
          <LogoMark />
        </span>
        <span className="text-[13.5px] font-[650] tracking-[-0.01em]">Kumnous-គំនូស</span>
      </span>

      {search && (
        <label className="relative min-w-0 max-w-[360px] flex-1">
          <span className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2 text-slate-soft [&_svg]:size-[14px]">
            <Search />
          </span>
          <input
            type="search"
            className="w-full rounded-md border border-line bg-paper py-2 pl-[32px] pr-2.5 text-[13px] text-ink outline-none transition-[border-color,background,box-shadow] placeholder:text-slate-soft focus:border-green focus:bg-surface focus:shadow-[0_0_0_3px_var(--green-ring)]"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
          />
        </label>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          className="inline-flex items-center justify-center gap-[7px] rounded-lg border border-green bg-green px-3.5 py-1.5 text-[12.5px] font-semibold text-on-accent transition-colors hover:bg-green-strong [&_svg]:size-3.5"
          onClick={newDiagram}
        >
          <Plus />
          New Diagram
        </button>
        <AccountMenu />
      </div>
    </header>
  );
}

export function DashboardShell({
  search,
  onCategory,
  children,
}: {
  search?: { value: string; onChange: (value: string) => void; placeholder: string };
  onCategory?: (slug: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <Topbar search={search} />
      <div className="flex min-h-0 flex-1">
        <Sidebar onCategory={onCategory} />
        <main className="min-w-0 flex-1 overflow-y-auto bg-paper">{children}</main>
      </div>
    </div>
  );
}

/** A small promo card, matching the one docked at the bottom of the sidebar
 *  in the reference design — a nudge back to Kumnous AI from anywhere
 *  in the dashboard. */
export function CopilotPromo() {
  const navigate = useNavigate();
  return (
    <button
      className="flex w-full flex-col items-start gap-1 rounded-xl border border-green-line bg-green-soft p-3 text-left transition-colors hover:border-green [&_svg]:size-4"
      onClick={() => navigate("/")}
    >
      <span className="flex items-center gap-1.5 text-[12.5px] font-[650] text-green-deep">
        <Sparkles />
        Kumnous AI
      </span>
      <span className="text-[11px] leading-[1.45] text-slate">
        Describe your project and let AI choose the best template for you.
      </span>
      <span className="mt-1 text-[11px] font-[650] text-green-deep">Try Now →</span>
    </button>
  );
}
