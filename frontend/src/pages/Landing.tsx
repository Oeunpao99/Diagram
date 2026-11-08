import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import type { DiagramType } from "../api/types";
import {
  Check,
  CheckCircle,
  ChevronDown,
  FileImage,
  LinkIcon,
  LogoMark,
  Printer,
} from "../components/icons";
import { TYPE_LABEL, TypeGlyph, tintFor } from "../components/templateVisuals";
import { ThemeIconButton } from "../components/ThemeToggle";
import { COPY, saveLang, storedLang, type Lang, type LandingCopy } from "./landing/copy";
import { DemoCanvas } from "./landing/DemoCanvas";
import { SHOWCASE } from "./landing/demoDocs";
import { FlagKH, FlagUK } from "./landing/Flags";
import { HeroDemo } from "./landing/HeroDemo";
import { PipelineFlow } from "./landing/PipelineFlow";
import { TemplateBrowser } from "./landing/TemplateBrowser";

/* Design notes (frontend-design pass)
 * - Palette: neutral paper, navy ink, teal for actions, brand red for AI and
 *   attention. Colour, where used, is a solid fill.
 * - Plus Jakarta Sans for English headings and body; Khmer falls through to
 *   Kantumruy Pro, a Cambodian face that sets Khmer and Latin.
 * - Sections are left-aligned: heading, then content. No card grids.
 * - The hero demo drawing itself is the one piece of motion that plays
 *   without being asked; the pipeline below is interactive. */

// Plus Jakarta Sans for English, headings and body alike; it has no Khmer, so
// Khmer text falls through to Kantumruy Pro.
const DISPLAY = "[font-family:'Plus_Jakarta_Sans','Kantumruy_Pro',sans-serif]";
const BODY = "[font-family:'Plus_Jakarta_Sans','Kantumruy_Pro',sans-serif]";
const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";
const PRIMARY = `inline-flex items-center rounded-lg bg-green px-5 py-3 text-[15px] font-medium text-on-accent no-underline transition-[background-color,translate] hover:-translate-y-0.5 hover:bg-green-strong ${FOCUS}`;
const WRAP = "mx-auto w-[min(1120px,calc(100%-40px))]";

const TYPES = Object.keys(TYPE_LABEL) as DiagramType[];

/** Where "Contact us" on the Enterprise plan goes. Empty sends people to
 *  sign-up instead, so the button never points at a made-up address. */
const SALES_EMAIL = "";

/** Yearly billing takes this much off the monthly price. */
const YEARLY_DISCOUNT = 0.2;

/** Prices per plan, in the same order as the copy's plans; Pro is index 1. */
const PLAN_PRICES = [0, 6, 10];
const RECOMMENDED_PLAN = 1;

/** Rises its contents in the first time they scroll into view; `delay`
 *  staggers siblings. Reduced motion shows them straight away (see
 *  `.lp-reveal` in tailwind.css). */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`lp-reveal ${shown ? "is-in" : ""} ${className}`}
      style={{ "--d": `${delay}s` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

function SectionHeading({ title, intro }: { title: string; intro?: string }) {
  return (
    <Reveal>
      <h2
        className={`${DISPLAY} m-0 text-[32px] font-semibold leading-[1.3] tracking-[-0.015em] text-ink-strong max-[560px]:text-[26px]`}
      >
        {title}
      </h2>
      {intro && <p className="mb-0 mt-3 max-w-[62ch] text-[15px] leading-[1.7] text-slate">{intro}</p>}
    </Reveal>
  );
}

/** Heading on the left, content on the right; stacks on narrow screens. */
function Section({
  id,
  title,
  intro,
  children,
}: {
  id?: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`${WRAP} scroll-mt-20 border-t border-line py-20 max-[860px]:py-14`}>
      <div className="grid grid-cols-[300px_1fr] gap-12 max-[960px]:grid-cols-1 max-[960px]:gap-8">
        <div>
          <SectionHeading title={title} intro={intro} />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function ForYourTeam({ label, points }: { label: string; points: { title: string; body: string }[] }) {
  return (
    <div className="mt-12 border-t border-line pt-6">
      <h3 className="m-0 flex items-center gap-2 text-[14px] font-semibold text-ink-strong">
        <span className="h-3.5 w-[3px] rounded-full bg-brand-red" />
        {label}
      </h3>
      <div className="mt-4 grid grid-cols-3 gap-8 max-[760px]:grid-cols-1 max-[760px]:gap-5">
        {points.map((point, i) => (
          <Reveal key={point.title} delay={i * 0.1}>
            <p className="m-0 text-[15px] font-medium text-ink-strong">{point.title}</p>
            <p className="mb-0 mt-1.5 text-[14px] leading-[1.7] text-slate">{point.body}</p>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

const LANGUAGES: { value: Lang; name: string; flag: ReactNode }[] = [
  { value: "en", name: "English", flag: <FlagUK /> },
  { value: "km", name: "ខ្មែរ", flag: <FlagKH /> },
];

/** Language dropdown: the current flag and name, a chevron, and a short menu
 *  of the other choices. Closes on Escape or a press outside it. */
export function LanguageMenu({ lang, onChange, label }: { lang: Lang; onChange: (lang: Lang) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.value === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[14px] font-medium text-ink-strong transition-colors hover:bg-surface-2 ${FOCUS}`}
      >
        {current.flag}
        <span lang={current.value}>{current.name}</span>
        <span className={`text-slate transition-transform [&_svg]:size-3.5 ${open ? "rotate-180" : ""}`}>
          <ChevronDown />
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute right-0 top-[calc(100%+6px)] z-50 m-0 min-w-[170px] list-none rounded-xl border border-line bg-surface p-1 shadow-3 animate-[menu-in_130ms_ease]"
        >
          {LANGUAGES.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === lang}
                lang={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 px-3 py-2 text-left text-[14px] ${FOCUS} ${
                  option.value === lang
                    ? "bg-green font-medium text-on-accent"
                    : "bg-transparent text-ink hover:bg-surface-2"
                }`}
              >
                {option.flag}
                {option.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Examples({ copy }: { copy: LandingCopy["examples"] }) {
  const [active, setActive] = useState<(typeof SHOWCASE)[number]["id"]>("flow");
  const current = SHOWCASE.find((s) => s.id === active) ?? SHOWCASE[0];

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-line" role="tablist" aria-label={copy.title}>
        {SHOWCASE.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            onClick={() => setActive(item.id)}
            className={`-mb-px cursor-pointer border-0 border-b-2 border-solid bg-transparent px-3 py-2.5 text-[14px] font-medium transition-colors ${FOCUS} ${
              active === item.id ? "border-brand-red text-ink-strong" : "border-transparent text-slate hover:text-ink-strong"
            }`}
          >
            {copy.tabs[item.id].label}
          </button>
        ))}
      </div>
      <p className="mb-0 mt-4 max-w-[60ch] text-[15px] leading-[1.7] text-slate">{copy.tabs[current.id].blurb}</p>
      <div className="mt-5 h-[560px] overflow-hidden rounded-[14px] border border-line-strong max-[760px]:h-[420px]">
        <DemoCanvas doc={current.doc} explore hints={{ explore: copy.dragExplore, move: copy.dragMove }} />
      </div>
    </div>
  );
}

/** One editor capability per row: what it does on the left, a piece of the
 *  real interface on the right. */
function FeatureRow({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <Reveal>
    <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-8 border-b border-line py-8 first:pt-0 max-[760px]:grid-cols-1 max-[760px]:gap-4">
      <div>
        <h3 className={`${DISPLAY} m-0 text-[21px] font-semibold leading-[1.4] text-ink-strong`}>{title}</h3>
        <p className="mb-0 mt-2 text-[15px] leading-[1.7] text-slate">{body}</p>
      </div>
      <div>{children}</div>
    </div>
    </Reveal>
  );
}

export function Pricing({ copy, signUp }: { copy: LandingCopy["pricing"]; signUp: string }) {
  const [yearly, setYearly] = useState(true);
  const price = (monthly: number) => {
    const value = yearly ? monthly * (1 - YEARLY_DISCOUNT) : monthly;
    return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
  };

  return (
    <div>
      <div className="inline-flex rounded-lg border border-line bg-surface p-1" role="group" aria-label={copy.title}>
        {[
          { value: false, label: copy.monthly },
          { value: true, label: copy.yearly(YEARLY_DISCOUNT * 100) },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={yearly === option.value}
            onClick={() => setYearly(option.value)}
            className={`cursor-pointer rounded-md border-0 px-4 py-1.5 text-[14px] font-medium transition-colors ${FOCUS} ${
              yearly === option.value ? "bg-green text-on-accent" : "bg-transparent text-slate hover:text-ink-strong"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 items-start gap-4 max-[860px]:grid-cols-1">
        {copy.plans.map((plan, i) => {
          const highlight = i === RECOMMENDED_PLAN;
          const monthly = PLAN_PRICES[i];
          return (
            <Reveal key={plan.name} delay={i * 0.1}>
            <div
              className={`flex flex-col rounded-xl bg-surface p-6 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-3 ${
                highlight ? "border-2 border-solid border-green" : "border border-line"
              }`}
            >
              <p className="m-0 h-[20px] text-[13px] font-medium text-brand-red">{highlight ? copy.recommended : ""}</p>
              <h3 className={`${DISPLAY} m-0 mt-1 text-[21px] font-semibold text-ink-strong`}>{plan.name}</h3>
              <p className="mb-0 mt-1 min-h-[72px] text-[14px] leading-[1.6] text-slate">{plan.blurb}</p>
              <p className="mb-0 mt-5 flex flex-wrap items-baseline gap-2">
                <span className={`${DISPLAY} text-[40px] font-semibold leading-none tracking-[-0.02em] text-ink-strong`}>
                  {price(monthly)}
                </span>
                {plan.unit && <span className="text-[13.5px] text-slate">{plan.unit}</span>}
              </p>
              <p className="mb-0 mt-2 min-h-[20px] text-[12.5px] text-slate-soft">
                {monthly > 0 && yearly ? copy.billedYearly(monthly) : ""}
              </p>
              <Link
                to="/register"
                className={`mt-5 rounded-lg px-4 py-2.5 text-center text-[14px] font-medium no-underline transition-colors ${FOCUS} ${
                  highlight
                    ? "bg-green text-on-accent hover:bg-green-strong"
                    : "border border-line-strong text-ink-strong hover:border-green"
                }`}
              >
                {plan.cta}
              </Link>
              <ul className="m-0 mt-6 flex list-none flex-col gap-2.5 p-0 text-[14px] text-ink">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 leading-[1.6]">
                    <span className="mt-0.5 shrink-0 text-green [&_svg]:size-4">
                      <Check />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            </Reveal>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <div>
          <h3 className={`${DISPLAY} m-0 text-[21px] font-semibold text-ink-strong`}>{copy.enterprise.title}</h3>
          <p className="mb-0 mt-1.5 max-w-[60ch] text-[14px] leading-[1.7] text-slate">{copy.enterprise.body}</p>
        </div>
        {SALES_EMAIL ? (
          <a
            href={`mailto:${SALES_EMAIL}`}
            className={`rounded-lg border border-line-strong px-5 py-2.5 text-[14px] font-medium text-ink-strong no-underline hover:border-green ${FOCUS}`}
          >
            {copy.enterprise.contact}
          </a>
        ) : (
          <Link
            to="/register"
            className={`rounded-lg border border-line-strong px-5 py-2.5 text-[14px] font-medium text-ink-strong no-underline hover:border-green ${FOCUS}`}
          >
            {signUp}
          </Link>
        )}
      </div>
    </div>
  );
}

export function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent py-5 text-left text-[16px] font-medium leading-[1.6] text-ink-strong ${FOCUS}`}
      >
        {q}
        <span className={`shrink-0 text-slate transition-transform [&_svg]:size-4 ${open ? "rotate-180" : ""}`}>
          <ChevronDown />
        </span>
      </button>
      {open && <p className="m-0 max-w-[64ch] pb-5 text-[15px] leading-[1.75] text-slate">{a}</p>}
    </div>
  );
}

/** Public marketing page shown at `/` to signed-out visitors. */
export default function Landing() {
  const [lang, setLang] = useState<Lang>(storedLang);
  const t = COPY[lang];
  const km = lang === "km";

  useEffect(() => {
    document.documentElement.lang = lang;
    saveLang(lang);
  }, [lang]);

  // Khmer stacks vowels and subscripts above and below the line, so it needs
  // more leading than Latin; the headline's connector follows the same line
  // height so its arrow still lands on line two.
  const lh = km ? 1.45 : 1.1;
  const portY = lh * 0.5;
  const arrowY = lh * 1.5 + 0.08;

  return (
    <div className={`relative isolate min-h-screen bg-paper text-ink ${BODY}`}>
      {/* Faint drafting grid behind the whole page, fixed while it scrolls:
          clearest at the top, fading towards the bottom of the screen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 [background-image:linear-gradient(color-mix(in_srgb,var(--line-strong)_55%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--line-strong)_55%,transparent)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black_0%,rgba(0,0,0,0.55)_55%,rgba(0,0,0,0.25)_100%)]"
      />
      {/* A floating rounded bar: one font, 14px text, and 40px controls
          (round icon button, outlined Log in, solid call to action). */}
      <header className="sticky top-0 z-30 px-5 pt-3 max-[560px]:px-3">
        <div className="mx-auto flex h-16 w-[min(1180px,100%)] items-center justify-between gap-4 rounded-2xl border border-line bg-surface/90 pl-5 pr-2.5 text-[14px] shadow-2 backdrop-blur">
          <a href="#top" className={`flex shrink-0 items-center gap-2.5 rounded-md no-underline ${FOCUS}`}>
            <span className="grid size-8 place-items-center rounded-lg bg-green text-on-accent [&_svg]:size-4">
              <LogoMark />
            </span>
            <span className="text-[16px] font-semibold text-ink-strong">Kumnous-គំនូស</span>
          </a>
          <nav className="flex items-center gap-8 text-[15px] font-medium text-ink max-[1180px]:gap-6 max-[1040px]:hidden">
            {[
              { href: "#how-it-works", label: t.nav.how },
              { href: "#examples", label: t.nav.examples },
              { href: "#pricing", label: t.nav.pricing },
              { href: "#faq", label: t.nav.faq },
            ].map((item) => (
              <a key={item.href} href={item.href} className={`rounded-sm no-underline hover:text-green ${FOCUS}`}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <span className="max-[640px]:hidden">
              <LanguageMenu lang={lang} onChange={setLang} label={t.lang.label} />
            </span>
            <ThemeIconButton labels={t.theme} className="size-10 rounded-full" />
            <Link
              to="/login"
              className={`inline-flex h-10 items-center rounded-xl border border-line-strong bg-surface px-4 font-medium text-ink-strong no-underline hover:bg-surface-2 ${FOCUS}`}
            >
              {t.nav.login}
            </Link>
            <Link
              to="/register"
              className={`inline-flex h-10 items-center rounded-xl bg-green px-4 font-semibold text-on-accent no-underline shadow-2 hover:bg-green-strong max-[480px]:hidden ${FOCUS}`}
            >
              {t.nav.startFree}
            </Link>
          </div>
        </div>
      </header>

      <main id="top">
        <section className={`${WRAP} pb-16 pt-20 max-[560px]:pt-12`}>
          {/* The headline is a two-step flow: a port, an elbow connector and
              an arrowhead join line one to line two, drawn the way the
              editor draws its connectors. Sized in em so it scales with
              the type. */}
          <h1
            className={`${DISPLAY} relative m-0 pl-[0.62em] font-semibold tracking-[-0.02em] text-ink-strong ${
              km
                ? "text-[48px] max-[760px]:text-[34px] max-[420px]:text-[28px]"
                : "text-[60px] max-[760px]:text-[40px] max-[420px]:text-[32px]"
            }`}
            style={{ lineHeight: lh }}
          >
            <span
              aria-hidden="true"
              className="lp-pop absolute left-0 size-[0.2em] -translate-y-1/2 rounded-full border-[0.035em] border-solid border-[#5B6B76] bg-paper"
              style={{ top: `${portY}em`, "--d": "0.25s" } as React.CSSProperties}
            />
            <span
              aria-hidden="true"
              className="lp-grow-y absolute left-[0.1em] w-[0.035em] -translate-x-1/2 bg-[#5B6B76]"
              style={{ top: `${portY + 0.1}em`, height: `${arrowY - portY - 0.1}em`, "--d": "0.4s" } as React.CSSProperties}
            />
            <span
              aria-hidden="true"
              className="lp-grow-x absolute left-[0.1em] h-[0.035em] w-[0.28em] -translate-y-1/2 bg-[#5B6B76]"
              style={{ top: `${arrowY}em`, "--d": "0.75s" } as React.CSSProperties}
            />
            <span
              aria-hidden="true"
              className="lp-pop absolute left-[0.36em] size-0 -translate-y-1/2 border-y-[0.09em] border-l-[0.14em] border-solid border-y-transparent border-l-brand-red"
              style={{ top: `${arrowY}em`, "--d": "0.92s" } as React.CSSProperties}
            />
            <span className="lp-rise block">{t.hero.line1}</span>
            <span className="lp-rise block" style={{ "--d": "0.95s" } as React.CSSProperties}>
              {t.hero.line2}
            </span>
          </h1>
          <p
            className="lp-rise mb-0 mt-6 max-w-[58ch] text-[18px] leading-[1.7] text-slate"
            style={{ "--d": "1.1s" } as React.CSSProperties}
          >
            {t.hero.sub}
          </p>
          <div
            className="lp-rise mt-8 flex flex-wrap items-center gap-6"
            style={{ "--d": "1.2s" } as React.CSSProperties}
          >
            <Link to="/register" className={PRIMARY}>
              {t.nav.signUp}
            </Link>
            <a
              href="#examples"
              className={`rounded-sm text-[15px] font-medium text-ink-strong underline decoration-line-strong underline-offset-4 hover:decoration-green ${FOCUS}`}
            >
              {t.hero.seeExamples}
            </a>
          </div>
          <p className="lp-rise mb-0 mt-5 text-[14px] text-slate-soft" style={{ "--d": "1.25s" } as React.CSSProperties}>
            {t.hero.small}
          </p>

          <div className="lp-rise mt-14" style={{ "--d": "1.35s" } as React.CSSProperties}>
            <HeroDemo copy={t.demo} />
          </div>
          <ForYourTeam label={t.forYourTeam} points={t.impact.hero} />
        </section>

        <section id="how-it-works" className={`${WRAP} scroll-mt-20 border-t border-line py-20 max-[860px]:py-14`}>
          <SectionHeading title={t.how.title} intro={t.how.intro} />
          <Reveal className="mt-8" delay={0.1}>
            <PipelineFlow copy={t.how} />
          </Reveal>
        </section>

        <section id="examples" className={`${WRAP} scroll-mt-20 border-t border-line py-20 max-[860px]:py-14`}>
          <SectionHeading title={t.examples.title} intro={t.examples.intro} />
          <Reveal className="mt-8" delay={0.1}>
            <TemplateBrowser copy={t.examples} fallback={<Examples copy={t.examples} />} />
          </Reveal>
          <ForYourTeam label={t.forYourTeam} points={t.impact.examples} />
        </section>

        <Section title={t.editor.title} intro={t.editor.intro}>
          <FeatureRow title={t.editor.ask.title} body={t.editor.ask.body}>
            <div lang="en" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-[14px] leading-[1.5]">
              <p className="m-0 self-end rounded-xl rounded-tr-sm bg-surface-2 px-3 py-2 text-ink">
                Add a manager approval before the card is charged.
              </p>
              <p className="m-0 flex items-start gap-2 text-slate">
                <span className="mt-0.5 text-green [&_svg]:size-4">
                  <CheckCircle />
                </span>
                Added 1 step and re-routed 2 connectors.
              </p>
            </div>
          </FeatureRow>

          <FeatureRow title={t.editor.missing.title} body={t.editor.missing.body}>
            <div lang="en" className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
              <p className="m-0 flex-1 text-[14px] leading-[1.5] text-ink">
                This diagram has a couple of overlapping connectors. I can tidy the layout.
              </p>
              <span className="shrink-0 rounded-md bg-green px-3 py-1.5 text-[13px] font-medium text-on-accent">
                Fix layout
              </span>
            </div>
          </FeatureRow>

          <FeatureRow title={t.editor.types.title(TYPES.length)} body={t.editor.types.body}>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((type) => {
                const [bg, border, ink] = tintFor(type);
                return (
                  <span
                    key={type}
                    className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px] font-medium transition-[translate] hover:-translate-y-0.5"
                    style={{ background: bg, borderColor: border, color: ink }}
                  >
                    <TypeGlyph type={type} />
                    {TYPE_LABEL[type]}
                  </span>
                );
              })}
            </div>
          </FeatureRow>

          <FeatureRow title={t.editor.share.title} body={t.editor.share.body}>
            <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[14px] text-ink [&_svg]:size-4 [&_svg]:text-slate">
              {[<FileImage key="i" />, <Printer key="p" />, <LinkIcon key="l" />].map((icon, i) => (
                <li key={t.editor.share.rows[i]} className="flex items-center gap-3">
                  {icon}
                  {t.editor.share.rows[i]}
                </li>
              ))}
            </ul>
          </FeatureRow>

          <ForYourTeam label={t.forYourTeam} points={t.impact.editor} />
        </Section>

        <Section id="pricing" title={t.pricing.title} intro={t.pricing.intro}>
          <Pricing copy={t.pricing} signUp={t.nav.signUp} />
          <ForYourTeam label={t.forYourTeam} points={t.impact.pricing} />
        </Section>

        <Section id="faq" title={t.faq.title}>
          <Reveal className="border-t border-line">
            {t.faq.items.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </Reveal>
        </Section>

        <section className={`${WRAP} border-t border-line py-20`}>
          <h2
            className={`${DISPLAY} m-0 max-w-[22ch] text-[40px] font-semibold leading-[1.3] tracking-[-0.015em] text-ink-strong max-[560px]:text-[30px]`}
          >
            {t.closing.title}
          </h2>
          <p className="mb-0 mt-4 max-w-[58ch] text-[16px] leading-[1.7] text-slate">{t.closing.body}</p>
          <Link to="/register" className={`${PRIMARY} mt-8`}>
            {t.nav.signUp}
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-4 py-8 text-[14px] text-slate`}>
          <span className="flex items-center gap-2 font-semibold text-ink-strong">
            <span className="grid size-[22px] place-items-center rounded-md bg-green text-on-accent [&_svg]:size-3">
              <LogoMark />
            </span>
            Kumnous-គំនូស
          </span>
          <span className="flex gap-6">
            <a href="#pricing" className={`rounded-sm text-slate no-underline hover:text-ink-strong ${FOCUS}`}>
              {t.nav.pricing}
            </a>
            <a href="#faq" className={`rounded-sm text-slate no-underline hover:text-ink-strong ${FOCUS}`}>
              {t.nav.faq}
            </a>
            <Link to="/login" className={`rounded-sm text-slate no-underline hover:text-ink-strong ${FOCUS}`}>
              {t.nav.login}
            </Link>
          </span>
          <span>© {new Date().getFullYear()} Kumnous</span>
        </div>
      </footer>
    </div>
  );
}
