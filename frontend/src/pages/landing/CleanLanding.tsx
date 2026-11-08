import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import type { DiagramType } from "../../api/types";
import { ArrowRight, Check, CheckCircle, FileImage, ImageIcon, LinkIcon, LogoMark, Printer, Sparkles } from "../../components/icons";
import { TYPE_LABEL, TypeGlyph, tintFor } from "../../components/templateVisuals";
import { ThemeIconButton } from "../../components/ThemeToggle";
import { Examples, FaqItem, LanguageMenu, Pricing, Reveal } from "../Landing";
import { COPY, saveLang, storedLang, type Lang } from "./copy";
import { HeroDemo } from "./HeroDemo";
import { HeroText } from "./HeroText";
import { PipelineFlow } from "./PipelineFlow";
import { TemplateBrowser } from "./TemplateBrowser";

/* A clean, image-led landing page, laid out like Smart Marketing's: a two-column hero
 * with a big product shot, the diagram types as a strip, three steps, a gallery of
 * showcase cards, feature rows that alternate sides, pricing, FAQ and a closing call.
 *
 * Every picture is a SHOWCASE slot: drop a file into frontend/public/showcase/ with the
 * name shown on the empty card (hero.png, 1.png … 6.png, feature-1.png …) and it
 * appears — until then the card shows where it goes. Words come from ./copy (English
 * and Khmer), so the language switch keeps working. The old page stays in ../Landing. */

// Plus Jakarta Sans for English, headings and body alike; it has no Khmer, so
// Khmer text falls through to Kantumruy Pro.
const DISPLAY = "[font-family:'Plus_Jakarta_Sans','Kantumruy_Pro',sans-serif]";
const BODY = "[font-family:'Plus_Jakarta_Sans','Kantumruy_Pro',sans-serif]";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";
const WRAP = "mx-auto w-[min(1180px,calc(100%-40px))]";
const TYPES = Object.keys(TYPE_LABEL) as DiagramType[];

/** A picture slot: the image in public/showcase/<file>, or — while there is none — a
 *  dashed card saying which file to add. ``ratio`` keeps the card's shape either way. */
function Shot({ file, ratio = "16 / 10", frame = false, label }: { file: string; ratio?: string; frame?: boolean; label?: string }) {
  const [missing, setMissing] = useState(false);
  const body = missing ? (
    <div
      className="grid h-full w-full place-items-center rounded-[inherit] border-2 border-dashed border-line-strong bg-surface-2 text-center"
      style={{ aspectRatio: ratio }}
    >
      <div className="px-4 text-slate">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-surface text-green shadow-2 [&_svg]:size-5">
          <ImageIcon />
        </span>
        <p className="mb-0 mt-3 text-[14px] font-semibold text-ink-strong">{label || "Your image here"}</p>
        <p className="mb-0 mt-1 text-[12.5px]">
          public/showcase/<b className="text-ink">{file}</b>
        </p>
      </div>
    </div>
  ) : (
    <img
      src={`/showcase/${file}`}
      alt={label || ""}
      loading="lazy"
      onError={() => setMissing(true)}
      className="block h-full w-full rounded-[inherit] object-cover"
      style={{ aspectRatio: ratio }}
    />
  );
  if (!frame) return <div className="overflow-hidden rounded-2xl">{body}</div>;
  // the product, in a plain browser frame
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_-24px_rgba(15,23,42,0.35)]">
      <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-4 py-2.5">
        {["#F87171", "#FBBF24", "#34D399"].map((c) => (
          <span key={c} className="size-2.5 rounded-full" style={{ background: c }} />
        ))}
        <span className="ml-3 flex-1 truncate rounded-md bg-surface px-3 py-1 text-[11.5px] text-slate-soft">kumnous.chlart.org</span>
      </div>
      <div className="rounded-none">{body}</div>
    </div>
  );
}

/** A small card floating over the hero shot. */
function FloatTag({ icon, text, sub, className, delay = 0 }: { icon: ReactNode; text: string; sub?: string; className: string; delay?: number }) {
  return (
    <div
      className={`absolute z-10 hidden items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-2.5 shadow-3 sm:flex ${className}`}
      style={{ animation: `kl-float 6s ease-in-out ${delay}s infinite` }}
    >
      <span className="grid size-8 flex-none place-items-center rounded-xl bg-green text-on-accent [&_svg]:size-4">{icon}</span>
      <span>
        <span className="block whitespace-nowrap text-[13px] font-semibold text-ink-strong">{text}</span>
        {sub && <span className="block whitespace-nowrap text-[11.5px] text-slate">{sub}</span>}
      </span>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-green">{children}</p>;
}

function Title({ eyebrow, title, intro, center = true }: { eyebrow?: string; title: string; intro?: string; center?: boolean }) {
  return (
    <Reveal className={center ? "mx-auto max-w-[760px] text-center" : ""}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className={`${DISPLAY} m-0 mt-3 text-[38px] font-semibold leading-[1.25] tracking-[-0.015em] text-ink-strong max-[560px]:text-[28px]`}>
        {title}
      </h2>
      {intro && <p className={`mb-0 mt-4 text-[16px] leading-[1.7] text-slate ${center ? "mx-auto max-w-[62ch]" : "max-w-[58ch]"}`}>{intro}</p>}
    </Reveal>
  );
}

/** A feature: words on one side, its showcase picture on the other (``flip`` swaps). */
function Feature({ eyebrow, title, body, points, file, flip = false }: { eyebrow: string; title: string; body: string; points: string[]; file: string; flip?: boolean }) {
  return (
    <div className={`grid items-center gap-12 lg:grid-cols-2 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className={`${DISPLAY} m-0 mt-3 text-[30px] font-semibold leading-[1.3] text-ink-strong max-[560px]:text-[24px]`}>{title}</h3>
        <p className="mb-0 mt-4 text-[15.5px] leading-[1.75] text-slate">{body}</p>
        <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
          {points.map((p, i) => (
            <li key={p} className="lp-reveal-item flex items-start gap-3 text-[15px] leading-[1.6] text-ink" style={{ "--d": `${0.2 + i * 0.1}s` } as CSSProperties}>
              <span className="mt-0.5 grid size-5 flex-none place-items-center rounded-full bg-green text-on-accent [&_svg]:size-3">
                <Check />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={0.15}>
        <Shot file={file} ratio="4 / 3" label={title} />
      </Reveal>
    </div>
  );
}

/** The public page at `/` for signed-out visitors. */
export default function CleanLanding() {
  const [lang, setLang] = useState<Lang>(storedLang);
  const t = COPY[lang];
  const km = lang === "km";
  useEffect(() => {
    document.documentElement.lang = lang;
    saveLang(lang);
  }, [lang]);
  const k = (en: string, kh: string) => (km ? kh : en);

  // the gallery: one card per kind of diagram people make most
  const gallery: { file: string; type: DiagramType; text: string }[] = [
    { file: "1.png", type: "process_flow", text: k("An approval flow, step by step", "លំហូរអនុម័ត មួយជំហានម្តងៗ") },
    { file: "2.png", type: "architecture", text: k("A cloud system at a glance", "ប្រព័ន្ធ Cloud មើលភ្លាមយល់") },
    { file: "3.png", type: "swimlane", text: k("Who does what, team by team", "អ្នកណាធ្វើអ្វី តាមក្រុមនីមួយៗ") },
    { file: "4.png", type: "data_flow", text: k("Where the data goes", "ទិន្នន័យទៅណាខ្លះ") },
    { file: "5.png", type: "org_chart", text: k("Your team, top to bottom", "ក្រុមការងាររបស់អ្នក ពីលើចុះក្រោម") },
    { file: "6.png", type: "mind_map", text: k("An idea, branched out", "គំនិតមួយ បែកជាមែកធាង") },
  ];

  return (
    <div className={`relative isolate min-h-screen bg-paper text-ink ${BODY}`}>
      {/* Faint drafting grid behind the whole page, fixed while it scrolls:
          clearest at the top, fading towards the bottom of the screen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 [background-image:linear-gradient(color-mix(in_srgb,var(--line-strong)_55%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--line-strong)_55%,transparent)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black_0%,rgba(0,0,0,0.55)_55%,rgba(0,0,0,0.25)_100%)]"
      />
      <style>{`
        @keyframes kl-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @media (prefers-reduced-motion: reduce) { [style*='kl-float'] { animation: none !important } }
        .lp-reveal-item { opacity: 0; translate: 0 10px; transition: opacity .5s ease, translate .5s cubic-bezier(.2,.8,.2,1); transition-delay: var(--d, 0s); }
        .is-in .lp-reveal-item { opacity: 1; translate: 0 0; }
        .lp-chip { opacity: 0; scale: .85; transition: opacity .35s ease, scale .35s cubic-bezier(.2,.9,.3,1.3), translate .2s ease; transition-delay: var(--d, 0s); }
        .is-in .lp-chip { opacity: 1; scale: 1; }
        @media (prefers-reduced-motion: reduce) { .lp-reveal-item, .lp-chip { opacity: 1; translate: none; scale: none; } }
      `}</style>

      {/* ── nav ── */}
      <header className="sticky top-0 z-30 px-5 pt-3 max-[560px]:px-3">
        <div className="mx-auto flex h-16 w-[min(1180px,100%)] items-center justify-between gap-4 rounded-2xl border border-line bg-surface/90 pl-5 pr-2.5 text-[14px] shadow-2 backdrop-blur">
          <a href="#top" className={`flex shrink-0 items-center gap-2.5 rounded-md no-underline ${FOCUS}`}>
            <span className="grid size-8 place-items-center rounded-lg bg-green text-on-accent [&_svg]:size-4">
              <LogoMark />
            </span>
            <span className="text-[16px] font-semibold text-ink-strong">Kumnous-គំនូស</span>
          </a>
          <nav className="flex items-center gap-8 text-[15px] font-medium text-ink max-[1040px]:hidden">
            {[
              { href: "#how-it-works", label: t.nav.how },
              { href: "#showcase", label: t.nav.examples },
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
            <Link to="/login" className={`inline-flex h-10 items-center rounded-xl border border-line-strong bg-surface px-4 font-medium text-ink-strong no-underline hover:bg-surface-2 ${FOCUS}`}>
              {t.nav.login}
            </Link>
            <Link to="/register" className={`inline-flex h-10 items-center rounded-xl bg-green px-4 font-semibold text-on-accent no-underline shadow-2 hover:bg-green-strong max-[480px]:hidden ${FOCUS}`}>
              {t.nav.startFree}
            </Link>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ── hero: the words left, the product right ── */}
        <section className={`${WRAP} grid items-center gap-14 pb-20 pt-20 max-[560px]:pt-12 lg:grid-cols-[1fr_1.1fr]`}>
          <div className="text-center lg:text-left">
            <HeroText
              line1={t.hero.line1}
              line2={t.hero.line2}
              sub={t.hero.sub}
              km={km}
              headingClass={`${DISPLAY} m-0 font-semibold tracking-[-0.02em] text-ink-strong ${km ? "text-[46px] leading-[1.4] max-[760px]:text-[32px]" : "text-[56px] leading-[1.12] max-[760px]:text-[38px]"}`}
              subClass="mx-auto mb-0 mt-6 max-w-[54ch] text-[17.5px] leading-[1.7] text-slate lg:mx-0"
            />
            <div className="lp-rise mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start" style={{ "--d": "1.3s" } as CSSProperties}>
              <Link
                to="/register"
                className={`inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3.5 text-[15px] font-semibold text-on-accent no-underline shadow-2 transition-[translate,background-color] hover:-translate-y-0.5 hover:bg-green-strong [&_svg]:size-4 ${FOCUS}`}
              >
                {t.nav.startFree} <ArrowRight />
              </Link>
              <a
                href="#showcase"
                className={`inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-6 py-3.5 text-[15px] font-semibold text-ink-strong no-underline hover:bg-surface-2 ${FOCUS}`}
              >
                {t.hero.seeExamples}
              </a>
            </div>
            <p className="lp-rise mb-0 mt-5 text-[14px] text-slate-soft" style={{ "--d": "1.45s" } as CSSProperties}>
              {t.hero.small}
            </p>
          </div>

          <div className="lp-rise relative px-2 py-6 sm:px-6" style={{ "--d": "0.45s" } as CSSProperties}>
            <Shot file="hero.png" frame label={k("The Kumnous editor", "កម្មវិធីកែ Kumnous")} />
            <FloatTag icon={<Sparkles />} text={k("Drawn by AI", "គូរដោយ AI")} sub={k("From one sentence", "ពីប្រយោគតែមួយ")} className="-left-2 top-16" />
            <FloatTag icon={<CheckCircle />} text={k("Layout checked", "បានពិនិត្យប្លង់")} sub={k("No overlaps", "គ្មានជាន់គ្នា")} className="-right-2 bottom-12" delay={1.2} />
          </div>
        </section>

        {/* ── the kinds of diagram, as a strip ── */}
        <section className="border-y border-line bg-surface">
          <Reveal className={`${WRAP} flex flex-wrap items-center justify-center gap-2.5 py-6`}>
            <span className="mr-2 text-[13px] text-slate">{k("Draws", "គូរបាន")}</span>
            {TYPES.map((type, i) => {
              const [bg, border, ink] = tintFor(type);
              return (
                <span
                  key={type}
                  className="lp-chip inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium hover:-translate-y-0.5"
                  style={{ background: bg, borderColor: border, color: ink, "--d": `${i * 0.05}s` } as CSSProperties}
                >
                  <TypeGlyph type={type} />
                  {TYPE_LABEL[type]}
                </span>
              );
            })}
          </Reveal>
        </section>

        {/* ── see it work: the live editor demo from the old page ── */}
        <section className={`${WRAP} scroll-mt-24 py-24 max-[860px]:py-16`}>
          <Title
            eyebrow={k("See it work", "មើលវាដំណើរការ")}
            title={k("From a sentence or a sketch to a finished diagram", "ពីប្រយោគ ឬគំនូរព្រាង ទៅជាដ្យាក្រាមពេញលេញ")}
            intro={k(
              "Watch a request get refined, a paper sketch get read, and the diagram build itself, shape by shape.",
              "មើលសំណើត្រូវបានកែលម្អ គំនូរព្រាងលើក្រដាសត្រូវបានអាន ហើយដ្យាក្រាមគូរខ្លួនឯង មួយរាងម្តងៗ។",
            )}
          />
          <Reveal className="mt-12" delay={0.1}>
            <HeroDemo copy={t.demo} />
          </Reveal>
        </section>

        {/* ── how it works: three steps ── */}
        <section id="how-it-works" className={`${WRAP} scroll-mt-24 py-24 max-[860px]:py-16`}>
          <Title eyebrow={t.nav.how} title={t.how.title} intro={t.how.intro} />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {t.how.inputs.map((input, i) => (
              <Reveal key={input.title} delay={i * 0.12}>
              <div className="h-full rounded-2xl border border-line bg-surface p-5 transition-[translate,box-shadow] hover:-translate-y-1 hover:shadow-3">
                <Shot file={`step-${i + 1}.png`} ratio="4 / 3" label={input.title} />
                <div className="mt-5 flex items-center gap-3">
                  <span className={`${DISPLAY} grid size-8 flex-none place-items-center rounded-full bg-green text-[14px] font-semibold text-on-accent`}>{i + 1}</span>
                  <h3 className="m-0 text-[17px] font-semibold text-ink-strong">{input.title}</h3>
                </div>
                <p className="mb-0 mt-2 text-[14.5px] leading-[1.65] text-slate">{input.body}</p>
              </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-12" delay={0.1}>
            <PipelineFlow copy={t.how} />
          </Reveal>
        </section>

        {/* ── showcase: one card per kind of diagram ── */}
        <section id="showcase" className="scroll-mt-24 border-y border-line bg-surface py-24 max-[860px]:py-16">
          <div className={WRAP}>
            <Title eyebrow={t.nav.examples} title={t.examples.title} intro={t.examples.intro} />
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((g, i) => {
                const [bg, border, ink] = tintFor(g.type);
                return (
                  <Reveal key={g.file} delay={(i % 3) * 0.1}>
                  <article className="group h-full overflow-hidden rounded-2xl border border-line bg-paper transition-[translate,box-shadow] hover:-translate-y-1 hover:shadow-3">
                    <div className="p-3 pb-0">
                      <Shot file={g.file} ratio="4 / 3" label={TYPE_LABEL[g.type]} />
                    </div>
                    <div className="flex items-center justify-between gap-3 p-4">
                      <p className="m-0 text-[15px] font-semibold leading-[1.5] text-ink-strong">{g.text}</p>
                      <span className="inline-flex flex-none items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-medium" style={{ background: bg, borderColor: border, color: ink }}>
                        <TypeGlyph type={g.type} />
                        {TYPE_LABEL[g.type]}
                      </span>
                    </div>
                  </article>
                  </Reveal>
                );
              })}
            </div>
            <Reveal className="mt-16" delay={0.1}>
              <h3 className={`${DISPLAY} m-0 text-center text-[24px] font-semibold text-ink-strong`}>
                {k("Or open any template, live", "ឬបើកគំរូណាមួយ ផ្ទាល់")}
              </h3>
              <div className="mt-6">
                <TemplateBrowser copy={t.examples} fallback={<Examples copy={t.examples} />} />
              </div>
            </Reveal>
            <div className="mt-10 text-center">
              <Link to="/register" className={`inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3.5 text-[15px] font-semibold text-on-accent no-underline hover:bg-green-strong [&_svg]:size-4 ${FOCUS}`}>
                {k("Make your own", "បង្កើតរបស់អ្នកផ្ទាល់")} <ArrowRight />
              </Link>
            </div>
          </div>
        </section>

        {/* ── features: words and a picture, sides alternating ── */}
        <section className={`${WRAP} flex flex-col gap-24 py-24 max-[860px]:gap-16 max-[860px]:py-16`}>
          <Title eyebrow={k("Features", "មុខងារ")} title={t.editor.title} intro={t.editor.intro} />
          <Feature
            eyebrow="01"
            title={t.editor.ask.title}
            body={t.editor.ask.body}
            points={t.impact.editor.slice(0, 3).map((p) => p.title)}
            file="feature-1.png"
          />
          <Feature
            eyebrow="02"
            title={t.editor.missing.title}
            body={t.editor.missing.body}
            points={t.how.outputs.map((o) => o.title)}
            file="feature-2.png"
            flip
          />
          <Feature
            eyebrow="03"
            title={t.editor.share.title}
            body={t.editor.share.body}
            points={[...t.editor.share.rows]}
            file="feature-3.png"
          />
          <ul className="m-0 flex list-none flex-wrap justify-center gap-6 p-0 text-[14px] text-slate [&_svg]:size-4 [&_svg]:text-green">
            {[<FileImage key="i" />, <Printer key="p" />, <LinkIcon key="l" />].map((icon, i) => (
              <li key={i} className="flex items-center gap-2">
                {icon}
                {t.editor.share.rows[i]}
              </li>
            ))}
          </ul>
        </section>

        {/* ── pricing ── */}
        <section id="pricing" className="scroll-mt-24 border-y border-line bg-surface py-24 max-[860px]:py-16">
          <div className={WRAP}>
            <Title eyebrow={t.nav.pricing} title={t.pricing.title} intro={t.pricing.intro} center={false} />
            <Reveal className="mt-12" delay={0.1}>
              <Pricing copy={t.pricing} signUp={t.nav.signUp} />
            </Reveal>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className={`${WRAP} scroll-mt-24 py-24 max-[860px]:py-16`}>
          <Title eyebrow={t.nav.faq} title={t.faq.title} />
          <Reveal className="mx-auto mt-10 max-w-[820px] border-t border-line" delay={0.1}>
            {t.faq.items.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </Reveal>
        </section>

        {/* ── closing call ── */}
        <section className={`${WRAP} pb-24`}>
          <Reveal className="rounded-3xl bg-green px-8 py-16 text-center text-on-accent max-[560px]:px-5 max-[560px]:py-12">
            <h2 className={`${DISPLAY} m-0 mx-auto max-w-[24ch] text-[38px] font-semibold leading-[1.3] max-[560px]:text-[28px]`}>{t.closing.title}</h2>
            <p className="mx-auto mb-0 mt-4 max-w-[56ch] text-[16px] leading-[1.7] opacity-90">{t.closing.body}</p>
            <Link
              to="/register"
              className={`mt-8 inline-flex items-center gap-2 rounded-xl bg-surface px-6 py-3.5 text-[15px] font-semibold text-ink-strong no-underline transition-[translate] hover:-translate-y-0.5 [&_svg]:size-4 ${FOCUS}`}
            >
              {t.nav.signUp} <ArrowRight />
            </Link>
          </Reveal>
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

