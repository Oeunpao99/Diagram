import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { DiagramType } from "../api/types";
import {
  ArrowRight,
  CheckCircle,
  ChevronDown,
  FileImage,
  LinkIcon,
  LogoMark,
  Printer,
  Sparkles,
} from "../components/icons";
import { TYPE_LABEL, TypeGlyph, tintFor } from "../components/templateVisuals";
import { ThemeToggle } from "../components/ThemeToggle";
import { DemoCanvas } from "./landing/DemoCanvas";
import { ORDER_FLOW, SHOWCASE } from "./landing/demoDocs";

const PROMPT = "Draw an order flow: check stock, charge the card, or tell the customer it's out.";
/** Animation clock ticks at 40ms: type the prompt, draw a shape every
 *  REVEAL_EVERY ticks, then hold the finished diagram before looping. */
const TICK_MS = 40;
const REVEAL_EVERY = 11;
const LEAD = 10;
const HOLD = 100;

const FAQ = [
  {
    q: "Do I have to draw anything myself?",
    a: "No. Describe the process or system in a sentence and Kumnous AI places the shapes and connectors. You can still drag, restyle and rewire anything afterwards.",
  },
  {
    q: "Can I change a diagram after it's drawn?",
    a: "Yes, two ways. Edit directly on the canvas, or ask the copilot, for example “add a manager approval before the card is charged”, and it edits the diagram in place.",
  },
  {
    q: "What diagram types are supported?",
    a: "Process flows, swimlanes, architecture, network, sequence, entity-relationship, data flow, org charts, mind maps, trees and circle diagrams. There are ready-made templates for the common ones.",
  },
  {
    q: "How do I get a diagram out of Kumnous?",
    a: "Export it as PNG, SVG or PDF, or send a share link so someone else can open it.",
  },
  {
    q: "Does it work in dark mode?",
    a: "Yes. The whole app, including the canvas and every shape, follows light, dark or your system setting.",
  },
];

const TYPES = Object.keys(TYPE_LABEL) as DiagramType[];

function Eyebrow({ children }: { children: string }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-green">
      {children}
    </span>
  );
}

function SectionTitle({ eyebrow, children }: { eyebrow: string; children: string }) {
  return (
    <div className="mb-10 text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="m-0 mt-2.5 text-[34px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink-strong max-[560px]:text-[26px]">
        {children}
      </h2>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** The product, working: a prompt types into the copilot panel and the
 *  diagram draws itself on the real canvas, shape by shape. */
function HeroDemo() {
  const reduced = usePrefersReducedMotion();
  const total = ORDER_FLOW.nodes.length;
  const endTick = PROMPT.length + LEAD + total * REVEAL_EVERY + HOLD;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setTick((t) => (t + 1 >= endTick ? 0 : t + 1)), TICK_MS);
    return () => window.clearInterval(id);
  }, [reduced, endTick]);

  const typed = reduced ? PROMPT.length : Math.min(PROMPT.length, tick);
  const revealed = reduced
    ? total
    : Math.max(0, Math.min(total, Math.floor((tick - PROMPT.length - LEAD) / REVEAL_EVERY) + 1));
  const done = revealed >= total;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-3">
      <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5">
        <span className="grid size-[22px] place-items-center rounded-md bg-[linear-gradient(135deg,var(--green),var(--green-deep))] text-on-accent [&_svg]:size-[13px]">
          <LogoMark />
        </span>
        <span className="text-[12.5px] font-semibold text-ink-strong">{ORDER_FLOW.title}</span>
        <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[10.5px] font-medium text-slate">
          Process
        </span>
        <span className="ml-auto flex gap-1.5 text-[11.5px] font-medium">
          <span className="rounded-md border border-line px-2.5 py-1 text-slate">Share</span>
          <span className="rounded-md border border-line px-2.5 py-1 text-slate">Export</span>
        </span>
      </div>

      <div className="grid h-[400px] grid-cols-[1fr_232px] max-[760px]:h-auto max-[760px]:grid-cols-1">
        <div className="h-[400px] min-w-0 border-r border-line max-[760px]:h-[300px] max-[760px]:border-b max-[760px]:border-r-0">
          <DemoCanvas doc={ORDER_FLOW} revealed={revealed} />
        </div>

        <div className="flex flex-col gap-3 bg-surface-2 p-3.5 max-[760px]:min-h-[190px]">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-strong">
            <span className="grid size-5 place-items-center rounded-full bg-green-soft text-green [&_svg]:size-3">
              <Sparkles />
            </span>
            Kumnous AI
          </div>
          <p className="m-0 min-h-[78px] rounded-xl rounded-tr-sm border border-line bg-surface px-3 py-2.5 text-[12.5px] leading-[1.5] text-ink">
            {PROMPT.slice(0, typed)}
            {typed < PROMPT.length && (
              <span className="ml-px inline-block h-[13px] w-px translate-y-[2px] animate-pulse bg-ink" />
            )}
          </p>
          {typed >= PROMPT.length && (
            <p className="m-0 flex items-start gap-2 text-[12px] leading-[1.5] text-slate">
              <span
                className={`mt-px shrink-0 [&_svg]:size-3.5 ${done ? "text-green" : "text-slate-soft"}`}
              >
                {done ? <CheckCircle /> : <Sparkles />}
              </span>
              {done
                ? `Drew ${total} shapes and ${ORDER_FLOW.edges.length} connectors.`
                : `Drawing… ${revealed} of ${total}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Showcase() {
  const [active, setActive] = useState<(typeof SHOWCASE)[number]["id"]>("flow");
  const current = SHOWCASE.find((s) => s.id === active) ?? SHOWCASE[0];

  return (
    <div className="grid grid-cols-[260px_1fr] gap-8 max-[860px]:grid-cols-1">
      <div className="flex flex-col gap-1.5">
        {SHOWCASE.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(item.id)}
            aria-pressed={active === item.id}
            className={`cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors ${
              active === item.id
                ? "border-green-line bg-green-soft"
                : "border-transparent bg-transparent hover:bg-surface"
            }`}
          >
            <span className="block text-[14px] font-semibold text-ink-strong">{item.label}</span>
            {active === item.id && (
              <span className="mt-1 block text-[12.5px] leading-[1.5] text-slate">{item.blurb}</span>
            )}
          </button>
        ))}
      </div>
      <div className="h-[380px] overflow-hidden rounded-2xl border border-line shadow-2">
        <DemoCanvas doc={current.doc} />
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent px-5 py-4 text-left text-[14px] font-semibold text-ink-strong"
      >
        {q}
        <span
          className={`shrink-0 text-slate transition-transform [&_svg]:size-4 ${open ? "rotate-180" : ""}`}
        >
          <ChevronDown />
        </span>
      </button>
      {open && <p className="m-0 px-5 pb-5 text-[13.5px] leading-[1.65] text-slate">{a}</p>}
    </div>
  );
}

const CARD = "rounded-2xl border border-line bg-surface p-6";

/** Public marketing page shown at `/` to signed-out visitors. */
export default function Landing() {
  return (
    <div className="min-h-screen scroll-smooth bg-paper text-ink">
      <header className="sticky top-3 z-30 mx-auto mt-3 flex w-[min(1080px,calc(100%-24px))] items-center justify-between rounded-2xl border border-line bg-surface/85 px-4 py-2.5 shadow-2 backdrop-blur">
        <a href="#top" className="flex items-center gap-2.5 no-underline">
          <span className="grid size-[26px] place-items-center rounded-lg bg-[linear-gradient(135deg,var(--green),var(--green-deep))] text-on-accent [&_svg]:size-[15px]">
            <LogoMark />
          </span>
          <span className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink-strong">
            Kumnous-គំនូស
          </span>
        </a>
        <nav className="flex items-center gap-5 text-[13px] font-medium text-slate">
          <a href="#see-it" className="no-underline hover:text-ink-strong max-[760px]:hidden">
            See it
          </a>
          <a href="#types" className="no-underline hover:text-ink-strong max-[760px]:hidden">
            Diagram types
          </a>
          <a href="#faq" className="no-underline hover:text-ink-strong max-[760px]:hidden">
            FAQ
          </a>
          <span className="max-[560px]:hidden">
            <ThemeToggle />
          </span>
          <Link to="/login" className="no-underline hover:text-ink-strong">
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-green px-3.5 py-1.5 text-on-accent no-underline hover:bg-green-strong"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main id="top">
        <section className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[560px] opacity-70 [background-image:radial-gradient(var(--dot)_1.2px,transparent_1.2px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
          />
          <div className="relative mx-auto grid w-[min(1080px,calc(100%-24px))] grid-cols-[400px_1fr] items-center gap-10 pb-20 pt-16 max-[1000px]:grid-cols-1 max-[560px]:pt-10">
            <div>
              <Eyebrow>គំនូស · AI diagram editor</Eyebrow>
              <h1 className="m-0 mt-3.5 text-[46px] font-semibold leading-[1.06] tracking-[-0.03em] text-ink-strong max-[560px]:text-[34px]">
                Say what the process is. Get the diagram.
              </h1>
              <p className="mb-0 mt-5 text-[16px] leading-[1.65] text-slate">
                Kumnous AI turns a sentence into an editable flowchart, architecture or data-flow
                diagram, then keeps editing it with you, on a canvas built for the details.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-3 text-[14px] font-medium text-on-accent no-underline shadow-2 hover:bg-green-strong [&_svg]:size-4"
                >
                  Start diagramming <ArrowRight />
                </Link>
                <a
                  href="#see-it"
                  className="rounded-xl border border-line-strong bg-surface px-5 py-3 text-[14px] font-medium text-ink-strong no-underline hover:border-green-line"
                >
                  See it work
                </a>
              </div>
              <p className="mb-0 mt-6 flex items-center gap-2 text-[12.5px] text-slate-soft">
                Exports to
                {["PNG", "SVG", "PDF"].map((f) => (
                  <span
                    key={f}
                    className="rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-slate"
                  >
                    {f}
                  </span>
                ))}
              </p>
            </div>
            <HeroDemo />
          </div>
        </section>

        <section id="see-it" className="mx-auto w-[min(1080px,calc(100%-24px))] scroll-mt-24 py-16">
          <SectionTitle eyebrow="See it">Real diagrams, drawn the way the editor draws them</SectionTitle>
          <Showcase />
        </section>

        <section className="mx-auto w-[min(1080px,calc(100%-24px))] py-16">
          <SectionTitle eyebrow="Inside the editor">Built for the fiddly part, too</SectionTitle>
          <div className="grid grid-cols-6 gap-4 max-[860px]:grid-cols-1">
            <div className={`${CARD} col-span-3 max-[860px]:col-span-1`}>
              <h3 className="m-0 text-[16px] font-semibold text-ink-strong">Edit by talking</h3>
              <p className="mb-4 mt-1.5 text-[13.5px] leading-[1.6] text-slate">
                Ask for a change in plain words. The copilot edits the diagram you already have
                instead of starting over.
              </p>
              <div className="flex flex-col gap-2.5 rounded-xl bg-surface-2 p-3.5 text-[12.5px] leading-[1.5]">
                <p className="m-0 self-end rounded-xl rounded-tr-sm border border-line bg-surface px-3 py-2 text-ink">
                  Add a manager approval before the card is charged.
                </p>
                <p className="m-0 flex items-start gap-2 text-slate">
                  <span className="mt-px text-green [&_svg]:size-3.5">
                    <CheckCircle />
                  </span>
                  Added 1 step and re-routed 2 connectors.
                </p>
              </div>
            </div>

            <div className={`${CARD} col-span-3 max-[860px]:col-span-1`}>
              <h3 className="m-0 text-[16px] font-semibold text-ink-strong">Notices what's off</h3>
              <p className="mb-4 mt-1.5 text-[13.5px] leading-[1.6] text-slate">
                Overlapping connectors, dead ends, missing branches. The copilot flags them and
                offers a one-click fix.
              </p>
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3.5 shadow-2">
                <p className="m-0 flex-1 text-[12.5px] leading-[1.5] text-ink">
                  This diagram has a couple of overlapping connectors. I can tidy the layout.
                </p>
                <span className="shrink-0 rounded-lg bg-green px-3 py-1.5 text-[12px] font-medium text-on-accent">
                  Fix Layout
                </span>
              </div>
            </div>

            <div className={`${CARD} col-span-4 max-[860px]:col-span-1`} id="types">
              <h3 className="m-0 text-[16px] font-semibold text-ink-strong">
                {TYPES.length} diagram types
              </h3>
              <p className="mb-4 mt-1.5 text-[13.5px] leading-[1.6] text-slate">
                Each type gets its own shapes and layout rules, so a sequence diagram doesn't look
                like a flowchart.
              </p>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((type) => {
                  const [bg, border, ink] = tintFor(type);
                  return (
                    <span
                      key={type}
                      className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium"
                      style={{ background: bg, borderColor: border, color: ink }}
                    >
                      <TypeGlyph type={type} />
                      {TYPE_LABEL[type]}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className={`${CARD} col-span-2 max-[860px]:col-span-1`}>
              <h3 className="m-0 text-[16px] font-semibold text-ink-strong">Share or export</h3>
              <p className="mb-4 mt-1.5 text-[13.5px] leading-[1.6] text-slate">
                Hand it off as an image, a document or a link.
              </p>
              <div className="flex flex-col gap-2 text-[12.5px] font-medium text-ink [&_svg]:size-4 [&_svg]:text-slate">
                {[
                  { icon: <FileImage />, label: "PNG or SVG image" },
                  { icon: <Printer />, label: "PDF handout" },
                  { icon: <LinkIcon />, label: "Share link" },
                ].map((row) => (
                  <span
                    key={row.label}
                    className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2"
                  >
                    {row.icon}
                    {row.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto w-[min(720px,calc(100%-24px))] scroll-mt-24 py-16">
          <SectionTitle eyebrow="FAQ">Questions people ask</SectionTitle>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {FAQ.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </div>
        </section>

        <section className="mx-auto w-[min(1080px,calc(100%-24px))] pb-20 pt-6">
          <div className="rounded-3xl bg-[linear-gradient(135deg,var(--green),var(--green-deep))] px-6 py-14 text-center text-on-accent">
            <h2 className="m-0 text-[30px] font-semibold tracking-[-0.025em] max-[560px]:text-[24px]">
              Your next diagram is one sentence away.
            </h2>
            <Link
              to="/register"
              className="mt-7 inline-block rounded-xl bg-surface px-6 py-3 text-[14px] font-medium text-ink-strong no-underline"
            >
              Create an account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-[min(1080px,calc(100%-24px))] flex-wrap items-center justify-between gap-3 py-6 text-[12.5px] text-slate">
          <span className="flex items-center gap-2 font-semibold text-ink-strong">
            <span className="grid size-[20px] place-items-center rounded-md bg-[linear-gradient(135deg,var(--green),var(--green-deep))] text-on-accent [&_svg]:size-3">
              <LogoMark />
            </span>
            Kumnous-គំនូស
          </span>
          <span className="flex gap-5">
            <a href="#faq" className="text-slate no-underline hover:text-ink-strong">
              FAQ
            </a>
            <Link to="/login" className="text-slate no-underline hover:text-ink-strong">
              Log in
            </Link>
            <Link to="/register" className="text-slate no-underline hover:text-ink-strong">
              Register
            </Link>
          </span>
          <span>© {new Date().getFullYear()} Kumnous</span>
        </div>
      </footer>
    </div>
  );
}
