# PLAN — Módulo del Alumno (Student)

Documento de plan del **panel del alumno** (dashboard de estudiante). Reproduce el
patrón exitoso de los módulos admin y teacher: rutas anidadas bajo un layout
propio, un archivo por responsabilidad, features modulares, y cada fase termina
con verificación completa + commit.

- Idioma: documentación en español; código, variables y commits en inglés.
- Backend: Python/FastAPI en `backend/`; frontend: React en `frontend/`.
- Cada fase se entrega con `commit + push` a `main` (como Fases A–D y T0–T4).

**Documentación relacionada**: [PLAN_ADMIN.md](PLAN_ADMIN.md) y
[PLAN_PROFESOR.md](PLAN_PROFESOR.md) (módulos previos y patrón de origen) ·
[TRABAJO_REALIZADO_EN_ALUMNO.md](../PLANES_APLICADO_CON_EXITO/TRABAJO_REALIZADO_EN_ALUMNO.md)
(ejecución) · [CHANGELOG.md](../../CHANGELOG.md) ·
[Índice de docs](../Explicacion_de_Cada_ARCHIVO.md).

---

## 1. Contexto y objetivo

Hoy el alumno **no tiene panel propio**:

- Al iniciar sesión cae en `HomePage` (`features/home/HomePage.tsx`), que es un
  stub: solo muestra el health-check de la API y un `EmptyState` fijo.
- El redirect tras login (`features/auth/homePath.ts:19-21`) solo conoce a
  `teacher` (`/teacher`); el student va a `/` y debe reconstruir su estado a
  mano con N peticiones (`/courses`, `/courses/{i}/assignments`,
  `/courses/{i}/submissions`, `/calendar/institutional`, `/messages/unread-count`,
  `/me/course-chats`).
- **No existe ningún endpoint de agregación propio del alumno** (0 resultados
  para `student/dashboard`, `/me/summary`, `/me/pending`, `/me/attendance`).
- Existen 44 endpoints utilizables por student (5 públicos + 39 autenticados),
  pero sin resumen: entregas pendientes, próximas fechas, notas recibidas y
  asistencia están repartidos por áreas.

Los módulos admin (`/admin`) y teacher (`/teacher`) son el patrón a calcar.

### Conexiones del rol (requisito explícito)

| Con | Flujo | Estado |
|-----|-------|--------|
| **Teacher** | Evalúa sus entregas (nota + rúbrica + comentario), devuelve "requiere cambios"; el alumno ve **solo su propia** evaluación | Backend ✅ / UI suelta ✅ |
| **Admin** | Crea cursos, matricula, asigna asientos/PINs; el alumno solo ve sus matrículas activas (404 en curso ajeno) | ✅ |
| **Student → sí mismo** | Dashboard propio, badge de pendientes, mi progreso y mi asistencia por curso | ❌ **Objetivo de este plan** |

---

## 2. Decisiones de diseño

- **D-S1 — Rutas compartidas se quedan planas.** `/courses/:id/*` (aula,
  contenido, tareas, calendario, mensajes) las usan también teacher y admin:
  **no** se reubican bajo `/student` (evita romper tests y enlaces
  existentes). El módulo student solo añade rutas nuevas propias.
- **D-S2 — Login de student redirige a `/student`** (hoy va a `/`); también
  tras `change-credentials` (mismo `homePathAfterLogin()`).
- **D-S3 — Guard `RequireStudent`**: deja pasar `student` y `admin`
  (consistente con `RequireTeacher` y con el backend, donde admin puede todo);
  `teacher` → `/`.
- **D-S4 — Componentes viven en `features/student/`**: no se acoplan a
  `features/teacher/` ni `features/admin/`. Cada página/subcomponente en su
  archivo (SRP).
- **D-S5 — Polling, no WebSocket** (consistente con todo el proyecto):
  `usePendingCount` con `refetchInterval: 30000`, patrón de teacher.
- **D-S6 — Cero cambios de visibilidad.** El plan **no** toca las reglas de
  `policies.py` (`can_read_submission`, `can_write_submission`, visibilidad
  `private|class`): el dashboard solo consume endpoints ya filtrados por
  backend (matrícula activa y entregas propias forzadas en servidor). El
  alumno **nunca** ve notas ni comentarios de evaluación de otros.
- **D-S7 — Sin migraciones de esquema.** Todo el módulo es de lectura y
  agregación sobre tablas existentes (`enrollments`, `submissions`,
  `evaluations`, `attendance_records`).

---

## 3. Inventario del rol (estado actual)

### Backend utilizable por student (44 endpoints)

- Auth/perfil: `POST /auth/login/student`, `GET/PATCH /auth/me`,
  `PATCH /auth/change-credentials`, `GET /auth/permissions`, refresh/logout.
- Cursos y aula: `GET /courses` (solo matrículas activas), `GET /courses/{id}`
  (404 si no está matriculado), `GET /courses/{id}/classroom`,
  `GET /courses/{id}/seats`, `GET /courses/{id}/enrollments/me`,
  `GET /me/courses`.
- Tareas y entregas (área completa): `GET /courses/{id}/assignments`,
  `GET /assignments/{id}`, `POST /submissions` (solo student),
  `GET /courses/{id}/submissions` (forzado a las suyas) + `?mine`,
  `GET/PATCH/DELETE /submissions/{id}` (escritura solo dueño, borradores),
  upload/descarga/borrado de ficheros, `GET /submissions/{id}/evaluations`
  (solo la propia; `peer ⇒ []`), `GET /submissions/{id}/github-meta`.
- Contenido: `GET /courses/{id}/sections`, `GET /courses/{id}/announcements`
  (solo lectura).
- Calendario: `GET /courses/{id}/calendar`,
  `GET /calendar/institutional` (solo sus cursos).
- Mensajería: directorio, privados, `unread-count`, chat de curso,
  `GET /me/course-chats`.
- RGPD: `GET /me/export`, `DELETE /me/data` (solo students).
- **Denegados:** asistencia (staff), rúbricas (staff), gradebook (staff),
  evaluar (403 "estudiantes nunca evalúan"), overview/ficha de alumno (staff),
  todo `/admin/*` y `/teacher/*`.

### Huecos de agregación (backend inexistente — a crear en este plan)

| Endpoint | Fase | Propósito |
|----------|------|-----------|
| `GET /student/dashboard` | S1 | KPIs agregados: pendientes, fechas de la semana, mis cursos, actividad reciente |
| `GET /student/pending-count` | S2 | Contador para badge de navegación ("N por entregar") |
| `GET /courses/{id}/my-progress` | S3 | Mi progreso por tarea (estado, nota) + **mi asistencia** del curso |

### Frontend

- Existen páginas compartidas por curso (lista en §2 D-S1) con permisos
  backend: `CourseListPage`, `ClassroomPage`, `ContentPage`, `WorkPage`
  (crear/editar/entregar + ver **su** evaluación), `AssignmentDetailPage`,
  `CalendarPage`, `MessagesPage`, cuenta y privacidad.
- **No existe**: layout student, guard, redirect a `/student`, dashboard,
  badge de pendientes ni vista de "mi progreso/asistencia".
- Hogar actual: `HomePage` = health-check sin datos del alumno
  (`features/home/HomePage.tsx:8-11`, `EmptyState` en `:55-57`).

---

## 4. Fases

### Fase S0 — Estructura y navegación (solo frontend)

**Frontend:**

- `features/student/StudentLayout.tsx`: sidebar (Inicio, Mis cursos,
  Calendario, Mensajes, Mi cuenta) + tarjeta de usuario + logout, patrón
  `features/teacher/TeacherLayout.tsx`.
- `features/student/dashboard/StudentDashboardPage.tsx` (stub con `EmptyState`
  "Fase S1").
- `app/routes.tsx`: guard `RequireStudent` (D-S3) + rutas anidadas
  `/student` → dashboard.
- `features/auth/homePath.ts`: `student → /student` (D-S2), usado por
  `LoginPage` y `ChangeCredentialsPage`.
- `app/layout.tsx`: enlace "Panel" en la nav global para student (patrón
  teacher).
- Tests: `features/student/StudentPhaseS.test.tsx` (patrón
  `TeacherPhaseT.test.tsx`): teacher redirigido, student ve sidebar y rutas,
  admin pasa el guard.

**Salida:** lint + format + typecheck + test + build en verde.

### Fase S1 — Dashboard del alumno

**Backend** (`app/api/v1/routes/student.py`, nuevo; patrón `teacher.py`):

- `GET /student/dashboard` → `StudentDashboard`:
  - `totals`: `courses_count`, `pending_submissions` (borradores +
    `needs_changes`), `due_this_week`, `graded_submissions`.
  - `courses[]`: `{id, name, code, status, pending, next_due_at}` (solo
    matrículas activas).
  - `upcoming[]`: próximas fechas límite de **todos** mis cursos (curso +
    tarea + `due_at`).
  - `recent[]`: últimas evaluaciones recibidas (solo las suyas: curso, tarea,
    score, `evaluated_at`).
  - Filtro por matrícula activa; 403 si no es student/admin.
- Tests: `tests/test_student.py` (dashboard, aislamiento de cursos sin
  matrícula, 403 a teacher).

**Frontend** `features/student/dashboard/` (SRP):

- `StudentDashboardPage.tsx` (orquesta), `KpiCard.tsx`, `CourseCard.tsx`,
  `UpcomingList.tsx`, `ActivityList.tsx`, `QuickActions.tsx` (mis cursos,
  entregar tarea → `WorkPage`, calendario).

**Salida:** dashboard con datos reales; tests backend + frontend.

### Fase S2 — Badge de pendientes

**Backend:**

- `GET /student/pending-count` → `{pending}` (tareas sin entregar +
  `needs_changes`), patrón `GET /teacher/pending-count`.
- Tests: contador, aislamiento, 403 a teacher.

**Frontend:**

- `features/student/usePendingCount.ts` (polling 30 s, D-S5, patrón
  `features/teacher/usePendingCount.ts`).
- Badge real en `StudentLayout` + sección "Por entregar" en el dashboard
  (enlaza a `/courses/:id/work/:assignmentId`).

**Salida:** el alumno ve de un vistazo cuántas entregas le quedan, con badge
en la navegación.

### Fase S3 — Mi progreso y mi asistencia por curso

**Backend:**

- `GET /courses/{id}/my-progress` (matriculado; `require_enrolled`):
  - `assignment_stats[]`: `{assignment_id, title, due_at, status, score,
    submitted_at}` (estado de **su** entrega por tarea).
  - `summary`: entregadas/pendientes, nota media, `% de entrega`.
  - `attendance`: `{present, late, absent, excused, pct}` (sus registros del
    curso; reutiliza los helpers de conteo ya existentes).
- Tests: progreso con entregas y sin ellas, 404 curso no matriculado,
  sin datos de compañeros en la respuesta.

**Frontend** `features/student/course/`:

- `MyProgressPage.tsx` (`/student/courses/:courseId`): progreso por tarea
  (estado + nota), resumen y asistencia; accesos rápidos a aula/tareas.
- Enlace desde `CourseCard` del dashboard y desde `CourseListPage`.

**Salida:** el alumno sigue su curso entero (fechas, entregas, notas,
asistencia) sin salir del panel.

### Fase S4 — Guards de UI, pulido y cierre

- Guards de rol en rutas solo-staff hoy sin protección en frontend
  (`app/routes.tsx`): `/courses/:id/evaluate`, `/attendance`, `/rubrics`,
  `/gradebook` → redirect para student (evita UI rota; el backend ya devuelve
  403).
- Ocultar enlaces cabecera de `ClassroomPage` ("Asistencia", "Rúbricas") a
  no-staff.
- Estados vacíos/carga/error en todas las vistas nuevas; a11y (contraste AA,
  foco visible, ARIA, teclado); responsive del sidebar.
- [CHANGELOG.md](../../CHANGELOG.md) **[Fase S]** + verificación completa;
  commit + push.

---

## 5. Verificación por fase (obligatoria)

- Backend: `ruff check .` → `ruff format --check .` → `mypy app` →
  `pytest -q --cov=app` (≥80 %).
- Frontend: `npm run lint` → `npm run format` → `npm run typecheck` →
  `npm run test` → `npm run build`.
- Migraciones: ninguna (D-S7).

## 6. Fuera de alcance

- Evaluar, aprobar o pasar lista (teacher); usuarios, matrículas, asientos,
  PINs y ajustes (admin).
- Cambiar reglas de visibilidad o exponer evaluaciones/grades ajenos (D-S6).
- Módulo admin (pendiente aparte de revisión/acomodo).
- WebSocket, email real, MFA.

## 7. Orden de ejecución

S0 → S1 → S2 → S3 → S4. Cada fase: implementar → cadena de verificación →
[CHANGELOG.md](../../CHANGELOG.md) (solo en S4, entrada única **[Fase S]**)
→ commit + push.
