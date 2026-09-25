# Trabajo realizado en Admin — Roadmap A–D completado

Fuente original del roadmap: este mismo archivo (sección final "Roadmap de
origen"). Documenta lo entregado fase a fase, con verificación y pendientes.

**Documentación relacionada**: plan [PLAN_ADMIN.md](../PLAN/PLAN_ADMIN.md) ·
[CHANGELOG.md](../../CHANGELOG.md) (entrada `## [Fase A]` … `## [Fase D]`) ·
hermanos [TRABAJO_REALIZADO_EN_PROFESOR.md](TRABAJO_REALIZADO_EN_PROFESOR.md)
y [TRABAJO_REALIZADO_EN_ALUMNO.md](TRABAJO_REALIZADO_EN_ALUMNO.md) ·
[Índice de docs](../Explicacion_de_Cada_ARCHIVO.md).

Resumen de commits en `main`
(`https://github.com/kindred-98/Aula-de-clase-de-Java-Aspasia`):

| Fase | Commit | Contenido |
|------|--------|-----------|
| A | `86d505d` | Gestión de admin con UI (cursos, usuarios, mensajes, observador, RGPD) |
| B | `b7de2d7` | Directorio por roles, chat por curso y badge de no leídos |
| C | `ba65d42` | Dashboard multi-curso, gradebook, ajustes, reportes, calendario, backup |
| D | `26f100a` | Categorías, cohorts, autoenrolamiento, roles personalizados, sesiones y desbloqueo |

Verificación siempre en verde tras cada fase:

- Backend (`backend/`): `ruff check .` → `ruff format --check .` →
  `mypy app` → `pytest -q --cov=app` → **105 tests, 86% cobertura**.
- Frontend (`frontend/`): `npm run lint` → `npm run format` →
  `npm run typecheck` → `npm run test` → `npm run build` →
  **31 tests**.
- Migraciones: `alembic upgrade head` aplicado en local sobre
  `dev.db` (SQLite; CI usa PostgreSQL).

---

## Fase D — Escala (última, 2026-09-24, commit `26f100a`)

Objetivo del roadmap: escalar la plataforma con catálogo de cursos
(items 15–16) y valorar email real (item 17).

### Item 15 — Categorías de cursos, cohorts y autoenrolamiento

**Modelos** (`backend/app/models/scale.py`, migración
`d9a4b5c6e7f8_add_scale_phase_d.py`):

- `CourseCategory`: nombre + slug único; contador de cursos derivado.
- `Cohort`: nombre + código + FK opcional a categoría.
- `CohortMembership`: un alumno por cohort (único compuesto
  `cohort_id + student_id`).
- FKs nuevas: `Course.category_id`, `Course.cohort_id` y
  `User.custom_role_id` (todas `ON DELETE SET NULL`).
- `test_models.py` actualizado con las 4 tablas nuevas.

**Rutas** (`backend/app/api/v1/routes/phase_d.py`):

- `GET /admin/categories` (lista con `course_count`), `POST`, `PATCH`,
  `DELETE`; lectura pública `GET /categories`.
- `PATCH /admin/courses/{id}/taxonomy`: asigna categoría/cohort a un
  curso.
- CRUD `/admin/cohorts` + miembros: `POST` (alta individual, idempotente),
  `POST .../bulk` (alta masiva), `DELETE .../members/{student_id}`;
  `GET /admin/cohorts/{id}` devuelve la lista de miembros.
- `POST /courses/{id}/auto-enroll` (solo staff del curso): matricula a
  todos los estudiantes del cohort asignado al curso que tengan hueco
  libre (respeta `layout_rows × layout_cols`). Devuelve
  `{enrolled, skipped, reasons}` con motivos:
  `no_cohort` (curso sin cohort), `empty_cohort`,
  `no_free_seats`, `already_enrolled`. Auditoría `course.auto_enrolled`.

### Item 16 — Roles personalizados, sesiones activas y desbloqueo

**Permisos** (`backend/app/schemas/scale.py` → `KNOWN_PERMISSIONS`):

`reports.view`, `settings.manage`, `backup.export`, `gradebook.view`,
`courses.manage`, `users.manage`.

**Control de acceso** (`backend/app/security/policies.py`):

- `user_permissions(user)`: admin → todos los permisos; el resto → los
  de su `CustomRole` (vacío si no tiene rol).
- `require_permission(perm)`: dependency factory para endpoints.
  Conectado con lo ya hecho en Fase C:
  - `GET/PUT /admin/settings` exige `settings.manage`.
  - `GET /admin/reports/overview[.csv]` exige `reports.view`.
  - Así un profe sin rol sigue recibiendo 403 (tests Fase C intactos) y
    con un rol otorgado el permiso pasa a 200.

**Rutas:**

- CRUD `/admin/roles`: nombre + lista de permisos; permiso desconocido →
  422. Cada rol expone `assigned_count`.
- `POST /admin/users/{id}/custom-role`: asigna/quita rol
  (`custom_role_id = null` para quitar).
- `GET /admin/permissions` (catálogo + efectivos) y
  `GET /auth/permissions` (los del usuario autenticado).
- `GET /admin/sessions`: refresh tokens vivos (sesión, creada, expira,
  usuario). `POST /admin/sessions/revoke`: revoca todas las sesiones de
  un usuario; auditoría `sessions.revoked`.
- `POST /admin/users/{id}/unlock`: elimina los eventos
  `auth.login_failed` del audit (por email, username o nombre) para
  permitir reintentar el login; auditoría `user.unlocked`.

**Frontend** (`frontend/src/features/scale/`, 1 responsabilidad por
archivo):

- `/admin/categories` (`CategoriesPage.tsx`): crear/listar/borrar
  categorías con contador de cursos.
- `/admin/cohorts` (`CohortsPage.tsx`): CRUD de cohorts + despliegue de
  miembros con alta/baja individual y masiva.
- `/admin/roles` (`RolesPage.tsx`): crear roles con checkboxes de
  permisos y asignación a usuarios.
- `/admin/sessions` (`SessionsPage.tsx`): tabla de sesiones activas +
  acciones de cuenta (revocar sesiones / desbloquear cuenta).
- `CourseTaxonomyPanel.tsx`: montado en el detalle de curso admin
  (`AdminCourseDetailPage.tsx`); asigna categoría/cohort y ejecuta el
  autoenrolamiento con feedback de motivos.
- Nav en `AdminLayout.tsx`: Categorías, Cohorts, Roles, Sesiones.
- Tipos nuevos en `lib/api.ts`: `CategoryPublic`, `CohortPublic`,
  `CohortMemberPublic`, `CohortDetail`, `CustomRolePublic`,
  `PermissionCatalog`, `ActiveSessionPublic`, `AutoEnrollResult`,
  `CourseTaxonomyPublic`; `CoursePublic` ahora expone
  `category_id`/`cohort_id`.
- Tests `ScalePhaseD.test.tsx` (4): crear categoría, cohorts con
  miembros, crear rol con permisos, sesiones + acciones de cuenta.

**Tests backend** (`tests/test_phase_d.py`, 7): CRUD de categorías y
taxonomy, cohorts + miembros + autoenrolamiento (con huecos y lleno),
rutas solo-admin, gating de reportes por permiso personalizado
(403 → 200 con rol → 403 al quitarlo), sesiones y desbloqueo.

### Item 17 — Email real: descartado por diseño

El roadmap lo marca como opcional y hoy la plataforma es 100% in-app
(mensajes, anuncios, calendario). No se implementa envío SMTP; queda
documentado en [CHANGELOG.md](../../CHANGELOG.md).

### Verificación Fase D

- Backend: ruff + format + mypy (57 archivos, 0 errores) +
  **105 tests, 86%**.
- Frontend: lint + format + typecheck + **31 tests** + build OK.
- Migración `d9a4b5c6e7f8` aplicada en local (`alembic upgrade head`).

---

## Fase C — Profesional LMS (commit `ba65d42`)

- Backend: dashboard multi-curso (`GET /admin/dashboard/multi`),
  gradebook matriz (`GET /courses/{id}/gradebook`), ajustes del centro
  (tabla `system_settings`, migración `c8f5e1a2b3d4`,
  `GET/PUT /admin/settings` con audit `settings.updated`), reportes
  (`GET /admin/reports/overview` + `.csv`), calendario institucional
  (`GET /calendar/institutional`) y backup de curso
  (`GET /courses/{id}/backup`, audit `course.backup`).
- Frontend `features/phasec/`: `/admin/multi`, `/admin/reports`,
  `/admin/settings`, `/courses/:id/gradebook`, `/calendar`,
  `CourseBackupButton`.
- Tests: `test_phase_c.py` (6) + `PhaseC.test.tsx` (5) → 98 backend /
  27 frontend en verde en su momento.

## Fase B — Comunicación (commit `b7de2d7`)

- Backend: chat privado ampliado (student↔student con matrícula común),
  `GET /messages/directory` por rol, `GET /messages/unread-count`,
  chat por curso (`course_messages` + `course_message_reads`,
  migración `b7e2d4f1a9c3`): `GET/POST /courses/{id}/chat`,
  `POST .../chat/read`, `GET /me/course-chats`, audit
  `course_chat.sent`.
- Frontend `features/messages/`: pestañas Privado y Por curso, directorio
  messageable, badge de no leídos en la nav (polling 20 s).
- Tests: 92 backend / 22 frontend en su momento.

## Fase A — Admin con UI (commit `86d505d`)

- Backend: chat 1:1 (`messages`, migración `a1f3c9d2e8b4`),
  `POST /admin/users` con secreto temporal, reset de contraseña,
  dashboard admin, observador de entregas/notas, `PATCH /auth/me`.
- Frontend: `AdminLayout` + rutas anidadas (dashboard, cursos, detalle
  de curso, usuarios, mensajes, observador, auditoría, import CSV,
  herramientas), Mi cuenta, privacidad RGPD.
- Tests: 87 backend / 18 frontend en su momento.

---

## Pendientes conocidos (roadmap B/D)

- Fase B: notificaciones in-app (campana) y anuncios globales del centro.
- Ajustes de sesión (expiración configurable, MFA) fuera de alcance.
- Chat/mensajes sin WebSocket (polling con TanStack Query).
- Backup JSON sin archivos binarios de entregas (solo metadatos y notas).

---

## Roadmap de origen (texto original del archivo)

```
3. Módulos prioritarios (orden de impacto)

Fase A — Cerrar lo que ya hay API sin UI (máximo valor, poco esfuerzo)

Crear curso (nombre, código, 3×5, clone opcional)
Gestión de curso: editar, archivar, asignar/quitar profe, matrículas, asientos
Mover clonar + notas CSV a /admin (quitar de Privacidad)
Crear usuario (admin/teacher) + reset contraseña staff
Borrar datos RGPD desde ficha de usuario

Fase B — Comunicación (el "por qué" de la app)
1. Notificaciones in-app (campana: evaluación, anuncio, fecha límite, PIN reset)
2. Mensajería ligera o hilo por curso (admin ↔ profe ↔ student con límites)
3. Anuncios globales del centro + por curso (ya parcial)

Fase C — Profesional LMS
9. Dashboard con métricas agregadas multi-curso
10. Gradebook matriz
11. Settings (mi perfil, contraseña, nombre centro, políticas)
12. Reportes + export
13. Calendario institucional
14. Backup/export curso

Fase D — Escala
15. Categorías de cursos, cohorts, autoenrolamiento
16. Roles personalizados, sesiones activas, desbloqueo
17. Email real (opcional; hoy todo in-app es más simple)
```
