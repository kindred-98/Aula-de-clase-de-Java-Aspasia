.PHONY: help install backend-install frontend-install lint lint-backend lint-frontend \
	test test-backend test-frontend migrate upgrade seed up down logs \
	dev-backend dev-frontend ci

help:
	@echo "Comandos: install | lint | test | migrate | up | down | dev-backend | dev-frontend | ci"

install: backend-install frontend-install

backend-install:
	cd backend && python -m pip install -e ".[dev]"

frontend-install:
	cd frontend && npm install

lint: lint-backend lint-frontend

lint-backend:
	cd backend && ruff check . && ruff format --check . && mypy app

lint-frontend:
	cd frontend && npm run lint && npm run format:check

test: test-backend test-frontend

test-backend:
	cd backend && pytest --cov=app --cov-fail-under=80

test-frontend:
	cd frontend && npm run test

migrate:
	cd backend && alembic upgrade head

upgrade: migrate

seed:
	cd backend && python -m scripts.seed_demo

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

dev-backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

ci: lint test
