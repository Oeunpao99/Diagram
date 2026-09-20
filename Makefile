.PHONY: help db api web install migrate revision seed reset fmt

# Overridable, e.g. `make db DIAGRAM_DB_PORT=5434` / `make api API_PORT=8010`
# on a box where the defaults are already taken by something else.
DIAGRAM_DB_PORT ?= 5432
API_PORT ?= 8000

help:
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install:  ## install backend + frontend dependencies
	cd backend && uv sync
	cd frontend && npm install

db:       ## start postgres
	DIAGRAM_DB_PORT=$(DIAGRAM_DB_PORT) docker compose up -d db

migrate:  ## apply migrations
	cd backend && uv run alembic upgrade head

revision: ## new migration from model changes: make revision m="add x"
	cd backend && uv run alembic revision --autogenerate -m "$(m)"

seed:     ## load the built-in template library
	cd backend && uv run python -m scripts.seed_templates

api:      ## run the API on :8000 (override with API_PORT=...)
	cd backend && uv run uvicorn app.main:app --reload --port $(API_PORT)

web:      ## run the web app on :5173 (talks to the API on $(API_PORT))
	cd frontend && API_PORT=$(API_PORT) npm run dev

reset:    ## drop the database and rebuild it from scratch
	DIAGRAM_DB_PORT=$(DIAGRAM_DB_PORT) docker compose down -v
	DIAGRAM_DB_PORT=$(DIAGRAM_DB_PORT) docker compose up -d db
	@sleep 4
	$(MAKE) migrate seed

fmt:      ## format and lint the backend
	cd backend && uv run ruff format . && uv run ruff check --fix .
