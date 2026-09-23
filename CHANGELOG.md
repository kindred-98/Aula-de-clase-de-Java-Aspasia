# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [Fase 2] — 2026-09-23

### Hecho

- Backend:
  - Secciones de curso: CRUD (`/courses/{id}/sections`), slug único por curso
    (409), `kind` content|external, Markdown y URL externa.
  - Anuncios: CRUD (`/courses/{id}/announcements`) con autor y auditoría.
  - Tareas: `GET/PATCH/DELETE /assignments/{id}`, `due_at`, `max_score`,
    `visibility` (private|class), reentrega con `version` en submissions.
  - Panel admin (`/admin/*`, solo `require_admin`):
    - Listado/búsqueda de usuarios con filtro por rol.
    - Activar/desactivar cuentas (audit `user.status_changed`).
    - Reset de PIN de estudiante (PIN de 6 dígitos, se devuelve una sola vez,
      audit `pin.reset` sin PIN en claro).
    - Importación CSV de estudiantes por curso (`name[,email][,username]`),
      PINs generados en lote, matrícula automática, audit
      `students.imported`.
    - AuditLog con filtros por `action`, `course_id`, `actor_id`.
    - Métricas por curso: matrículas y entregas por estado.
  - `GET /auth/me` → `UserPublic` (rol para UI admin/staff).
  - Tests: 68 tests, cobertura **87 %** (mínimo 80 %); ruff + mypy en verde.
- Frontend (Fase 2):
  - `Markdown` seguro (sin HTML del usuario): títulos, listas, negrita,
    cursiva, código inline y bloques, enlaces http(s).
  - Contenido del curso (`/courses/:id/content`): sidebar de secciones,
    vista de sección (content/external) y anuncios; formularios de creación
    para staff.
  - Detalle de tarea (`/courses/:id/work/:assignmentId`): fecha límite,
    visibilidad, máximo, edición (staff) de título/descripción/due_at/
    visibility/max_score.
  - Lista de tareas en WorkPage con enlace al detalle y badge de atrasada.
  - Panel admin (`/admin`): pestañas Usuarios (búsqueda, activar/desactivar,
    reset PIN), Importar CSV, Audit log (filtro action) y Métricas por curso.
  - `AuthContext` carga `/auth/me`; nav muestra enlace Admin solo a admins.
  - Tests: 11 (rutas, login, secciones, detalle tarea, admin) + lint/format/
    typecheck/build en verde.
- Verificación local:
  - `alembic upgrade head` sobre SQLite (`3a38236975b6` → `2b87aadf33ae`).
  - TestClient: `GET /health` y `/api/v1/health` → 200.
  - Backend: ruff, mypy, pytest+cov 87 %. Frontend: eslint, prettier, tsc,
    vitest (11), vite build.

### Pendiente / limitaciones

- Docker/PostgreSQL no disponibles en esta máquina (CI + compose).
- Asistencia, calendario, GitHub metadata, clonar cursos, export CSV y
  rúbricas: Fase 3.
- Código de secciones/temas del curso en menú lateral ampliable (hoy
  Contenido desde el aula).

## [Fase 1] — 2026-09-23

### Hecho

- Backend:
  - Auth completa: login estudiante (course_code + identifier + PIN), login
    staff (email + password), refresh con rotación, logout, cambio obligatorio
    de credenciales (`must_change_credentials`).
  - Rate-limit de login fallido (5 intentos / 15 min → 429) vía `audit_logs`.
  - Políticas de permisos centralizadas en `app/security/policies.py`
    (admin / teacher-of-course / enrolled / peer visibility).
  - Cursos: CRUD, seats, matrículas, asignación de profesorado, vista de aula
    (classroom grid con estado de entrega por asiento).
  - Trabajo académico: assignments, submissions (draft/submit), archivos
    (validación extensión + magic bytes), evaluaciones (historial append-only).
  - Storage local con API abstracta (preparada S3).
  - Migración `2b87aadf33ae` (añade `users.username`).
  - Scripts: `seed_demo` (curso JAVA 3×5, 15 estudiantes con PIN, profe) y
    `create_admin`.
  - Tests: 57 tests, cobertura **86 %** (mínimo 80 %); ruff + mypy en verde.
- Frontend (Fase 1):
  - Contexto de sesión (access token en localStorage, refresh cookie).
  - Login (estudiante / personal), cambio de credenciales obligatorio.
  - Lista de cursos, vista de aula (cuadrícula con estados de entrega),
    workspace de estudiante (entregas + GitHub + archivos) y vista de
    evaluación de la profesora.
  - Rutas protegidas (`RequireAuth` + redirect a `/change-credentials`).
  - Tests: 7 (rutas, login success/error) + lint/format/typecheck/build.
- Verificación local:
  - `alembic upgrade head` sobre SQLite.
  - uvicorn + `GET /health` → 200; login staff + `GET /courses` → 200.
  - `seed_demo` + `create_admin` ejecutados sobre SQLite local.

### Pendiente / limitaciones

- Docker/PostgreSQL no disponibles en esta máquina (CI + compose).
- Announcements, attendance y secciones de contenido: Fase 2+.

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
