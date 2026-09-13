.PHONY: help db api web install migrate revision seed reset fmt

help:
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install:  ## install backend + frontend dependencies
	cd backend && uv sync
	cd frontend && npm install

db:       ## start postgres
	docker compose up -d db

migrate:  ## apply migrations
	cd backend && uv run alembic upgrade head

revision: ## new migration from model changes: make revision m="add x"
	cd backend && uv run alembic revision --autogenerate -m "$(m)"

seed:     ## load the built-in template library
	cd backend && uv run python -m scripts.seed_templates

api:      ## run the API on :8000
	cd backend && uv run uvicorn app.main:app --reload --port 8000

web:      ## run the web app on :5173
	cd frontend && npm run dev

reset:    ## drop the database and rebuild it from scratch
	docker compose down -v && docker compose up -d db
	@sleep 4
	$(MAKE) migrate seed

fmt:      ## format and lint the backend
	cd backend && uv run ruff format . && uv run ruff check --fix .
