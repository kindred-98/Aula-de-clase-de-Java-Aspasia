<div align="center">

<img src="./assets/images.jpg" alt="Aspasia — La formación de tu futuro" width="420" />

# Aspasia · Aula Virtual Multi-Curso

**Plataforma profesional de gestión de aulas para la academia Aspasia**

[![Phase](https://img.shields.io/badge/phase-0--3%20complete-16a34a?style=flat-square)](./CHANGELOG.md)
[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.141-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/backend-79%20tests%20%C2%B7%2086%25%20cov-0ea5e9?style=flat-square)](./backend/tests)
[![Frontend](https://img.shields.io/badge/frontend-17%20tests-8b5cf6?style=flat-square)](./frontend/src)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)

**Guía de arranque → [COMANDOS_DE_LA_APP.md](./Archivo_Markdown/COMANDOS/COMANDOS_DE_LA_APP.md)** · Arquitectura → [PLAN_CLAUDE.md](./Archivo_Markdown/PLAN/PLAN_CLAUDE.md) · Entregas → [CHANGELOG.md](./CHANGELOG.md)

</div>

---

## 📑 Índice

1. [Introducción](#-introducción)
2. [Por qué existe Aspasia](#-por-qué-existe-aspasia)
3. [Para qué sirve](#-para-qué-sirve)
4. [Usuario y roles](#-usuario-y-roles)
5. [Cómo funciona la aplicación](#-cómo-funciona-la-aplicación)
6. [Flujos de registro y acceso](#-flujos-de-registro-y-acceso)
7. [Pantallas y funcionalidades](#-pantallas-y-funcionalidades)
8. [Arquitectura técnica](#-arquitectura-técnica)
9. [Modelo de datos (resumen)](#-modelo-de-datos-resumen)
10. [Matriz de permisos](#-matriz-de-permisos)
11. [Seguridad](#-seguridad)
12. [Calidad y pruebas](#-calidad-y-pruebas)
13. [Instalación y arranque](#-instalación-y-arranque)
14. [Estructura del repositorio](#-estructura-del-repositorio)
15. [Documentación relacionada](#-documentación-relacionada)
16. [Autor](#-autor)
17. [Conclusión](#-conclusión)

---

## 📖 Introducción

**Aspasia** es una plataforma web de aula virtual multi-curso para la academia **Aspasia — La formación de tu futuro**. El primer caso de uso es una clase de **Java** con **3 filas × 5 asientos** y la profesora al frente; el modelo está pensado para crecer a todos los cursos de la academia.

El nombre rinde homenaje a **Aspasia de Mileto**, educadora y retórica de la Atenas clásica: símbolo de enseñanza cercana, diálogo y rigor. La misión del producto es la misma: **que el aula física se convierta en un espacio digital ordenado, seguro y medible**, sin perder la metáfora del “asiento” que cada estudiante ocupa en la clase.

Este README explica **qué es**, **por qué se creó**, **para qué fin** y **cómo funciona de punta a punta**. Los comandos operativos están en **[COMANDOS_DE_LA_APP.md](./Archivo_Markdown/COMANDOS/COMANDOS_DE_LA_APP.md)**.

---

## 💡 Por qué existe Aspasia

### El problema

Las academias de programación gestionan clases con herramientas genéricas (Drive, Classroom, hojas de cálculo, Moodle “a medias”):

- No representan la **cuadrícula real del aula** ni quién va en cada asiento.
- Mezclan **entregas, notas y comentarios** sin un control fino de quién ve qué.
- No resuelven el **alta masiva de alumnos con PIN simples** (móvil en el aula, sin email obligatorio).
- Pierden **historial de evaluaciones**, rúbricas, asistencia y calendario en sitios distintos.
- Complican el **multi-curso**: cada clase nueva es empezar de cero.

### La solución

Una sola plataforma donde:

1. **Crear un curso nuevo = nombre + código + tamaño de aula** (y opcionalmente clonar secciones de otro curso).
2. Cada estudiante tiene su **“asiento”** y su **espacio de trabajo** (archivos + enlaces GitHub).
3. La profesora **evalúa dentro de la app** (nota, rúbrica, comentario Markdown, “requiere cambios”).
4. Los compañeros pueden ver trabajos **solo si la tarea es de visibilidad `class`**, y **nunca** notas ni comentarios ajenos.
5. Administra el centro: profesores, matrículas, PINs, CSV, auditoría y métricas.

### Para qué fin (objetivos de producto)

| Fin | Cómo se materializa |
|-----|---------------------|
| **Operar el aula del día a día** | Cuadrícula con estados, entrega, evaluación, asistencia |
| **Escalar a más cursos** | Multi-tenant por `course_id`, clonar plantillas, secciones dinámicas |
| **Seguridad y cumplimiento** | JWT + argon2, rate-limit, AuditLog, RGPD (export/borrar datos) |
| **Calidad de software** | Tests de permisos obligatorios, cov ≥80 %, CI en cada PR |
| **UX real en móvil** | Responsive, light/dark, a11y básica, toasts y confirmaciones |

---

## 🎯 Para qué sirve

### Caso de uso principal (clase Java)

```
Profesora al frente
┌─────────────────────────────────────────┐
│  [1,1] [1,2] [1,3] [1,4] [1,5]         │
│  [2,1] [2,2] [2,3] [2,4] [2,5]         │
│  [3,1] [3,2] [3,3] [3,4] [3,5]         │
│         ← 15 estudiantes →             │
└─────────────────────────────────────────┘
```

- Cada asiento muestra **nombre + estado** (sin entregar / entregado / revisado / atrasado) con **texto e ícono**, no solo color.
- Clic en un asiento → espacio de ese estudiante (para staff) o su workspace (si es él).

### Capacidades (Fases 0–3 completadas)

- Auth con **PIN de 6 dígitos** (estudiantes) y **email + contraseña** (staff).
- Cursos, asientos, matrículas, secciones Markdown, tareas con fechas y versiones.
- Archivos con **allowlist de extensiones**, validación de contenido real, `sha256` y descarga por endpoint con permisos.
- Enlaces **GitHub** con metadatos vía API (lenguaje, último commit, README) y **degradación** si falla la red.
- Evaluación **append-only** (historial), rúbricas, export CSV de notas.
- Asistencia por día, calendario (tareas + anuncios), anuncios.
- Admin: usuarios, reset PIN, import CSV, audit log, métricas, **clonar curso**, archivar (no borrar).
- RGPD: exportar y anonimizar datos del estudiante.

---

## 👥 Usuario y roles

| Rol | Identidad | Quién lo crea | Qué ve |
|-----|-----------|---------------|--------|
| **admin** | email + contraseña | Script `create_admin` o seed | Todo: cursos, usuarios, PINs, auditoría |
| **teacher** | email + contraseña | El admin (cuenta) + asignación al curso | Solo **sus** cursos (`course_teachers`) |
| **student** | **código de curso + username + PIN** | El admin (CSV o individual); **no hay auto-registro** | Solo cursos donde está **matriculado** |

> El **rol lo asigna el admin** al crear el usuario. **“Dar clase” = asignación explícita** al curso, no implícita por tener el rol `teacher`.

---

## ⚙️ Cómo funciona la aplicación

### 1. Arquitectura de alto nivel

```
┌──────────────┐     HTTPS/JSON      ┌──────────────────┐      ┌─────────────┐
│  Navegador   │ ◄─────────────────► │  API FastAPI     │ ◄──► │ PostgreSQL  │
│  React SPA   │   /api/v1           │  (JWT + policies)│      │  (Alembic)  │
│  TanStack Q. │                     │  Storage local   │      └─────────────┘
└──────────────┘                     │  o S3 preparado  │
                                     └──────────────────┘
```

- **Frontend:** React 19 + Vite + TypeScript + Tailwind 4 + React Router 7 + TanStack Query 5. En memoria: access token JWT corto; refresh en cookie `HttpOnly`.
- **Backend:** FastAPI, SQLAlchemy 2.x, Pydantic v2, Alembic, argon2. Toda regla de permisos vive **en el servidor**.
- **Almacenamiento:** interfaz abstracta `Storage` → `LocalStorage` (disco) en dev; `S3Storage` preparada para prod.

### 2. Ciclo de vida de una sesión

1. Login (estudiante o staff) → access JWT **15 min** + refresh **rotatorio** (cookie path `/api/v1/auth`).
2. UI llama a `/api/v1/...` con `Authorization: Bearer …`.
3. Dependencias FastAPI (`CurrentUser`, `require_admin`, `require_staff_of_course`, `require_enrolled`, …) validan **en cada endpoint**.
4. Logout → refresh revocado. 5 logins fallidos / 15 min → **429** + AuditLog.

### 3. Ciclo de vida académico de un curso

```
Admin crea curso (nombre, código, rows×cols)
    → genera seats
    → asigna profesora (course_teachers)
    → importa alumnos (CSV) + PINs
    → matricula y coloca en asientos

Profesora crea secciones, tareas, anuncios, rúbricas
Estudiante entrega (GitHub + archivos + notas) → status: draft → submitted
Profesora evalúa (score, rúbrica, comentario) → reviewed | needs_changes
    → historial de evaluaciones (nunca se sobrescribe)
Asistencia / calendario / export CSV / métricas
```

### 4. Estados de una entrega

| Estado | Significado |
|--------|-------------|
| `draft` | Borrador del estudiante |
| `submitted` | Enviada, en cola de revisión |
| `reviewed` | Evaluada |
| `needs_changes` | La profesora pidió correcciones (reentrega → `version++`) |

### 5. Visibilidad entre compañeros

- `visibility = private` → solo el autor y el staff del curso.
- `visibility = class` → otros estudiantes ven **archivos y enlaces** del trabajo.
- **Jamás** se envía al cliente `score`, `comment_markdown` ni `rubric_scores` de otra persona (test de permisos obligatorio).

---

## 🔐 Flujos de registro y acceso

### Estudiante — ¿quién da el PIN y el identificador?

**No existe auto-registro.** Solo el admin da de alta:

| Paso | Acción |
|------|--------|
| 1 | Admin **importa CSV** (`name[,email][,username]`) o resetea un PIN individual |
| 2 | Backend genera **username** (si no venía) y **PIN de 6 dígitos** |
| 3 | Respuesta del admin muestra PIN y username **una sola vez** |
| 4 | El admin entrega por el canal que sea: **código de curso + username + PIN** |
| 5 | Login pide **los tres** (`course_code` + `identifier` + `pin`) — nunca solo el PIN |
| 6 | Si `must_change_credentials` → pantalla de **cambio de PIN obligatorio** |

PINs y contraseñas se guardan **solo con argon2**. En AuditLog **nunca** aparece el PIN en claro.

### Profesora / admin — ¿cómo se registra?

**Tampoco se auto-registra:**

| Paso | Quién | Qué |
|------|--------|-----|
| 1 | Admin (o seed/script) | Crea cuenta: **nombre + email + contraseña**, rol `teacher` o `admin` |
| 2 | Admin | Crea el curso (nombre + código + 3×5…) |
| 3 | Admin | `POST /courses/{id}/teachers/{teacher_id}` → la vincula al curso |
| 4 | Profesora | Login con **email + contraseña** (pestaña “Personal”) |
| 5 | Backend | Solo ve cursos donde está en `course_teachers` (o es admin) |

**Resumen en una frase:** el estudiante recibe un “carnet” (código + usuario + PIN); el profesor tiene cuenta de correo y el admin decide **a qué clases entra**.

### Credenciales de demostración (seed)

| Usuario | Credencial |
|---------|------------|
| Curso | código **`JAVA`** |
| Profesora | `profe@demo.test` / `profe-demo-pass` |
| Estudiantes | `student01` … `student15` + PIN impreso por `python -m scripts.seed_demo` |
| Admin | el que definas con `AULA_ADMIN_EMAIL` / `AULA_ADMIN_PASSWORD` en `scripts.create_admin` |

---

## 🖥️ Pantallas y funcionalidades

| # | Pantalla | Ruta (SPA) | Quién |
|---|----------|------------|--------|
| 1 | Login + cambio de credenciales | `/login`, `/change-credentials` | todos |
| 2 | Lista de cursos | `/` | autenticados |
| 3 | **Vista de aula** (cuadrícula + estados) | `/courses/:id` | staff / enrolled |
| 4 | Workspace del estudiante | desde el asiento | student (propio) / staff |
| 5 | Contenido (secciones MD + anuncios) | `/courses/:id/content` | enrolled |
| 6 | Tareas y detalle (fechas, versiones) | `/courses/:id/work[...]` | enrolled / staff |
| 7 | **Evaluación** (nota + rúbrica + GitHub meta) | EvaluatePage | teacher / admin |
| 8 | Anuncios y **calendario** | `/courses/:id/calendar` | enrolled |
| 9 | **Asistencia** (tap en asientos) | `/courses/:id/attendance` | staff |
| 10 | **Rúbricas** CRUD | `/courses/:id/rubrics` | staff |
| 11 | **Admin** (usuarios, CSV, audit, métricas) | `/admin` | admin |
| 12 | Cuenta y **privacidad RGPD** | `/account/privacy` | todos (alcance por rol) |

UX transversal: tokens de diseño light/dark, estados de carga/vacío/error, toasts, confirmación en acciones destructivas, contraste AA, foco visible, ARIA en diálogos y `aria-live` en toasts.

---

## 🏗️ Arquitectura técnica

| Capa | Tecnología | Versión |
|------|------------|---------|
| Lenguaje BE | Python | ≥3.12 (Docker/CI: 3.12) |
| API | FastAPI | 0.141.1 |
| ORM | SQLAlchemy | 2.0.54 |
| Migraciones | Alembic | 1.20.0 |
| Validación | Pydantic v2 | 2.13.5 |
| BD | PostgreSQL | 17 (tests locales: SQLite) |
| Auth hash | argon2-cffi | 25.1.0 |
| JWT | PyJWT | 2.15.0 |
| Frontend | React + Vite + TS | 19 / 7 / 5.9 |
| CSS | Tailwind CSS | 4.x |
| Datos FE | TanStack Query | 5.x |
| Routing | React Router | 7.x |
| Tests | pytest + Vitest | cov backend ≥80 % |
| Lint | ruff, mypy strict, eslint, prettier | — |
| Infra | Docker Compose, GitHub Actions | postgres, api, nginx |

**Decisiones clave** (detalle en [PLAN_CLAUDE.md](./Archivo_Markdown/PLAN/PLAN_CLAUDE.md)):

- **Multi-tenant desde el día 1:** toda fila de curso lleva `course_id`.
- **Asiento ≠ estudiante:** `enrollments` separa entidades; mover de sitio **no pierde entregas**.
- **Evaluación inmutable:** cada nota es una fila nueva (historial).
- **Archivar ≠ borrar:** los cursos se archivan; el borrado físico no está en la UI.
- **Refresh rotatorio** revocable; access token corto en el cliente.
- **Sin Docker en la máquina dev:** se verifica con SQLite + TestClient; CI usa PostgreSQL real.

---

## 🗃️ Modelo de datos (resumen)

```
users ──< enrollments >── seats
  │         │
  │         └── courses ──< sections, assignments, announcements,
  │                          attendance_records, rubrics, audit_logs
  │
  ├── course_teachers (course ↔ teacher)
  └── submissions ──< submission_files
           │
           ├── evaluations (append-only)
           └── assignment_id nullable (entregas libres)

refresh_tokens · audit_logs · storage (disco/S3)
```

Tablas principales: `users`, `courses`, `course_teachers`, `seats`, `enrollments`, `sections`, `assignments`, `submissions`, `submission_files`, `evaluations`, `rubrics`, `announcements`, `attendance_records`, `audit_logs`, `refresh_tokens`.

Índices en **todas** las claves foráneas y columnas de filtrado frecuente.

---

## 🔒 Matriz de permisos

| Acción | admin | teacher (sus cursos) | student (matriculado) |
|--------|:-----:|:--------------------:|:---------------------:|
| CRUD cursos, clonar, archivar | ✔ | — | — |
| Gestionar profesores / alumnos / PINs | ✔ | — | — |
| Ver AuditLog / métricas globales | ✔ | métricas de sus cursos | — |
| Crear secciones, tareas, anuncios, rúbricas | ✔ | ✔ | — |
| Ver todas las entregas del curso | ✔ | ✔ | solo si `visibility=class` (sin eval. ajenas) |
| Escribir / borrar entrega | — | — | **solo las suyas** |
| Evaluar (nota, rúbrica, comentario) | ✔ | ✔ | — (solo lee la **propia**) |
| Pasar lista | ✔ | ✔ | — |
| Ver secciones / anuncios del curso | ✔ | ✔ | ✔ |
| Matricularse / ver cursos ajenos | ✔ | solo los suyos | solo los suyos |
| Exportar CSV / RGPD | ✔ / RGPD propio | exporta sus cursos | exporta **sus** datos |

**Invariantes con tests obligatorios:**

1. Un estudiante **nunca** recibe evaluación de otro (ni por ID directo).
2. Un estudiante **solo escribe** en `submissions.student_id == yo`.
3. Sin matrícula → **404** (no 403, para no filtrar existencia).
4. Teacher fuera de `course_teachers` → **404** en ese curso.
5. Toda query de curso filtra por `course_id`.
6. Cambiar de asiento **no altera** `submissions`.
7. 5 PINs fallidos → bloqueo temporal + AuditLog.

---

## 🛡️ Seguridad

- **HTTPS** en producción; CORS por **lista blanca** de orígenes (nunca `*`).
- Cabeceras: `X-Content-Type-Options`, `X-Frame-Options=DENY`, `Referrer-Policy`; `TrustedHost` en producción.
- **Pydantic estricto**; solo ORM/parametrizado (**sin SQL a mano**).
- Secretos **solo en variables de entorno**; `.env.example` sin valores reales.
- Logs JSON estructurados **sin** PIN, tokens ni contraseñas.
- Markdown del usuario: se guarda crudo y se **sanitiza al renderizar** (sin HTML confiado).
- Archivos: allowlist de extensiones, magic bytes, nombre aleatorio + sha256, descarga vía endpoint con permisos y `Content-Disposition: attachment`.
- **GitHub URL** solo `https://github.com/<usuario>/<repo>`; metadatos con caché TTL y timeout; si falla, **degrada** sin romper la UI.
- **RGPD:** `GET /me/export`, `DELETE /me/data` (estudiante), `DELETE /admin/users/{id}/data` (admin).

---

## ✅ Calidad y pruebas

| Área | Comando | Estado actual |
|------|---------|---------------|
| Backend lint | `ruff check` + `ruff format --check` + `mypy` | 🟢 |
| Backend tests | `pytest --cov=app --cov-fail-under=80` | 🟢 **79 tests · 86.73 %** |
| Frontend lint | `eslint` + `prettier --check` | 🟢 |
| Frontend tests | `vitest run` | 🟢 **17 tests** |
| Typecheck / build | `tsc -b` + `vite build` | 🟢 |
| Migraciones | `alembic upgrade head` | 🟢 (SQLite local; CI: PostgreSQL) |
| Smoke en vivo | TestClient sobre BD demo | 🟢 **27/27 checks** |
| CI | GitHub Actions en push/PR | backend + frontend + compose config |

Los tests de **permisos** son el criterio de aceptación prioritario (ver matriz anterior).

---

## 🚀 Instalación y arranque

**Guía completa paso a paso → [COMANDOS_DE_LA_APP.md](./Archivo_Markdown/COMANDOS/COMANDOS_DE_LA_APP.md)**

### Arranque express (Docker)

```bash
docker compose up --build -d
# Frontend http://localhost:3000 · API http://localhost:8000/docs
```

### Arranque express (local, 2 terminales)

```bash
# Terminal 1 — API
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
cp ../.env.example ../.env   # ajusta SECRET_KEY y DATABASE_URL
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

### Primer admin + seed

```bash
cd backend
AULA_ADMIN_EMAIL=admin@aspasia.test AULA_ADMIN_PASSWORD=TuClave123! python -m scripts.create_admin
python -m scripts.seed_demo   # imprime PINs de student01…15 una sola vez
```

Detalles, Makefile, troubleshooting y credenciales de demo: **[COMANDOS_DE_LA_APP.md](./Archivo_Markdown/COMANDOS/COMANDOS_DE_LA_APP.md)**.

---

## 📁 Estructura del repositorio

```
/
├── README.md              ← este documento
├── CHANGELOG.md           ← historial por fases
├── Archivo_Markdown/
│   ├── Explicacion_de_Cada_ARCHIVO.md  ← índice de toda la documentación
│   ├── COMANDOS/          ← COMANDOS_DE_LA_APP.md, run_comando.md
│   ├── PLAN/              ← PLAN_CLAUDE, PLAN_ADMIN, PLAN_PROFESOR, PLAN_ALUMNO
│   ├── PLANES_APLICADO_CON_EXITO/       ← informes TRABAJO_REALIZADO_*.md
│   └── PROMPT_INICIAL/    ← prompt_Claude_PrimerasFases.md
├── Makefile · docker-compose.yml · .env.example
├── .github/workflows/ci.yml
├── assets/images.jpg             # Logo oficial Aspasia
├── backend/
│   ├── app/
│   │   ├── main.py                 # factory FastAPI, CORS, headers
│   │   ├── core/                   # config, logging, security (JWT, argon2)
│   │   ├── db/ · models/ · schemas/
│   │   ├── api/v1/routes/          # auth, courses, work, admin, phase3…
│   │   ├── security/policies.py    # permisos reutilizables
│   │   ├── services/               # auth, audit, github_meta
│   │   └── storage/                # LocalStorage / S3Storage
│   ├── alembic/                    # migraciones
│   ├── scripts/                    # create_admin, seed_demo
│   └── tests/                      # 79 tests
└── frontend/
    └── src/
        ├── app/                    # router, layout, theme
        ├── components/ui/          # Button, Toast, Confirm…
        ├── features/               # auth, classroom, work, admin…
        └── lib/api.ts              # cliente HTTP tipado
```

---

## 📚 Documentación relacionada

| Documento | Contenido |
|-----------|-----------|
| **[COMANDOS_DE_LA_APP.md](./Archivo_Markdown/COMANDOS/COMANDOS_DE_LA_APP.md)** | Instalar, arrancar, tests, troubleshooting |
| **[run_comando.md](./Archivo_Markdown/COMANDOS/run_comando.md)** | Chuleta de arranque express (2 terminales) |
| **[PLAN_CLAUDE.md](./Archivo_Markdown/PLAN/PLAN_CLAUDE.md)** | Esquema de datos, matriz de permisos, decisiones D1–D14 |
| **[PLAN_ADMIN.md](./Archivo_Markdown/PLAN/PLAN_ADMIN.md)** · **[PLAN_PROFESOR.md](./Archivo_Markdown/PLAN/PLAN_PROFESOR.md)** · **[PLAN_ALUMNO.md](./Archivo_Markdown/PLAN/PLAN_ALUMNO.md)** | Planes por módulo: admin (A–D), profesor (T0–T4), alumno (S0–S4) |
| **[TRABAJO_REALIZADO_EN_ADMIN.md](./Archivo_Markdown/PLANES_APLICADO_CON_EXITO/TRABAJO_REALIZADO_EN_ADMIN.md)** · **[TRABAJO_REALIZADO_EN_PROFESOR.md](./Archivo_Markdown/PLANES_APLICADO_CON_EXITO/TRABAJO_REALIZADO_EN_PROFESOR.md)** · **[TRABAJO_REALIZADO_EN_ALUMNO.md](./Archivo_Markdown/PLANES_APLICADO_CON_EXITO/TRABAJO_REALIZADO_EN_ALUMNO.md)** | Informes de entregas por módulo |
| **[prompt_Claude_PrimerasFases.md](./Archivo_Markdown/PROMPT_INICIAL/prompt_Claude_PrimerasFases.md)** | Briefing inicial (contrato de trabajo) |
| **[Explicacion_de_Cada_ARCHIVO.md](./Archivo_Markdown/Explicacion_de_Cada_ARCHIVO.md)** | Índice: qué hace cada documento |
| **[CHANGELOG.md](./CHANGELOG.md)** | Qué se hizo y probó en cada fase (0–3, A–D, T, S) |
| **[LICENSE](./LICENSE)** | Licencia MIT |
| API (`/docs`) | OpenAPI interactiva en desarrollo |

---

## 👤 Autor

| | |
|--|--|
| **Proyecto** | Aspasia — La formación de tu futuro · Aula Virtual Multi-Curso |
| **Autor** | [kindred-98](https://github.com/kindred-98) · angelecheniq@gmail.com |
| **Rol en el repo** | Diseño, arquitectura e implementación full stack (Fases 0–3) |
| **Stack** | FastAPI · PostgreSQL · React/Vite/TS · Docker · CI |
| **Licencia** | MIT |

> Primera casilla de uso: clase de Java (3×5). Siguiente horizonte: más cursos de la academia con el mismo modelo multi-tenant.

---

## 🏁 Conclusión

**Aspasia** resuelve un problema concreto de las academias de programación: **operar el aula real con la seguridad y la trazabilidad de un producto profesional**, sin multi-tenant improvisado ni notas expuestas entre compañeros.

En este repositorio están, hoy:

- ✅ Las **Fases 0–3** del plan (de la base del repo al pulido UX/a11y, RGPD y clonación de cursos).
- ✅ Una **API tipada** con permisos centralizados y tests de seguridad como criterio de aceptación.
- ✅ Una **SPA responsive** con estados de carga/error, tema claro/oscuro y flujos de estudiante, profesora y admin.
- ✅ **Infraestructura** Docker + CI + migraciones Alembic listas para PostgreSQL 17.
- ✅ **Documentación viva**: este README (producto), COMANDOS (operación), PLAN (arquitectura) y CHANGELOG (entregas).

El siguiente paso operativo es **levantar la app** con la guía de comandos, crear el primer admin y dar clase con el curso semilla. A partir de ahí, cada curso nuevo es un nombre, un código y un tamaño de aula.

---

<div align="center">

<img src="./assets/images.jpg" alt="Aspasia — La formación de tu futuro" width="320" />

**Aspasia · La formación de tu futuro**  
*Aula virtual multi-curso para enseñar programación con rigor y claridad.*

[![README](https://img.shields.io/badge/docs-README-4f46e5?style=flat-square)](./README.md)
[![COMANDOS](https://img.shields.io/badge/docs-COMANDOS-0ea5e9?style=flat-square)](./Archivo_Markdown/COMANDOS/COMANDOS_DE_LA_APP.md)
[![PLAN](https://img.shields.io/badge/docs-PLAN-7c3aed?style=flat-square)](./Archivo_Markdown/PLAN/PLAN_CLAUDE.md)
[![CHANGELOG](https://img.shields.io/badge/docs-CHANGELOG-16a34a?style=flat-square)](./CHANGELOG.md)
[![Índice](https://img.shields.io/badge/docs-%C3%ADndice%20de%20docs-f59e0b?style=flat-square)](./Archivo_Markdown/Explicacion_de_Cada_ARCHIVO.md)

<br/>

<sub>© Aspasia · Licencia MIT · Documentación en español · Código y commits en inglés</sub>

</div>
