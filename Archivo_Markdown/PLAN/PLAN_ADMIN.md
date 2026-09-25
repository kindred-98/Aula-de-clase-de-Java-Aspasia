# PLAN — Módulo Admin (Administración)

Documento de plan del **módulo admin** (Fases A–D). Origen: el roadmap
"Módulos prioritarios" del briefing original
(`prompt_Claude_PrimerasFases.md`, sección 3), ejecutado entre el
2026-09-24 (`86d505d`) y `26f100a`. Redactado/dejado por escrito al cierre
para tener el mismo formato que `PLAN_PROFESOR.md` y `PLAN_ALUMNO.md`;
el detalle de lo entregado está en `TRABAJO_REALIZADO_EN_ADMIN.md` y en
`CHANGELOG.md` (entrada `## [Fase A]` … `## [Fase D]`).

- Idioma: documentación en español; código, variables y commits en inglés.
- Backend: Python/FastAPI en `backend/`; frontend: React en `frontend/`.
- Cada fase se entregó con cadena de verificación + `commit + push` a `main`.

---

## 1. Contexto y objetivo

El proyecto nació con las **Fases 0–3** (API + UI básicas: auth, cursos,
entregas, evaluación, rúbricas, asistencia, calendario), pero el rol
admin quedó sin cerrar:

- No existía módulo `/admin`: sin `AdminLayout`, sin rutas anidadas y
  sin UI para crear usuarios, matricular, clonar cursos o auditar.
- Al iniciar sesión, el admin caía en `HomePage` (stub de health-check).
- Backend preexistente aprovechable: CRUD de cursos/asientos/matrículas,
  export CSV, clonar curso, RGPD (`/me/export`, `/me/data`)… pero sin
  dashboard, sin observador y sin el resto de la superficie admin.

El roadmap pedía "cerrar lo que ya hay API sin UI" y luego escalar
(comunicación, LMS profesional, escala).

### Conexiones del rol (requerido por el roadmap)

| Con | Flujo | Estado al empezar |
|-----|-------|-------------------|
| **Teacher** | Admin crea/asigna/quita profes de curso; el teacher solo opera sus cursos (404 si no es suyo) | API parcial / UI ❌ |
| **Student** | Admin crea usuarios, matricula, asigna asientos y PINs; el student solo ve sus matrículas | API parcial / UI ❌ |
| **Admin → sí mismo** | Dashboard, usuarios, import CSV, clonar/exportar, auditoría, reportes, ajustes, escala | ❌ **Objetivo de este plan** |

---

## 2. Decisiones de diseño

- **D-A1 — Módulo `/admin` con layout propio y rutas anidadas.**
  `features/admin/AdminLayout.tsx` + rutas `/admin/*` en `app/routes.tsx`
  (dashboard, cursos, usuarios, mensajes, observador, auditoría, import,
  herramientas). Este es el patrón que después calcaron
  `PLAN_PROFESOR.md` (T0) y `PLAN_ALUMNO.md` (S0).
- **D-A2 — Guard `RequireAdmin`**: solo `admin`; `teacher`/`student` → `/`.
- **D-A3 — Un archivo por responsabilidad**: `features/admin/` (y
  `features/phasec/`, `features/scale/` por fase) con páginas y
  subcomponentes separados; tipos centralizados en `lib/api.ts`.
- **D-A4 — Backend + tests por fase**: cada funcionalidad se entrega con
  endpoint, política de permisos y tests (`pytest --cov`) antes del
  push; frontend con lint/format/typecheck/test/build en verde.
- **D-A5 — Auditoría en acciones sensibles**: `services/audit.py`
  registra altas, resets, clonados, backups, autoenrolamiento,
  revocación de sesiones, etc. (`audit` visible en `/admin/audit`).
- **D-A6 — RGPD by design**: borrado/anonimización desde la ficha de
  usuario (`DELETE /admin/users/{id}/data`); clonar curso y export CSV
  viven en **Herramientas**, no en Privacidad (queda solo RGPD allí).
- **D-A7 — Permisos por capas**: Fase A–C por rol (`require_admin`,
  `require_staff_of_course`); Fase D añade permisos custom
  (`KNOWN_PERMISSIONS` + `require_permission()`; admin → todos).
- **D-A8 — Comunicación 100% in-app**: chat/directorios/mensajes con
  polling (8–20 s), **sin WebSocket** y **sin email real** (item 17 del
  roadmap, descartado por diseño).
- **D-A9 — Migraciones Alembic por fase** sobre SQLite local (CI en
  PostgreSQL): `a1f3c9d2e8b4` (messages), `b7e2d4f1a9c3` (course chat),
  `c8f5e1a2b3d4` (system_settings), `d9a4b5c6e7f8` (scale).

---

## 3. Inventario (estado al empezar)

### Backend existente (Fases 0–3, reutilizado)

- Auth y perfil: `POST /auth/login`, `PATCH /auth/me`,
  `PATCH /auth/change-credentials`, RGPD `/me/export` y `/me/data`.
- Cursos: CRUD `/courses`, asientos y matrículas, `GET
  /courses/{id}/classroom`, `POST /courses/{id}/clone` (admin), export
  `GET /courses/{id}/export/grades.csv` (staff).
- Trabajo académico: assignments, submissions, evaluaciones, secciones,
  anuncios, rúbricas, asistencia, calendario de curso.

### Backend a crear (Fases A–D)

| Fase | Endpoints / modelos nuevos |
|------|----------------------------|
| A | `POST /admin/users`, `PATCH /admin/users/{id}`, `POST .../reset-password`, `GET /admin/dashboard`, `GET /admin/observer/submissions|evaluations`, chat 1:1 (`/messages/*`, tabla `messages`) |
| B | `GET /messages/directory`, `GET /messages/unread-count`, chat por curso (`/courses/{id}/chat`, `/me/course-chats`; tablas `course_messages`, `course_message_reads`) |
| C | `GET /admin/dashboard/multi`, `GET /courses/{id}/gradebook`, `GET/PUT /admin/settings` (tabla `system_settings`), `GET /admin/reports/overview[.csv]`, `GET /calendar/institutional`, `GET /courses/{id}/backup` |
| D | CRUD `/admin/categories`, `/admin/cohorts` (+autoenroll), CRUD `/admin/roles`, `POST /admin/users/{id}/custom-role`, `GET /admin/permissions`, `GET /auth/permissions`, `GET /admin/sessions` (+`revoke`), `POST /admin/users/{id}/unlock` (modelos en `models/scale.py`) |

### Frontend

- **No existía** el módulo: sin `/admin`, sin layout, sin panel de
  usuarios ni observador; `HomePage` era un stub para todos los roles.
- UI suelta previa: login, aula, entregas, evaluación, contenido.

---

## 4. Fases

### Fase A — Cerrar lo que ya hay API sin UI (commit `86d505d`)

- **Backend**: chat 1:1 (`messages`, migración `a1f3c9d2e8b4`);
  `POST /admin/users` con `temporary_secret` una sola vez; edición,
  reset de contraseña/PIN; dashboard `GET /admin/dashboard` (KPIs +
  actividad reciente); observador de entregas y evaluaciones;
  `PATCH /auth/me` (409 email duplicado).
- **Frontend**: `AdminLayout` + rutas anidadas (dashboard, cursos,
  detalle de curso, usuarios, mensajes, observador, auditoría, import
  CSV, herramientas); alta de usuarios con banner de secreto temporal;
  import CSV de alumnos por curso con PINs en lote; Herramientas
  (clonar curso, export CSV, métricas); Mi cuenta y Privacidad RGPD.
- **Tests**: `test_admin_phase_a.py` → 87 backend / 18 frontend.

### Fase B — Comunicación (commit `b7de2d7`)

- **Backend**: chat privado ampliado (student↔student con matrícula
  común), directorio por rol (`GET /messages/directory`), badge
  (`GET /messages/unread-count`), chat global por curso (tablas
  `course_messages` + `course_message_reads`, migración
  `b7e2d4f1a9c3`, audit `course_chat.sent`).
- **Frontend**: `features/messages/` — pestañas Privado y Por curso,
  directorio messageable, hilos con no leídos y badge en la nav
  (polling 20 s); `/admin/messages` pasa a redirigir a `/messages`.
- **Tests**: `test_messages_phase_b.py` (5) → 92 backend / 22 frontend.

### Fase C — Profesional LMS (commit `ba65d42`)

- **Backend**: dashboard multi-curso (`/admin/dashboard/multi`),
  gradebook matriz (`/courses/{id}/gradebook`), ajustes del centro
  (tabla `system_settings`, migración `c8f5e1a2b3d4`, audit
  `settings.updated`), reportes + CSV, calendario institucional con
  visibilidad por rol, backup de curso en JSON (audit `course.backup`).
- **Frontend**: `features/phasec/` — `/admin/multi`, `/admin/settings`,
  `/admin/reports`, `/courses/:id/gradebook`, `/calendar` y
  `CourseBackupButton`; nav con Multi-curso, Reportes y Ajustes.
- **Tests**: `test_phase_c.py` (6) → 98 backend / 27 frontend.

### Fase D — Escala (commit `26f100a`)

- **Backend** (`models/scale.py`, migración `d9a4b5c6e7f8`):
  categorías de curso con `course_count`; cohorts con miembros
  (alta/baja individual y masiva) y autoenrolamiento por cohorte
  (`POST /courses/{id}/auto-enroll`, audit `course.auto_enrolled`);
  roles personalizados con catálogo `KNOWN_PERMISSIONS` y asignación a
  usuarios; `require_permission()` conectado a Fase C
  (`settings.manage`, `reports.view`); sesiones activas (refresh
  tokens) con revocación y desbloqueo de cuentas (audits
  `sessions.revoked`, `user.unlocked`).
- **Frontend**: `features/scale/` — `/admin/categories`,
  `/admin/cohorts`, `/admin/roles`, `/admin/sessions` y
  `CourseTaxonomyPanel` en el detalle de curso; nav ampliada.
- **Item 17 (email real)**: descartado por diseño; la plataforma es
  in-app.
- **Tests**: `test_phase_d.py` (7) → 105 backend / 31 frontend.

---

## 5. Verificación por fase (obligatoria)

- Backend: `ruff check .` → `ruff format --check .` → `mypy app` →
  `pytest -q --cov=app` (≥80 %): **87 → 92 → 98 → 105 tests**
  (84.98 % → 86 %).
- Frontend: `npm run lint` → `npm run format` → `npm run typecheck` →
  `npm run test` → `npm run build`: **18 → 22 → 27 → 31 tests**.
- Migraciones: `alembic upgrade head` aplicado en local por fase
  (`a1f3c9d2e8b4`, `b7e2d4f1a9c3`, `c8f5e1a2b3d4`, `d9a4b5c6e7f8`).
- CHANGELOG: una entrada por fase (`## [Fase A]` … `## [Fase D]`).

## 6. Fuera de alcance

- WebSocket, email real/SMTP y MFA (decisión D-A8 y roadmap item 17).
- Ajustes de sesión (expiración configurable) más allá de revocación.
- Módulos teacher y student (a cargo de `PLAN_PROFESOR.md` y
  `PLAN_ALUMNO.md`).
- Revisión/acomodo fino del módulo admin (pendiente aparte, ver
  `TRABAJO_REALIZADO_EN_ADMIN.md`).

## 7. Orden de ejecución

A → B → C → D. Cada fase: implementar → cadena de verificación →
CHANGELOG (una entrada por fase) → commit + push.

---

## Roadmap de origen (texto original, sección 3 del prompt)

```
3. Módulos prioritarios (orden de impacto)

Fase A — Cerrar lo que ya hay API sin UI (máximo valor, poco esfuerzo)
Fase B — Comunicación (el "por qué" de la app)
Fase C — Profesional LMS
Fase D — Escala
```

(Detalle completo del texto original: `TRABAJO_REALIZADO_EN_ADMIN.md`,
sección "Roadmap de origen".)
