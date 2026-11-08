import { useEffect, useState } from "react";

import type { LandingCopy } from "./copy";

/** "How it works", as a live pipeline: what goes in on the left, Kumnous in
 *  the middle, what comes out on the right, and the five real steps along the
 *  bottom (read the request, choose a type, draw, lay out and check, ready).
 *
 *  Plays on its own, cycling through the three kinds of input. Clicking an
 *  input replays the run from that source; clicking a step jumps to it and
 *  pauses; hovering an output traces its path. Particles ride the paths with
 *  SVG <animateMotion>, which CSS reduced-motion can't stop, so they're not
 *  rendered at all for people who asked for less motion. */

const W = 1000;
const H = 440;
const CORE = { x: 500, y: 220, r: 74 };
const CARD_W = 210;
const ROWS = [90, 220, 350];

/** Five steps: read, choose type, draw, lay out and check, ready. */
const STEP_COUNT = 5;

/** Teal for the paths that produce something, brand red for the one that
 *  looks for problems. */
const OUT_COLOR = ["var(--green)", "var(--brand-red)", "var(--green)"];

/** Which outputs light up at each step. */
const LIT: number[][] = [[], [], [0], [0, 1], [0, 1, 2]];

const TICK_MS = 50;
const STEP_TICKS = 40;
const HOLD_TICKS = 60;
const RUN_TICKS = STEP_TICKS * STEP_COUNT;

const inPath = (i: number) =>
  `M ${CARD_W + 20} ${ROWS[i]} C 360 ${ROWS[i]}, 360 ${CORE.y}, ${CORE.x - CORE.r} ${CORE.y}`;
const outPath = (i: number) =>
  `M ${CORE.x + CORE.r} ${CORE.y} C 640 ${CORE.y}, 640 ${ROWS[i]}, ${W - CARD_W - 20} ${ROWS[i]}`;

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

function Particles({
  pathId,
  color = "var(--green)",
  count = 3,
  dur = 1.6,
}: {
  pathId: string;
  color?: string;
  count?: number;
  dur?: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, k) => (
        <circle key={k} r={3.5} fill={color}>
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${(k * dur) / count}s`}>
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </circle>
      ))}
    </>
  );
}

export function PipelineFlow({ copy }: { copy: LandingCopy["how"] }) {
  const INPUTS = copy.inputs;
  const OUTPUTS = copy.outputs;
  const STEPS = copy.steps;
  const reduced = usePrefersReducedMotion();
  const [tick, setTick] = useState(reduced ? RUN_TICKS : 0);
  const [playing, setPlaying] = useState(!reduced);
  const [source, setSource] = useState(0);
  const [picked, setPicked] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setTick((t) => {
        if (t + 1 < RUN_TICKS + HOLD_TICKS) return t + 1;
        // Run finished: start over, moving to the next kind of input
        // unless the visitor chose one.
        if (!picked) setSource((s) => (s + 1) % INPUTS.length);
        return 0;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, picked]);

  const step = Math.min(STEPS.length - 1, Math.floor(tick / STEP_TICKS));
  const percent = Math.min(100, Math.round((tick / RUN_TICKS) * 100));
  const lit = LIT[step];
  const busy = step >= 1 && step <= 3;
  const stepLabel = step === 0 ? INPUTS[source].read : copy.status[step];
  const motion = !reduced && playing;

  const chooseInput = (i: number) => {
    setSource(i);
    setPicked(true);
    setTick(0);
    setPlaying(!reduced);
  };
  const jumpTo = (i: number) => {
    setTick(i === STEPS.length - 1 ? RUN_TICKS : i * STEP_TICKS + 1);
    setPlaying(false);
  };

  return (
    <div className="overflow-hidden rounded-[14px] border border-line-strong bg-surface">
      <div className="overflow-x-auto">
        <div className="relative mx-auto aspect-[1000/440] min-w-[760px] [background-image:radial-gradient(var(--dot)_1.2px,transparent_1.2px)] [background-size:24px_24px]">
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
            {/* Paths: a quiet base line, and a flowing green one when active. */}
            {ROWS.map((_, i) => {
              const active = i === source;
              return (
                <g key={`in-${i}`}>
                  <path id={`kf-in-${i}`} d={inPath(i)} fill="none" stroke="var(--line-strong)" strokeWidth={2} />
                  {active && (
                    <path
                      d={inPath(i)}
                      fill="none"
                      stroke="var(--green)"
                      strokeWidth={2.5}
                      className={step <= 1 ? "kf-flow" : ""}
                      opacity={step <= 1 ? 1 : 0.45}
                    />
                  )}
                  {active && motion && step <= 1 && <Particles pathId={`kf-in-${i}`} />}
                </g>
              );
            })}
            {ROWS.map((_, i) => {
              const on = lit.includes(i) || hovered === i;
              const flowing = motion && lit.includes(i) && step < STEPS.length - 1;
              return (
                <g key={`out-${i}`}>
                  <path id={`kf-out-${i}`} d={outPath(i)} fill="none" stroke="var(--line-strong)" strokeWidth={2} />
                  {on && (
                    <path
                      d={outPath(i)}
                      fill="none"
                      stroke={OUT_COLOR[i]}
                      strokeWidth={2.5}
                      className={flowing || hovered === i ? "kf-flow" : ""}
                    />
                  )}
                  {flowing && i === lit[lit.length - 1] && (
                    <Particles pathId={`kf-out-${i}`} color={OUT_COLOR[i]} />
                  )}
                </g>
              );
            })}

            {/* Port circles where paths meet the cards, as on the canvas. */}
            {ROWS.map((y, i) => (
              <g key={`ports-${i}`} fill="var(--surface)" strokeWidth={2}>
                <circle cx={CARD_W + 20} cy={y} r={5} stroke={i === source ? "var(--green)" : "var(--line-strong)"} />
                <circle
                  cx={W - CARD_W - 20}
                  cy={y}
                  r={5}
                  stroke={lit.includes(i) || hovered === i ? OUT_COLOR[i] : "var(--line-strong)"}
                />
              </g>
            ))}

            {/* The core: a soft pulse while working, two arcs that turn
                faster while it thinks, and the current step in words. */}
            <circle
              cx={CORE.x}
              cy={CORE.y}
              r={CORE.r + 26}
              fill="none"
              stroke="var(--line-strong)"
              strokeDasharray="1 7"
              strokeLinecap="round"
              className="kf-spin"
              style={{ animationDuration: "60s" }}
            />
            {busy && (
              <circle cx={CORE.x} cy={CORE.y} r={CORE.r} fill="var(--green)" className="kf-pulse" opacity={0.14} />
            )}
            <circle
              cx={CORE.x}
              cy={CORE.y}
              r={CORE.r + 12}
              fill="none"
              stroke="var(--green)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="70 480"
              className="kf-spin"
              style={{ animationDuration: busy ? "1.6s" : "8s" }}
            />
            <circle
              cx={CORE.x}
              cy={CORE.y}
              r={CORE.r + 12}
              fill="none"
              stroke="var(--brand-red)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="40 510"
              className="kf-spin-rev"
              style={{ animationDuration: busy ? "2.4s" : "12s" }}
            />
            <circle
              cx={CORE.x}
              cy={CORE.y}
              r={CORE.r}
              fill="var(--surface)"
              stroke={busy || step === STEPS.length - 1 ? "var(--green)" : "var(--line-strong)"}
              strokeWidth={2}
            />
            <text
              x={CORE.x}
              y={CORE.y - 6}
              textAnchor="middle"
              className="[font-family:'Plus_Jakarta_Sans','Kantumruy_Pro',sans-serif]"
              fontSize={19}
              fontWeight={600}
              fill="var(--ink-strong)"
            >
              Kumnous AI
            </text>
            <text x={CORE.x} y={CORE.y + 18} textAnchor="middle" fontSize={12.5} fill="var(--slate)">
              {STEPS[step]}
            </text>
          </svg>

          {/* Cards are HTML over the SVG, placed on the same coordinates. */}
          {INPUTS.map((input, i) => (
            <button
              key={input.title}
              type="button"
              onClick={() => chooseInput(i)}
              aria-pressed={i === source}
              className={`absolute flex -translate-y-1/2 cursor-pointer flex-col items-start rounded-xl border bg-surface px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${
                i === source ? "border-green" : "border-line-strong hover:border-slate-soft"
              }`}
              style={{ left: `${(20 / W) * 100}%`, top: `${(ROWS[i] / H) * 100}%`, width: `${(CARD_W / W) * 100}%` }}
            >
              <span className="text-[14px] font-semibold text-ink-strong">{input.title}</span>
              <span className="mt-0.5 text-[12.5px] text-slate">{input.body}</span>
            </button>
          ))}
          {OUTPUTS.map((output, i) => {
            const on = lit.includes(i);
            return (
              <div
                key={output.title}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className={`absolute flex -translate-y-1/2 flex-col rounded-xl border px-4 py-3 transition-colors duration-300 ${
                  on
                    ? i === 1
                      ? "border-brand-red bg-brand-red text-white [&>span]:!text-white"
                      : "border-green bg-green text-white [&>span]:!text-white"
                    : "border-line-strong bg-surface"
                }`}
                style={{
                  left: `${((W - CARD_W - 20) / W) * 100}%`,
                  top: `${(ROWS[i] / H) * 100}%`,
                  width: `${(CARD_W / W) * 100}%`,
                }}
              >
                <span className="flex items-center gap-2 text-[14px] font-semibold text-ink-strong">
                  <span
                    className={`size-2 rounded-full transition-colors ${
                      on ? "bg-white" : "bg-line-strong"
                    }`}
                  />
                  {output.title}
                </span>
                <span className="mt-0.5 text-[12.5px] text-slate">{output.body}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* The five steps, as a scrubber. */}
      <div className="border-t border-line px-6 pb-5 pt-5">
        <div className="relative mx-auto max-w-[760px]">
          <div className="absolute left-[10%] right-[10%] top-[7px] h-[2px] bg-line" />
          <div
            className="absolute left-[10%] top-[7px] h-[2px] bg-[linear-gradient(90deg,var(--green),var(--brand-red))] transition-[width] duration-100"
            style={{ width: `${percent * 0.8}%` }}
          />
          <ol className="relative m-0 grid list-none grid-cols-5 p-0">
            {STEPS.map((label, i) => (
              <li key={label} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => jumpTo(i)}
                  aria-current={i === step ? "step" : undefined}
                  className="group flex cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green"
                >
                  <span
                    className={`size-4 rounded-full border-2 border-solid transition-colors ${
                      i < step || (i === step && percent >= 100)
                        ? "border-green bg-green"
                        : i === step
                          ? "border-green bg-surface"
                          : "border-line-strong bg-surface group-hover:border-slate-soft"
                    }`}
                  />
                  <span
                    className={`text-[13px] ${i === step ? "font-semibold text-ink-strong" : "text-slate group-hover:text-ink-strong"}`}
                  >
                    {label}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-[13.5px] text-slate">
          <span aria-live="polite">
            {stepLabel} <span className="font-semibold text-ink-strong tabular-nums">{percent}%</span>
          </span>
          {!reduced && (
            <button
              type="button"
              onClick={() => {
                if (!playing && tick >= RUN_TICKS) setTick(0);
                setPlaying((p) => !p);
              }}
              className="cursor-pointer rounded-md border border-line-strong bg-surface px-3 py-1 text-[13px] font-medium text-ink-strong hover:border-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
            >
              {playing ? copy.pause : copy.play}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
