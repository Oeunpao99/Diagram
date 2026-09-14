import { useEffect, useRef, useState } from "react";

import { usePanelResize } from "../hooks/usePanelResize";
import { useDiagram } from "../store/useDiagram";
import { Alert, ArrowRight, Check, ImageIcon, LogoMark, Send, Sparkles, X } from "./icons";

const MAX_IMAGE_BYTES = 6_000_000; // ~6MB — matches the backend's data-url cap with room to spare

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
  const [attachedImage, setAttachedImage] = useState<{ dataUrl: string; name: string } | null>(
    null,
  );
  const [attachError, setAttachError] = useState<string | null>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const resize = usePanelResize();

  const busy = useDiagram((s) => s.busy);
  const improved = useDiagram((s) => s.improved);
  const hasNodes = useDiagram((s) => s.doc.nodes.length > 0);
  const improvePrompt = useDiagram((s) => s.improvePrompt);
  const analyzeImage = useDiagram((s) => s.analyzeImage);
  const generate = useDiagram((s) => s.generate);
  const runEdit = useDiagram((s) => s.runEdit);
  const dismissImproved = useDiagram((s) => s.dismissImproved);

  // The composer grows with its content (up to a cap) so multi-line ideas
  // get room to breathe instead of being squeezed into a one-row strip.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
  }, [input]);

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

  /** No diagram yet, but a sketch instead of (or alongside) typed text —
   *  same Describe step, just read from a picture. */
  const sendImage = (image: { dataUrl: string; name: string }, caption: string) => {
    if (busy !== null) return;
    appendMessage({ role: "user", text: caption.trim() || `Attached ${image.name}` });
    dismissImproved();
    setShowImproved(false);
    void analyzeImage(image.dataUrl, caption);
    setAttachedImage(null);
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

  const send = () => {
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
    <aside
      className="relative flex min-h-0 flex-col border-l border-line bg-surface max-[1240px]:hidden"
      data-copilot
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drag-to-resize, not a click target */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize AI Copilot panel"
        className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none select-none hover:bg-green-ring active:bg-green-ring"
        onPointerDown={resize.onPointerDown}
      />
      <header className="shrink-0 border-b border-line px-4 pb-3 pt-4">
        <h1 className="m-0 flex items-center gap-2.5 text-[15px] font-bold tracking-[-0.01em]">
          <span className="grid size-[26px] shrink-0 place-items-center rounded-[9px] bg-green-soft text-green-strong [&_svg]:size-[15px]">
            <LogoMark />
          </span>
          AI Copilot
        </h1>
        <p className="mt-[6px] text-[11.5px] leading-[1.4] text-slate-soft">
          Describe, generate, and improve your diagram.
        </p>
        <div className="mt-3 flex items-center rounded-[9px] bg-paper px-[9px] py-[7px]" aria-label="Describe to Improve to Generate to Edit">
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
            Describe a process, system, or workflow below — try one of the ideas in the box, or
            write your own. I&apos;ll sharpen the prompt, then generate an editable diagram from it.
          </p>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex max-w-full gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
            <span className={`grid size-6 shrink-0 place-items-center rounded-full border border-green-line text-[10px] font-[650] [&_svg]:size-3 ${message.role === "user" ? "bg-[#dcebe5] text-green-deep" : "bg-green-soft text-green-strong"}`}>
              {message.role === "ai" ? <LogoMark /> : "You"}
            </span>
            <div className={`min-w-0 rounded-[11px] px-[11px] py-[9px] text-[12.5px] leading-[1.5] ${message.role === "user" ? "max-w-[78%] rounded-br-[4px] bg-green text-on-accent" : "max-w-full whitespace-pre-wrap rounded-bl-[4px] border border-line chat-bubble-ai"}`}>
              {message.text}
            </div>
          </div>
        ))}

        {(busy === "improving" || busy === "analyzing") && (
          <div className="flex max-w-full gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-green-line bg-green-soft text-green-strong [&_svg]:size-3">
              <LogoMark />
            </span>
            <div className="min-w-0 max-w-full whitespace-pre-wrap rounded-bl-[4px] rounded-[11px] border border-line chat-bubble-ai px-[11px] py-[9px] text-[12.5px] leading-[1.5]">
              {busy === "analyzing" && (
                <div className="mb-1.5 text-[11px] font-[550] text-slate">
                  Looking at your image…
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

        {improved && (
          <div className="flex max-w-full gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-green-line bg-green-soft text-green-strong [&_svg]:size-3">
              <LogoMark />
            </span>
            <div className="min-w-0 max-w-full whitespace-pre-wrap rounded-bl-[4px] rounded-[11px] border border-line chat-bubble-ai px-[11px] py-[9px] text-[12.5px] leading-[1.5]">
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
              <LogoMark />
            </span>
            <div className="min-w-0 max-w-full whitespace-pre-wrap rounded-bl-[4px] rounded-[11px] border border-line chat-bubble-ai px-[11px] py-[9px] text-[12.5px] leading-[1.5]">
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
        <div
          className="rounded-[16px] bg-paper p-2.5 transition-[box-shadow,background-color] hover:ring-1 hover:ring-line-strong focus-within:bg-surface"
          data-composer-field
        >
          <div className="no-scrollbar mb-1.5 flex gap-1 overflow-x-auto pb-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                className={`inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full border bg-surface px-2.5 py-[5px] text-[11px] font-[550] transition-all hover:border-green hover:bg-green-soft hover:text-green-deep [&_svg]:size-[11px] ${input === suggestion ? "border-green bg-green-soft text-green-deep" : "border-line text-slate"}`}
                onClick={() => setInput(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>

          {!hasNodes && attachedImage && (
            <div className="mb-1.5 flex items-center gap-2 rounded-[10px] border border-line bg-surface p-1.5 pr-2">
              <img
                src={attachedImage.dataUrl}
                alt=""
                className="size-9 shrink-0 rounded-[7px] border border-line object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-[11px] font-[550] text-ink">
                {attachedImage.name}
              </span>
              <button
                className="grid size-5 shrink-0 place-items-center rounded-full border-none bg-transparent text-slate-soft transition-colors hover:bg-paper hover:text-ink [&_svg]:size-3"
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
                ? "Tell AI what to change…"
                : attachedImage
                  ? "Add a caption (optional)…"
                  : "Describe what you want to diagram…"
            }
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return; // Shift+Enter -> newline
              event.preventDefault();
              send();
            }}
          />
          <div className="flex items-center gap-2 pt-2">
            <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-soft">
              {hasNodes
                ? "Edits the current diagram"
                : "Improves the prompt, then generates a diagram"}
              {" · "}
              <kbd className="rounded-[5px] border border-line bg-surface px-1 py-px font-[600] text-slate">
                Enter
              </kbd>
              {" to send · "}
              <kbd className="rounded-[5px] border border-line bg-surface px-1 py-px font-[600] text-slate">
                Shift
              </kbd>
              {" + "}
              <kbd className="rounded-[5px] border border-line bg-surface px-1 py-px font-[600] text-slate">
                Enter
              </kbd>
              {" for a new line"}
            </span>
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
                  className="grid size-[30px] shrink-0 place-items-center rounded-[10px] border-none bg-transparent text-slate transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-[15px]"
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
              className="grid size-[38px] shrink-0 place-items-center rounded-[12px] border-none bg-green text-on-accent transition-all hover:scale-[1.03] hover:bg-green-strong active:scale-95 disabled:cursor-not-allowed disabled:bg-line-strong disabled:hover:scale-100 [&_svg]:size-[17px]"
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
