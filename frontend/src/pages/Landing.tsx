import { Link } from "react-router-dom";

import { LogoMark } from "../components/icons";
import { ThemeToggle } from "../components/ThemeToggle";

const FEATURES = [
  {
    title: "Describe it, get a diagram",
    body: "Type what you want in plain English or Khmer. Kumnous AI lays out the nodes, edges and labels for you.",
  },
  {
    title: "Edit with conversation",
    body: "Ask the copilot to add a service, rename a step or re-route a flow. Changes land on the canvas instantly.",
  },
  {
    title: "Templates & cloud icons",
    body: "Start from flowcharts, sequence and architecture templates, with AWS and Azure icon libraries built in.",
  },
  {
    title: "Share & export",
    body: "Send a share link to teammates, or export your diagram when it's ready for docs and slides.",
  },
];

const STEPS = [
  { n: "1", title: "Describe", body: "Tell the copilot what you're trying to diagram." },
  { n: "2", title: "Refine", body: "Tweak shapes, styles and layout on the canvas, or keep chatting." },
  { n: "3", title: "Share", body: "Export or share a link in one click." },
];

/** Public marketing page shown at `/` to signed-out visitors. */
export default function Landing() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-[28px] place-items-center rounded-lg bg-[linear-gradient(135deg,var(--green),var(--green-deep))] text-on-accent [&_svg]:size-[16px]">
            <LogoMark />
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink-strong">
            Kumnous-គំនូស
          </span>
        </div>
        <nav className="flex items-center gap-3 text-[13px]">
          <ThemeToggle />
          <Link to="/login" className="font-medium text-slate no-underline hover:text-ink-strong">
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-green px-3.5 py-1.5 font-medium text-on-accent no-underline hover:bg-green-strong"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-[820px] px-5 pb-16 pt-16 text-center max-[560px]:pt-10">
          <span className="inline-block rounded-full border border-green-line bg-green-soft px-3 py-1 text-[12px] font-medium text-green">
            AI-powered diagram editor
          </span>
          <h1 className="m-0 mt-5 text-[48px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink-strong max-[560px]:text-[34px]">
            Turn ideas into diagrams, just by asking.
          </h1>
          <p className="mx-auto mb-0 mt-5 max-w-[600px] text-[17px] leading-relaxed text-slate">
            Kumnous AI is a copilot for flowcharts, architecture and process diagrams. Say what you
            need, then polish it on a canvas built for the details.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="rounded-xl bg-green px-6 py-3 text-[14px] font-medium text-on-accent no-underline shadow-2 hover:bg-green-strong"
            >
              Start diagramming free
            </Link>
            <Link
              to="/login"
              className="rounded-xl border border-line-strong bg-surface px-6 py-3 text-[14px] font-medium text-ink-strong no-underline hover:border-green-line"
            >
              Sign in
            </Link>
          </div>

          <div className="mx-auto mt-14 max-w-[640px] rounded-2xl border border-line bg-surface p-5 text-left shadow-2">
            <p className="m-0 rounded-lg bg-green-soft px-3.5 py-2.5 text-[13px] text-ink-strong">
              Draw a login flow with email, Google sign-in and password reset.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[12px] font-medium text-ink-strong">
              {["Start", "Choose method", "Verify", "Dashboard"].map((label, i, a) => (
                <span key={label} className="flex items-center gap-2">
                  <span className="rounded-lg border border-green-line bg-paper px-3 py-1.5">
                    {label}
                  </span>
                  {i < a.length - 1 && <span className="text-slate-soft">→</span>}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1080px] px-5 py-12">
          <h2 className="m-0 mb-8 text-center text-[28px] font-semibold tracking-[-0.02em] text-ink-strong">
            Everything you need to diagram faster
          </h2>
          <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-line bg-surface p-6">
                <h3 className="m-0 mb-2 text-[16px] font-semibold text-ink-strong">{f.title}</h3>
                <p className="m-0 text-[14px] leading-relaxed text-slate">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1080px] px-5 py-12">
          <h2 className="m-0 mb-8 text-center text-[28px] font-semibold tracking-[-0.02em] text-ink-strong">
            How it works
          </h2>
          <div className="grid grid-cols-3 gap-4 max-[700px]:grid-cols-1">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <span className="mx-auto grid size-9 place-items-center rounded-full bg-green-soft text-[14px] font-semibold text-green">
                  {s.n}
                </span>
                <h3 className="m-0 mb-1.5 mt-3 text-[16px] font-semibold text-ink-strong">
                  {s.title}
                </h3>
                <p className="m-0 text-[14px] text-slate">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1080px] px-5 pb-20 pt-6">
          <div className="rounded-2xl bg-[linear-gradient(135deg,var(--green),var(--green-deep))] px-6 py-12 text-center text-on-accent">
            <h2 className="m-0 text-[28px] font-semibold tracking-[-0.02em]">
              Your next diagram is one sentence away.
            </h2>
            <Link
              to="/register"
              className="mt-6 inline-block rounded-xl bg-surface px-6 py-3 text-[14px] font-medium text-ink-strong no-underline"
            >
              Create your free account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-[12px] text-slate">
        © {new Date().getFullYear()} Kumnous-គំនូស. All rights reserved.
      </footer>
    </div>
  );
}
