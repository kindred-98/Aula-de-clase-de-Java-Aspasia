# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [Fase B] — 2026-09-24

### Hecho

- Backend (comunicación):
  - Chat privado ampliado: student↔student si comparten matrícula activa;
    `GET /messages/directory` por rol (admin→todos, teacher→sus alumnos+
    admins, student→profes+admins+compañeros de clase con `course_ids`).
  - `GET /messages/unread-count` (privados + no leídos por sala de curso,
    `total` calculado en `build_unread_count`).
  - Chat global por curso: tablas `course_messages` y `course_message_reads`
    (migración `b7e2d4f1a9c3`); `GET/POST /courses/{id}/chat`,
    `POST .../chat/read`, `GET /me/course-chats`; miembros 404 si no
    pertenecen; audit `course_chat.sent`.
  - Tests Fase B (`tests/test_messages_phase_b.py`, 5 tests): permisos
    student→student, directorio por rol, unread-count, sala de curso,
    aislamiento de no miembros.
  - ruff + format + mypy + pytest+cov **92 tests, 85%**.
- Frontend modular `features/messages/` (1 responsabilidad por archivo):
  - `/messages` accesible a todos los roles: pestañas Privado y Por curso.
  - Privado: conversaciones, directorio messageable, hilo, composer.
  - Curso: lista de salas (`/me/course-chats`), hilo con no leídos, composer.
  - Badge de no leídos en la nav (`useUnreadCount`, polling 20 s).
  - `features/admin/messages/` eliminado; `/admin/messages` redirige a
    `/messages`; AdminLayout y QuickActions actualizados.
  - Tipos nuevos en `lib/api.ts` (directory, unread, course chat).
  - Tests `MessagesPhaseB.test.tsx` (4); lint/format/typecheck/build
    **22 tests frontend** en verde.
- Migración local: `alembic upgrade head` → `b7e2d4f1a9c3`.

### Pendiente / limitaciones

- Notificaciones in-app (campana) y anuncios globales del centro: aún en
  Fase B roadmap (pendientes 6 y 8).
- Chat sin WebSocket (polling 8–20 s con TanStack Query).

## [Fase A] — 2026-09-24

### Hecho

- Backend:
  - Chat 1:1: tabla `messages` (migración `a1f3c9d2e8b4`), rutas
    `/messages/conversations`, `/messages/{user_id}`, `POST /messages`,
    `POST /messages/{id}/read`; permisos admin→cualquiera, teacher↔curso,
    student↔staff de sus cursos.
  - Admin: `POST /admin/users` (alta con `temporary_secret` una sola vez),
    `PATCH /admin/users/{id}`, `POST .../reset-password`, dashboard
    `GET /admin/dashboard` (KPIs + actividad reciente), observador
    `GET /admin/observer/submissions|evaluations`.
  - Perfil: `PATCH /auth/me` (nombre/email, 409 email duplicado).
  - `list_conversations` en Python puro (compatible SQLite sin `least`).
  - Tests Fase A (`tests/test_admin_phase_a.py`); ruff + mypy + pytest+cov
    **87 tests, 84.98%**.
- Frontend (estructura modular, 1 responsabilidad por archivo):
  - `features/admin/AdminLayout.tsx` + rutas anidadas en `app/routes.tsx`
    (dashboard, cursos, detalle de curso, usuarios, mensajes, observador,
    auditoría, import CSV, herramientas).
  - Dashboard: KPIs, acciones rápidas, entregas y auditoría recientes.
  - Cursos: crear/editar, matrículas, profesorado, enlace a observador.
  - Usuarios: alta con banner de secreto temporal, filtros, activar/desactivar,
    reset PIN/contraseña, borrado RGPD.
  - Mensajes: lista de conversaciones, hilo de chat con no leídos, escritura.
  - Observador: entregas + notas con filtros de curso/estado/alumno.
  - Import CSV: por curso (`name[,email][,username]`) con PINs en lote.
  - Herramientas: clonar curso, export CSV de notas, métricas por curso.
  - Mi cuenta (`/account`): perfil + cambio de contraseña
    (`PATCH /auth/change-credentials`); Privacidad solo RGPD (clonar/CSV
    movidos a Herramientas).
  - Nav: Mi cuenta, Mensajes (admin), Admin.
  - Tipos nuevos en `lib/api.ts`; `AuthContext.refreshUser`.
  - Tests: `AdminPhaseA.test.tsx` (3) + privacidad actualizada;
    **18 tests**, lint/format/typecheck/build en verde.

### Pendiente / limitaciones

- Smoke en vivo de la UI admin en el navegador del usuario (la app ya corre
  en local).
- Mensajes no usan WebSocket (polling 8–15 s con TanStack Query).

## [Fase 3] — 2026-09-24

### Hecho

- Backend:
  - Rúbricas: tabla `rubrics` + `assignments.rubric_id` (migración
    `c4f1a90e2b7d`, FK `SET NULL`, `batch_alter_table` compatible SQLite);
    CRUD `/courses/{id}/rubrics` con auditoría `rubric.*` y validación de
    curso al enlazar tareas.
  - Asistencia: `GET/PUT /courses/{id}/attendance` (upsert por día),
    `GET .../attendance/summary`; solo staff del curso; 404 si el alumno no
    está matriculado.
  - Calendario: `GET /courses/{id}/calendar` (tareas con `due_at` + anuncios
    ordenados); requiere matrícula.
  - Clonar curso (admin): `POST /courses/{id}/clone` copia seats, profesores,
    secciones, rúbricas, tareas y 20 anuncios (no enrollments/submissions);
    409 si `code` duplicado.
  - Export CSV: `GET /courses/{id}/export/grades.csv` (staff) con
    `Content-Disposition: attachment`.
  - Metadatos GitHub: `GET /submissions/{id}/github-meta` con caché en memoria
    TTL 300 s, timeout 3 s, degradación sin 500 si falla la API.
  - RGPD: `GET /me/export` (datos personales + entregas + evaluaciones +
    asistencia); `DELETE /me/data` (estudiante se autoanonimiza);
    `DELETE /admin/users/{id}/data` (admin, no a sí mismo → 400).
  - Tests: suite Fase 3 (`tests/test_phase3.py`) + `test_models` actualizado
    con tabla `rubrics`; ruff + mypy + pytest+cov en verde; `alembic upgrade
    head` verificado sobre SQLite.
- Frontend (Fase 3):
  - Tipos API nuevos (`RubricPublic`, `Attendance*`, `CalendarEvent`,
    `GithubMetaResponse`, `RgpdExportResponse`, `apiDownload` con `PUT`).
  - Asistencia (`/courses/:id/attendance`): pasada de lista por asiento con
    estados (presente/tarde/ausente/justificada), acciones masivas y resumen
    por estudiante.
  - Calendario (`/courses/:id/calendar`): eventos de tareas y anuncios con
    enlace a la tarea.
  - Rúbricas (`/courses/:id/rubrics`): CRUD con criterios (id, label, max) y
    confirmación de borrado.
  - Evaluación: selector de rúbrica + puntuación por criterio; panel de
    metadatos GitHub (`GithubMetaPanel`) degradable.
  - Cuenta y privacidad (`/account/privacy`): exportar datos RGPD en JSON,
    borrar datos con confirmación; admin: exportar notas CSV y clonar curso.
  - Nav: enlace Privacidad; aula: enlaces a Calendario, Asistencia y Rúbricas.
  - `Toast`/`ConfirmDialog` con `aria-live` y `role=alertdialog`; `ToastViewport`
    montado en `App`.
  - Tests: 17 (asistencia, calendario, rúbricas, privacidad, más la suite
    Fase 1–2); lint/format/typecheck/build en verde.
- Verificación local:
  - Backend: ruff, mypy, pytest+cov; `alembic upgrade head` SQLite
    (`3a38236975b6` → `2b87aadf33ae` → `c4f1a90e2b7d`).
  - Frontend: eslint, prettier, tsc, vitest (17), vite build.
  - TestClient: `GET /health` y `/api/v1/health` → 200.
  - Smoke en vivo sobre `demo_phase3.db` (seed + admin + migraciones):
    **27/27 checks OK** (login staff/estudiante, rúbricas, asistencia, CSV,
    clonar, RGPD, calendario, GitHub meta, cambios de PIN, aislamiento 403).

### Pendiente / limitaciones

- Docker/PostgreSQL no disponibles en esta máquina (CI + compose); el arranque
  en vivo de uvicorn+vite se validó con TestClient (sandbox no mantiene
  procesos en segundo plano).
- Metadatos GitHub reales dependen de red; en tests se cubre el parser y la
  degradación.
- Métricas de tasa de entrega avanzadas y UX/a11y finos pueden ampliarse en
  iteraciones futuras.

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
