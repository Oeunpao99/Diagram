import { create } from "zustand";

import { api } from "../api/client";
import {
  emptyDoc,
  normalizeDoc,
  type AgentAction,
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
  undo: () => void;
  redo: () => void;
  clearError: () => void;

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
  sendChatMessage: (message: string) => Promise<void>;
  autoLayout: (direction?: Direction, size?: PageTarget | null) => Promise<void>;
  revalidate: () => Promise<void>;
}

const HISTORY_LIMIT = 50;

const DIAGRAM_KEY = "dc.current-diagram";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: [],
      }));
      writeStoredDiagramId(id);
      get().bumpSaved();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  beginNew: (projectId) => {
    pendingProjectId = projectId;
    writeStoredDiagramId(null);
    set({
      diagramId: null,
      projectId: projectId ?? null,
      validation: null,
      changeLog: [],
      improved: null,
      selection: [],
      edgeSelection: [],
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

  sendChatMessage: async (text) => {
    const { doc, selection, edgeSelection, diagramId } = get();
    set({
      busy: "editing",
      editPhase: "checking",
      error: null,
      chatAnswer: null,
      chatWarnings: [],
    });

    let result;
    try {
      result = await api.agent(doc, text, selection, edgeSelection, diagramId);
    } catch {
      // The agent itself failed — fall through to the whole-document edit
      // pipeline rather than dropping the user's message on a backend
      // hiccup. That path validates its own output.
      set({ editPhase: "updating" });
      await get().runEdit(text);
      return;
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
    const algorithm = (doc.lanes ?? []).length > 1 ? "swimlane" : "layered";
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
  if (suppressNextAutosave) {
    suppressNextAutosave = false;
    return;
  }
  if (state.doc !== prev.doc && useSettings.getState().prefs.autosave) {
    schedulePersist();
  }
});
