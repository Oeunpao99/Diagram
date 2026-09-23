import type {
  Accent,
  AgentResult,
  AgentStreamEvent,
  ChatMessage,
  ChatTurn,
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

/** FastAPI's error body is `{"detail": ...}`, but `detail` isn't always a
 *  string — a Pydantic validation failure (422) sends a *list* of
 *  `{loc, msg, type}` objects instead. Handing that straight to `Error()`
 *  stringifies each object as "[object Object]" rather than the actual
 *  message, so this pulls the real text out of either shape. */
function parseErrorDetail(text: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text; // plain text body
  }
  const detail = (parsed as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : null))
      .filter((msg): msg is string => !!msg);
    if (messages.length > 0) return messages.join("; ");
  }
  return text;
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

/** Nothing on the wire guarantees a reply ever comes — a body the proxy
 *  refuses mid-upload, or a connection that stalls, leaves `fetch` pending
 *  indefinitely, and every caller here parks its spinner on that promise.
 *  A deadline turns "the panel spinning forever" into a dismissable error.
 *  Generous, because the AI routes really do run for a minute or two. */
const REQUEST_TIMEOUT_MS = 180_000;

/** `AbortSignal.timeout` aborts with a DOMException whose message is about
 *  signals, not about what the user did — swap in something a person can
 *  act on. */
function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  return run(AbortSignal.timeout(REQUEST_TIMEOUT_MS)).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError("That took too long and was cancelled — try again.", 0);
    }
    throw error;
  });
}

async function post<T>(path: string, body: unknown, method = "POST"): Promise<T> {
  const response = await withTimeout((signal) =>
    fetch(`${BASE}${path}`, {
      method,
      headers: headers(),
      body: JSON.stringify(body),
      signal,
    }),
  );
  if (!response.ok) {
    await guard(response);
    const detail = await response.text();
    throw new ApiError(parseErrorDetail(detail) || response.statusText, response.status);
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

/** The streaming form of `agent` — the backend pushes a `pending`/`step` event
 *  per real tool call over Server-Sent Events, then a single `result` event
 *  with the same AgentResult a one-shot call returns. `onEvent` fires for
 *  every event as it arrives so the chat can narrate the run live. */
async function streamAgent(
  doc: DiagramDoc,
  message: string,
  selection: string[],
  edgeSelection: string[],
  diagramId: string | null | undefined,
  history: ChatTurn[],
  onEvent: ((event: AgentStreamEvent) => void) | undefined,
): Promise<AgentResult> {
  const response = await fetch(`${BASE}/ai/agent/stream`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      doc,
      message,
      selection,
      edge_selection: edgeSelection,
      diagram_id: diagramId,
      history,
    }),
  });
  if (!response.ok) {
    await guard(response);
    const detail = await response.text();
    throw new ApiError(parseErrorDetail(detail) || response.statusText, response.status);
  }
  if (!response.body) throw new ApiError("This browser doesn't support streaming.", 0);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AgentResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let sep: number;
    // Every SSE event ends in a blank line (`\n\n`), and each `data:` payload
    // is one line of JSON — json.dumps on the server keeps it that way.
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      const event = JSON.parse(dataLine.slice(6)) as AgentStreamEvent;
      if (event.type === "result") result = event.result;
      onEvent?.(event);
    }
    if (done) break;
  }

  if (!result) throw new ApiError("The agent returned no result.", 502);
  return result;
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

  // Reorganizes the diagram to follow a template's structure while keeping
  // its own content — distinct from just loading a template's static
  // example (which is a plain client-side doc swap, see TemplateRail.tsx).
  restyleTemplate: (doc: DiagramDoc, templateSlug: string, diagramId?: string | null) =>
    post<EditResult>("/ai/restyle-template", {
      doc,
      template_slug: templateSlug,
      diagram_id: diagramId,
    }),

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
    history: ChatTurn[] = [],
  ) =>
    post<AgentResult>("/ai/agent", {
      doc,
      message,
      selection,
      edge_selection: edgeSelection,
      diagram_id: diagramId,
      history,
    }),

  // Streaming twin of `agent` — same body, same result, but progress events
  // arrive first so the chat can show the run live. Stays as the copilot's
  // primary call; `agent` above is the fallback if streaming fails.
  agentStream: (
    doc: DiagramDoc,
    message: string,
    selection: string[] = [],
    edgeSelection: string[] = [],
    diagramId?: string | null,
    history: ChatTurn[] = [],
    onEvent?: (event: AgentStreamEvent) => void,
  ) => streamAgent(doc, message, selection, edgeSelection, diagramId, history, onEvent),

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

  // The Copilot thread attached to a diagram — see useDiagram.ts's
  // `messages`. list/add mirror getDiagram/saveDiagram's shape; clear is
  // what /new calls.
  listMessages: (diagramId: string) => get<ChatMessage[]>(`/diagrams/${diagramId}/messages`),

  addMessage: (
    diagramId: string,
    message: { role: "user" | "ai"; text: string; image?: string | null; changes?: string[]; warnings?: string[] },
  ) => post<ChatMessage>(`/diagrams/${diagramId}/messages`, message),

  clearMessages: (diagramId: string) => del(`/diagrams/${diagramId}/messages`),

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

  /* Google/GitHub: `code` is the redirect callback's query param, exchanged
   * server-side for the user's profile — `redirect_uri` must be the exact
   * URL the browser was actually sent to, since both providers check it
   * against the code themselves. */
  loginGoogle: (code: string, redirectUri: string) =>
    post<TokenResponse>("/auth/google", { code, redirect_uri: redirectUri }),

  loginGithub: (code: string, redirectUri: string) =>
    post<TokenResponse>("/auth/github", { code, redirect_uri: redirectUri }),

  me: () => get<User>("/auth/me"),

  updateSettings: (patch: { name?: string; theme?: Theme; accent?: Accent }) =>
    post<User>("/auth/me", patch, "PATCH"),

  changePassword: (current_password: string, new_password: string) =>
    post<void>("/auth/me/password", { current_password, new_password }),
};

export { ApiError };
