# PLAN — Plataforma de Aula Virtual Multi-Curso

Documento de arquitectura y decisiones. Se actualiza ante cada decisión ambigua
(opción más segura) y sirve de referencia durante todas las fases.

- Idioma: documentación en español; código, variables y commits en inglés.
- Multi-tenant desde el día 1: todo dato de curso lleva `course_id` y toda
  consulta lo filtra.

---

## 1. Stack (verificado)

| Capa | Tecnología | Versión usada | Verificación |
|------|------------|---------------|--------------|
| Backend | Python | `>=3.12` (Docker/CI: 3.12) | máquina local solo tiene 3.14 → ver decisión D1 |
| API | FastAPI | 0.141.1 | PyPI |
| ORM | SQLAlchemy | 2.0.54 | PyPI |
| Migraciones | Alembic | 1.20.0 | PyPI |
| Validación | Pydantic | 2.13.5 (v2) | PyPI |
| Settings | pydantic-settings | 2.15.0 | PyPI |
| BD | PostgreSQL | 3 (imagen `postgres:17-alpine`) | compose/CI |
| Driver PG | psycopg | 3.3.6 | PyPI |
| Auth hash | argon2-cffi | 25.1.0 | PyPI |
| JWT | PyJWT | 2.15.0 | PyPI |
| Servidor | uvicorn | 0.53.0 | PyPI |
| Frontend | React | 19.3.0 | npm |
| Build | Vite | 7.x + `@vitejs/plugin-react` 5.x | npm (peer deps comprobados) |
| Lenguaje | TypeScript | 5.9.x | npm (typescript-eslint admite `<6.1.0`) |
| CSS | Tailwind CSS | 4.x (`@tailwindcss/vite`) | npm |
| Datos | TanStack Query | 5.x | npm |
| Routing | React Router | 7.x | npm |
| Tests FE | Vitest 5 + Testing Library | — | npm |
| Lint BE | ruff 0.16.x, mypy 2.x | — | PyPI |
| Lint FE | eslint 9 (flat) + prettier 3 | — | npm |
| Tests BE | pytest 9 + pytest-cov | — | PyPI |

Nada de lo anterior se cambia sin justificarlo aquí.

---

## 2. Decisiones (ambigüedades resueltas)

**D1 — Python local vs objetivo 3.12.** La máquina de desarrollo solo tiene
Python 3.14 y no hay Docker instalado. Objetivo oficial: 3.12
(`requires-python = ">=3.12"`, imágenes `python:3.12-slim`, CI con 3.12).
El código evita sintaxis propia de 3.13/3.14. La verificación local se ejecuta
en 3.14; la de producción/CI en 3.12.

**D2 — Docker no disponible localmente.** Se generan `docker-compose.yml` y
Dockerfiles igualmente (requisito de infra). La verificación de la app en esta
máquina se hace arrancando uvicorn y vite en local; en CI se valida
`docker compose config` y las migraciones contra PostgreSQL real.

**D3 — Tests de BD.** Local: SQLite (sin infra). CI: PostgreSQL (servicio).
Los modelos usan tipos portables (`String`, `DateTime`, `JSON` con variante
`JSONB` en PG, `Enum` nativo) para que el comportamiento sea equivalente.
La cobertura mínima del 80 % se mide en el backend.

**D4 — Refresh token.** La especificación pide refresh rotatorio y revocable
pero no nombra la tabla. Se añade `refresh_tokens` (fase 1, contemplada en el
esquema): token hasheado, `expires_at`, `revoked_at`, rotación al usar.

**D5 — Rate limiting de PIN.** Sin dependencias externas: se cuentan intentos
fallidos consultando `audit_logs` (acción `auth.login_failed`) por IP y por
cuenta; bloqueo temporal a los 5 intentos. Persiste en BD → sobrevive reinicios.

**D6 — El profesor no tiene asiento.** La cuadrícula es solo de estudiantes
(`layout_rows × layout_cols`). La UI pinta a la profesora "al frente" fuera de
la cuadrícula. No se crea fila extra en BD.

**D7 — `submission.assignment_id` nullable.** Permite entregas libres (sin
tarea asociada) tal y como pide el modelo. `course_id` siempre presente.

**D8 — `evaluation` inmutable.** Nunca se UPDATE: cada evaluación es una fila
nueva (historial). La "actual" es la de `created_at` más reciente.

**D9 — Archivos.** Interfaz `Storage` con `LocalStorage` (disco, nombre
aleatorio + sha256) y `S3Storage` preparada (boto3) para producción. Descarga
siempre vía endpoint que comprueba permisos; `Content-Disposition: attachment`.

**D10 — Markdown.** Render en cliente con sanitización estricta; en servidor se
guarda Markdown crudo. Nunca HTML confiado.

**D11 — Archivar ≠ borrar.** Cursos se archivan (`status=archived`). El borrado
físico no existe en la UI de admin (solo RGPD para datos de un estudiante).

**D12 — CSV importación.** Formato: `name,email?,username?` (+ columnas
opcionales). PINs se generan en lote y se muestran una sola vez.

**D13 — Cookies vs bearer.** Access token JWT en memoria/`localStorage`
corto (15 min); refresh en cookie `HttpOnly` `SameSite=strict` path acotado.
En desarrollo sin HTTPS, cookie sin `Secure`; en producción `Secure`.

**D14 — Unicidad de estudiante por curso.** `UNIQUE(course_id, student_id)` y
`UNIQUE(course_id, seat_id)` en `enrollments`. Cambiar de asiento solo actualiza
`seat_id`; las `submissions` cuelgan del estudiante, no del asiento → no se
pierden entregas.

---

## 3. Esquema de datos

```
users
  id PK
  name str(200)
  email str(320) NULL UNIQUE          -- opcional en estudiantes
  role enum(admin|teacher|student)
  pin_hash str NULL                   -- argon2, solo estudiantes
  password_hash str NULL              -- argon2, admin/teacher
  is_active bool default true
  must_change_credentials bool default false
  created_at timestamptz

courses
  id PK
  name str(200)
  description text NULL
  code str(16) UNIQUE                 -- código corto de acceso
  status enum(active|archived) default active
  layout_rows int default 3
  layout_cols int default 5
  settings jsonb default {}           -- p.ej. {"peer_visibility_default": "class"}
  created_at timestamptz

course_teachers                          -- PK compuesta
  course_id FK->courses
  teacher_id FK->users
  PRIMARY KEY (course_id, teacher_id)

seats
  id PK
  course_id FK->courses
  row int, col int
  UNIQUE(course_id, row, col)

enrollments
  id PK
  course_id FK->courses
  student_id FK->users
  seat_id FK->seats NULL
  status enum(active|inactive) default active
  UNIQUE(course_id, student_id)
  UNIQUE(course_id, seat_id)          -- NULLs múltiples permitidos (PG)

sections
  id PK
  course_id FK->courses
  title str(200)
  slug str(80)
  order int
  kind enum(content|external)
  body_markdown text NULL
  external_url str(500) NULL
  UNIQUE(course_id, slug)

assignments
  id PK
  course_id FK->courses
  section_id FK->sections NULL
  title str(200)
  description_markdown text
  due_at timestamptz NULL
  max_score decimal(6,2) default 100
  visibility enum(private|class) default private
  created_by FK->users
  created_at timestamptz

submissions
  id PK
  assignment_id FK->assignments NULL   -- entregas libres
  course_id FK->courses
  student_id FK->users
  github_url str(500) NULL
  notes text
  status enum(draft|submitted|reviewed|needs_changes) default draft
  submitted_at timestamptz NULL
  version int default 1
  created_at, updated_at

submission_files
  id PK
  submission_id FK->submissions ON DELETE CASCADE
  original_name str(255)
  stored_name str(64)                  -- nombre aleatorio en disco/S3
  mime str(100)
  size_bytes bigint
  sha256 str(64)

evaluations
  id PK
  submission_id FK->submissions
  teacher_id FK->users
  score decimal(6,2) NULL
  rubric_scores jsonb default {}
  comment_markdown text
  created_at timestamptz               -- historial append-only

announcements
  id PK
  course_id FK->courses
  author_id FK->users
  title str(200)
  body_markdown text
  created_at timestamptz

attendance_records
  id PK
  course_id FK->courses
  student_id FK->users
  date date
  status enum(present|late|absent|excused)
  UNIQUE(course_id, student_id, date)

audit_logs
  id PK
  actor_id FK->users NULL
  action str(80)                       -- p.ej. auth.login_failed, pin.reset
  entity_type str(80) NULL
  entity_id str(64) NULL
  course_id FK->courses NULL
  payload jsonb default {}
  ip str(45) NULL
  created_at timestamptz

refresh_tokens                          -- D4, fase 1
  id PK
  user_id FK->users
  token_hash str(64)                   -- sha256 del token
  expires_at timestamptz
  revoked_at timestamptz NULL
  created_at timestamptz
```

Índices: todas las FK + columnas de filtrado frecuente
(`courses.code`, `enrollments.student_id`, `submissions.course_id`,
`submissions.student_id`, `submissions.status`, `audit_logs.action`,
`audit_logs.created_at`, `attendance_records.date`…).

Relación clave estudiante–asiento: `enrollments` separa entidades (D14);
mover un estudiante de asiento no toca `submissions`.

---

## 4. Matriz de permisos (siempre en backend)

Políticas reutilizables de FastAPI (dependencias): `CurrentUser`,
`RequireAdmin`, `RequireTeacherOf(course)`, `RequireEnrolled(course)`,
`CanWriteSubmission`, `CanReadSubmission`, `CanEvaluate`.

| Acción | admin | teacher (sus cursos) | student (matriculado) |
|--------|:-----:|:--------------------:|:---------------------:|
| CRUD cursos, clonar, archivar | ✔ | — | — |
| Gestionar profesores/estudiantes/PINs | ✔ | — | — |
| Ver AuditLog / métricas | ✔ | métricas de sus cursos | — |
| Crear secciones/tareas/anuncios | ✔ | ✔ | — |
| Ver todas las entregas del curso | ✔ | ✔ | solo si `visibility=class` (sin evaluaciones ajenas) |
| Escribir/borrar entrega | — | — | solo las suyas |
| Evaluar (nota, rúbrica, comentario) | ✔ | ✔ | — (solo lee la propia) |
| Pasar lista | ✔ | ✔ | — |
| Ver anuncios/secciones del curso | ✔ | ✔ | ✔ |
| Matricularse / ver cursos ajenos | ✔ | solo los suyos | solo los suyos |
| Exportar CSV notas / RGPD | ✔ / RGPD propio | exportar sus cursos | exportar sus datos |

Invariantes de seguridad (con tests obligatorios):

1. Estudiante jamás recibe `score`, `comment_markdown` o `rubric_scores` de
   otra persona (ni por ID directo).
2. Estudiante solo escribe en `submissions.student_id == yo`.
3. Estudiante sin matrícula ⇒ 404 en cualquier recurso del curso (no 403 con
   filtración de existencia).
4. Teacher sin `course_teachers` ⇒ 404 en el curso.
5. Multi-tenant: toda query de curso incluye `course_id`.
6. Mover de asiento no altera `submissions`.
7. PIN erróneo ×5 ⇒ bloqueo temporal + `audit_logs`.

---

## 5. Estructura de carpetas

```
/
├── PLAN.md  CHANGELOG.md  README.md  LICENSE
├── Makefile  docker-compose.yml  .env.example
├── .pre-commit-config.yaml  .gitignore
├── .github/workflows/ci.yml
├── backend/
│   ├── Dockerfile  pyproject.toml  alembic.ini
│   ├── alembic/
│   │   ├── env.py  script.py.mako
│   │   └── versions/0001_initial.py
│   ├── app/
│   │   ├── main.py                   # create_app, middleware, router
│   │   ├── core/                     # config, logging, security, deps
│   │   ├── db/                       # base, session
│   │   ├── models/                   # SQLAlchemy 2.x (Mapped[])
│   │   ├── schemas/                  # Pydantic v2
│   │   ├── api/v1/routes/            # endpoints
│   │   ├── services/                 # lógica de negocio
│   │   ├── security/                 # políticas/permisos reutilizables
│   │   └── storage/                  # LocalStorage / S3Storage (fase 1)
│   ├── scripts/seed_demo.py          # curso Java 3×5 demo (fase 1+)
│   └── tests/
│       ├── conftest.py
│       ├── unit/
│       └── integration/
└── frontend/
    ├── Dockerfile  package.json  vite.config.ts  eslint.config.js
    ├── index.html  tsconfig*.json  .prettierrc
    └── src/
        ├── main.tsx  App.tsx  index.css
        ├── app/                      # router, providers, layout
        ├── components/ui/            # Button, Spinner, Toast, Confirm…
        ├── features/                 # auth, classroom, assignments, admin…
        ├── lib/                      # api client, query, utils
        └── test/setup.ts
```

---

## 6. Superficie API (v1, resumen por fase)

- **Fase 1:** `POST /auth/login` (curso+código+PIN / email+password),
  `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/change-credentials`,
  `GET /courses`, `GET /courses/{code}`, `GET /courses/{id}/classroom`,
  `GET/POST /courses/{id}/enrollments`, seats, `GET/POST /submissions`,
  upload/download de archivos, `GET/POST /submissions/{id}/evaluations`.
- **Fase 2:** sections, assignments (+versiones, fechas), announcements,
  admin CRUD, import CSV, audit log.
- **Fase 3:** rubrics, attendance, calendar, GitHub metadata, clone course,
  metrics, CSV export, RGPD.

Prefijo: `/api/v1`. Errores: `{ "detail": str }` FastAPI estándar.

---

## 7. Seguridad transversal

- CORS por lista de orígenes (`CORS_ORIGINS`), no `*`.
- Headers: `X-Content-Type-Options`, `X-Frame-Options=DENY`,
  `Referrer-Policy`, CSP básica en producción.
- Pydantic estricto; sin SQL a mano; ORM/parametrizado.
- Secretos solo por env; `.env.example` sin valores reales.
- Logs JSON estructurados sin PIN/tokens/contraseñas.
- Markdown sanitizado al renderizar (FE) y nunca se guarda HTML confiado.
- RGPD (fase 3): exportar y borrar datos de un estudiante.

---

## 8. Calidad y CI

- `ruff check` + `ruff format --check` + `mypy` + `pytest --cov` (≥80 %).
- `eslint` + `prettier --check` + `vitest run`.
- pre-commit: ruff, format, trailing whitespace, EOF, check-yaml,
  detect-private-key, prettier (FE).
- GitHub Actions: jobs `backend` (3.12, lint+tests+alembic sobre PG) y
  `frontend` (lint+tests) y `compose-config`.

---

## 9. Fases

| Fase | Contenido | Criterio de salida |
|------|-----------|--------------------|
| 0 | PLAN, repo, compose, CI, linters, BD+migraciones | lint+tests en verde; `alembic upgrade head` OK |
| 1 MVP | auth PIN segura, cursos, asientos, matrículas, vista de aula, entregas (archivos+GitHub), evaluación, tests de permisos | tests de permisos obligatorios en verde |
| 2 | secciones MD, tareas+fechas+versiones, visibilidad, admin, CSV, anuncios, AuditLog | lint+tests+compose+CHANGELOG |
| 3 | rúbricas, asistencia, calendario, GitHub meta, clonar, métricas, CSV, RGPD, UX/a11y | lint+tests+compose+CHANGELOG |

---

## 10. Seed de demo (script aparte, nunca en código de producción)

Curso "Java" 3×5 asientos, 1 profesora, 15 estudiantes, secciones de ejemplo
(HTML, CSS, Java, JS, Información externa). Comando: `make seed` /
`python -m scripts.seed_demo`.
