import { useEffect, useState, type CSSProperties } from "react";

/** The hero headline and subtitle, animated.
 *
 *  English: each word rises in out of a blur, one after another. Line two
 *  is live, "Get a <flowchart> you can edit.", with the word cycling through
 *  short kinds of diagram, in a slot fixed to the widest of them; each new phrase slides up, a green
 *  highlighter sweeps in behind it and the text turns white on it, and the gap eases to its width so the line never jumps.
 *  The subtitle then fades in word by word, and whichever of its words names
 *  the current kind of diagram is lit up to match.
 *
 *  Khmer has no spaces between words, so it can't be split this way: there
 *  the two lines and the subtitle simply rise in. Reduced motion shows the
 *  plain text with nothing cycling. */

/** Short words only, all taking "a", so the line reads the same each time.
 *  `match` lights up the same word in the subtitle when it's there. */
const CYCLE: { phrase: string; match?: string }[] = [
  { phrase: "flowchart", match: "flowchart" },
  { phrase: "mind map" },
  { phrase: "org chart" },
  { phrase: "swimlane" },
];
const CYCLE_MS = 2600;
const WORD_STEP = 0.08;

function usePrefersReducedMotion() {
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  return reduced;
}

const delay = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

/** Words of `text`, each its own animated span, starting at `start` seconds. */
function Words({ text, start, step = WORD_STEP, className = "kl-word" }: { text: string; start: number; step?: number; className?: string }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span key={`${word}-${i}`} className={className} style={delay(start + i * step)}>
          {word}
          {i < text.split(" ").length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

export function HeroText({
  line1,
  line2,
  sub,
  km,
  headingClass,
  subClass,
}: {
  line1: string;
  line2: string;
  sub: string;
  km: boolean;
  headingClass: string;
  subClass: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const cycling = !km && !reduced;
  const current = CYCLE[index];

  // Start cycling once the headline has finished arriving.
  useEffect(() => {
    if (!cycling) return;
    let interval = 0;
    const startTimer = window.setTimeout(() => {
      interval = window.setInterval(() => setIndex((i) => (i + 1) % CYCLE.length), CYCLE_MS);
    }, 1800);
    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(interval);
    };
  }, [cycling]);

  if (km) {
    return (
      <>
        <h1 className={headingClass}>
          <span className="lp-rise block">{line1}</span>
          <span className="lp-rise block text-green" style={delay(0.3)}>
            {line2}
          </span>
        </h1>
        <p className={`lp-rise ${subClass}`} style={delay(0.6)}>
          {sub}
        </p>
      </>
    );
  }

  const line1Words = line1.split(" ").length;
  const subStart = 0.75 + line1Words * WORD_STEP;

  return (
    <>
      <h1 className={headingClass} aria-label={`${line1} ${line2}`}>
        <span aria-hidden="true">
          <Words text={line1} start={0} />{" "}
          <Words text="Get a" start={line1Words * WORD_STEP + 0.05} />{" "}
          {/* A fixed slot as wide as the widest word: every word sits centred
              in the same box, so the line never changes length and nothing
              beside the headline (the hero picture) ever moves. */}
          {/* Two wrappers on purpose: `.kl-word` sets display: inline-block for
              its entrance, which would override the grid that stacks the
              words; on one element the hidden copies sat side by side and
              shoved the hero picture over. */}
          <span className="kl-word" style={delay(line1Words * WORD_STEP + 0.2)}>
            <span className="inline-grid whitespace-nowrap align-bottom text-green">
              {CYCLE.map((c) => (
                <span key={c.phrase} aria-hidden="true" className="invisible col-start-1 row-start-1 px-[0.12em]">
                  {c.phrase}
                </span>
              ))}
              <span className="relative isolate col-start-1 row-start-1 justify-self-center px-[0.12em]">
                <span key={current.phrase} className={cycling ? "kl-marked" : "text-on-accent"}>
                  {current.phrase}
                </span>
                <span key={`m-${current.phrase}`} className="kl-mark" />
              </span>
            </span>
          </span>{" "}
          <Words text="you can edit." start={line1Words * WORD_STEP + 0.25} />
        </span>
      </h1>
      <p className={subClass}>
        {sub.split(" ").map((token, i) => {
          const [, word = token, tail = ""] = token.match(/^(.*?)([.,;:!?]*)$/u) ?? [];
          const lit = cycling && !!current.match && word.toLowerCase() === current.match;
          return (
            <span key={`${token}-${i}`} className="kl-fadeword" style={delay(subStart + i * 0.025)}>
              <span className={`kl-subword ${lit ? "kl-lit" : ""}`}>{word}</span>
              {tail}{" "}
            </span>
          );
        })}
      </p>
    </>
  );
}
