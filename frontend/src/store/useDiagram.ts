import { create } from "zustand";

import { api } from "../api/client";
import {
  emptyDoc,
  normalizeDoc,
  type DiagramDoc,
  type Direction,
  type ImprovedPrompt,
  type ValidationReport,
} from "../api/types";
import { useSettings } from "./useSettings";

type Busy =
  | null
  | "improving"
  | "generating"
  | "editing"
  | "laying-out"
  | "documenting"
  | "analyzing";

interface DiagramState {
  doc: DiagramDoc;
  diagramId: string | null;
  validation: ValidationReport | null;
  improved: ImprovedPrompt | null;
  changeLog: string[];
  selection: string[];
  edgeSelection: string[];
  busy: Busy;
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
  /** Detach from the current diagram so the next edit starts a fresh record. */
  beginNew: () => void;
  bumpSaved: () => void;

  improvePrompt: (prompt: string) => Promise<void>;
  analyzeImage: (imageDataUrl: string, prompt?: string) => Promise<void>;
  dismissImproved: () => void;
  generate: (prompt: string, templateSlug?: string | null) => Promise<void>;
  runEdit: (instruction: string) => Promise<void>;
  autoLayout: (direction?: Direction) => Promise<void>;
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
      const created = await api.createDiagram(doc);
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

export const useDiagram = create<DiagramState>((set, get) => ({
  doc: emptyDoc(),
  diagramId: null,
  validation: null,
  improved: null,
  changeLog: [],
  selection: [],
  edgeSelection: [],
  busy: null,
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

  beginNew: () => {
    writeStoredDiagramId(null);
    set({
      diagramId: null,
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
    set({ busy: "editing", error: null });
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
      set({ busy: null });
    }
  },

  autoLayout: async (direction) => {
    const { doc } = get();
    const algorithm = (doc.lanes ?? []).length > 1 ? "swimlane" : "layered";
    set({ busy: "laying-out", error: null });
    try {
      const next = await api.layout(doc, direction ?? doc.direction, algorithm);
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
