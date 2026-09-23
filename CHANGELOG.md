# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [Fase 0] — 2026-09-23

### Hecho

- `PLAN.md` con esquema de datos completo, matriz de permisos, estructura de
  carpetas y decisiones (D1–D14).
- Estructura del monorepo: `backend/` (FastAPI) + `frontend/` (React/Vite) +
  infraestructura raíz.
- Backend:
  - App FastAPI con CORS, headers de seguridad, logging JSON y `/health`
    (+ alias bajo `/api/v1/health`).
  - Configuración con pydantic-settings y `.env.example`.
  - Modelos SQLAlchemy 2.x de todo el dominio (users, courses, seats,
    enrollments, sections, assignments, submissions, files, evaluations,
    announcements, attendance, audit_logs, refresh_tokens).
  - Alembic: migración inicial `3a38236975b6` (14 tablas, índices y
    únicas).
  - Seguridad base: argon2 (`hash_secret`/`verify_secret`), JWT access,
    valor de refresh token.
  - Tests: 20 tests (sistemas, modelos/integridad, seguridad) con
    cobertura **92 %** (mínimo exigido 80 %).
  - `ruff check`, `ruff format --check` y `mypy --strict` en verde.
- Frontend:
  - Vite 7 + React 19 + TypeScript 5.9 + Tailwind 4 + React Router 7 +
    TanStack Query 5.
  - Design tokens (claro/oscuro), layout base, estados Loading/Empty/Error,
    página de inicio que consulta la salud de la API.
  - ESLint flat + Prettier + Vitest (3 tests en verde) + `tsc -b` + build.
- Infra:
  - `docker-compose.yml` (postgres 17, api, frontend nginx).
  - Dockerfiles backend (python:3.12-slim) y frontend (multi-stage nginx).
  - GitHub Actions: lint + tests backend (con PostgreSQL y `alembic upgrade`),
    lint + tests + build frontend, validación de compose.
  - `Makefile`, `.pre-commit-config.yaml`, `.gitignore`, `.env.example`.

### Probado

- `pytest --cov=app --cov-fail-under=80` → 20 passed, 92.27 %.
- `ruff check .` / `ruff format --check .` / `mypy app` → OK.
- `alembic upgrade head` sobre SQLite local (CI lo hace sobre PostgreSQL).
- `npm run lint`, `format:check`, `typecheck`, `test`, `build` → OK.
- Arranque de uvicorn + `GET /health` → 200 (verificación local).

### Pendiente / limitaciones del entorno

- **Docker no está instalado** en la máquina de desarrollo: el compose no se
  pudo levantar aquí; se valida en CI (`docker compose config`) y deberá
  verificarse manualmente en una máquina con Docker (Fase 1).
- Local solo tiene **Python 3.14**: el objetivo oficial sigue siendo 3.12
  (Docker/CI). Ver PLAN.md D1/D2.
- Seed demo, primer admin y endpoints de auth/cursos: **Fase 1**.
