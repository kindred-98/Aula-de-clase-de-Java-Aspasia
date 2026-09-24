# PLAN — Módulo del Profesor (Teacher)

Documento de plan del **panel profesional del profesor**. Reproduce el patrón
exitoso del módulo admin: rutas anidadas bajo un layout propio, un archivo por
responsabilidad, features modulares, y cada fase termina con verificación
completa + commit.

- Idioma: documentación en español; código, variables y commits en inglés.
- Backend: Python/FastAPI en `backend/`; frontend: React en `frontend/`.
- Cada fase se entrega con `commit + push` a `main` (como Fases A–D de admin).

---

## 1. Contexto y objetivo

Hoy el profesor **no tiene panel propio**:

- Al iniciar sesión cae en `HomePage` (stub de estado de la API).
- Sus herramientas (tareas, evaluación, asistencia, gradebook, rúbricas,
  contenido, anuncios) están repartidas en rutas planas
  (`/courses/:id/work`, `/courses/:id/evaluate`, …) sin navegación común.
- Existen 111 endpoints; ~59 son utilizables por teacher, pero **no hay
  ninguno de agregación propia del profesor** (dashboard, cola global de
  evaluación, actividad reciente).

El módulo admin (`/admin` + `AdminLayout` + rutas anidadas) es el patrón a
calcar.

### Conexiones del rol (requisito explícito)

| Con | Flujo | Estado |
|-----|-------|--------|
| **Student** | Evaluar (nota + rúbrica + comentario Markdown), marcar "requiere cambios", anuncios, chat por curso, asistencia, ver trabajos con visibilidad `class` | Backend ✅ / UI suelta ✅ |
| **Admin** | Admin asigna/quita profes (`TeacherManager`), observador y reportes; teacher solo opera sus cursos (404 si no es suyo) | ✅ |
| **Teacher → sí mismo** | Dashboard propio, cola de evaluación global, panel de curso, ficha de alumno, export CSV | ❌ **Objetivo de este plan** |

---

## 2. Decisiones de diseño

- **D-T1 — Rutas compartidas se quedan planas.** `/courses/:id/*`
  (aula, contenido, tareas, evaluación, asistencia, gradebook, rúbricas,
  calendario) las usan también student y admin: **no** se reubican bajo
  `/teacher` (evita romper tests y enlaces existentes). El módulo teacher
  solo añade rutas nuevas propias.
- **D-T2 — Login de teacher redirige a `/teacher`** (hoy va a `/`); también
  tras `change-credentials`.
- **D-T3 — Guard `RequireTeacher`**: deja pasar `teacher` y `admin`
  (consistente con backend, donde admin puede todo); `student` → `/`.
- **D-T4 — Componentes viven en `features/teacher/`**: no se acoplan a
  `features/admin/`. Cada página/subcomponente en su archivo (SRP).
- **D-T5 — Permisos custom de Fase D** (`gradebook.view`, `reports.view`)
  deben respetarse en las páginas del panel teacher.
- **D-T6 — Polling, no WebSocket** (consistente con todo el proyecto).

---

## 3. Inventario del rol (estado actual)

### Backend utilizable por teacher (59 endpoints)

- Cursos: `GET /me/courses`, `GET /courses/{id}` (404 si no es suyo),
  `GET /courses/{id}/classroom`, `GET/POST .../enrollments`,
  `GET .../seats`.
- Tareas y entregas: CRUD `/assignments` (staff), `GET
  /courses/{id}/submissions` (filtros `student_id`, `status`), detalle,
  evaluaciones `POST/GET /submissions/{id}/evaluations`.
- Secciones y anuncios: CRUD `/courses/{id}/sections` y
  `/courses/{id}/announcements`.
- Rúbricas: CRUD `/courses/{id}/rubrics`.
- Asistencia: `GET/PUT /courses/{id}/attendance` + `/summary`.
- Gradebook: `GET /courses/{id}/gradebook`; export
  `GET /courses/{id}/export/grades.csv`.
- Calendarios: `GET /courses/{id}/calendar`, `GET /calendar/institutional`.
- Mensajería: directorio, privados, chat de curso, unread-count.
- Permisos: `GET /auth/permissions`.

### Backend inexistente (a crear en este plan)

| Endpoint | Fase | Propósito |
|----------|------|-----------|
| `GET /teacher/dashboard` | T1 | KPIs agregados de mis cursos + actividad reciente |
| `GET /teacher/queue` | T2 | Cola global de entregas pendientes de revisar |
| `GET /teacher/pending-count` | T2 | Contador para badge de navegación |
| `GET /courses/{id}/overview` | T3 | Por tarea: entregas/total/%; por alumno: estado |
| `GET /courses/{id}/students/{sid}` | T3 | Ficha completa de un alumno del curso |

### Frontend

- Existen páginas compartidas por curso (lista en §2 D-T1) con
  permisos backend.
- **No existe**: layout teacher, guard, redirect, dashboard, cola, panel de
  curso ni ficha de alumno.

---

## 4. Fases

### Fase T0 — Estructura y navegación (solo frontend)

**Frontend:**

- `features/teacher/TeacherLayout.tsx`: sidebar (Inicio, Cola de
  evaluación, Mensajes, Calendario) + tarjeta de usuario + logout, patrón
  `AdminLayout`.
- `features/teacher/dashboard/TeacherDashboardPage.tsx` (stub con
  `EmptyState` "Fase T1") y `features/teacher/queue/EvaluationQueuePage.tsx`
  (stub "Fase T2").
- `app/routes.tsx`: guard `RequireTeacher` + rutas anidadas
  `/teacher` → dashboard, `/teacher/queue`.
- `features/auth/LoginPage.tsx` y `ChangeCredentialsPage.tsx`: redirect a
  `/teacher` si `role === "teacher"` (D-T2).
- `app/layout.tsx`: enlace "Panel" en la nav global para teacher.
- Tests: `features/teacher/TeacherPhaseT.test.tsx` (patrón
  `AdminPhaseA.test.tsx`): student redirigido, teacher ve sidebar y rutas,
  admin pasa el guard.

**Salida:** lint + format + typecheck + test + build en verde.

### Fase T1 — Dashboard del profesor

**Backend** (`app/api/v1/routes/teacher.py`, nuevo):

- `GET /teacher/dashboard` → `TeacherDashboard`:
  - `global`: `courses_count`, `students_count`, `pending_evaluations`,
    `due_this_week`, `open_assignments`.
  - `courses[]`: `{id, name, code, status, students, pending, open_assignments, next_due_at}`.
  - `upcoming[]`: próximas fechas límite (curso + tarea + `due_at`).
  - `recent[]`: últimas entregas/evaluaciones de mis cursos.
  - Filtro por `course_teachers` (admin ve los suyos = todos);
    403 si no es teacher/admin.
- Tests: `tests/test_teacher.py` (dashboard, aislamiento de cursos ajenos,
  403 a student).

**Frontend** `features/teacher/dashboard/` (SRP):

- `TeacherDashboardPage.tsx` (orquesta), `KpiCard.tsx`, `CourseCard.tsx`,
  `UpcomingList.tsx`, `ActivityList.tsx`, `QuickActions.tsx`
  (crear tarea, pasar lista, anuncio → páginas existentes).

**Salida:** dashboard con datos reales; tests backend + frontend.

### Fase T2 — Cola de evaluación global

**Backend:**

- `GET /teacher/queue?course_id&status&page&page_size` → lista de entregas
  `submitted | needs_changes` de **todos** mis cursos con `{course_id,
  course_name, assignment_id, assignment_title, student_id, student_name,
  status, submitted_at, due_at}`; paginación.
- `GET /teacher/pending-count` → `{pending}` (badge).
- Tests: cola multi-curso, filtros, aislamiento, 403 student.

**Frontend** `features/teacher/queue/`:

- `EvaluationQueuePage.tsx`, `QueueFilters.tsx`,
  `QueueItemActions.tsx` ("Evaluar" → `/courses/:id/evaluate`).
- Badge real en `TeacherLayout` con `usePendingCount()` (polling 30 s,
  patrón `useUnreadCount`).

**Salida:** profesor con N cursos ve su cola unificada en 1 clic.

### Fase T3 — Panel de curso y ficha de alumno

**Backend:**

- `GET /courses/{id}/overview` (staff): `{assignment_stats:
  [{assignment_id, title, submitted, total, pct}], student_stats:
  [{student_id, name, submitted, pending, last_score, attendance_pct}]}`
  → `GET /courses/{id}/students/{studentId}` (staff): entregas con su
  última evaluación, asistencia, media.
- Tests: overview por curso, ficha, 404 curso ajeno, 403 student.

**Frontend** `features/teacher/course/`:

- `TeacherCourseOverviewPage.tsx` (`/teacher/courses/:courseId`): tareas
  con % de entrega, tarjeta por alumno, accesos rápidos (aula, asistencia,
  gradebook, rúbricas, contenido/anuncios, chat).
- `StudentDetailPage.tsx` (`/teacher/courses/:courseId/students/:studentId`):
  historial de entregas, evaluaciones, asistencia, nota media.
- `AssignmentProgressRow.tsx`, `StudentCard.tsx`.

**Salida:** el profesor sigue a un alumno de principio a fin sin salir del
panel.

### Fase T4 — Informes, export y pulido

- Botón "Exportar notas CSV" por curso (endpoint ya existente).
- Acceso a `/admin/reports` si `GET /auth/permissions` incluye
  `reports.view` (roles custom, Fase D); ocultar si no.
- Estados vacíos/carga/error en todas las vistas nuevas; a11y (contraste
  AA, foco visible, ARIA, teclado); responsive del sidebar.
- CHANGELOG **[Fase T]** + verificación completa; commit + push.

---

## 5. Verificación por fase (obligatoria)

- Backend: `ruff check .` → `ruff format --check .` → `mypy app` →
  `pytest -q --cov=app` (≥80 %).
- Frontend: `npm run lint` → `npm run format` → `npm run typecheck` →
  `npm run test` → `npm run build`.
- Migraciones: ninguna prevista en T0–T2; T3 solo lectura (sin cambios de
  esquema).

## 6. Fuera de alcance

- Crear/archivar cursos, asignar profes, usuarios, ajustes del centro
  (admin).
- Módulo student (`PLAN_ALUMNO.md`, después de este).
- Revisión/acomodo del módulo admin (pendiente aparte).
- WebSocket, email real, MFA.

## 7. Orden de ejecución

T0 → T1 → T2 → T3 → T4. Cada fase: implementar → cadena de verificación →
CHANGELOG (solo en T4, entrada única **[Fase T]**) → commit + push.
