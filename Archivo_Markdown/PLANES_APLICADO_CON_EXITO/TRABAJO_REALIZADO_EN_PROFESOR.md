# Trabajo realizado en Profesor — Plan [PLAN_PROFESOR.md](../PLAN/PLAN_PROFESOR.md) (fases T0–T4) completado

Documento de cierre del **panel del profesorado**. Fuente de ejecución:
[Archivo_Markdown/PLAN/PLAN_PROFESOR.md](../PLAN/PLAN_PROFESOR.md);
resumen oficial en [CHANGELOG.md](../../CHANGELOG.md)
(entrada `## [Fase T]`).

**Documentación relacionada**: plan [PLAN_PROFESOR.md](../PLAN/PLAN_PROFESOR.md) ·
patrón de origen [PLAN_ADMIN.md](../PLAN/PLAN_ADMIN.md) ·
módulo siguiente [PLAN_ALUMNO.md](../PLAN/PLAN_ALUMNO.md) ·
hermano [TRABAJO_REALIZADO_EN_ALUMNO.md](TRABAJO_REALIZADO_EN_ALUMNO.md) ·
[Índice de docs](../Explicacion_de_Cada_ARCHIVO.md).

Resumen de commits en `main`
(`https://github.com/kindred-98/Aula-de-clase-de-Java-Aspasia`):

| Fase | Commit | Contenido |
|------|--------|-----------|
| T0 | `d251624` | `TeacherLayout`, guard `RequireTeacher` y rutas `/teacher` |
| T1 | `962abf1` | `GET /teacher/dashboard` + dashboard con KPIs y actividad |
| T2 | `2c76dd9` | Cola de evaluación (`/teacher/queue`), filtros y badge "Por revisar" |
| T3 | `dc7c96c` | Panel de curso (`/courses/{id}/overview`) y ficha de alumno |
| T4 | `c803df5` | Permisos (`usePermissions`), informes con `reports.view`, export CSV, a11y/responsive |
| T4 docs | `bc1f125` | Entrada `## [Fase T]` en el CHANGELOG |

Verificación en verde tras cada fase (cadena obligatoria):

- Backend (`backend/`): `ruff check .` → `ruff format --check .` →
  `mypy app` → `pytest -q --cov=app` → **114 tests, 86.11 % cobertura**
  (al cierre de la Fase T; con la Fase S posterior: 123 tests, 86.70 %).
- Frontend (`frontend/`): `npm run lint` → `npm run format` →
  `npm run typecheck` → `npm run test` → `npm run build` →
  **43 tests** (tras Fase S: 66).
- Migraciones: ninguna (solo lectura/agregación, sin cambios de esquema).

---

## Decisiones de diseño (§2 del plan)

- **D-T1 — Rutas compartidas se quedan planas.** `/courses/:id/*` (aula,
  contenido, tareas, evaluación, asistencia, gradebook, rúbricas,
  calendario) las usan también student y admin: **no** se reubican bajo
  `/teacher`.
- **D-T2 — Login de teacher redirige a `/teacher`** (`homePath.ts`), también
  tras `change-credentials`.
- **D-T3 — Guard `RequireTeacher`**: deja pasar `teacher` y `admin`;
  `student` → `/`.
- **D-T4 — Componentes en `features/teacher/`**, un archivo por
  responsabilidad (SRP); no se acoplan a `features/admin/`.
- **D-T5 — Permisos custom de Fase D** (`gradebook.view`, `reports.view`)
  respetados en las vistas del panel.
- **D-T6 — Polling, no WebSocket** (consistente con todo el proyecto).

---

## Fase T4 — Informes, export y pulido (commit `c803df5`)

- **Permisos en frontend**: hook `usePermissions` (`GET /auth/permissions`)
  y guard `RequirePermission`; `/admin/reports` sale del árbol
  `RequireAdmin` y pasa a exigir `reports.view` (admin entra directo).
- **`AdminLayout`** oculta las secciones solo-admin a no-admins (conserva
  Mensajes, Reportes y cerrar sesión).
- **`TeacherLayout`**: enlace "Informes" condicional a `reports.view` y
  sidebar responsive (fila envuelta en móvil, columna en `lg`).
- **Exportación de notas**: botón "Exportar notas CSV" en el panel del
  curso (`apiDownload` + toast de confirmación/error), reutilizando
  `GET /courses/{id}/export/grades.csv`.
- **Accesibilidad**: `--color-warning` de claro `#d97706` → `#b45309`
  (contraste AA); foco visible global (`:focus-visible` en `index.css`).
- Tests: `TeacherPhaseT.test.tsx` (12, 5 nuevos en T4).

## Fase T3 — Panel de curso y ficha de alumno (commit `dc7c96c`)

**Backend** (`routes/courses.py`, solo staff del curso):

- `GET /courses/{id}/overview` → `CourseOverview`:
  `assignment_stats[]` (entregadas/total/% por tarea) y
  `student_stats[]` (entregadas, pendientes, última nota, % asistencia).
- `GET /courses/{id}/students/{student_id}` → `StudentCourseDetail`:
  nota media, asistencia (presentes/tardes/faltas/justificadas + %) y
  todas las entregas con su última evaluación.
- Tests: overview, ficha, 404 en curso ajeno, 403 a student.

**Frontend** `features/teacher/course/`:

- `TeacherCourseOverviewPage.tsx` (`/teacher/courses/:courseId`):
  accesos rápidos (aula, asistencia, gradebook, rúbricas, contenido,
  anuncios, chat), progreso por tarea (`AssignmentProgressRow`) y
  tarjetas de alumno (`StudentCard`).
- `StudentDetailPage.tsx` (`/teacher/courses/:courseId/students/:studentId`):
  KPIs, detalle de asistencia y entregas/evaluaciones.

## Fase T2 — Cola de evaluación global (commit `2c76dd9`)

**Backend** (`app/api/v1/routes/teacher.py`, nuevo):

- `GET /teacher/queue?course_id&status&page&page_size` → entregas
  `submitted | needs_changes` de **todos** mis cursos con curso, tarea,
  alumno, estado y fechas; paginación y filtros.
- `GET /teacher/pending-count` → `{pending}` para el badge.
- Tests: cola multi-curso, filtros, aislamiento y 403 a student.

**Frontend** `features/teacher/queue/`:

- `EvaluationQueuePage.tsx`, `QueueFilters.tsx`, `QueueItemActions.tsx`
  (acción "Evaluar" → `/courses/:id/evaluate`).
- Badge "Por revisar" en `TeacherLayout` con `usePendingCount()`
  (polling 30 s, patrón de `useUnreadCount`).

## Fase T1 — Dashboard del profesor (commit `962abf1`)

**Backend** (`routes/teacher.py`):

- `GET /teacher/dashboard` → `TeacherDashboard`:
  - `global`: `courses_count`, `students_count`, `pending_evaluations`,
    `due_this_week`, `open_assignments`.
  - `courses[]`, `upcoming[]` (próximos vencimientos) y `recent[]`
    (últimas entregas/evaluaciones), filtrado por `course_teachers`
    (admin ve todos); 403 si no es teacher/admin.
- Tests (`tests/test_teacher.py`): agregados, aislamiento de cursos
  ajenos y 403 a student.

**Frontend** `features/teacher/dashboard/` (SRP):
`TeacherDashboardPage.tsx`, `KpiCard.tsx`, `CourseCard.tsx` (enlaza al
panel del curso), `UpcomingList.tsx`, `ActivityList.tsx`,
`QuickActions.tsx` (crear tarea, pasar lista, anuncio).

## Fase T0 — Estructura y navegación (commit `d251624`)

- `features/teacher/TeacherLayout.tsx`: sidebar (Inicio, Cola de
  evaluación, Mensajes, Calendario) + tarjeta de usuario + logout,
  patrón `AdminLayout`.
- `app/routes.tsx`: guard `RequireTeacher` (D-T3) y rutas anidadas
  `/teacher`, `/teacher/queue`, `/teacher/courses/:courseId`,
  `/teacher/courses/:courseId/students/:studentId`.
- `homePath.ts`: redirect a `/teacher` tras login (D-T2) y enlace
  "Panel" en la nav global (`app/layout.tsx`).
- Stubs con `EmptyState` para dashboard y cola (reemplazados en T1/T2).
- Tests: `TeacherPhaseT.test.tsx` — student redirigido, teacher ve
  sidebar y rutas, admin pasa el guard.

---

## Pendiente / limitaciones

- El enlace "Informes" depende del permiso `reports.view` (Fase D): un
  rol personalizado sin ese permiso no lo ve, por diseño.
- No se añadieron vistas de reportes propias del profesorado: se
  reutiliza el informe de Fase C en `/admin/reports`.
- Sin WebSocket: la cola y el badge usan polling con TanStack Query.
- Fuera de alcance del plan: crear/archivar cursos, usuarios y ajustes
  (admin); módulo student (ya cubierto por
  [PLAN_ALUMNO.md](../PLAN/PLAN_ALUMNO.md)).
