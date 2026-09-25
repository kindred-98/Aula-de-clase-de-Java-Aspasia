# Trabajo realizado en Alumno — Plan [PLAN_ALUMNO.md](../PLAN/PLAN_ALUMNO.md) (fases S0–S4) completado

Documento de cierre del **panel del alumnado**. Fuente de ejecución:
[Archivo_Markdown/PLAN/PLAN_ALUMNO.md](../PLAN/PLAN_ALUMNO.md);
resumen oficial en [CHANGELOG.md](../../CHANGELOG.md)
(entrada `## [Fase S]`).

**Documentación relacionada**: plan [PLAN_ALUMNO.md](../PLAN/PLAN_ALUMNO.md) ·
patrón de origen [PLAN_ADMIN.md](../PLAN/PLAN_ADMIN.md) y
[PLAN_PROFESOR.md](../PLAN/PLAN_PROFESOR.md) ·
hermano [TRABAJO_REALIZADO_EN_PROFESOR.md](TRABAJO_REALIZADO_EN_PROFESOR.md) ·
[Índice de docs](../Explicacion_de_Cada_ARCHIVO.md).

Resumen de commits en `main`
(`https://github.com/kindred-98/Aula-de-clase-de-Java-Aspasia`):

| Fase | Commit | Contenido |
|------|--------|-----------|
| plan | `e9c334f` | [`Archivo_Markdown/PLAN/PLAN_ALUMNO.md`](../PLAN/PLAN_ALUMNO.md) |
| S0 | `ffc6c67` | `StudentLayout`, guard `RequireStudent` y rutas `/student` |
| S1 | `44a704c` | `GET /student/dashboard` + panel con KPIs, cursos y actividad |
| S2 | `276208b` | `GET /student/pending-count`, badge en la nav y lista "Por entregar" |
| S3 | `306ee09` | `GET /courses/{id}/my-progress` + página "Mi progreso" |
| S4 | `7ed6780` | Guards de rutas staff, enlaces ocultos en el aula y CHANGELOG |

Verificación en verde tras cada fase (cadena obligatoria):

- Backend (`backend/`): `ruff check .` → `ruff format --check .` →
  `mypy app` → `pytest -q --cov=app` → **123 tests, 86.70 % cobertura**.
- Frontend (`frontend/`): `npm run lint` → `npm run format` →
  `npm run typecheck` → `npm run test` → `npm run build` →
  **66 tests**.
- Migraciones: ninguna (D-S7, módulo de lectura y agregación).

---

## Decisiones de diseño (§2 del plan)

- **D-S1 — Rutas compartidas se quedan planas.** `/courses/:id/*` (aula,
  contenido, tareas, calendario, mensajes) las usan también teacher y
  admin: **no** se reubican bajo `/student`.
- **D-S2 — Login de student redirige a `/student`** (`homePath.ts`),
  también tras `change-credentials`.
- **D-S3 — Guard `RequireStudent`**: deja pasar `student` y `admin`;
  `teacher` → `/`.
- **D-S4 — Componentes en `features/student/`**, un archivo por
  responsabilidad (SRP); no se acoplan a `features/teacher/` ni
  `features/admin/`.
- **D-S5 — Polling, no WebSocket**: `usePendingCount` con
  `refetchInterval: 30000` (patrón de teacher).
- **D-S6 — Cero cambios de visibilidad.** No se toca `policies.py`
  (`can_read_submission`, visibilidad `private|class`): el alumno solo
  consume datos ya filtrados por backend y **nunca** ve notas ni
  comentarios ajenos.
- **D-S7 — Sin migraciones de esquema**: solo lectura sobre
  `enrollments`, `submissions`, `evaluations` y `attendance_records`.

---

## Endpoints nuevos (huecos de agregación)

| Endpoint | Fase | Propósito |
|----------|------|-----------|
| `GET /student/dashboard` | S1 | KPIs, mis cursos, próximas fechas, actividad reciente y "Por entregar" |
| `GET /student/pending-count` | S2 | Contador `{pending}` para el badge de navegación |
| `GET /courses/{id}/my-progress` | S3 | Progreso propio por tarea + resumen + asistencia (matriculado) |

---

## Fase S4 — Guards de UI, pulido y cierre (commit `7ed6780`)

- **Guard `RequireStaff`** en `app/routes.tsx` para las rutas solo-staff
  `/courses/:id/evaluate`, `/attendance`, `/rubrics` y `/gradebook`:
  un student es redirigido a `/student` (el backend ya devolvía 403;
  ahora la UI no se rompe).
- **`ClassroomPage`**: la cabecera oculta los enlaces "Asistencia" y
  "Rúbricas" a no-staff (`isStaff` = teacher/admin); "Contenido",
  "Ir a entregas" y "Calendario" siguen visibles para todos.
- Revisión transversal: estados de carga/error/vacío en todas las
  vistas nuevas, ARIA (`aria-label` en nav y secciones), foco visible
  global y sidebar responsive del `StudentLayout` (fila en móvil,
  columna en `lg`).
- Entrada única **`## [Fase S]`** en [CHANGELOG.md](../../CHANGELOG.md).
- Tests: redirección desde las 4 rutas staff, teacher sigue pudiendo
  abrir "Evaluar entregas", aula con/sin enlaces staff.

## Fase S3 — Mi progreso y mi asistencia por curso (commit `306ee09`)

**Backend** (`routes/courses.py`, con `require_enrolled`):

- `GET /courses/{id}/my-progress` → `StudentCourseProgress`:
  - `assignment_stats[]`: `{assignment_id, title, due_at, status,
    score, submitted_at}` con la **última** entrega propia por tarea
    (`none | draft | submitted | reviewed | needs_changes`).
  - `summary`: entregadas/pendientes, nota media y % de entrega
    (entregadas = `submitted | reviewed`, coherente con el dashboard).
  - `attendance`: `{present, late, absent, excused, pct}` reutilizando
    los helpers `_attendance_counts` / `_attendance_pct`.
  - 404 sin matrícula activa, 403 al profesorado, admin permitido.
- Tests: progreso con entregas (reviewed + draft + sin entrega) y
  asistencia, progreso sin entregas, 404/403/200 por rol y ausencia de
  datos de compañeros en la respuesta.

**Frontend**:

- `features/student/course/MyProgressPage.tsx`
  (`/student/courses/:courseId`): KPIs (entregadas, pendientes, nota
  media, asistencia), detalle de asistencia y progreso por tarea con
  chips de estado y notas; accesos rápidos a aula/tareas y Spinner /
  ErrorState / EmptyState.
- Enlaces de entrada: `CourseCard` del dashboard → `/student/courses/:id`
  y "Mi progreso →" en `CourseListPage` (solo students).

## Fase S2 — Badge de pendientes (commit `276208b`)

**Backend** (`routes/student.py`):

- `GET /student/pending-count` → `{pending}`: tareas cuya última
  entrega no existe, es `draft` o `needs_changes` (patrón de
  `GET /teacher/pending-count`).
- `StudentDashboard.pending_items[]` (máx. 10, orden por fecha con
  vencidas primero y sin fecha al final) para la sección "Por entregar".
- Tests: contador con borradores/`needs_changes` frente a entregadas,
  403 a teacher, orden con vencida y sin fecha (fuera de `upcoming`).

**Frontend**:

- `features/student/usePendingCount.ts`: query
  `["student-pending-count"]`, habilitada para student|admin, con
  `refetchInterval: 30000` (D-S5).
- Badge "N entregas por entregar" en el NavLink de Inicio del
  `StudentLayout` (aria-label para lectores de pantalla).
- `PendingList.tsx` ("Por entregar") sustituye a `UpcomingList` en el
  dashboard, con chips "Vencida"/"Sin fecha" y enlace a
  `/courses/:id/work/:assignmentId`.

## Fase S1 — Dashboard del alumno (commit `44a704c`)

**Backend** (`app/api/v1/routes/student.py`, nuevo):

- `GET /student/dashboard` → `StudentDashboard`:
  - `totals`: `courses_count`, `pending_submissions`, `due_this_week`,
    `graded_submissions`.
  - `courses[]` (solo matrículas activas, con pendiente y próxima
    entrega), `upcoming[]`, `recent[]` (últimas evaluaciones propias) y
    `pending_items[]`.
  - Filtro por matrícula activa; 403 si no es student/admin; admin ve
    todos los cursos.
- Esquemas en `app/schemas/student.py` (`StudentTotals`,
  `StudentDashboardCourse`, `StudentPendingItem`,
  `StudentRecentEvaluation`, …).
- Tests: agregados, aislamiento de cursos sin matrícula, 403 a teacher.

**Frontend** `features/student/dashboard/` (SRP):
`StudentDashboardPage.tsx` (orquesta), `KpiCard.tsx`, `CourseCard.tsx`,
`PendingList.tsx`, `ActivityList.tsx`, `QuickActions.tsx`.

## Fase S0 — Estructura y navegación (commit `ffc6c67`)

- `features/student/StudentLayout.tsx`: sidebar (Inicio, Mis cursos,
  Calendario, Mensajes, Mi cuenta) + tarjeta de usuario + logout, con
  nav responsive y `aria-label` propio.
- `app/routes.tsx`: guard `RequireStudent` (D-S3) y ruta anidada
  `/student` → dashboard.
- `homePath.ts`: redirect a `/student` tras login (D-S2) y enlace
  "Panel" en la nav global (`app/layout.tsx`).
- Stub de dashboard con `EmptyState` (reemplazado en S1).
- Tests: `StudentPhaseS.test.tsx` — teacher redirigido, student ve
  sidebar y rutas, admin pasa el guard.

---

## Pendiente / limitaciones

- Badge y "Por entregar" usan polling (30 s), sin WebSocket (D-S5).
- La lista "Por entregar" muestra como máximo 10 tareas.
- Sin migraciones de esquema (D-S7); las reglas de visibilidad del
  backend no se tocaron (D-S6).
- Fuera de alcance: evaluar/pasar lista (teacher), usuarios y
  matrículas (admin); cambios de MFA/email/WebSocket.
