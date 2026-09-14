import type {
  Accent,
  AgentResult,
  DiagramDoc,
  DiagramListItem,
  DiagramOut,
  DiagramType,
  Direction,
  EditResult,
  GenerateResult,
  ImprovedPrompt,
  Project,
  RouteResult,
  Template,
  Theme,
  TokenResponse,
  User,
  ValidationReport,
} from "./types";

const BASE = "/api";
const TOKEN_KEY = "dc.token";

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/* --------------------------------------------------------------------------
   Auth token. Held in a module variable so every request can reach it without
   a React import, and mirrored into localStorage so a refresh stays signed in.
   -------------------------------------------------------------------------- */

let token: string | null = readStoredToken();
let onUnauthorized: (() => void) | null = null;

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // private window, or site data blocked
  }
}

export function setToken(next: string | null) {
  token = next;
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* in-memory only for this tab */
  }
}

export function getToken() {
  return token;
}

/** The auth store registers here so an expired token bounces us to /login. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function headers(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function guard(response: Response) {
  if (response.status === 401) {
    setToken(null);
    onUnauthorized?.();
  }
}

async function post<T>(path: string, body: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await guard(response);
    const detail = await response.text();
    let message = detail;
    try {
      message = JSON.parse(detail).detail ?? detail;
    } catch {
      /* plain text body */
    }
    throw new ApiError(message || response.statusText, response.status);
  }
  return response.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { headers: headers(false) });
  if (!response.ok) {
    await guard(response);
    throw new ApiError(response.statusText, response.status);
  }
  return response.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const response = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: headers(false),
  });
  if (!response.ok) {
    await guard(response);
    throw new ApiError(response.statusText, response.status);
  }
}

export const api = {
  improvePrompt: (prompt: string, diagram_type?: DiagramType) =>
    post<ImprovedPrompt>("/ai/improve-prompt", { prompt, diagram_type }),

  analyzeImage: (imageDataUrl: string, prompt = "") =>
    post<ImprovedPrompt>("/ai/analyze-image", { image_data_url: imageDataUrl, prompt }),

  generateIcon: (prompt: string) => post<{ svg: string }>("/ai/generate-icon", { prompt }),

  generate: (payload: {
    prompt: string;
    diagram_type?: DiagramType | null;
    template_slug?: string | null;
    direction?: Direction;
    save?: boolean;
  }) => post<GenerateResult>("/ai/generate", { direction: "LR", save: true, ...payload }),

  edit: (
    doc: DiagramDoc,
    instruction: string,
    selection: string[] = [],
    // The model reads the instruction itself and decides — see
    // "needs_relayout" in the backend's edit prompt. Forcing true here would
    // override that on every edit and reflow the whole canvas for a rename.
    relayout = false,
    diagramId?: string | null,
  ) => post<EditResult>("/ai/edit", { doc, instruction, selection, relayout, diagram_id: diagramId }),

  // The copilot chat's front door once a diagram exists: one call answers a
  // question, applies a precise list of tool calls, or falls through to the
  // whole-document edit agent. `selection` is what makes "make these red"
  // resolvable — without it the agent has no idea what "these" means.
  agent: (
    doc: DiagramDoc,
    message: string,
    selection: string[] = [],
    edgeSelection: string[] = [],
    diagramId?: string | null,
  ) =>
    post<AgentResult>("/ai/agent", {
      doc,
      message,
      selection,
      edge_selection: edgeSelection,
      diagram_id: diagramId,
    }),

  // The classify-only half of the above, kept for callers that want the
  // decision without the action.
  routeMessage: (doc: DiagramDoc, message: string) =>
    post<RouteResult>("/ai/route", { doc, message }),

  validate: (doc: DiagramDoc) => post<ValidationReport>("/ai/validate", doc),

  layout: (
    doc: DiagramDoc,
    direction?: Direction,
    algorithm = "layered",
    size?: { width: number; height: number } | null,
  ) =>
    post<DiagramDoc>("/ai/layout", {
      doc,
      direction,
      algorithm,
      ...(size ? { width: size.width, height: size.height } : {}),
    }),

  documentation: (doc: DiagramDoc, audience: "internal" | "customer" | "developer") =>
    post<{ markdown: string }>("/ai/documentation", { doc, audience }),

  explain: (doc: DiagramDoc) => post<{ text: string }>("/ai/explain", doc),

  templates: () => get<Template[]>("/templates"),

  // `keepVersion` is off for autosaves — every node drag shouldn't mint a
  // DiagramVersion snapshot. Doing so just overwrites data in place.
  saveDiagram: (id: string, doc: DiagramDoc, versionLabel?: string, keepVersion = false) =>
    post<DiagramOut>(
      `/diagrams/${id}`,
      { doc, title: doc.title, keep_version: keepVersion, version_label: versionLabel },
      "PATCH",
    ),

  createDiagram: (doc: DiagramDoc, projectId?: string) =>
    post<DiagramOut>("/diagrams", { title: doc.title, doc, project_id: projectId }),

  listDiagrams: (limit = 40, favorite?: boolean, projectId?: string) =>
    get<DiagramListItem[]>(
      `/diagrams?limit=${limit}` +
        (favorite === undefined ? "" : `&favorite=${favorite}`) +
        (projectId === undefined ? "" : `&project_id=${projectId}`),
    ),

  // `doc` stays out of the body entirely (not just falsy) — the backend only
  // skips minting a new DiagramVersion when the `doc` key is absent, and only
  // starring/unstarring shouldn't count as an edit worth a version snapshot.
  setFavorite: (id: string, is_favorite: boolean) =>
    post<DiagramOut>(`/diagrams/${id}`, { is_favorite }, "PATCH"),

  // `project_id: null` explicitly clears it (removes the diagram from its
  // project) — the backend tells "omitted" and "sent as null" apart.
  setProject: (id: string, project_id: string | null) =>
    post<DiagramOut>(`/diagrams/${id}`, { project_id }, "PATCH"),

  getDiagram: (id: string) => get<DiagramOut>(`/diagrams/${id}`),

  listProjects: () => get<Project[]>("/projects"),

  createProject: (name: string, description?: string, color?: string) =>
    post<Project>("/projects", { name, description, color }),

  deleteProject: (id: string) => del(`/projects/${id}`),

  deleteDiagram: (id: string) => del(`/diagrams/${id}`),

  /* --- auth --- */

  register: (email: string, name: string, password: string) =>
    post<TokenResponse>("/auth/register", { email, name, password }),

  login: (email: string, password: string) =>
    post<TokenResponse>("/auth/login", { email, password }),

  me: () => get<User>("/auth/me"),

  updateSettings: (patch: { name?: string; theme?: Theme; accent?: Accent }) =>
    post<User>("/auth/me", patch, "PATCH"),

  changePassword: (current_password: string, new_password: string) =>
    post<void>("/auth/me/password", { current_password, new_password }),
};

export { ApiError };
