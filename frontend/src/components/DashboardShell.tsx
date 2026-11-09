import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { emptyDoc } from "../api/types";
import { useAuth } from "../store/useAuth";
import { useDiagram } from "../store/useDiagram";
import { CreditBadge } from "./CreditBadge";
import { ThemeIconButton } from "./ThemeToggle";
import { initials } from "./TopBar";
import {
  Briefcase,
  ChevronRight,
  ClipboardList,
  Clock,
  Cpu,
  DatabaseIcon,
  Folder,
  Grid,
  Home,
  Layers,
  LogoMark,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Share,
  Sparkles,
  Star,
  Truck,
  X,
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

const PROMO_DISMISSED = "kumnous.sidebarPromo.dismissed";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

const ChevronsUpDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
  </svg>
);

function rowClass(active: boolean) {
  return `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] no-underline transition-colors [&_svg]:size-[18px] [&_svg]:shrink-0 ${FOCUS} ${
    active
      ? "bg-surface-2 font-medium text-ink-strong [&_svg]:text-ink-strong"
      : "text-slate hover:bg-surface-2 hover:text-ink-strong [&_svg]:text-slate"
  }`;
}

/** A small dropdown anchored to its trigger; closes on any outside press. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function MenuItem({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] hover:bg-surface-2 [&_svg]:size-4 [&_svg]:text-slate ${
        danger ? "text-red" : "text-ink"
      } ${FOCUS}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Top of the sidebar: whose workspace this is, with its menu. */
function WorkspaceSwitcher() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const first = user?.name?.split(" ")[0];

  return (
    <div ref={ref} className="relative">
      <button
        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-surface-2 ${FOCUS}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-green text-on-accent [&_svg]:size-3.5">
          <LogoMark />
        </span>
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-ink-strong">
          {first ? `${first}'s workspace` : "Kumnous"}
        </span>
        <span className="text-slate [&_svg]:size-4">
          <ChevronsUpDown />
        </span>
      </button>
      {open && (
        <div
          className="absolute inset-x-0 top-[calc(100%+4px)] z-50 rounded-xl border border-line bg-surface p-1 shadow-3 animate-[menu-in_130ms_ease]"
          role="menu"
        >
          <MenuItem
            onClick={() => {
              setOpen(false);
              navigate("/projects");
            }}
          >
            <Layers />
            Projects
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
          >
            <Settings />
            Settings
          </MenuItem>
        </div>
      )}
    </div>
  );
}

/** "Find" box. Pressing F anywhere outside a text field jumps into it. */
function FindBox({ search }: { search: { value: string; onChange: (value: string) => void; placeholder: string } }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate [&_svg]:size-4">
        <Search />
      </span>
      <input
        ref={inputRef}
        type="search"
        className="w-full rounded-lg border border-line bg-surface-2 py-2 pl-9 pr-9 text-[14px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-slate focus:border-green focus:shadow-[0_0_0_3px_var(--green-ring)]"
        value={search.value}
        onChange={(event) => search.onChange(event.target.value)}
        placeholder="Find…"
        aria-label={search.placeholder}
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded border border-line bg-surface font-sans text-[11px] text-slate">
        F
      </kbd>
    </label>
  );
}

function Sidebar({
  search,
  onCategory,
}: {
  search?: { value: string; onChange: (value: string) => void; placeholder: string };
  onCategory?: (slug: string) => void;
}) {
  const location = useLocation();
  const onTemplates = location.pathname === "/templates";
  const [templatesOpen, setTemplatesOpen] = useState(onTemplates);
  // NavLink's own `isActive` only compares pathname, so all five category
  // links (same "/templates" path, different "?category=") would otherwise
  // light up together. Match the query param by hand instead.
  const activeCategory = onTemplates ? new URLSearchParams(location.search).get("category") : undefined;

  return (
    <nav
      className="flex w-[264px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-line bg-surface px-3 py-3 max-[900px]:hidden"
      aria-label="Dashboard"
    >
      <WorkspaceSwitcher />
      {search && <FindBox search={search} />}

      <div className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) =>
          item.to === "/templates" ? (
            <div key={item.to}>
              <div className="flex items-center">
                <NavLink
                  to="/templates"
                  end
                  className={({ isActive }) => `${rowClass(isActive && !activeCategory)} flex-1`}
                >
                  <item.icon />
                  {item.label}
                </NavLink>
                <button
                  className={`ml-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-slate hover:bg-surface-2 hover:text-ink-strong [&_svg]:size-4 ${FOCUS}`}
                  onClick={() => setTemplatesOpen((v) => !v)}
                  aria-expanded={templatesOpen}
                  aria-label={templatesOpen ? "Hide template categories" : "Show template categories"}
                >
                  <span className={`transition-transform ${templatesOpen ? "rotate-90" : ""}`}>
                    <ChevronRight />
                  </span>
                </button>
              </div>
              {templatesOpen && (
                <div className="ml-[21px] mt-0.5 flex flex-col gap-0.5 border-l border-line pl-2">
                  {CATEGORIES.map((category) => (
                    <Link
                      key={category.slug}
                      to={`/templates?category=${category.slug}`}
                      className={`${rowClass(activeCategory === category.slug)} py-1.5 text-[13.5px]`}
                      onClick={() => onCategory?.(category.slug)}
                    >
                      {category.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => rowClass(isActive)}>
              <item.icon />
              {item.label}
            </NavLink>
          ),
        )}
      </div>

      <div className="border-t border-line pt-3">
        <span
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-slate-soft [&_svg]:size-[18px]"
          title="Shared with you isn't available yet"
        >
          <Share />
          Shared with you
          <span className="ml-auto text-[12px]">Soon</span>
        </span>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <CopilotPromo />
        <CreditBadge size="md" />
        <SidebarProfile />
      </div>
    </nav>
  );
}

/** The account row pinned at the bottom of the sidebar, with its menu. */
function SidebarProfile() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  if (!user) return null;

  return (
    <div ref={ref} className="relative flex items-center gap-2.5 border-t border-line px-1 pt-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[12px] font-semibold text-ink-strong">
        {initials(user.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink-strong">{user.name}</span>
        <span className="block truncate text-[12px] text-slate">{user.email}</span>
      </span>
      <button
        className={`grid size-8 shrink-0 place-items-center rounded-full border border-line text-slate hover:text-ink-strong [&_svg]:size-4 ${FOCUS}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <span className="rotate-90">
          <MoreVertical />
        </span>
      </button>
      {open && (
        <div
          className="absolute inset-x-0 bottom-[calc(100%+6px)] z-50 rounded-xl border border-line bg-surface p-1 shadow-3 animate-[menu-in_130ms_ease]"
          role="menu"
        >
          <MenuItem
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
          >
            <Settings />
            Settings
          </MenuItem>
          <MenuItem
            danger
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </MenuItem>
        </div>
      )}
    </div>
  );
}

/** The header across the top of the content: where you are, and the two
 *  things you can start from anywhere. */
function ContentHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const page =
    NAV_ITEMS.find((item) => item.to !== "/" && location.pathname.startsWith(item.to))?.label ?? "Home";
  const category = new URLSearchParams(location.search).get("category");
  const categoryLabel = CATEGORIES.find((c) => c.slug === category)?.label;
  const first = user?.name?.split(" ")[0];

  const newDiagram = () => {
    useDiagram.getState().beginNew();
    useDiagram.getState().setDoc(emptyDoc());
    navigate("/");
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-6 max-[560px]:px-4">
      <span className="hidden size-6 place-items-center rounded-full bg-green text-on-accent max-[900px]:grid [&_svg]:size-3">
        <LogoMark />
      </span>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[14px]">
        <span className="truncate text-slate max-[560px]:hidden">{first ? `${first}'s workspace` : "Workspace"}</span>
        <span className="text-line-strong max-[560px]:hidden">/</span>
        <span className={`truncate ${categoryLabel ? "text-slate" : "font-medium text-ink-strong"}`}>{page}</span>
        {categoryLabel && (
          <>
            <span className="text-line-strong">/</span>
            <span className="truncate font-medium text-ink-strong">{categoryLabel}</span>
          </>
        )}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[14px] font-medium text-ink-strong hover:bg-surface-2 [&_svg]:size-4 ${FOCUS}`}
          onClick={newDiagram}
        >
          <Plus />
          New diagram
        </button>
        <button
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[14px] font-medium text-ink-strong hover:bg-surface-2 [&_svg]:size-4 [&_svg]:text-brand-red ${FOCUS}`}
          onClick={() => navigate("/")}
        >
          <Sparkles />
          Kumnous AI
        </button>
        <span className="ml-1">
          <ThemeIconButton />
        </span>
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
    <div className="flex h-full overflow-hidden bg-surface">
      <Sidebar search={search} onCategory={onCategory} />
      <div className="flex min-w-0 flex-1 flex-col">
        <ContentHeader />
        <main className="min-h-0 flex-1 overflow-y-auto bg-paper">{children}</main>
      </div>
    </div>
  );
}

/** A bordered panel with a header row, in the style of a settings or
 *  deployment detail card: title on the left, actions on the right, then
 *  whatever the page puts inside. */
export function Panel({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="m-0 text-[15px] font-semibold text-ink-strong">{title}</h2>
          {description && <p className="mb-0 mt-0.5 text-[13px] text-slate">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Sidebar card pointing back to Kumnous AI. Can be closed for good. */
export function CopilotPromo() {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => localStorage.getItem(PROMO_DISMISSED) === "1");
  if (hidden) return null;

  return (
    <div className="relative rounded-xl border border-line bg-surface-2 p-4">
      <button
        className={`absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full border border-line bg-surface text-slate hover:text-ink-strong [&_svg]:size-3 ${FOCUS}`}
        onClick={() => {
          localStorage.setItem(PROMO_DISMISSED, "1");
          setHidden(true);
        }}
        aria-label="Close"
      >
        <X />
      </button>
      <p className="m-0 flex items-center gap-1.5 pr-6 text-[14px] font-semibold text-ink-strong [&_svg]:size-4 [&_svg]:text-brand-red">
        <Sparkles />
        Kumnous AI
      </p>
      <p className="mb-0 mt-1.5 text-[13px] leading-[1.5] text-slate">
        Describe your project and Kumnous picks the right template, or draws it from scratch.
      </p>
      <button
        className={`mt-3 w-full rounded-lg bg-ink-strong py-2 text-[13.5px] font-medium text-paper hover:opacity-90 ${FOCUS}`}
        onClick={() => navigate("/")}
      >
        Describe a diagram
      </button>
    </div>
  );
}
