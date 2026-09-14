import { create } from "zustand";

import { api } from "../api/client";
import {
  emptyDoc,
  type DiagramDoc,
  type Direction,
  type ImprovedPrompt,
  type ValidationReport,
} from "../api/types";

type Busy = null | "improving" | "generating" | "editing" | "laying-out" | "documenting";

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

  setDoc: (doc: DiagramDoc, options?: { silent?: boolean }) => void;
  setSelection: (ids: string[]) => void;
  setEdgeSelection: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  clearError: () => void;

  improvePrompt: (prompt: string) => Promise<void>;
  dismissImproved: () => void;
  generate: (prompt: string, templateSlug?: string | null) => Promise<void>;
  runEdit: (instruction: string) => Promise<void>;
  autoLayout: (direction?: Direction) => Promise<void>;
  revalidate: () => Promise<void>;
}

const HISTORY_LIMIT = 50;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
      const result = await api.edit(doc, instruction, selection);
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
