<div align="center">

<img src="./assets/images.jpg" alt="Aspasia — La formación de tu futuro" width="360" />

# 🚀 Guía de Comandos

**Aspasia · Aula Virtual Multi-Curso**

[![README](https://img.shields.io/badge/docs-README-4f46e5?style=flat-square)](./README.md)
[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.141-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)

*Todo lo que necesitas para instalar, arrancar, probar y mantener la app.*

[Volver al README](./README.md) · [Ir al índice](#-índice)

</div>

---

## 📑 Índice

1. [Propósito de esta guía](#-propósito-de-esta-guía)
2. [Requisitos previos](#-requisitos-previos)
3. [Variables de entorno](#-variables-de-entorno)
4. [Opción A — Arranque con Docker (recomendado)](#-opción-a--arranque-con-docker-recomendado)
5. [Opción B — Arranque local sin Docker](#-opción-b--arranque-local-sin-docker)
6. [Primer admin y seed de demo](#-primer-admin-y-seed-de-demo)
7. [Migraciones de base de datos](#-migraciones-de-base-de-datos)
8. [Tests y calidad de código](#-tests-y-calidad-de-código)
9. [Comandos Makefile (resumen)](#-comandos-makefile-resumen)
10. [Puertos y URLs](#-puertos-y-urls)
11. [Flujos de acceso (credenciales)](#-flujos-de-acceso-credenciales)
12. [Solución de problemas](#-solución-de-problemas)
13. [Conclusión](#-conclusión)

---

## 🎯 Propósito de esta guía

Esta página concentra **solo comandos operativos**: instalar dependencias, levantar la API y el frontend, crear el primer administrador, sembrar el curso de demostración, ejecutar tests y lint.

- Qué es la plataforma y **por qué existe** → [README.md](./README.md)
- Arquitectura, permisos y modelo de datos → [PLAN.md](./PLAN.md)
- Historial de entregas por fase → [CHANGELOG.md](./CHANGELOG.md)

> **Convención:** en Windows (PowerShell) usa `.venv\Scripts\python` o `.venv\Scripts\activate`; en Linux/macOS usa `python` / `source .venv/bin/activate`.

---

## 📦 Requisitos previos

| Componente | Versión mínima | Notas |
|------------|----------------|--------|
| Python | 3.12+ | Local también funciona con 3.13/3.14 (CI/Docker usan 3.12) |
| Node.js | 20+ | Incluye npm |
| Git | 2.x | |
| Docker + Compose | última | Opcional en local; necesario para el stack completo |
| PostgreSQL | 17 | Solo si no usas Docker (o SQLite para pruebas rápidas) |

```bash
# Verificar versiones
python --version   # o python3 --version
node --version
npm --version
git --version
docker --version
docker compose version
```

---

## 🔐 Variables de entorno

1. Copia el ejemplo:

```bash
cp .env.example .env
# Windows:
Copy-Item .env.example .env
```

2. Edita `.env` (nunca lo subas al repositorio). Claves principales:

| Variable | Descripción | Ejemplo / default |
|----------|-------------|-------------------|
| `SECRET_KEY` | Firma JWT (≥32 chars en producción) | cadena aleatoria larga |
| `DATABASE_URL` | URL de SQLAlchemy | `postgresql+psycopg://aula:aula@localhost:5432/aula` |
| `CORS_ORIGINS` | Orígenes permitidos (coma) | `http://localhost:5173,http://localhost:3000` |
| `ENVIRONMENT` | `development` \| `production` | `development` |
| `DEBUG` | Activa `/docs` y OpenAPI | `true` en dev |
| `MAX_UPLOAD_MB` | Tamaño máximo de subida | `10` |
| `STORAGE_BACKEND` | `local` \| `s3` | `local` |
| `AULA_ADMIN_EMAIL` / `AULA_ADMIN_PASSWORD` | Solo al crear el primer admin | ver abajo |

Frontend (Vite): `VITE_API_BASE_URL` → `http://localhost:8000/api/v1`.

---

## 🐳 Opción A — Arranque con Docker (recomendado)

Levanta **PostgreSQL + API + frontend** en un solo comando.

```bash
# Desde la raíz del repo
docker compose up --build -d
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| Docs (dev) | http://localhost:8000/docs |
| PostgreSQL | `localhost:5432` (user/pass/db: `aula`) |

```bash
# Estados y logs
docker compose ps
docker compose logs -f api
docker compose logs -f frontend

# Bajar (conserva volúmenes de datos)
docker compose down

# Bajar y borrar volúmenes (¡borra la BD!)
docker compose down -v
```

**Migraciones + admin + seed dentro del contenedor API:**

```bash
docker compose exec api alembic upgrade head

docker compose exec api env \
  AULA_ADMIN_EMAIL=admin@aspasia.test \
  AULA_ADMIN_PASSWORD=CambiarClave123! \
  python -m scripts.create_admin

docker compose exec api python -m scripts.seed_demo
```

> Si tu `make` no está disponible en Windows, ejecuta los comandos `docker compose …` directamente.

---

## 💻 Opción B — Arranque local sin Docker

### B1. Instalar dependencias

```bash
# Backend
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\Activate.ps1
# Linux / macOS
# source .venv/bin/activate

python -m pip install --upgrade pip
pip install -e ".[dev]"

# Frontend (otra terminal)
cd frontend
npm install
```

Atajo con Makefile (Linux/macOS o make en Windows):

```bash
make install
```

### B2. Base de datos

**Con PostgreSQL local (recomendado para parecerse a producción):**

```bash
# Asegura que PostgreSQL esté en marcha y crea la BD si hace falta
# (usuario/contraseña/db de ejemplo: aula/aula/aula)
```

En `.env`:

```env
DATABASE_URL=postgresql+psycopg://aula:aula@localhost:5432/aula
SECRET_KEY=una-clave-secreta-larga-minimo-32-caracteres
ENVIRONMENT=development
DEBUG=true
```

**Sin PostgreSQL (solo para probar rápido):**

```bash
# Windows PowerShell
$env:DATABASE_URL="sqlite:///./dev.db"
$env:SECRET_KEY="dev-only-insecure-secret-change-me-32chars"
$env:AULA_ENVIRONMENT="development"
$env:AULA_DEBUG="true"
```

> En Linux/macOS: `export DATABASE_URL="sqlite:///./dev.db"` etc.

### B3. Migraciones

```bash
cd backend
alembic upgrade head
# Windows con venv sin activar:
# .\.venv\Scripts\python.exe -m alembic upgrade head
```

### B4. Arrancar la app (2 terminales)

**Terminal 1 — API:**

```bash
cd backend
# Windows (venv activado):
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# Sin activar venv:
# .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

| Servicio | URL |
|----------|-----|
| Frontend (Vite) | http://localhost:5173 |
| API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| Health | http://localhost:8000/health · http://localhost:8000/api/v1/health |

El proxy de Vite redirige `/api` → `http://localhost:8000`.

```bash
# Detener: Ctrl+C en cada terminal
```

---

## 👤 Primer admin y seed de demo

### Crear el primer administrador

```bash
cd backend

# Windows PowerShell
$env:AULA_ADMIN_EMAIL="admin@aspasia.test"
$env:AULA_ADMIN_PASSWORD="TuClaveSegura123!"
python -m scripts.create_admin

# Linux / macOS
export AULA_ADMIN_EMAIL="admin@aspasia.test"
export AULA_ADMIN_PASSWORD="TuClaveSegura123!"
python -m scripts.create_admin
```

- Contraseña mínima: **8 caracteres**.
- Idempotente: si el email ya existe, no duplica.

### Seed de demostración (curso Java 3×5)

```bash
cd backend
python -m scripts.seed_demo
```

Crea (si no existe el código `JAVA`):

| Elemento | Valor |
|----------|--------|
| Curso | `Java` · código **`JAVA`** · 3 filas × 5 columnas |
| Profesora | `profe@demo.test` / `profe-demo-pass` |
| Estudiantes | `student01` … `student15` con **PIN de 6 dígitos** (se imprimen una vez) |
| Secciones | HTML, CSS, Java, JS, Información externa |
| `must_change_credentials` | `true` en alumnos → **cambio de PIN obligatorio** al entrar |

La salida del script incluye el mapa `username → PIN`. Guárdala; no se vuelve a mostrar.

### Panel admin tras el login

Con el admin creado, entra en la app → pestaña **Admin**:

- Buscar/listar usuarios y filtrar por rol  
- Activar/desactivar cuentas  
- **Reset de PIN** (se muestra una sola vez)  
- **Importar estudiantes por CSV** (`name[,email][,username]`) con PINs en lote  
- Audit log con filtros  
- Métricas por curso  

Asignar profesora a un curso (API, solo admin):

```http
POST /api/v1/courses/{course_id}/teachers/{teacher_id}
```

Matricular estudiante y asignar asiento:

```http
POST /api/v1/courses/{course_id}/enrollments
```

---

## 🗄️ Migraciones de base de datos

```bash
cd backend

# Aplicar todo lo pendiente
alembic upgrade head

# Última revisión aplicada
alembic current

# Historial
alembic history

# Nueva migración (desarrollo)
alembic revision --autogenerate -m "descripcion_corta"

# Solo SQLite local (si no usas PG en esta shell)
$env:ALEMBIC_DATABASE_URL="sqlite:///./dev.db"   # PowerShell
# export ALEMBIC_DATABASE_URL="sqlite:///./dev.db"  # bash
alembic upgrade head
```

---

## 🧪 Tests y calidad de código

### Backend (pytest + ruff + mypy)

```bash
cd backend

# Todo en verde (lo que usa CI)
ruff check .
ruff format --check .
mypy app
pytest --cov=app --cov-fail-under=80

# Solo un archivo / un test
pytest tests/test_permissions.py -q
pytest tests/test_permissions.py::test_nombre_del_test -q

# Watch (si instalas pytest-watch u opcional)
# pytest --cov=app -q --lf
```

### Frontend (eslint + prettier + vitest + build)

```bash
cd frontend

npm run lint          # ESLint
npm run format        # Prettier --write
npm run format:check  # Prettier --check
npm run typecheck     # tsc -b
npm run test          # Vitest run
npm run build         # tsc + vite build (producción)
npm run preview       # sirve dist/ en local
npm run test:watch    # watch mode
```

### Makefile (atajos)

```bash
make lint    # backend + frontend
make test    # backend + frontend
make ci      # lint + test
```

### pre-commit (opcional, recomendado)

```bash
cd backend   # o raíz según config
pre-commit install
pre-commit run --all-files
```

### CI (GitHub Actions)

En cada push/PR a `main`, el workflow `.github/workflows/ci.yml` ejecuta:

1. **backend**: ruff, format, mypy, `alembic upgrade` sobre PostgreSQL 17, pytest ≥80 %  
2. **frontend**: lint, format, typecheck, tests, build  
3. **compose**: `docker compose config`

---

## 🧰 Comandos Makefile (resumen)

| Comando | Qué hace |
|---------|----------|
| `make install` | Instala backend (`pip -e .[dev]`) y frontend (`npm install`) |
| `make lint` | ruff + format + mypy + eslint + prettier |
| `make test` | pytest ≥80 % + vitest |
| `make migrate` / `make upgrade` | `alembic upgrade head` |
| `make seed` | Curso demo Java 3×5 |
| `make up` | `docker compose up --build -d` |
| `make down` | `docker compose down` |
| `make logs` | Logs en vivo de compose |
| `make dev-backend` | uvicorn `--reload` en :8000 |
| `make dev-frontend` | Vite en :5173 |
| `make ci` | lint + test (paridad con CI) |
| `make help` | Lista de comandos |

---

## 🔌 Puertos y URLs

| Puerto | Servicio |
|--------|----------|
| 3000 | Frontend (Docker / nginx) |
| 5173 | Frontend (Vite dev) |
| 8000 | API FastAPI |
| 5432 | PostgreSQL |

| Ruta útil | Descripción |
|-----------|-------------|
| `/` | SPA (login, aula, admin…) |
| `/docs` | Swagger UI (solo con `DEBUG=true`) |
| `/openapi.json` | Esquema OpenAPI |
| `/health` · `/api/v1/health` | Health check |
| `/api/v1/*` | Prefijo de la API v1 |

---

## 🔑 Flujos de acceso (credenciales)

### Estudiante (no se auto-registra)

```
Admin importa CSV o resetea PIN
        ↓
Recibe: código de curso + username + PIN (6 dígitos)
        ↓
Login: course_code + identifier + pin
        ↓
must_change_credentials → cambiar PIN obligatorio
        ↓
Entrar al aula
```

```text
Código JAVA · student01 · PIN impreso por el seed o por el admin
```

### Personal (admin / profesora)

```
Admin crea cuenta (email + contraseña) o seed
        ↓
Admin asigna profesora al curso (course_teachers)
        ↓
Login: email + contraseña  (pestaña "Personal")
```

| Demo (seed) | Credencial |
|-------------|------------|
| Admin (si usas create_admin) | `admin@aspasia.test` + la que definas |
| Profesora | `profe@demo.test` / `profe-demo-pass` |

> **Seguridad:** 5 intentos fallidos → bloqueo temporal (ventana 15 min) + registro en AuditLog. Los PINs solo se guardan con **argon2**; nunca en claro ni en logs.

---

## 🧰 Solución de problemas

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `DATABASE_URL` sin definir / error de driver | Falta `.env` o driver PG | Copia `.env.example`; `pip install -e ".[dev]"` |
| `Address already in use` | Puerto 8000/5173 ocupado | Cierra el proceso o cambia el puerto |
| Frontend no ve la API | uvicorn parado o proxy mal | Arranca backend en :8000; revisa `vite.config.ts` |
| `Secret key too short` | `SECRET_KEY` débil | ≥32 caracteres aleatorios |
| CORS error en navegador | Origen no listado | Añade `http://localhost:5173` a `CORS_ORIGINS` |
| Migración no aplica en SQLite | FKs en alter | Se usa `batch_alter_table` (ya en la migración de rúbricas) |
| `must_change_credentials` al usar seed | Diseño intencional | Cambia el PIN en el primer login |
| PIN perdido (seed) | Solo se imprime una vez | Admin → **Reset de PIN** |
| `docker compose` no encuentra servicios | No estás en la raíz | Ejecuta desde el directorio con `docker-compose.yml` |
| Windows: `ruff`/`pytest` no se encuentran | Venv sin activar | `.\.venv\Scripts\Activate.ps1` o rutas absolutas al exe |
| Tests frontend 0 | Node_modules incompleto | `npm ci` o `npm install` |

**Verificación mínima de salud:**

```bash
curl -s http://localhost:8000/health
# → {"status":"ok", ...}

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
# → 200
```

---

## 🏁 Conclusión

Con esta guía puedes, en orden:

1. **Instalar** backend y frontend (Docker o local).  
2. **Configurar** `.env` y aplicar migraciones.  
3. **Crear** el primer admin y, opcionalmente, el seed Java 3×5.  
4. **Arrancar** API + UI y comprobar `/health`.  
5. **Ejecutar** lint y tests al mismo nivel que CI.  
6. **Diagnosticar** los fallos habituales con la tabla de troubleshooting.

Para el **porqué del producto**, roles, perminos y mapa de pantallas, vuelve al [README](./README.md).  
Para decisiones de arquitectura, consulta [PLAN.md](./PLAN.md).

---

<div align="center">

<img src="./assets/images.jpg" alt="Aspasia — La formación de tu futuro" width="220" />

**Aspasia · La formación de tu futuro**  
Guía de comandos · Aula Virtual Multi-Curso

[README](./README.md) · [PLAN](./PLAN.md) · [CHANGELOG](./CHANGELOG.md) · [LICENSE](./LICENSE)

<br/>

<sub>Documentación operativa · © Aspasia · Licencia MIT</sub>

</div>
