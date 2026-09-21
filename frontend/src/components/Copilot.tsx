import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

import { usePanelCollapse, usePanelResize } from "../hooks/usePanelResize";
import { matchSlashCommands } from "../lib/slashCommands";
import { useDiagram } from "../store/useDiagram";
import { AiTodoList } from "./AiTodoList";
import {
  Alert,
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  LogoMark,
  Send,
  Sparkles,
  UserIcon,
  X,
} from "./icons";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { timeAgo } from "./templateVisuals";

const MAX_IMAGE_BYTES = 6_000_000; // ~6MB — matches the backend's data-url cap with room to spare

/** Ideas to prime an empty canvas — real prompts a user could actually send.
 *  Kept short: one business-process example, one technical one, enough to
 *  show the range without turning into a wall of chips. Clicking one sends
 *  it straight through improve → generate, so a first-time visitor lands a
 *  diagram in two clicks instead of learning the whole flow first. */
const STARTER_IDEAS = [
  "Employee onboarding process",
  "Microservice deployment pipeline",
  "Online order to dispatch flow with colors by stage",
  "Purchase order approval with rejection loop",
];

/** Once a diagram exists, these describe edits instead — one per thing the
 *  agent can do, so the range is discoverable without reading docs: a
 *  structural change, a layout action, a question, a canvas action. */
const EDIT_SUGGESTIONS = [
  "Add a rejection path",
  "Make it top-down",
  "Explain this diagram",
  "Fit it to a slide",
  "Give me ideas to improve this",
];

/** How many of the most recent chat messages ride along with a new one, so
 *  a short reply ("all", "yes") can resolve against the agent's own
 *  previous question — see sendEdit. */
const HISTORY_TURNS = 8;

/** "process_flow" -> "Process Flow" */
function formatType(value: string): string {
  return value
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/* --------------------------------------------------------------- copilot */

export function Copilot() {
  const [input, setInput] = useState("");
  const [showImproved, setShowImproved] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<{ dataUrl: string; name: string } | null>(
    null,
  );
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [slashHighlight, setSlashHighlight] = useState(0);
  const [sessionInfo, setSessionInfo] = useState(false);
  const tailRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const resize = usePanelResize();
  const { collapsed, toggle: toggleCollapsed } = usePanelCollapse();

  const messages = useDiagram((s) => s.messages);
  const appendMessage = useDiagram((s) => s.appendMessage);
  const clearMessages = useDiagram((s) => s.clearMessages);
  const undo = useDiagram((s) => s.undo);
  const redo = useDiagram((s) => s.redo);
  const busy = useDiagram((s) => s.busy);
  const editPhase = useDiagram((s) => s.editPhase);
  const editSteps = useDiagram((s) => s.editSteps);
  // Set (and cleared) by Canvas.tsx's rehearsal — see the store's own doc
  // comment. Gates the "done" summary below so it doesn't show up before
  // the diagram has visibly finished sketching itself in, and drives the
  // live "drawing X" line while it's still going.
  const rehearsing = useDiagram((s) => s.rehearsing);
  const generationProgress = useDiagram((s) => s.generationProgress);
  const generationPlan = useDiagram((s) => s.generationPlan);
  const improved = useDiagram((s) => s.improved);
  const hasNodes = useDiagram((s) => s.doc.nodes.length > 0);
  const improvePrompt = useDiagram((s) => s.improvePrompt);
  const analyzeImage = useDiagram((s) => s.analyzeImage);
  const generate = useDiagram((s) => s.generate);
  const sendChatMessage = useDiagram((s) => s.sendChatMessage);
  const dismissImproved = useDiagram((s) => s.dismissImproved);

  // The composer grows with its content (up to a cap) so multi-line ideas
  // get room to breathe instead of being squeezed into a one-row strip.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
  }, [input]);

  // "/" as the composer's very first character, with nothing typed after a
  // space yet, is read as a command in progress — matchSlashCommands([])
  // (an empty query) lists every command, narrowing as more is typed.
  const slashQuery = input.startsWith("/") && !input.includes(" ") ? input.slice(1) : null;
  const slashMatches = slashQuery !== null ? matchSlashCommands(slashQuery) : [];

  useEffect(() => setSlashHighlight(0), [slashQuery]);

  const runSlashCommand = (cmd: string) => {
    setInput("");
    setSlashHighlight(0);
    if (cmd === "/new") void clearMessages();
    else if (cmd === "/session") setSessionInfo(true);
    else if (cmd === "/undo") undo();
    else if (cmd === "/redo") redo();
    else if (cmd === "/explain") sendEdit("Explain this diagram");
  };

  // Acknowledge a finished send once `busy` settles back to idle *and* any
  // rehearsal has actually finished playing — a generate/layout clears
  // `busy` well before the sketch even starts (see the store's `rehearsing`
  // doc comment), so gating on `busy` alone would show this summary while
  // the canvas is still blank or mid-drawing. The agent can come back with
  // any combination of three things: something to say, a list of what it
  // changed, and a list of what it couldn't — a question is just the first
  // on its own, a clean edit the second.
  useEffect(() => {
    if (!pendingText || busy !== null || rehearsing) return;
    const { chatAnswer, changeLog, chatWarnings } = useDiagram.getState();

    // The agent can come back with three things: what it did (changeLog), a
    // few things it couldn't (chatWarnings), and a one-sentence summary of
    // it all (chatAnswer). "ask" answers are just the last on their own; a
    // clean edit is the first two. They render as a checked list, not plain
    // markdown bullets — the same changelog the live feed showed, so the
    // done-message reads as one coherent record of the run.
    const changes = changeLog.slice(0, 8);
    const warnings = chatWarnings.slice(0, 6);
    appendMessage({
      role: "ai",
      text: chatAnswer || (changes.length > 0 ? "Done — here's what changed:" : pendingText),
      ...(changes.length > 0 ? { changes } : null),
      ...(warnings.length > 0 ? { warnings } : null),
    });
    // Each message's changelog is captured above (into `changes`) exactly
    // once — clearing it here (not just chatAnswer/chatWarnings) stops it
    // from being re-attached to the *next* message too, which is what made
    // a plain follow-up question inherit an old changelog and get rendered
    // as a finished-edit card (plain text, no Markdown) instead of a normal
    // prose answer.
    useDiagram.setState({ chatAnswer: null, chatWarnings: [], changeLog: [] });
    setPendingText(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, pendingText, rehearsing]);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    // generationProgress/generationPlan: keeps the live drawing todo list in
    // view as it updates shape by shape, not just when a real message is
    // appended.
  }, [messages, improved, generationProgress, generationPlan]);

  useEffect(() => {
    const onFocus = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail ?? "";
      setInput(detail);
      document.querySelector<HTMLTextAreaElement>("[data-composer-field] textarea")?.focus();
    };
    window.addEventListener("copilot:focus", onFocus);
    return () => window.removeEventListener("copilot:focus", onFocus);
  }, []);

  /** No diagram yet: this describes what to build, and kicks off Improve. */
  const sendDescribe = (text: string) => {
    if (!text.trim() || busy !== null) return;
    appendMessage({ role: "user", text });
    dismissImproved();
    setShowImproved(false);
    void improvePrompt(text);
    setInput("");
  };

  /** No diagram yet, but a sketch instead of (or alongside) typed text —
   *  same Describe step, just read from a picture. The image rides along on
   *  the user's own message so their bubble shows what they sent, and it's
   *  persisted with the thread (see appendMessage) so a restored chat renders
   *  it the same way it did live. */
  const sendImage = (image: { dataUrl: string; name: string }, caption: string) => {
    if (busy !== null) return;
    appendMessage({
      role: "user",
      text: caption.trim() || `Attached ${image.name}`,
      image: image.dataUrl,
    });
    dismissImproved();
    setShowImproved(false);
    void analyzeImage(image.dataUrl, caption);
    setAttachedImage(null);
    setInput("");
  };

  /** A diagram already exists: could be an instruction to change it, a
   *  question about it, or a request for ideas — sendChatMessage sorts out
   *  which before anything touches the diagram. */
  const sendEdit = (text: string) => {
    if (!text.trim() || busy !== null || !hasNodes) return;
    // The last few turns, from *before* this new message — enough for a
    // short reply ("all", "yes") to resolve against the agent's own
    // previous question without dragging the whole conversation along.
    const history = messages.slice(-HISTORY_TURNS).map(({ role, text: t }) => ({ role, text: t }));
    appendMessage({ role: "user", text });
    setPendingText("The edit is applied to the diagram.");
    void sendChatMessage(text, history);
    setInput("");
  };

  const send = () => {
    if (slashMatches.length > 0) return runSlashCommand(slashMatches[slashHighlight].cmd);
    if (hasNodes) return sendEdit(input);
    if (attachedImage) return sendImage(attachedImage, input);
    return sendDescribe(input);
  };

  const onFilePicked = (file: File | undefined) => {
    if (!file) return;
    setAttachError(null);
    if (!file.type.startsWith("image/")) {
      setAttachError("That's not an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setAttachError("That image is too large — try one under 6MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachedImage({ dataUrl: String(reader.result), name: file.name });
    reader.onerror = () => setAttachError("Couldn't read that file.");
    reader.readAsDataURL(file);
  };

  const working: "improving" | "generating" | "analyzing" | null =
    busy === "improving" || busy === "generating" || busy === "analyzing" ? busy : null;

  const suggestions = hasNodes ? EDIT_SUGGESTIONS : STARTER_IDEAS;

  if (collapsed) {
    return (
      <aside
        className="relative flex min-h-0 flex-col items-center border-l border-line bg-surface pt-3 max-[1240px]:hidden"
        data-copilot
        aria-label="Kumnous AI (collapsed)"
      >
        <button
          className="grid size-8 shrink-0 place-items-center rounded-[9px] border-none bg-transparent text-slate transition-colors hover:bg-paper hover:text-ink [&_svg]:size-[15px]"
          onClick={toggleCollapsed}
          title="Expand Kumnous AI"
          aria-label="Expand Kumnous AI"
        >
          <ChevronLeft />
        </button>
        <span className="mt-3 grid size-[26px] shrink-0 place-items-center rounded-[9px] bg-green-soft text-green-strong [&_svg]:size-[15px]">
          <LogoMark />
        </span>
      </aside>
    );
  }

  return (
    <aside
      className="relative flex min-h-0 flex-col border-l border-line bg-surface max-[1240px]:hidden"
      data-copilot
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drag-to-resize, not a click target */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Kumnous AI panel"
        className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none select-none hover:bg-green-ring active:bg-green-ring"
        onPointerDown={resize.onPointerDown}
      />
      <header className="shrink-0 border-b border-line px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="m-0 flex items-center gap-2.5 text-[15px] font-bold tracking-[-0.01em]">
            <span className="grid size-[26px] shrink-0 place-items-center rounded-[9px] bg-green-soft text-green-strong [&_svg]:size-[15px]">
              <LogoMark />
            </span>
            Kumnous AI
          </h1>
          <button
            className="grid size-7 shrink-0 place-items-center rounded-[9px] border-none bg-transparent text-slate transition-colors hover:bg-paper hover:text-ink [&_svg]:size-[13px]"
            onClick={toggleCollapsed}
            title="Collapse Kumnous AI"
            aria-label="Collapse Kumnous AI"
          >
            <ChevronRight />
          </button>
        </div>
        <p className="mt-[6px] text-[11.5px] leading-[1.4] text-slate-soft">
          Describe, generate, and improve your diagram.
        </p>
      </header>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-3.5 py-3.5">
        {messages.length === 0 && !improved && (
          <div className="px-1 pt-1">
            <h2 className="m-0 text-[13.5px] font-bold tracking-[-0.01em] text-ink">
              Build your first diagram
            </h2>
            <p
              style={{
                fontSize: 12.5,
                lineHeight: 1.6,
                color: "var(--slate)",
                padding: "6px 2px 0",
              }}
            >
              Describe a process, system, or workflow, or click an example below — it&apos;ll
              sharpen the prompt, then generate an editable diagram you can keep tweaking.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex max-w-full gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
            <span className={`grid size-7 shrink-0 place-items-center rounded-full border border-green-line [&_svg]:size-[15px] ${message.role === "user" ? "bg-[#dcebe5] text-green-deep" : "bg-green-soft text-green-strong"}`}>
              {message.role === "ai" ? <LogoMark /> : <UserIcon />}
            </span>
            {/* The user's own message keeps its bubble so you can pick your
                turns out at a glance; the AI's reply is bare text — a border
                around every answer just boxes in the thing you're reading.
                Only the AI's side goes through Markdown — the user's own
                text is literal, not something to interpret as formatting
                syntax they may not have intended (a stray "*" or "-"
                shouldn't turn into emphasis or a list).
                `chat-stream` (a plain prose reply only — the changelog card
                already streams in its own way, one line at a time via
                `.chat-in`, so sweeping the whole card too would animate it
                twice over) sweeps the text in left-to-right, the same
                "still arriving" feel a live token stream has, even though
                this whole answer actually landed in one response. */}
            {message.role === "user" ? (
              <div className="flex min-w-0 max-w-[78%] flex-col items-end gap-1.5">
                {/* The image stands on its own above the bubble, separate
                    from the text frame — what you sent reads as its own
                    thing rather than a picture plugged into the chat line.
                    Width-capped so a full-page sketch can't blow the thread
                    out; `object-contain` keeps it whole. */}
                {message.image && (
                  <img
                    src={message.image}
                    alt="Attached sketch"
                    className="block max-h-[220px] w-auto max-w-full rounded-[11px] border border-line bg-surface object-contain"
                  />
                )}
                <div className="max-w-full whitespace-pre-wrap rounded-[11px] rounded-br-[4px] bg-green px-[11px] py-[9px] text-[11.5px] leading-[1.5] text-on-accent">
                  {message.text}
                </div>
              </div>
            ) : (
              <div
                className={`chat-markdown min-w-0 max-w-[78%] py-[5px] text-[11.5px] leading-[1.5] text-ink${message.changes?.length ? "" : " chat-stream"}`}
              >
                {message.changes?.length ? (
                // A finished edit: the summary sentence up top, then the real
                // changelog as a card — the same treatment `improved`'s own
                // "Structured analysis" card already uses below, so a change
                // summary reads as a designed piece of the app rather than
                // list items floating loose in a paragraph, and the two
                // "here's a structured thing the AI produced" moments in this
                // panel don't look like they belong to two different apps.
                // The checklist itself is the same lines the live feed
                // walked through — done reads as that run's own record, not
                // a second, differently-worded retelling. Warnings get their
                // own amber-tinted section so a partial success can't be
                // mistaken for a complete one.
                <div>
                  {message.text && (
                    // The agent's one-sentence summary often carries the same
                    // **bold**-a-label habit its full answers do (nothing
                    // stops it, even though only "ask" answers are told to
                    // format that way) — rendered as Markdown here too, same
                    // as the plain-answer branch below, instead of showing
                    // the raw asterisks literally.
                    <div>
                      <Markdown>{message.text}</Markdown>
                    </div>
                  )}
                  <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
                    <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-[11px] py-[9px] text-[11px] font-[650] text-ink">
                      <span className="grid size-4 shrink-0 place-items-center text-green-strong [&_svg]:size-3.5">
                        <CheckCircle />
                      </span>
                      {message.changes.length} change{message.changes.length === 1 ? "" : "s"}
                    </div>
                    {/* This list sits inside the same `chat-markdown`
                        ancestor the plain-answer branch uses for real
                        Markdown output, so `.chat-markdown ul`'s own rule
                        (`padding-left: 18px`, meant for react-markdown's
                        bullet lists) was winning over this list's own
                        `px-[11px]` — a `ul` + class selector always beats a
                        same-layer class-only one regardless of which comes
                        later, so only `!` (important) actually overrides it.
                        `list-none` removes the browser's own default marker
                        too (this list draws its own dot span instead). */}
                    <ul className="list-none space-y-1 py-[9px] pl-[11px]! pr-[11px]!">
                      {message.changes.map((change, index) => (
                        <li
                          key={index}
                          className="chat-in flex items-start gap-1.5 text-[11.5px] leading-[1.45]"
                          style={{ animationDelay: `${index * 130}ms` }}
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-soft" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                    {message.warnings?.length ? (
                      <div className="border-t border-[#f0e0b8] bg-amber-soft px-[11px] py-[9px]">
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-[650] text-amber">
                          <span className="grid size-3.5 shrink-0 place-items-center [&_svg]:size-3">
                            <Alert />
                          </span>
                          Couldn&apos;t do all of it
                        </div>
                        <ul className="space-y-1">
                          {message.warnings.map((warning, index) => (
                            <li
                              key={index}
                              className="chat-in flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-amber"
                              style={{
                                animationDelay: `${(message.changes?.length ?? 0) * 130 + index * 130}ms`,
                              }}
                            >
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber" />
                              <span>{warning}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <Markdown>{message.text}</Markdown>
              )}
              </div>
            )}
          </div>
        ))}

        {/* Once the diagram itself has landed and the canvas starts
            sketching it in, this hands off to the "drawing X" bubble below —
            not shown together, so there's one live status at a time. */}
        {(busy === "improving" ||
          busy === "analyzing" ||
          (busy === "generating" && !generationProgress)) && (
          <div className="flex max-w-full gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-green-line bg-green-soft text-green-strong [&_svg]:size-[15px]">
              <LogoMark />
            </span>
            <div className="chat-live min-w-0 max-w-full text-[11.5px] leading-[1.5] text-ink">
              {busy === "analyzing" && (
                <div className="mb-1.5 text-[11px] font-[550] text-slate">
                  Looking at your image…
                </div>
              )}
              {busy === "generating" && (
                <div className="mb-1.5 text-[11px] font-[550] text-slate">
                  Working out the steps…
                </div>
              )}
              <span className="typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        )}

        {/* The full node list, known the instant generation/layout returns —
            checked off in step with the canvas's own sketch animation
            (Canvas.tsx / RehearsalOverlay) rather than a single "drawing X"
            line, so this is a real todo list, not a fake one revealed early. */}
        {generationPlan && (
          <div className="flex max-w-full gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-green-line bg-green-soft text-green-strong [&_svg]:size-[15px]">
              <LogoMark />
            </span>
            <div className="chat-live min-w-0 max-w-full text-[11.5px] leading-[1.5] text-ink">
              <div className="mb-1.5 text-[11px] font-[550] text-slate">Drawing your diagram…</div>
              <AiTodoList
                steps={generationPlan.map((label, index) => ({
                  id: String(index),
                  label,
                  done: index < (generationProgress?.index ?? 0),
                }))}
              />
            </div>
          </div>
        )}

        {improved && (
          <div className="flex max-w-full gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-green-line bg-green-soft text-green-strong [&_svg]:size-[15px]">
              <LogoMark />
            </span>
            <div className="min-w-0 max-w-full whitespace-pre-wrap py-[5px] text-[11.5px] leading-[1.5] text-ink">
              {improved.reasoning ?? "Here's how I'd structure that."}

              <div className="mt-2 overflow-hidden rounded-[10px] border border-line bg-surface">
                <div className="flex items-center justify-between border-b border-line bg-surface-2 px-[11px] py-[9px] text-[11px] font-[650] text-ink">
                  <span>Structured analysis</span>
                  <span className="rounded-[20px] bg-green-soft px-2 py-0.5 text-[9.5px] font-[650] uppercase tracking-[0.05em] text-green-strong">AI</span>
                </div>
                <div className="border-b border-line px-[11px] py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-[550] text-slate-soft">Diagram Type</span>
                    <span className="text-right text-xs font-semibold text-ink">{improved.recommended_type ? formatType(improved.recommended_type) : "—"}</span>
                  </div>
                </div>
                <div className="px-[11px] py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-[550] text-slate-soft">Recommended Template</span>
                    <span className="text-right text-xs font-semibold text-ink">
                      {improved.recommended_template_slug ?? "None — built from scratch"}
                    </span>
                  </div>
                </div>
                {improved.missing_information.length > 0 && (
                  <div className="mx-2.5 mb-2.5 mt-0 flex items-start gap-2 rounded-lg border border-[#f0e0b8] bg-amber-soft p-2 px-2.5 text-[11px] leading-[1.45] text-amber [&_svg]:mt-px [&_svg]:size-[13px] [&_svg]:shrink-0">
                    <Alert />
                    <span>
                      <b>Worth clarifying</b> — {improved.missing_information.join("; ")}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 8 }}>
                <button
                  className="inline-flex items-center justify-center gap-[5px] whitespace-nowrap rounded-[7px] border border-green-line bg-surface px-2.5 py-1 text-xs font-[550] text-green-deep transition-colors hover:border-green hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => setShowImproved((v) => !v)}
                >
                  <Sparkles />
                  {showImproved ? "Hide improved prompt" : "View improved prompt"}
                </button>
              </div>

              {showImproved && (
                <div className="mt-2 overflow-hidden rounded-[10px] border border-line">
                  <div className="flex items-center justify-between gap-2 border-b border-line bg-paper px-2.5 py-2 text-[11px] text-slate">
                    <span>
                      <b>Improved prompt</b> · use it to generate
                    </span>
                  </div>
                  <div className="px-[11px] py-[9px] text-xs leading-[1.55] text-ink">{improved.improved}</div>
                </div>
              )}

              <div className="mt-[9px] flex gap-[7px]">
                <button
                  className="inline-flex flex-1 items-center justify-center gap-[7px] whitespace-nowrap rounded-md border border-green-line bg-surface px-3 py-1.5 text-[12.5px] font-[550] text-green-deep transition-colors hover:border-green hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={working !== null}
                  onClick={dismissImproved}
                >
                  Keep original
                </button>
                <button
                  className="inline-flex flex-1 items-center justify-center gap-[7px] whitespace-nowrap rounded-md border border-green bg-green px-3 py-1.5 text-[12.5px] font-[550] text-on-accent transition-colors hover:border-green-strong hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={working !== null}
                  onClick={() => {
                    setPendingText("The diagram has been generated on the canvas.");
                    void generate(improved.improved);
                  }}
                >
                  {working === "generating" ? (
                    <span className="btn__spin" aria-hidden />
                  ) : (
                    <ArrowRight />
                  )}
                  {working === "generating" ? "Generating…" : "Generate Diagram"}
                </button>
              </div>
            </div>
          </div>
        )}

        {busy === "editing" && (
          <div className="flex max-w-full gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-green-line bg-green-soft text-green-strong [&_svg]:size-[15px]">
              <LogoMark />
            </span>
            <div className="chat-live min-w-0 max-w-full text-[11.5px] leading-[1.5] text-ink">
              {/* A live todo list, not a fake timer — every step shown here
                  was genuinely announced by the backend the moment it became
                  knowable (spinner) and flipped to done with the real text
                  the moment it actually finished. */}
              <div className="mb-1.5 text-[11px] font-[550] text-slate">
                {editPhase === "checking"
                  ? "Understanding your request…"
                  : "Making changes to the diagram…"}
              </div>
              {editSteps.length > 0 && (
                <div className="mb-1.5">
                  <AiTodoList steps={editSteps} />
                </div>
              )}
              <span className="typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        )}

        <div ref={tailRef} />
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-3 pb-3 pt-3">
        {sessionInfo && (
          <div className="mb-2 flex items-start justify-between gap-2 rounded-[10px] border border-line bg-paper px-3 py-2 text-[11.5px] leading-[1.5] text-slate">
            <span>
              <b className="text-ink">This session</b> · {messages.length} message
              {messages.length === 1 ? "" : "s"}
              {messages[0] && <> · started {timeAgo(messages[0].created_at)}</>}
              {messages.length > 0 && (
                <> · last activity {timeAgo(messages[messages.length - 1].created_at)}</>
              )}
            </span>
            <button
              type="button"
              aria-label="Dismiss"
              className="grid size-5 shrink-0 place-items-center rounded text-slate-soft transition-colors hover:text-ink [&_svg]:size-3"
              onClick={() => setSessionInfo(false)}
            >
              <X />
            </button>
          </div>
        )}
        <div
          className={`relative rounded-[16px] bg-paper p-2.5 transition-[box-shadow,background-color] hover:ring-1 hover:ring-line-strong focus-within:bg-surface ${dragOver ? "ring-2 ring-green-ring" : ""}`}
          data-composer-field
          onDragOver={(event) => {
            if (hasNodes || !event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setDragOver(false);
          }}
          onDrop={(event) => {
            if (hasNodes) return;
            event.preventDefault();
            setDragOver(false);
            onFilePicked(event.dataTransfer.files?.[0]);
          }}
        >
          {slashMatches.length > 0 && (
            <SlashCommandMenu
              matches={slashMatches}
              highlightedIndex={slashHighlight}
              onHover={setSlashHighlight}
              onPick={runSlashCommand}
            />
          )}
          {dragOver && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[16px] border-2 border-dashed border-green bg-[rgba(13,159,110,0.08)] text-[12.5px] font-[600] text-green-deep">
              Drop image to attach
            </div>
          )}
          <div className="no-scrollbar mb-1.5 flex gap-1 overflow-x-auto pb-1">
            {!hasNodes && <span className="shrink-0 text-[11px] font-[550] text-slate-soft">Try an example —</span>}
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                title="Click to describe this diagram"
                className={`inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full border bg-surface px-2.5 py-[5px] text-[11px] font-[550] transition-all hover:border-green hover:bg-green-soft hover:text-green-deep [&_svg]:size-[11px] ${input === suggestion ? "border-green bg-green-soft text-green-deep" : "border-line text-slate"}`}
                onClick={() => (hasNodes ? setInput(suggestion) : sendDescribe(suggestion))}
              >
                {suggestion}
              </button>
            ))}
          </div>

          {!hasNodes && attachedImage && (
            <div className="relative mb-1.5 inline-block">
              {/* A standalone square card, not a row — `object-contain` so a
                  wide sketch or tall screenshot stays whole rather than
                  cropped, the filename as a hover title instead of a visible
                  label, and the remove button as a small corner badge over
                  the thumbnail itself. */}
              <img
                src={attachedImage.dataUrl}
                alt={attachedImage.name}
                title={attachedImage.name}
                className="size-28 rounded-xl border border-line bg-paper object-contain"
              />
              <button
                className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-line bg-surface text-slate-soft shadow-1 transition-colors hover:bg-paper hover:text-ink [&_svg]:size-3"
                aria-label="Remove attached image"
                onClick={() => setAttachedImage(null)}
              >
                <X />
              </button>
            </div>
          )}

          {!hasNodes && attachError && (
            <div className="mb-1.5 text-[11px] font-[550] text-red">{attachError}</div>
          )}

          <textarea
            ref={taRef}
            rows={3}
            className="block min-h-[70px] w-full resize-none border-none bg-transparent py-0.5 text-[13.5px] leading-[1.55] placeholder:text-slate-soft"
            // A global `:focus-visible { outline: ... }` rule lives outside
            // any Tailwind layer, so it beats every layered utility class
            // regardless of specificity — only an inline style outranks it.
            // The composer box around this textarea already shows focus via
            // its own background/ring change, so the browser's own outline
            // here is just redundant, not a missing affordance.
            style={{ outline: "none" }}
            value={input}
            placeholder={
              hasNodes
                ? "Change something, ask a question, or get ideas…"
                : attachedImage
                  ? "Add a caption (optional)…"
                  : "Describe what you want to diagram…"
            }
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (slashMatches.length > 0) {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSlashHighlight((i) => (i + 1) % slashMatches.length);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSlashHighlight((i) => (i - 1 + slashMatches.length) % slashMatches.length);
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setInput("");
                  return;
                }
              }
              if (event.key !== "Enter" || event.shiftKey) return; // Shift+Enter -> newline
              event.preventDefault();
              send();
            }}
            onPaste={(event) => {
              // Same gate as the drag-drop handler above — attaching a
              // picture is only ever part of describing a diagram from
              // scratch, not something a message about an existing one uses.
              if (hasNodes) return;
              const item = Array.from(event.clipboardData.items).find((i) =>
                i.type.startsWith("image/"),
              );
              if (!item) return; // plain text paste — let the browser handle it
              const file = item.getAsFile();
              if (!file) return;
              event.preventDefault(); // don't also drop a stray filename/blob URL into the text
              onFilePicked(file);
            }}
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            {/* The old row also carried a "what this does / Enter to send"
                hint here — cut as clutter that repeats what's already
                obvious from using the box once. Actions stay right-aligned
                the way they were alongside it. */}
            {!hasNodes && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    onFilePicked(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <button
                  className="grid size-[38px] shrink-0 place-items-center rounded-[12px] border-none bg-green text-on-accent transition-all hover:scale-[1.03] hover:bg-green-strong active:scale-95 disabled:cursor-not-allowed disabled:bg-line-strong disabled:hover:scale-100 [&_svg]:size-[17px] [&_svg]:stroke-[1.6]"
                  aria-label="Attach an image of a diagram sketch"
                  title="Attach an image — the AI reads it instead of typed text"
                  disabled={busy !== null}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImageIcon />
                </button>
              </>
            )}
            <button
              className="grid size-[38px] shrink-0 place-items-center rounded-[12px] border-none bg-green text-on-accent transition-all hover:scale-[1.03] hover:bg-green-strong active:scale-95 disabled:cursor-not-allowed disabled:bg-line-strong disabled:hover:scale-100 [&_svg]:size-[17px] [&_svg]:stroke-[1.6]"
              aria-label="Send"
              disabled={(!input.trim() && !attachedImage) || busy !== null}
              onClick={send}
            >
              {busy !== null ? <span className="btn__spin" aria-hidden /> : <Send />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
