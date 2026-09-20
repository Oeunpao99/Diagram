# Diagram Copilot

Describe a process, get an editable diagram, then keep telling the AI what to change.

The core idea: **the model decides what is in the diagram, deterministic code decides where it goes.** Layout, validation and positioning never touch the LLM, which is why the output comes out readable the first time instead of drifting between generations.

```
prompt → prompt agent → template agent → diagram agent
       → repair → validator → layout engine → React Flow canvas
                                    ↑                │
                                    └──── AI edit ───┘
```

---

## Requirements

| Tool | Version | Why |
| --- | --- | --- |
| Python | 3.11+ | backend |
| uv | latest | Python dependency management |
| Node | 18+ | frontend |
| Docker | any | Postgres, or bring your own |

Install uv if you don't have it:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## First run

```bash
# 1. database
docker compose up -d db

# 2. backend
cd backend
cp .env.example .env          # then put your ANTHROPIC_API_KEY in it
uv sync                       # creates .venv and installs everything
uv run alembic upgrade head   # creates all tables
uv run python -m scripts.seed_templates
uv run uvicorn app.main:app --reload --port 8000

# 3. frontend, in a second terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. API docs are at http://localhost:8000/docs.

If you prefer, `make install && make db && make migrate && make seed` does the same thing, and `make help` lists the rest.

---

## Running on a host where those ports are already taken

Postgres (`5432`) and the API (`8000`) are both overridable so this can run
alongside another stack on the same box without editing any tracked file:

```bash
DIAGRAM_DB_PORT=5434 docker compose up -d db
# backend/.env: DATABASE_URL=postgresql+asyncpg://diagram:diagram@localhost:5434/diagram
cd backend && uv run uvicorn app.main:app --reload --port 8010
cd frontend && API_PORT=8010 npm run dev
```

Or with `make`: `make db DIAGRAM_DB_PORT=5434`, `make api API_PORT=8010`,
`make web API_PORT=8010`. The frontend's own dev port (`5173`) doesn't need
changing unless it's *also* taken — Vite falls back to the next free one on
its own. `backend/.env`'s `DATABASE_URL` is the one thing that always has to
be kept in sync by hand, since Postgres itself has no way to tell the
backend which port Compose published it on.

---

## Environment

`backend/.env`:

```ini
DATABASE_URL=postgresql+asyncpg://diagram:diagram@localhost:5432/diagram
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5              # generation and editing
ANTHROPIC_FAST_MODEL=claude-haiku-4-5-20251001  # prompt improvement, explain
CORS_ORIGINS=http://localhost:5173
```

Only `ANTHROPIC_API_KEY` has no working default.

---

## Migrations

Alembic runs against the async engine and reads the URL from your settings, so `alembic.ini` stays free of credentials.

```bash
uv run alembic upgrade head            # apply
uv run alembic downgrade -1            # roll back one
uv run alembic revision --autogenerate -m "add comments table"
uv run alembic history                 # what exists
uv run alembic current                 # where you are
```

After editing a model in `app/models/`, autogenerate a revision and **read the generated file before applying it** — autogenerate misses renames and server-side default changes.

---

## Dependencies with uv

```bash
uv add httpx                # add a runtime dependency
uv add --dev pytest-cov     # add a dev dependency
uv remove anthropic
uv sync                     # install exactly what uv.lock says
uv lock --upgrade           # refresh the lock file
uv run <anything>           # run inside the venv without activating it
```

Commit `uv.lock`. It is what makes installs reproducible.

---

## Project layout

```
backend/
  app/
    main.py                 FastAPI app, CORS, health
    core/config.py          settings from .env
    db/                     declarative base + async session
    models/diagram.py       projects, diagrams, versions, templates, ai_runs
    schemas/diagram.py      ★ the diagram contract — start here
    layout/engine.py        ★ Sugiyama-style layout, no LLM
    services/
      llm.py                Anthropic wrapper, JSON extraction
      prompts.py            ★ every system prompt, one file
      ai.py                 agent orchestration
      validator.py          ★ the diagram checker
    api/routes/             ai.py, diagrams.py
  alembic/                  async env.py + 0001 initial schema
  scripts/seed_templates.py 6 built-in templates

frontend/
  src/
    api/types.ts            TS mirror of the contract
    api/client.ts           every endpoint
    api/adapter.ts          doc ↔ React Flow
    store/useDiagram.ts     zustand: doc, undo/redo, AI state
    components/
      Canvas.tsx            React Flow surface
      PromptBar.tsx         prompt → improve → generate
      Copilot.tsx           AI edit, checks, documentation
      Toolbar.tsx           layout, undo, save, export
      TemplateRail.tsx      template library
      nodes.tsx             shape renderers
    styles/app.css
```

The four files marked ★ are where you'll spend most of your time.

---

## The contract

Every part of the system speaks one JSON shape, defined once in `backend/app/schemas/diagram.py` and mirrored in `frontend/src/api/types.ts`:

```json
{
  "title": "Import cargo clearance",
  "diagram_type": "swimlane",
  "direction": "LR",
  "lanes": [{ "id": "lane_customs", "label": "Customs", "order": 2 }],
  "nodes": [
    { "id": "inspect", "label": "Customs inspection", "kind": "process", "lane": "lane_customs" }
  ],
  "edges": [{ "id": "e7", "source": "inspect", "target": "cleared", "label": "Yes" }]
}
```

The model is explicitly told never to emit `x`/`y`. Coordinates are added downstream by the layout engine, and stripped again before any edit request. That one rule is what keeps AI edits from resetting positioning you set by hand.

Change the contract in those two files and nowhere else.

---

## API

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/ai/improve-prompt` | rewrite + gaps + type/template recommendation |
| POST | `/api/ai/generate` | full pipeline, optionally saves |
| POST | `/api/ai/edit` | natural-language edit in place |
| POST | `/api/ai/validate` | **no model call** — free, instant |
| POST | `/api/ai/layout` | **no model call** — auto arrange |
| POST | `/api/ai/documentation` | Markdown for internal/customer/developer |
| POST | `/api/ai/explain` | spoken-style walkthrough for demos |
| GET/POST | `/api/diagrams` | list, create |
| GET/PATCH/DELETE | `/api/diagrams/{id}` | PATCH snapshots a version by default |
| GET | `/api/diagrams/{id}/versions` | history |
| POST | `/api/diagrams/{id}/versions/{n}/restore` | restore forward as a new version |
| GET/POST | `/api/projects` | workspace grouping |
| GET | `/api/templates` | template library |

`validate` and `layout` cost nothing, so call them freely — on every drag, every edit, every save.

---

## Layout engine

`app/layout/engine.py`. Pure Python, no dependencies.

1. Break cycles with a DFS so the graph is a DAG
2. Layer by longest path from a source
3. Order within each layer by barycenter, four sweeps — this is what removes crossing connectors
4. Assign coordinates and centre each layer on the cross axis

Swimlane mode replaces steps 3–4: the layer drives the flow axis, the node's lane drives the cross axis, and lane bands are emitted into `meta` for the canvas to draw.

Tuning constants live at the top of the file: `LAYER_GAP`, `NODE_GAP`, `LANE_PADDING`, `LANE_HEADER`.

Tested across all 6 templates × 4 directions × 3 algorithms, plus a fully cyclic graph with no entry point and an empty document.

---

## Diagram checker

`app/services/validator.py`. Three families of rule, no model call:

- **Structural** — duplicate ids, dangling connectors, orphan nodes, self loops, undefined lanes
- **Business** — decisions with one exit, unlabelled branches, missing entry/exit, and approval or verification steps with no rejection path (it follows one hop through a decision node, because that's where the rejection branch actually sits)
- **Visual** — overlapping boxes, connector crossings, labels too long for their shape

Issues marked `fixable` render a **Fix** button in the copilot panel that sends the problem back to the edit agent.

---

## Known gaps

Things deliberately left for later, roughly in the order I'd tackle them:

- **Auth.** There is none. Every diagram is visible to everyone. Add this before anything leaves your network.
- **The three AI endpoints are untested against a live model.** Layout, validation and CRUD are verified. Expect to iterate on `services/prompts.py` for your first week — that's normal, and it's why the prompts sit in one file.
- **PNG/SVG export captures the viewport**, so it exports what's on screen. For very large diagrams, fit the view first.
- **No image upload yet.** The contract has `image_url` on every node and the canvas renders it; the upload endpoint and asset library aren't built.
- **No collaboration, comments, or presentation mode.** These were V2 in your own plan and I kept them there.
- **Mermaid / draw.io export** isn't implemented. The JSON export gives you a clean starting point for a converter.

---

## Common problems

**`connection refused` on port 5432** — Postgres isn't up. `docker compose up -d db`, wait a few seconds.

**`ANTHROPIC_API_KEY is not set`** — you copied `.env.example` but didn't fill in the key, or you're running uvicorn from outside `backend/` so `.env` isn't found.

**Templates rail says nothing loaded** — you skipped `seed_templates`, or the API isn't on port 8000.

**`Model did not return valid JSON`** — the generation prompt drifted. `llm.py` already handles fences and stray prose; if it persists, lower `temperature` in `services/llm.py` or tighten the schema block in `prompts.py`.

**Diagram looks tangled** — press Auto arrange. If it's still bad, the problem is usually a missing edge rather than the layout; run the checker.
