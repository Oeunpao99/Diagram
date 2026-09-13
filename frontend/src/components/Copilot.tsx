import { useEffect, useRef, useState } from "react";

import { useDiagram } from "../store/useDiagram";
import { Alert, ArrowRight, Check, Send, Sparkles } from "./icons";

interface Msg {
  id: number;
  role: "user" | "ai";
  text: string;
}

/** Ideas to prime an empty canvas — real prompts a user could actually send. */
const STARTER_IDEAS = [
  "Employee onboarding process",
  "Customer support ticket flow",
  "Import cargo clearance process",
  "Microservice deployment pipeline",
];

/** Once a diagram exists, these describe edits instead. */
const EDIT_SUGGESTIONS = [
  "Add a rejection path",
  "Make this a swimlane",
  "Improve the layout",
  "Simplify this diagram",
];

function uid(): number {
  return Date.now() + Math.floor(Math.random() * 1e5);
}

/** "process_flow" -> "Process Flow" */
function formatType(value: string): string {
  return value
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/* --------------------------------------------------------------- copilot */

export function Copilot() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [showImproved, setShowImproved] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const tailRef = useRef<HTMLDivElement>(null);

  const busy = useDiagram((s) => s.busy);
  const improved = useDiagram((s) => s.improved);
  const changeLog = useDiagram((s) => s.changeLog);
  const hasNodes = useDiagram((s) => s.doc.nodes.length > 0);
  const improvePrompt = useDiagram((s) => s.improvePrompt);
  const generate = useDiagram((s) => s.generate);
  const runEdit = useDiagram((s) => s.runEdit);
  const dismissImproved = useDiagram((s) => s.dismissImproved);

  const appendMessage = (msg: Omit<Msg, "id">) =>
    setMessages((current) => [...current, { id: uid(), ...msg }]);

  // Acknowledge finished edits once `busy` settles back to idle.
  useEffect(() => {
    if (!pendingText || busy !== null) return;
    const fresh = useDiagram.getState().changeLog;
    appendMessage({
      role: "ai",
      text:
        fresh.length > 0
          ? `Done. I made these changes:\n${fresh.slice(0, 3).map((c) => `  • ${c}`).join("\n")}`
          : pendingText,
    });
    setPendingText(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, pendingText]);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, improved]);

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

  /** A diagram already exists: this is an edit instruction. */
  const sendEdit = (text: string) => {
    if (!text.trim() || busy !== null || !hasNodes) return;
    appendMessage({ role: "user", text });
    setPendingText("The edit is applied to the diagram.");
    void runEdit(text);
    setInput("");
  };

  const send = () => (hasNodes ? sendEdit(input) : sendDescribe(input));

  const working: "improving" | "generating" | null =
    busy === "improving" ? "improving" : busy === "generating" ? "generating" : null;

  const stepState = (step: number): "done" | "active" | "idle" => {
    const described = messages.some((m) => m.role === "user") || Boolean(improved);
    const states: ("done" | "active" | "idle")[] = [
      described || hasNodes ? "done" : "active",
      improved || hasNodes ? "done" : busy === "improving" ? "active" : described ? "active" : "idle",
      hasNodes ? "done" : busy === "generating" ? "active" : improved ? "active" : "idle",
      hasNodes ? "active" : "idle",
    ];
    return states[step];
  };

  const STEP_NAMES = ["Describe", "Improve", "Generate", "Edit"];
  const suggestions = hasNodes ? EDIT_SUGGESTIONS : STARTER_IDEAS;

  return (
    <aside className="flex min-h-0 flex-col border-l border-line bg-surface max-[1240px]:hidden" data-copilot>
      <header className="shrink-0 border-b border-line px-3.5 pb-3 pt-3.5">
        <h1 className="m-0 flex items-center gap-2 text-[14.5px] font-[650] tracking-[-0.01em] [&_svg]:size-[17px] [&_svg]:text-green">
          <Sparkles />
          AI Copilot
        </h1>
        <p className="mt-[3px] text-[11.5px] leading-[1.4] text-slate-soft">
          Describe, generate, and improve your diagram.
        </p>
        <div className="mt-[11px] flex items-center rounded-[9px] bg-paper px-[9px] py-[7px]" aria-label="Describe to Improve to Generate to Edit">
          {STEP_NAMES.map((name, index) => {
            const state = stepState(index);
            return (
              <span key={name} className={`flex items-center gap-[5px] text-[10px] font-semibold transition-colors ${state === "active" ? "text-green-deep" : state === "done" ? "text-green" : "text-slate-soft"}`}>
                <span className="grid size-4 place-items-center rounded-full border-[1.5px] border-current bg-surface [&_svg]:size-[9px] [&_svg]:stroke-[2.6]">
                  {state === "done" ? <Check /> : index + 1}
                </span>
                {name}
                {index < STEP_NAMES.length - 1 && (
                  <span className={`mx-1.5 h-[1.5px] flex-1 rounded-[2px] ${state === "done" ? "bg-green" : state === "active" ? "bg-green-line" : "bg-line-strong"}`} />
                )}
              </span>
            );
          })}
        </div>
      </header>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-3.5 py-3.5">
        {messages.length === 0 && !improved && (
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--slate)", padding: "4px 2px" }}>
            Describe a process, system, or workflow below — try one of the ideas underneath the
            box, or write your own. I&apos;ll sharpen the prompt, then generate an editable
            diagram from it.
          </p>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex max-w-full gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
            <span className={`grid size-6 shrink-0 place-items-center rounded-full border border-green-line text-[10px] font-[650] [&_svg]:size-3 ${message.role === "user" ? "bg-[#dcebe5] text-green-deep" : "bg-green-soft text-green-strong"}`}>
              {message.role === "ai" ? <Sparkles /> : "You"}
            </span>
            <div className={`min-w-0 rounded-[11px] px-[11px] py-[9px] text-[12.5px] leading-[1.5] ${message.role === "user" ? "max-w-[78%] rounded-br-[4px] bg-green text-on-accent" : "max-w-full whitespace-pre-wrap rounded-bl-[4px] border border-line bg-paper"}`}>
              {message.text}
            </div>
          </div>
        ))}

        {busy === "improving" && (
          <div className="flex max-w-full gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-green-line bg-green-soft text-green-strong [&_svg]:size-3">
              <Sparkles />
            </span>
            <div className="min-w-0 max-w-full whitespace-pre-wrap rounded-bl-[4px] rounded-[11px] border border-line bg-paper px-[11px] py-[9px] text-[12.5px] leading-[1.5]">
              <span className="typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        )}

        {improved && (
          <div className="flex max-w-full gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-green-line bg-green-soft text-green-strong [&_svg]:size-3">
              <Sparkles />
            </span>
            <div className="min-w-0 max-w-full whitespace-pre-wrap rounded-bl-[4px] rounded-[11px] border border-line bg-paper px-[11px] py-[9px] text-[12.5px] leading-[1.5]">
              {improved.reasoning ?? "Here's how I'd structure that."}

              <div className="mt-2 overflow-hidden rounded-[10px] border border-line bg-surface">
                <div className="flex items-center justify-between border-b border-line bg-surface-2 px-[11px] py-[9px] text-[11px] font-[650] text-ink">
                  <span>Structured analysis</span>
                  <span className="rounded-[20px] bg-green-soft px-2 py-0.5 text-[9.5px] font-[650] uppercase tracking-[0.05em] text-green-strong">AI</span>
                </div>
                <div className="border-b border-line px-[11px] py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-[550] text-slate-soft">Diagram Type</span>
                    <span className="text-right text-xs font-semibold text-ink">{formatType(improved.recommended_type)}</span>
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
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-green-line bg-green-soft text-green-strong [&_svg]:size-3">
              <Sparkles />
            </span>
            <div className="min-w-0 max-w-full whitespace-pre-wrap rounded-bl-[4px] rounded-[11px] border border-line bg-paper px-[11px] py-[9px] text-[12.5px] leading-[1.5]">
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

      <div className="shrink-0 border-t border-line bg-surface px-3 pb-3 pt-2.5">
        <div className="no-scrollbar mb-2 flex gap-[5px] overflow-x-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border bg-surface-2 px-2.5 py-1 text-[11px] font-[550] transition-all hover:border-green hover:bg-green-soft hover:text-green-deep [&_svg]:size-[11px] ${input === suggestion ? "border-green bg-green-soft text-green-deep" : "border-line text-slate"}`}
              onClick={() => setInput(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div
          className="flex items-end gap-2 rounded-[11px] border border-line bg-surface py-[7px] pl-3 pr-[7px] transition-[border-color,box-shadow] focus-within:border-green focus-within:shadow-[0_0_0_3px_var(--green-ring)]"
          data-composer-field
        >
          <textarea
            rows={1}
            className="max-h-24 min-w-0 flex-1 resize-none border-none bg-transparent py-1 text-[12.5px] leading-[1.5] outline-none placeholder:text-slate-soft"
            value={input}
            placeholder={hasNodes ? "Tell AI what to change…" : "Describe what you want to diagram…"}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                send();
              }
            }}
          />
          <button
            className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border-none bg-green text-on-accent transition-colors hover:bg-green-strong disabled:cursor-not-allowed disabled:bg-line-strong [&_svg]:size-3.5"
            aria-label="Send"
            disabled={!input.trim() || busy !== null}
            onClick={send}
          >
            {busy !== null ? <span className="btn__spin" aria-hidden /> : <Send />}
          </button>
        </div>
        <div className="mt-1.5 text-center text-[10px] text-slate-soft">
          {hasNodes
            ? "Describe a change — the AI edits the existing diagram."
            : "Describe an idea — the AI improves the prompt, then generates a diagram."}
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "4px 0 10px" }}>
        <span style={{ fontSize: 10, color: "var(--slate-soft)" }}>
          {changeLog.length > 0 && `Last change · ${changeLog[0]}`}
        </span>
      </div>
    </aside>
  );
}
