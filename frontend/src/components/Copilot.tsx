import { useEffect, useRef, useState } from "react";

import { useDiagram } from "../store/useDiagram";
import {
  Alert,
  ArrowRight,
  Check,
  CheckCircle,
  Sparkles,
  Send,
} from "./icons";

interface AnalysisBlock {
  type: string;
  template: string;
  elements: string[];
  issue: string | null;
}

interface Msg {
  id: number;
  role: "user" | "ai";
  text: string;
  analysis?: AnalysisBlock;
  thinking?: boolean;
}

const SEED_PROMPT =
  "Create an import cargo process from receiving documents to final cargo release.";

const SUGGESTIONS = [
  "Add a rejection path",
  "Make this a swimlane",
  "Improve the layout",
  "Simplify this diagram",
];

const DEFAULT_ANALYSIS: AnalysisBlock = {
  type: "Process Flow",
  template: "Logistics — Process Flow",
  elements: [
    "Customer",
    "Import Information",
    "Document Verification",
    "Customs Inspection",
    "Cargo Release",
  ],
  issue: "Your process does not specify what happens when documents are rejected.",
};

function uid(): number {
  return Date.now() + Math.floor(Math.random() * 1e5);
}

/* ------------------------------------------------------------ analysis card */

function AnalysisCard({
  block,
  working,
  onImprove,
  onGenerate,
}: {
  block: AnalysisBlock;
  working: "improving" | "generating" | null;
  onImprove: () => void;
  onGenerate: () => void;
}) {
  return (
    <div>
      <div className="analysis">
        <div className="analysis__head">
          <span>Structured analysis</span>
          <span className="analysis__badge">AI</span>
        </div>
        <div className="analysis__row">
          <span className="analysis__label">Diagram Type</span>
          <span className="analysis__value">{block.type}</span>
        </div>
        <div className="analysis__row">
          <span className="analysis__label">Recommended Template</span>
          <span className="analysis__value">{block.template}</span>
        </div>
        <div className="analysis__row" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <span className="analysis__label" style={{ textAlign: "left" }}>
            Detected Elements
          </span>
          <ul className="analysis__list">
            {block.elements.map((element) => (
              <li key={element}>
                <CheckCircle />
                {element}
              </li>
            ))}
          </ul>
        </div>
        {block.issue && (
          <div className="analysis__issue">
            <Alert />
            <span>
              <b>Potential Issue</b> — {block.issue}
            </span>
          </div>
        )}
      </div>
      <div className="copilot__actions">
        <button
          className="btn btn--outline-accent"
          disabled={working !== null}
          onClick={onImprove}
        >
          <Sparkles />
          {working === "improving" ? "Improving…" : "Improve Prompt"}
        </button>
        <button className="btn btn--accent" disabled={working !== null} onClick={onGenerate}>
          {working === "generating" ? "Generating…" : "Generate Diagram"}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- copilot */

export function Copilot() {
  const [messages, setMessages] = useState<Msg[]>(() => [
    { id: uid(), role: "user", text: SEED_PROMPT },
    {
      id: uid(),
      role: "ai",
      text: "I understand this as an Import Cargo Process.",
      analysis: DEFAULT_ANALYSIS,
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [showImproved, setShowImproved] = useState(false);
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

  // Acknowledge finished AI operations once `busy` settles.
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
  }, [busy, pendingText]);

  // Reflect improved prompts that arrive from the AI.
  useEffect(() => {
    if (!improved) return;
    setShowImproved(false);
    appendMessage({
      role: "ai",
      text: "I improved your prompt by adding the document rejection path and organizing the customs activities into a separate process group.",
    });
  }, [improved]);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const onFocus = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail ?? "";
      setInput(detail);
      document.querySelector<HTMLTextAreaElement>(".composer__field textarea")?.focus();
    };
    window.addEventListener("copilot:focus", onFocus);
    return () => window.removeEventListener("copilot:focus", onFocus);
  }, []);

  const sendEdit = (text: string) => {
    if (!text.trim() || busy !== null || !hasNodes) return;
    appendMessage({ role: "user", text });
    setPendingText("The edit is applied to the diagram.");
    void runEdit(text);
    setInput("");
  };

  const working: "improving" | "generating" | null =
    busy === "improving" ? "improving" : busy === "generating" ? "generating" : null;

  const promptToUse = improved?.improved ?? SEED_PROMPT;

  const stepState = (step: number): "done" | "active" | "idle" => {
    const states: ("done" | "active" | "idle")[] = [
      hasNodes || improved ? "done" : "active",
      improved ? "done" : busy === "improving" ? "active" : "idle",
      hasNodes ? "done" : busy === "generating" ? "active" : "idle",
      hasNodes ? "active" : "idle",
    ];
    return states[step];
  };

  const STEP_NAMES = ["Describe", "Improve", "Generate", "Edit"];

  return (
    <aside className="copilot">
      <header className="copilot__header">
        <h1 className="copilot__title">
          <Sparkles />
          AI Copilot
        </h1>
        <p className="copilot__subtitle">Describe, generate, and improve your diagram.</p>
        <div className="stepper" aria-label="Describe to Improve to Generate to Edit">
          {STEP_NAMES.map((name, index) => {
            const state = stepState(index);
            return (
              <span key={name} className={`stepper__step ${state !== "idle" ? "is-" + state : ""}`}>
                <span className="stepper__dot">{state === "done" ? <Check /> : index + 1}</span>
                {name}
                {index < STEP_NAMES.length - 1 && (
                  <span className={`stepper__link ${state !== "idle" ? "is-" + state : ""}`} />
                )}
              </span>
            );
          })}
        </div>
      </header>

      <div className="chat">
        {messages.map((message) => (
          <div key={message.id} className={`msg msg--${message.role}`}>
            <span className="msg__avatar">
              {message.role === "ai" ? <Sparkles /> : "You"}
            </span>
            <div className="msg__bubble">
              {message.thinking ? (
                <span className="typing">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                message.text
              )}
              {message.analysis && (
                <AnalysisCard
                  block={message.analysis}
                  working={working}
                  onImprove={() => void improvePrompt(promptToUse)}
                  onGenerate={() => {
                    appendMessage({ role: "user", text: improved?.improved ?? SEED_PROMPT });
                    setPendingText("The diagram has been generated on the canvas.");
                    void generate(improved?.improved ?? SEED_PROMPT);
                  }}
                />
              )}
            </div>
          </div>
        ))}

        {improved && !showImproved && (
          <div className="msg msg--ai">
            <span className="msg__avatar">
              <Sparkles />
            </span>
            <div className="msg__bubble">
              Your original prompt is now stronger and ready to generate from.
              <div style={{ marginTop: 8 }}>
                <button
                  className="btn btn--sm btn--outline-accent"
                  onClick={() => setShowImproved(true)}
                >
                  <Sparkles />
                  View Improved Prompt
                </button>
              </div>
            </div>
          </div>
        )}

        {improved && showImproved && (
          <div className="msg msg--ai">
            <span className="msg__avatar">
              <Sparkles />
            </span>
            <div className="msg__bubble">
              <div className="improved-card">
                <div className="improved-card__head">
                  <span>
                    <b>Improved prompt</b> · use it to generate
                  </span>
                  <button onClick={() => setShowImproved(false)}>Hide</button>
                </div>
                <div className="improved-card__body">{improved.improved}</div>
              </div>
              <div className="copilot__actions">
                <button className="btn btn--outline-accent" onClick={dismissImproved}>
                  Keep original
                </button>
                <button
                  className="btn btn--accent"
                  disabled={working !== null}
                  onClick={() => {
                    setPendingText("The diagram has been generated on the canvas.");
                    void generate(improved.improved);
                  }}
                >
                  <ArrowRight />
                  Generate
                </button>
              </div>
            </div>
          </div>
        )}

        {busy === "editing" && (
          <div className="msg msg--ai">
            <span className="msg__avatar">
              <Sparkles />
            </span>
            <div className="msg__bubble">
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

      <div className="composer">
        <div className="composer__suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              className={`composer__chip ${input === suggestion ? "is-active" : ""}`}
              onClick={() => setInput(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="composer__field">
          <textarea
            rows={1}
            value={input}
            placeholder="Tell AI what to change…"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                sendEdit(input);
              }
            }}
          />
          <button
            className="composer__send"
            aria-label="Send command"
            disabled={!input.trim() || busy !== null || !hasNodes}
            onClick={() => sendEdit(input)}
          >
            <Send />
          </button>
        </div>
        <div className="composer__hint">
          {hasNodes ? "Describe a change — the AI edits the existing diagram." : "Generate a diagram first, then give it edits."}
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