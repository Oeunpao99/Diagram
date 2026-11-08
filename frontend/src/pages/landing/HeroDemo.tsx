import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import {
  BoxIcon,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  DatabaseIcon,
  DiamondIcon,
  Download,
  FileUp,
  GitBranch,
  ImageIcon,
  Layers,
  LogoMark,
  Maximize,
  MousePointer,
  Pan,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Square,
  TypeIcon,
  Upload,
  UserIcon,
  ZoomIn,
  ZoomOut,
} from "../../components/icons";
import type { LandingCopy } from "./copy";
import { DemoCanvas } from "./DemoCanvas";
import { CHECKOUT_FLOW, LEAVE_FLOW } from "./demoDocs";

/** The hero: the real editor's layout (top bar, canvas toolbar, tool rail,
 *  Kumnous AI panel, status bar) playing two scripted runs, one after the
 *  other.
 *
 *  "Type a prompt": a vague request is typed into the panel's input and
 *  sent, Kumnous asks two refining questions and a pointer picks the
 *  answers, the board shows progress, then the diagram builds itself and the
 *  reply ends with the changes card. "Upload a sketch": a photo of a paper
 *  sketch is dragged onto the input, attached, sent, scanned box by box,
 *  then rebuilt. Both run on one 50ms clock; every frame is derived from the
 *  tick, so switching runs is just resetting it. */

type Scenario = "prompt" | "sketch";

const TICK_MS = 50;
/** Ticks between shapes: long enough to watch a link draw, then its shape pop in. */
const NODE_EVERY = 18;

const PROMPT = "I need a flow for customer orders";
const SKETCH_NOTE = "Turn this sketch into a diagram";
const QUESTIONS = [
  { q: "What happens if payment fails?", options: ["Retry payment", "Cancel order"], pick: 0 },
  { q: "Do customers get a tracking ID?", options: ["Yes, send it", "No"], pick: 0 },
];

/** Tick at which each moment of a run happens. */
const PROMPT_RUN = (() => {
  const typed = PROMPT.length;
  const sent = typed + 8;
  const q1 = sent + 12;
  const q1Pick = q1 + 26;
  const q2 = q1Pick + 10;
  const q2Pick = q2 + 26;
  const loading = q2Pick + 10;
  const draw = loading + 40;
  const done = draw + CHECKOUT_FLOW.nodes.length * NODE_EVERY;
  return { typed, sent, q1, q1Pick, q2, q2Pick, loading, draw, done, end: done + 100 };
})();

const SKETCH_BOXES = 4;
const SKETCH_RUN = (() => {
  const drag = 10;
  const drop = 34;
  const typeStart = drop + 6;
  const typed = typeStart + SKETCH_NOTE.length;
  const sent = typed + 8;
  const scan = sent + 6;
  const scanned = scan + SKETCH_BOXES * 9 + 6;
  const loading = scanned + 4;
  const draw = loading + 36;
  const done = draw + LEAVE_FLOW.nodes.length * NODE_EVERY;
  return { drag, drop, typeStart, typed, sent, scan, scanned, loading, draw, done, end: done + 100 };
})();

function usePrefersReducedMotion() {
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  return reduced;
}

const Pointer = () => (
  <svg viewBox="0 0 24 24" className="size-5 drop-shadow" aria-hidden="true">
    <path d="M5 3l14 8-6 1.5L10 19z" fill="#14213d" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

function Spinner() {
  return (
    <span className="lp-spin inline-block size-3.5 shrink-0 rounded-full border-2 border-solid border-line-strong border-t-green" />
  );
}

/** A photo of a hand-drawn leave-approval sketch on lined paper. `found`
 *  outlines the first N boxes the way the reader marks what it detected. */
function PaperSketch({ found = 0 }: { found?: number }) {
  const hand = { fontFamily: "'Segoe Print','Bradley Hand','Comic Sans MS',cursive", fontSize: 10.5, fill: "#2a3550" };
  const boxes = [
    { x: 10, y: 62, w: 66, h: 32 },
    { x: 86, y: 54, w: 56, h: 48 },
    { x: 166, y: 22, w: 66, h: 32 },
    { x: 166, y: 106, w: 66, h: 32 },
  ];
  return (
    <svg viewBox="0 0 240 160" className="block h-full w-full" aria-hidden="true">
      <rect width="240" height="160" fill="#fbf8ef" />
      {[24, 44, 64, 84, 104, 124, 144].map((y) => (
        <line key={y} x1="0" x2="240" y1={y} y2={y} stroke="#cfdcef" strokeWidth="0.6" />
      ))}
      <line x1="22" x2="22" y1="0" y2="160" stroke="#f2b3b3" strokeWidth="0.8" />
      <g fill="none" stroke="#2a3550" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 63 L75 61 L77 93 L11 95 Z" />
        <path d="M114 55 L141 78 L114 101 L87 77 Z" />
        <path d="M167 23 L231 22 L232 53 L168 55 Z" />
        <path d="M167 107 L232 106 L231 138 L166 139 Z" />
        <path d="M77 78 L86 78" />
        <path d="M82 74 L87 78 L82 82" />
        <path d="M128 66 C 145 50, 152 38, 166 38" />
        <path d="M160 34 L166 38 L160 43" />
        <path d="M128 90 C 145 106, 152 120, 166 122" />
        <path d="M160 117 L166 122 L161 127" />
      </g>
      <text x="17" y="82" {...hand}>Submit leave</text>
      <text x="96" y="81" {...hand} fontSize={9.5}>Approve?</text>
      <text x="173" y="42" {...hand}>HR records</text>
      <text x="171" y="126" {...hand} fontSize={9.5}>Notify staff</text>
      <text x="146" y="44" {...hand} fontSize={9}>yes</text>
      <text x="146" y="119" {...hand} fontSize={9}>no</text>
      {boxes.slice(0, found).map((b) => (
        <rect
          key={b.x + b.y}
          x={b.x - 3}
          y={b.y - 3}
          width={b.w + 6}
          height={b.h + 6}
          rx="3"
          fill="color-mix(in srgb, var(--brand-red) 10%, transparent)"
          stroke="var(--brand-red)"
          strokeWidth="1.5"
          className="lp-pop"
        />
      ))}
    </svg>
  );
}

/** What the board shows between "sent" and the first shape: the current
 *  stage, a progress bar, and faint placeholder shapes where the diagram
 *  will go. */
function BoardProgress({ label, progress }: { label: string; progress: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 flex items-center justify-center gap-10 opacity-60" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-14 w-32 animate-pulse rounded-xl border-2 border-dashed border-line-strong"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="lp-rise w-[300px] rounded-xl border border-line bg-surface p-4 shadow-3">
          <p className="m-0 flex items-center justify-between gap-3 text-[13.5px] font-medium text-ink-strong">
            <span className="flex items-center gap-2.5">
              <Spinner />
              {label}
            </span>
            <span className="tabular-nums text-slate">{pct}%</span>
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-green transition-[width] duration-100" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Avatars as the real panel draws them: the K mark for Kumnous, a person
 *  for you. */
function Avatar({ who }: { who: "ai" | "user" }) {
  return (
    <span
      className={`grid size-7 shrink-0 place-items-center rounded-full border border-green-line [&_svg]:size-[15px] ${
        who === "user" ? "bg-[#dcebe5] text-green-deep" : "bg-green-soft text-green-strong"
      }`}
    >
      {who === "ai" ? <LogoMark /> : <UserIcon />}
    </span>
  );
}

/** Your turn: optional image above, then the green bubble. */
function UserTurn({ children, image }: { children?: ReactNode; image?: ReactNode }) {
  return (
    <div className="lp-rise flex flex-row-reverse gap-2">
      <Avatar who="user" />
      <div className="flex min-w-0 max-w-[80%] flex-col items-end gap-1.5">
        {image}
        {children && (
          <div
            lang="en"
            className="rounded-[11px] rounded-br-[4px] bg-green px-[11px] py-[9px] text-[13px] leading-[1.5] text-on-accent"
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

/** Kumnous's turn: the K avatar and plain text, no bubble. */
function AiTurn({ children }: { children: ReactNode }) {
  return (
    <div className="lp-rise flex gap-2">
      <Avatar who="ai" />
      <div className="min-w-0 max-w-[85%] py-[5px] text-[13px] leading-[1.55] text-ink">{children}</div>
    </div>
  );
}

function Question({ q, options, pick, picked }: { q: string; options: string[]; pick: number; picked: boolean }) {
  return (
    <div lang="en" className="mt-1.5 rounded-xl border border-line bg-surface p-3">
      <p className="m-0 text-[13px] font-medium text-ink-strong">{q}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option, i) => {
          const chosen = picked && i === pick;
          return (
            <span
              key={option}
              className={`relative rounded-full border px-2.5 py-1 text-[12.5px] transition-colors duration-200 ${
                chosen ? "border-green bg-green font-medium text-on-accent" : "border-line-strong text-ink"
              }`}
            >
              {option}
              {i === pick && !picked && (
                <span className="lp-pointer absolute -bottom-3 left-1/2">
                  <Pointer />
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** The "✓ N changes" card the real panel ends a reply with. */
function ChangesCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="lp-rise mt-2 rounded-xl border border-line bg-surface p-3">
      <p className="m-0 flex items-center gap-2 text-[13px] font-semibold text-ink-strong [&_svg]:size-4 [&_svg]:text-green">
        <CheckCircle />
        {title}
      </p>
      <ul className="mb-0 mt-2 list-disc pl-5 text-[12.5px] leading-[1.6] text-ink">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ToolButton({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] text-slate [&_svg]:size-4">
      {children}
      {label}
    </span>
  );
}

export function HeroDemo({ copy }: { copy: LandingCopy["demo"] }) {
  const reduced = usePrefersReducedMotion();
  const [scenario, setScenario] = useState<Scenario>("prompt");
  const run = scenario === "prompt" ? PROMPT_RUN : SKETCH_RUN;
  const [tick, setTick] = useState(reduced ? run.end - 1 : 0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setTick((t) => {
        if (t + 1 < run.end) return t + 1;
        setScenario((s) => (s === "prompt" ? "sketch" : "prompt"));
        return 0;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [reduced, run.end]);

  const choose = (next: Scenario) => {
    setScenario(next);
    setTick(reduced ? (next === "prompt" ? PROMPT_RUN : SKETCH_RUN).end - 1 : 0);
  };

  const doc = scenario === "prompt" ? CHECKOUT_FLOW : LEAVE_FLOW;
  const shapes = doc.nodes.length;
  const links = doc.edges.length;
  const revealed = Math.max(0, Math.min(shapes, Math.floor((tick - run.draw) / NODE_EVERY) + 1));
  const done = tick >= run.done;
  const s = SKETCH_RUN;
  const p = PROMPT_RUN;

  // What's in the input box right now.
  let draft = "";
  let attached = false;
  if (scenario === "prompt" && tick < p.sent) draft = PROMPT.slice(0, Math.min(PROMPT.length, tick));
  if (scenario === "sketch" && tick >= s.drop && tick < s.sent) {
    attached = true;
    draft = SKETCH_NOTE.slice(0, Math.max(0, Math.min(SKETCH_NOTE.length, tick - s.typeStart)));
  }
  const typing =
    (scenario === "prompt" && tick < p.typed) || (scenario === "sketch" && tick >= s.typeStart && tick < s.typed);
  const dropTarget = scenario === "sketch" && tick >= s.drag && tick < s.drop;

  // The paper being dragged from the canvas onto the input box.
  const dragging = scenario === "sketch" && tick >= s.drag && tick < s.drop;
  const paperGone = scenario === "sketch" && tick >= s.drop;
  const paperStyle: CSSProperties =
    dragging || paperGone
      ? { left: "calc(100% - 300px)", top: 400, transform: "rotate(0deg) scale(0.45)", opacity: paperGone ? 0 : 1 }
      : { left: "18%", top: 150, transform: "rotate(-6deg) scale(1)", opacity: 1 };
  const found = Math.max(0, Math.min(SKETCH_BOXES, Math.floor((tick - s.scan) / 9) + 1));

  // What the board shows before the first shape.
  const span = (from: number, to: number) => (tick - from) / (to - from);
  let board: { label: string; progress: number } | null = null;
  if (scenario === "prompt") {
    if (tick >= p.loading && tick < p.draw) board = { label: copy.generating, progress: span(p.loading, p.draw) };
  } else if (tick >= s.sent && tick < s.scan) {
    board = { label: copy.uploading, progress: span(s.sent, s.scan) };
  } else if (tick >= s.scan && tick < s.scanned) {
    board = { label: copy.readingBoard, progress: span(s.scan, s.scanned) };
  } else if (tick >= s.scanned && tick < s.draw) {
    board = { label: copy.generating, progress: span(s.scanned, s.draw) };
  }

  const tabs: { value: Scenario; label: string; icon: ReactNode }[] = [
    { value: "prompt", label: copy.tabPrompt, icon: <Sparkles /> },
    { value: "sketch", label: copy.tabSketch, icon: <Upload /> },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label={copy.tabsLabel}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={scenario === tab.value}
            onClick={() => choose(tab.value)}
            className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green [&_svg]:size-4 ${
              scenario === tab.value
                ? "border-green bg-green text-on-accent"
                : "border-line-strong bg-surface text-ink hover:bg-surface-2"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-line-strong bg-surface shadow-3">
        {/* Top bar, as in the editor. */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-2">
          <span className="grid size-[22px] place-items-center rounded-md bg-green text-on-accent [&_svg]:size-[13px]">
            <LogoMark />
          </span>
          <span className="text-[13px] font-semibold text-ink-strong max-[560px]:hidden">Kumnous-គំនូស</span>
          <span className="h-4 w-px bg-line max-[560px]:hidden" />
          <span className="truncate text-[13.5px] font-semibold text-ink-strong">{doc.title}</span>
          <span className="flex items-center gap-1.5 text-[12px] text-slate">
            <span className="size-1.5 rounded-full bg-green" />
            {copy.saved}
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-[12.5px] font-medium max-[760px]:hidden">
            <span className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-ink [&_svg]:size-3.5">
              <FileUp />
              {copy.importLabel}
            </span>
            <span className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-ink [&_svg]:size-3.5">
              <Download />
              {copy.exportLabel}
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-green px-2.5 py-1 font-semibold text-on-accent [&_svg]:size-3.5">
              <Sparkles />
              Kumnous AI
            </span>
          </span>
        </div>

        <div className="relative grid h-[560px] grid-cols-[1fr_340px] max-[860px]:h-auto max-[860px]:grid-cols-1">
          {/* Canvas with its floating toolbar and left tool rail. */}
          <div className="relative h-[560px] min-w-0 border-r border-line max-[860px]:h-[340px] max-[860px]:border-b max-[860px]:border-r-0">
            <DemoCanvas doc={doc} revealed={revealed} />
            {board && <BoardProgress label={board.label} progress={board.progress} />}

            <div
              aria-hidden="true"
              className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-xl border border-line bg-surface px-1.5 py-1 shadow-2 max-[1100px]:hidden"
            >
              <ToolButton>
                <MousePointer />
              </ToolButton>
              <ToolButton>
                <Pan />
              </ToolButton>
              <ToolButton>
                <Square />
              </ToolButton>
              <ToolButton>
                <TypeIcon />
              </ToolButton>
              <ToolButton>
                <GitBranch />
              </ToolButton>
              <ToolButton>
                <Pencil />
              </ToolButton>
              <span className="mx-1 h-4 w-px bg-line" />
              <ToolButton label={copy.autoLayout}>
                <Layers />
              </ToolButton>
              <ToolButton label={copy.direction}>
                <ChevronDown />
              </ToolButton>
              <span className="mx-1 h-4 w-px bg-line" />
              <ToolButton>
                <ZoomOut />
              </ToolButton>
              <span className="px-1 text-[12.5px] font-semibold text-ink">100%</span>
              <ToolButton>
                <ZoomIn />
              </ToolButton>
              <ToolButton label={copy.fit}>
                <Maximize />
              </ToolButton>
            </div>

            <div
              aria-hidden="true"
              className="absolute left-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-2 max-[860px]:hidden"
            >
              {[<ImageIcon key="i" />, <TypeIcon key="t" />, <BoxIcon key="b" />, <DiamondIcon key="d" />, <DatabaseIcon key="db" />, <UserIcon key="u" />, <Plus key="p" />].map(
                (icon, i) => (
                  <span key={i} className="grid size-8 place-items-center text-slate [&_svg]:size-4">
                    {icon}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* The Kumnous AI panel. */}
          <div className="flex min-h-0 flex-col bg-surface max-[860px]:h-[480px]">
            <div className="flex items-start gap-2.5 border-b border-line px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-green-soft text-green-strong [&_svg]:size-4">
                <LogoMark />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink-strong">Kumnous AI</span>
                <span className="block text-[12.5px] text-slate">{copy.panelSub}</span>
              </span>
              <span className="mt-1 text-slate [&_svg]:size-4">
                <ChevronRight />
              </span>
            </div>

            {/* Newest at the bottom; older turns scroll off the top. */}
            <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden px-4 py-3">
              {scenario === "prompt" ? (
                <>
                  {tick >= p.sent && <UserTurn>{PROMPT}</UserTurn>}
                  {tick >= p.q1 && (
                    <AiTurn>
                      {copy.askFirst}
                      <Question {...QUESTIONS[0]} picked={tick >= p.q1Pick} />
                    </AiTurn>
                  )}
                  {tick >= p.q2 && (
                    <AiTurn>
                      <Question {...QUESTIONS[1]} picked={tick >= p.q2Pick} />
                    </AiTurn>
                  )}
                </>
              ) : (
                tick >= s.sent && (
                  <>
                    <UserTurn
                      image={
                        <span className="relative block aspect-[3/2] w-[190px] overflow-hidden rounded-[11px] border border-line">
                          <PaperSketch found={tick >= s.scan ? found : 0} />
                          {tick >= s.scan && tick < s.scanned && <span className="lp-scan absolute inset-x-0 top-0 h-8" />}
                        </span>
                      }
                    >
                      {SKETCH_NOTE}
                    </UserTurn>
                    {tick >= s.scan && (
                      <AiTurn>
                        <span className="flex items-center gap-2">
                          {tick < s.scanned && <Spinner />}
                          {tick < s.scanned ? copy.reading(found) : copy.readDone(SKETCH_BOXES, 3)}
                        </span>
                      </AiTurn>
                    )}
                  </>
                )
              )}
              {tick >= run.loading && (
                <AiTurn>
                  {done ? (
                    <>
                      {copy.doneReply}
                      <ChangesCard
                        title={copy.changesTitle(3)}
                        items={[copy.changeShapes(shapes), copy.changeLinks(links), copy.changeLayout]}
                      />
                    </>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Spinner />
                      {tick < run.draw
                        ? scenario === "prompt"
                          ? copy.drawingYours
                          : copy.rebuilding
                        : copy.drawing(revealed, shapes)}
                    </span>
                  )}
                </AiTurn>
              )}
            </div>

            {/* Suggestions and the input, as in the real panel. */}
            <div className="border-t border-line p-3">
              <div className="no-scrollbar mb-2 flex gap-1.5 overflow-hidden">
                {copy.chips.map((chip) => (
                  <span
                    key={chip}
                    className="shrink-0 whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-[12px] text-ink"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <div
                className={`relative rounded-xl border bg-surface-2 p-2.5 transition-colors ${
                  dropTarget ? "border-2 border-dashed border-green" : "border-line"
                }`}
              >
                {attached && (
                  <span className="lp-pop mb-2 block aspect-[3/2] w-16 overflow-hidden rounded-md border border-line">
                    <PaperSketch />
                  </span>
                )}
                <p lang="en" className={`m-0 min-h-[40px] text-[13px] leading-[1.5] ${draft ? "text-ink" : "text-slate-soft"}`}>
                  {dropTarget ? (
                    <span className="flex items-center gap-1.5 font-medium text-green [&_svg]:size-4">
                      <Upload />
                      {copy.dropHint}
                    </span>
                  ) : (
                    draft || copy.inputPlaceholder
                  )}
                  {typing && <span className="ml-px inline-block h-[14px] w-px translate-y-[2px] animate-pulse bg-ink" />}
                </p>
                <div className="mt-1 flex justify-end gap-1.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-green text-on-accent [&_svg]:size-4">
                    <ImageIcon />
                  </span>
                  <span
                    className={`grid size-8 place-items-center rounded-lg transition-colors [&_svg]:size-4 ${
                      draft ? "bg-green text-on-accent" : "bg-line text-slate"
                    }`}
                  >
                    <Send />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {scenario === "sketch" && !reduced && tick < s.drop + 4 && (
            <div
              className="pointer-events-none absolute z-10 aspect-[3/2] w-[260px] origin-top-left overflow-hidden rounded-md shadow-3 transition-[left,top,transform,opacity] duration-[1100ms] ease-[cubic-bezier(.45,.05,.25,1)] max-[860px]:hidden"
              style={paperStyle}
            >
              <PaperSketch />
              {dragging && (
                <span className="absolute bottom-3 right-3">
                  <Pointer />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Status bar, as in the editor. */}
        <div className="flex items-center gap-4 border-t border-line px-4 py-1.5 text-[12px] text-slate">
          <span>{copy.nodes(revealed)}</span>
          <span>{copy.connections(Math.min(links, Math.max(0, revealed - 1)))}</span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-green" />
            {copy.autosave}
          </span>
          <span className="ml-auto max-[560px]:hidden">{copy.zoom}</span>
        </div>
      </div>
    </div>
  );
}
