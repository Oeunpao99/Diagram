import type {
  Accent,
  DiagramDoc,
  DiagramType,
  Direction,
  EditResult,
  GenerateResult,
  ImprovedPrompt,
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

export const api = {
  improvePrompt: (prompt: string, diagram_type?: DiagramType) =>
    post<ImprovedPrompt>("/ai/improve-prompt", { prompt, diagram_type }),

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

  validate: (doc: DiagramDoc) => post<ValidationReport>("/ai/validate", doc),

  layout: (doc: DiagramDoc, direction?: Direction, algorithm = "layered") =>
    post<DiagramDoc>("/ai/layout", { doc, direction, algorithm }),

  documentation: (doc: DiagramDoc, audience: "internal" | "customer" | "developer") =>
    post<{ markdown: string }>("/ai/documentation", { doc, audience }),

  explain: (doc: DiagramDoc) => post<{ text: string }>("/ai/explain", doc),

  templates: () => get<Template[]>("/templates"),

  saveDiagram: (id: string, doc: DiagramDoc, versionLabel?: string) =>
    post<unknown>(
      `/diagrams/${id}`,
      { doc, title: doc.title, version_label: versionLabel },
      "PATCH",
    ),

  createDiagram: (doc: DiagramDoc) =>
    post<{ id: string }>("/diagrams", { title: doc.title, doc }),

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
