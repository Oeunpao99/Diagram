import { create } from "zustand";

import { api } from "../api/client";
import {
  emptyDoc,
  normalizeDoc,
  type AgentAction,
  type AgentPlanStep,
  type AgentResult,
  type AgentStreamEvent,
  type ChatMessage,
  type ChatTurn,
  type DiagramDoc,
  type Direction,
  type ImprovedPrompt,
  type ValidationReport,
} from "../api/types";
import { withoutPageKeys, type PageTarget } from "../lib/pagePresets";
import { useSettings } from "./useSettings";

type Busy =
  | null
  | "improving"
  | "generating"
  | "editing"
  | "laying-out"
  | "documenting"
  | "analyzing";

/** Sub-state of `busy === "editing"` — sendChatMessage genuinely runs two
 *  sequential requests (classify, then apply), so the Copilot panel can show
 *  which one is actually in flight instead of one undifferentiated spinner. */
type EditPhase = "checking" | "updating" | null;

/** One row of the live todo-list the Copilot shows while an edit runs.
 *  The backend announces steps up front via `plan` events (`done: false`)
 *  and flips each to `done: true` (with the real, final text) via a `step`
 *  event once it's actually finished. */
export interface EditStep {
  id: string;
  label: string;
  done: boolean;
}

interface DiagramState {
  doc: DiagramDoc;
  diagramId: string | null;
  /** The project the open diagram belongs to, if any — drives the
   *  breadcrumb. Not part of `doc`: it's metadata on the saved Diagram row,
   *  not diagram content, so it doesn't travel through save/load the way
   *  nodes and edges do. */
  projectId: string | null;
  validation: ValidationReport | null;
  improved: ImprovedPrompt | null;
  changeLog: string[];
  /** Set by sendChatMessage when a chat message turned out to be a question
   *  or a request for ideas rather than an edit instruction — the diagram is
   *  untouched, this is what the Copilot panel should say back instead of
   *  its usual "I made these changes" summary. Consumed (cleared) by the
   *  panel once it's been shown as a message. */
  chatAnswer: string | null;
  /** Steps the agent wanted to take but couldn't — a node it named that
   *  isn't there, a tool call that didn't parse. Shown after the change list
   *  so a partly-applied instruction doesn't read as a finished one.
   *  Consumed (cleared) by the Copilot panel alongside `chatAnswer`. */
  chatWarnings: string[];
  selection: string[];
  edgeSelection: string[];
  busy: Busy;
  editPhase: EditPhase;
  /** The live per-tool progress of the current `editing` run — populated by
   *  the streaming /ai/agent/stream endpoint and consumed by the Copilot
   *  panel. Reset when the next editing message starts. */
  editSteps: EditStep[];
  /** True while Canvas.tsx's rehearsal is sketching a freshly generated (or
   *  relaid-out) diagram onto the canvas one shape at a time. `busy` alone
   *  isn't enough for anything that wants to know when the *reveal* is
   *  actually done — it already clears back to null well before the sketch
   *  starts (there's a settle-and-fit pause first) and stays null through
   *  the whole animation. The Copilot panel holds its own "done" summary on
   *  this rather than on `busy`, so it doesn't appear before the diagram
   *  has visibly finished drawing itself in. Owned by Canvas.tsx; read
   *  fresh via getState() rather than the reactive value, since it can
   *  flip in the same tick `busy` does. */
  rehearsing: boolean;
  /** Which shape the rehearsal is drawing right now, if any — lets the
   *  Copilot panel narrate the same thing the canvas is visibly doing
   *  instead of a static "Generating…". Cleared alongside `rehearsing`. */
  generationProgress: { label: string; index: number; total: number } | null;
  /** The full, ordered list of node labels the current rehearsal will draw —
   *  known the instant generation/layout returns, before the first
   *  `generationProgress` update fires, so the Copilot panel can show it as
   *  a todo list rather than a single "drawing X" line. Cleared alongside
   *  `generationProgress`. */
  generationPlan: string[] | null;
  /** The Copilot chat thread for the open diagram — restored on
   *  hydrate/loadDiagram, reset on beginNew. Persisted best-effort as it
   *  grows (see appendMessage); a transient save failure never blocks the
   *  chat, the same philosophy as doc autosave. */
  messages: ChatMessage[];
  error: string | null;

  past: DiagramDoc[];
  future: DiagramDoc[];

  /** True once boot-time restore (hydrate) has had its chance to load. */
  hydrated: boolean;
  /** Bumped whenever a diagram is created, saved, opened or removed, so
   *  panels that show the saved list know when to re-fetch it. */
  savedRev: number;

  setDoc: (doc: DiagramDoc, options?: { silent?: boolean }) => void;
  setSelection: (ids: string[]) => void;
  setEdgeSelection: (ids: string[]) => void;
  setRehearsing: (value: boolean) => void;
  setGenerationProgress: (
    progress: { label: string; index: number; total: number } | null,
  ) => void;
  setGenerationPlan: (plan: string[] | null) => void;
  undo: () => void;
  redo: () => void;
  clearError: () => void;
  /** Appends to `messages` and (best-effort) persists it against the open
   *  diagram — the single place that happens, so no caller needs to know
   *  the chat is saved anywhere. */
  appendMessage: (msg: Omit<ChatMessage, "id" | "created_at">) => void;
  /** What /new calls: clears the thread locally and on the server, leaving
   *  the diagram itself untouched. */
  clearMessages: () => Promise<void>;

  /** Restore the diagram this browser last worked on (called at boot). */
  hydrate: () => Promise<void>;
  /** Open a saved diagram and make it the one autosave writes to. */
  loadDiagram: (id: string) => Promise<void>;
  /** Detach from the current diagram so the next edit starts a fresh record.
   *  An optional projectId scopes that record to a project the moment
   *  autosave first creates it — see `pendingProjectId` below. */
  beginNew: (projectId?: string) => void;
  bumpSaved: () => void;

  improvePrompt: (prompt: string) => Promise<void>;
  analyzeImage: (imageDataUrl: string, prompt?: string) => Promise<void>;
  dismissImproved: () => void;
  generate: (prompt: string, templateSlug?: string | null) => Promise<void>;
  runEdit: (instruction: string) => Promise<void>;
  /** The copilot chat's actual entry point once a diagram exists — classifies
   *  the message first (see api.routeMessage) and only calls runEdit when
   *  it's genuinely an instruction to change something. A question or a
   *  request for ideas is answered via `chatAnswer` instead, diagram
   *  untouched. Falls through to runEdit if classification itself fails,
   *  so a backend hiccup degrades to the old always-edit behaviour rather
   *  than silently dropping the message. */
  sendChatMessage: (message: string, history?: ChatTurn[]) => Promise<void>;
  /** Reorganizes the open diagram to follow a template's structure, keeping
   *  its own content — what the toolbar's Template menu calls (distinct
   *  from just loading a template's static example onto a blank canvas,
   *  which is a plain client-side doc swap — see TemplateRail.tsx's `use`). */
  restyleToTemplate: (templateSlug: string) => Promise<void>;
  autoLayout: (direction?: Direction, size?: PageTarget | null) => Promise<void>;
  revalidate: () => Promise<void>;
}

const HISTORY_LIMIT = 50;

const DIAGRAM_KEY = "dc.current-diagram";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Append any plan steps not already in the list, in the order they arrived
 *  — a plan can grow across more than one `plan` event, so this merges
 *  rather than replaces. */
function addPlanSteps(steps: EditStep[], incoming: AgentPlanStep[]): EditStep[] {
  const known = new Set(steps.map((step) => step.id));
  const fresh = incoming.filter((step) => !known.has(step.id)).map((step) => ({ ...step, done: false }));
  return fresh.length > 0 ? [...steps, ...fresh] : steps;
}

/** Mark one step done by id, with its real, final text. */
function markStepDone(steps: EditStep[], id: string, label: string): EditStep[] {
  const index = steps.findIndex((step) => step.id === id);
  if (index === -1) return steps;
  const next = [...steps];
  next[index] = { id, label, done: true };
  return next;
}

/* --------------------------------------------------------------------------
   Autosave. The store is watched here (not inside React) so every doc change —
   node drags, title edits, AI edits, undo/redo — gets persisted without each
   action having to remember to call save. A debounce keeps rest-heavy moves
   from hammering the API.
   -------------------------------------------------------------------------- */

function readStoredDiagramId(): string | null {
  try {
    return localStorage.getItem(DIAGRAM_KEY);
  } catch {
    return null; // private window, or site data blocked
  }
}

function writeStoredDiagramId(id: string | null) {
  try {
    if (id) localStorage.setItem(DIAGRAM_KEY, id);
    else localStorage.removeItem(DIAGRAM_KEY);
  } catch {
    /* in-memory only for this tab */
  }
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
let persisting = false;
/** Set right before a programmatic doc load (hydrate/open) so the one-time
 *  doc swap that those cause doesn't echo an autosave of the same content. */
let suppressNextAutosave = false;
/** The project the *next* diagram autosave creates should belong to — set by
 *  beginNew(projectId) and consumed (then cleared) the moment that first
 *  create actually happens, since autosave — not the caller — is what
 *  decides when a brand-new blank doc turns into a real saved row. */
let pendingProjectId: string | undefined;

function schedulePersist(delay = 900) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = undefined;
    void persist();
  }, delay);
}

async function persist() {
  // A save is already in flight — the wrapped-up burst will pick up whatever
  // changed since, so just reschedule rather than re-entering.
  if (persisting) {
    schedulePersist(300);
    return;
  }
  const { doc, diagramId, busy } = useDiagram.getState();
  if (busy) {
    schedulePersist(300);
    return;
  }
  // A truly blank canvas is a placeholder, not a record worth persisting.
  if (doc.nodes.length === 0 && doc.edges.length === 0) return;

  persisting = true;
  try {
    if (diagramId) {
      await api.saveDiagram(diagramId, doc);
    } else {
      const created = await api.createDiagram(doc, pendingProjectId);
      pendingProjectId = undefined;
      writeStoredDiagramId(created.id);
      useDiagram.setState({ diagramId: created.id });
    }
    useDiagram.getState().bumpSaved();
  } catch {
    /* autosave is best-effort; a transient failure shouldn't alarm the user */
  } finally {
    persisting = false;
  }
}

/* --------------------------------------------------------------------------
   Chat persistence. A message can arrive before the diagram it belongs to
   has a diagramId yet — describing a brand-new diagram chats for a couple
   of turns before generate() actually creates the row — so those are held
   here and flushed once one exists (see the subscribe() block below).
   Everything else posts straight away, serialized through one promise chain
   so two fast messages can't land out of order.
   -------------------------------------------------------------------------- */

let pendingMessages: ChatMessage[] = [];
let messageQueue: Promise<unknown> = Promise.resolve();

function queuePersistMessage(diagramId: string, msg: ChatMessage) {
  messageQueue = messageQueue
    .then(() =>
      api.addMessage(diagramId, {
        role: msg.role,
        text: msg.text,
        changes: msg.changes,
        warnings: msg.warnings,
      }),
    )
    .catch(() => {
      /* best-effort — a transient failure shouldn't interrupt the chat */
    });
}

async function loadMessagesFor(diagramId: string) {
  try {
    const messages = await api.listMessages(diagramId);
    useDiagram.setState({ messages });
  } catch {
    /* best-effort restore — an empty thread beats blocking the diagram load */
  }
}

/* --------------------------------------------------------------------------
   Client actions. The agent can ask for things that don't live in the
   document at all — undo, or a viewport change. Undo/redo/select are store
   operations; the viewport ones belong to the React Flow instance, which only
   exists inside the Canvas, so those go out as an event it listens for.
   -------------------------------------------------------------------------- */

/** Viewport actions the Canvas picks up. Fired on `window`. */
export const CANVAS_ACTION_EVENT = "canvas:action";

function runClientAction(action: AgentAction) {
  const state = useDiagram.getState();
  switch (action.tool) {
    case "undo":
      state.undo();
      return;
    case "redo":
      state.redo();
      return;
    case "select":
      state.setSelection(action.args.ids ?? []);
      return;
    case "fit_view":
    case "zoom_in":
    case "zoom_out":
      window.dispatchEvent(new CustomEvent(CANVAS_ACTION_EVENT, { detail: action.tool }));
      return;
  }
}

export const useDiagram = create<DiagramState>((set, get) => ({
  doc: emptyDoc(),
  diagramId: null,
  projectId: null,
  validation: null,
  improved: null,
  changeLog: [],
  chatAnswer: null,
  chatWarnings: [],
  selection: [],
  edgeSelection: [],
  busy: null,
  editPhase: null,
  editSteps: [],
  rehearsing: false,
  generationProgress: null,
  generationPlan: null,
  messages: [],
  error: null,
  past: [],
  future: [],
  hydrated: false,
  savedRev: 0,

  setDoc: (doc, options) =>
    set((state) =>
      options?.silent
        ? { doc }
        : {
            doc,
            past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
            future: [],
          },
    ),

  setSelection: (selection) => set({ selection }),
  setEdgeSelection: (edgeSelection) => set({ edgeSelection }),
  setRehearsing: (rehearsing) => set({ rehearsing }),
  setGenerationProgress: (generationProgress) => set({ generationProgress }),
  setGenerationPlan: (generationPlan) => set({ generationPlan }),

  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        doc: previous,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future].slice(0, HISTORY_LIMIT),
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      return {
        doc: next,
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }),

  clearError: () => set({ error: null }),

  appendMessage: (msg) => {
    const full: ChatMessage = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...msg,
    };
    set((state) => ({ messages: [...state.messages, full] }));

    const { diagramId } = get();
    if (diagramId) {
      queuePersistMessage(diagramId, full);
    } else {
      // No diagram row yet (a brand-new, not-yet-generated diagram) —
      // flushed once one exists, see the subscribe() block below.
      pendingMessages.push(full);
    }
  },

  clearMessages: async () => {
    set({ messages: [] });
    pendingMessages = [];
    const { diagramId } = get();
    if (!diagramId) return;
    try {
      await api.clearMessages(diagramId);
    } catch {
      /* best-effort, same as the rest of chat persistence */
    }
  },

  hydrate: async () => {
    if (get().hydrated) return;
    const id = readStoredDiagramId();
    if (id) {
      try {
        const result = await api.getDiagram(id);
        suppressNextAutosave = true;
        set({
          doc: normalizeDoc(result.data),
          diagramId: result.id,
          projectId: result.project_id,
          hydrated: true,
        });
        void loadMessagesFor(result.id);
        return;
      } catch {
        // Gone, renamed on another device, or owned by a different account.
        writeStoredDiagramId(null);
      }
    }
    set({ hydrated: true });
  },

  loadDiagram: async (id) => {
    try {
      const result = await api.getDiagram(id);
      suppressNextAutosave = true;
      set((state) => ({
        doc: normalizeDoc(result.data),
        diagramId: result.id,
        projectId: result.project_id,
        validation: null,
        changeLog: [],
        improved: null,
        selection: [],
        edgeSelection: [],
        // Cleared immediately rather than left showing the *previous*
        // diagram's thread while this one's loads — loadMessagesFor below
        // replaces it once the fetch resolves.
        messages: [],
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: [],
      }));
      writeStoredDiagramId(id);
      get().bumpSaved();
      void loadMessagesFor(id);
    } catch (error) {
      set({ error: message(error) });
    }
  },

  beginNew: (projectId) => {
    pendingProjectId = projectId;
    pendingMessages = [];
    writeStoredDiagramId(null);
    set({
      diagramId: null,
      projectId: projectId ?? null,
      validation: null,
      changeLog: [],
      improved: null,
      selection: [],
      edgeSelection: [],
      // A fresh, unsaved diagram has no thread to restore.
      messages: [],
    });
    get().bumpSaved();
  },

  bumpSaved: () => set((state) => ({ savedRev: state.savedRev + 1 })),

  improvePrompt: async (prompt) => {
    set({ busy: "improving", error: null });
    try {
      set({ improved: await api.improvePrompt(prompt) });
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ busy: null });
    }
  },

  analyzeImage: async (imageDataUrl, prompt = "") => {
    set({ busy: "analyzing", error: null });
    try {
      set({ improved: await api.analyzeImage(imageDataUrl, prompt) });
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ busy: null });
    }
  },

  dismissImproved: () => set({ improved: null }),

  generate: async (prompt, templateSlug) => {
    set({ busy: "generating", error: null });
    try {
      const result = await api.generate({
        prompt,
        template_slug: templateSlug ?? get().improved?.recommended_template_slug ?? null,
        diagram_type: get().improved?.recommended_type ?? null,
      });
      set((state) => ({
        doc: result.doc,
        diagramId: result.diagram_id,
        validation: result.validation,
        changeLog: result.notes,
        improved: null,
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: [],
      }));
      if (result.diagram_id) writeStoredDiagramId(result.diagram_id);
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ busy: null });
    }
  },

  runEdit: async (instruction) => {
    const { doc, selection } = get();
    set({ busy: "editing", editPhase: "updating", error: null });
    try {
      const result = await api.edit(doc, instruction, selection, false, get().diagramId);
      set((state) => ({
        doc: result.doc,
        validation: result.validation,
        changeLog: result.changes,
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: [],
      }));
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ busy: null, editPhase: null });
    }
  },

  restyleToTemplate: async (templateSlug) => {
    const { doc, diagramId } = get();
    // "editing" (not a new busy value) so this gets the same in-flight
    // toast and landing cross-fade any AI edit already does (Canvas.tsx) —
    // no new UI state needed for what's still just "the AI changed the doc".
    set({ busy: "editing", editPhase: "updating", error: null });
    try {
      const result = await api.restyleTemplate(doc, templateSlug, diagramId);
      set((state) => ({
        doc: result.doc,
        validation: result.validation,
        changeLog: result.changes,
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: [],
      }));
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ busy: null, editPhase: null });
    }
  },

  sendChatMessage: async (text, history = []) => {
    const { doc, selection, edgeSelection, diagramId } = get();
    set({
      busy: "editing",
      editPhase: "checking",
      error: null,
      chatAnswer: null,
      chatWarnings: [],
      editSteps: [],
    });

    // The backend streams one event per real step (see /ai/agent/stream), so
    // the Copilot's live feed is a genuine record of the run, not a fake
    // timer: each tool shows with a spinner first, then flips to a check with
    // the actual changelog text the moment it's applied.
    const onEvent = (event: AgentStreamEvent) => {
      if (event.type === "plan") {
        set((state) => ({ editSteps: addPlanSteps(state.editSteps, event.steps) }));
      } else if (event.type === "step") {
        set((state) => ({
          editPhase: "updating",
          editSteps: markStepDone(state.editSteps, event.id, event.label),
        }));
      } else if (event.type === "error") {
        set({ error: event.message });
      }
    };

    let result: AgentResult;
    try {
      result = await api.agentStream(
        doc,
        text,
        selection,
        edgeSelection,
        diagramId,
        history,
        onEvent,
      );
    } catch {
      // The stream itself failed (proxy without SSE support, network hiccup) —
      // fall back to the one-shot call, and if that also fails, to the
      // whole-document edit pipeline rather than dropping the user's message.
      set({ editPhase: "updating" });
      try {
        result = await api.agent(doc, text, selection, edgeSelection, diagramId, history);
      } catch {
        await get().runEdit(text);
        return;
      }
    }

    if (result.intent === "ask") {
      set({ chatAnswer: result.answer, busy: null, editPhase: null });
      return;
    }

    // A "rewrite" already ran through the edit agent server-side, so both
    // remaining intents arrive the same way: a finished doc, or none at all
    // when only the canvas was touched ("undo that", "zoom out").
    set((state) => ({
      ...(result.doc
        ? {
            doc: result.doc,
            past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
            future: [],
          }
        : null),
      validation: result.validation ?? state.validation,
      changeLog: result.changes,
      chatAnswer: result.answer ?? null,
      chatWarnings: result.warnings,
      busy: null,
      editPhase: null,
    }));

    // Run these after the doc lands, so an "undo" or "fit view" the agent
    // asked for applies to the state the user is about to see. undo/redo
    // read the history the set() above just pushed onto.
    for (const action of result.client_actions) runClientAction(action);
  },

  autoLayout: async (direction, size) => {
    const { doc } = get();
    const algorithm =
      doc.diagram_type === "radial"
        ? "radial"
        : (doc.lanes ?? []).length > 1
          ? "swimlane"
          : "layered";
    set({ busy: "laying-out", error: null });
    try {
      const meta = size
        ? {
            ...doc.meta,
            page_width: size.width,
            page_height: size.height,
            ...(size.id ? { page_preset: size.id } : {}),
          }
        : withoutPageKeys(doc.meta);
      const payload = { ...doc, meta };
      const next = await api.layout(
        payload,
        direction ?? doc.direction,
        algorithm,
        size ? { width: size.width, height: size.height } : null,
      );
      set((state) => ({
        doc: next,
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: [],
      }));
      await get().revalidate();
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ busy: null });
    }
  },

  revalidate: async () => {
    try {
      set({ validation: await api.validate(get().doc) });
    } catch {
      /* validation is advisory; a failure here shouldn't interrupt the user */
    }
  },
}));

/* Watch for doc changes and persist them (module scope — outside React, so
 * drags, edits, undo/redo and title changes all autosave without each action
 * having to rememeber to call save). */
useDiagram.subscribe((state, prev) => {
  // A brand-new diagram's first couple of chat turns happen before
  // generate() gives it a diagramId — flush whatever was buffered for it
  // the moment one actually appears, regardless of the autosave guard
  // below (this isn't an autosave concern, and a diagramId only ever goes
  // null -> real, never back, so there's no risk of double-flushing).
  if (state.diagramId && !prev.diagramId && pendingMessages.length > 0) {
    const toFlush = pendingMessages;
    pendingMessages = [];
    for (const msg of toFlush) queuePersistMessage(state.diagramId, msg);
  }

  if (suppressNextAutosave) {
    suppressNextAutosave = false;
    return;
  }
  if (state.doc !== prev.doc && useSettings.getState().prefs.autosave) {
    schedulePersist();
  }
});
