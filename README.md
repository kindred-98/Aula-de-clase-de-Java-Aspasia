# Aula Virtual

Plataforma web de aula virtual multi-curso: asientos en cuadrícula, entregas con
archivos y enlaces a GitHub, evaluación de la profesora, secciones dinámicas y
panel de administración.

Documentación de arquitectura y decisiones: **[PLAN.md](./PLAN.md)**.
Historial de fases: **[CHANGELOG.md](./CHANGELOG.md)**.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, PostgreSQL
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS 4, TanStack Query, React Router
- **Auth:** JWT corto + refresh rotatorio, argon2 (PIN y contraseñas)
- **Tests:** pytest (≥80 % cobertura), Vitest + Testing Library
- **Infra:** Docker Compose, GitHub Actions, ruff/mypy/eslint/prettier, pre-commit

## Requisitos

- Python 3.12+ (desarrollo local también funciona con 3.13/3.14)
- Node.js 20+ y npm
- Docker (opcional en local; necesario para el stack completo)
- PostgreSQL 17 (vía Docker o instalado)

## Variables de entorno

Copia `.env.example` a `.env` y ajusta valores. Nunca subas `.env` al repositorio.

| Variable | Descripción |
|----------|-------------|
| `SECRET_KEY` | Clave JWT (≥32 caracteres en producción) |
| `DATABASE_URL` | URL de SQLAlchemy/PostgreSQL |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma |
| `MAX_UPLOAD_MB` | Tamaño máximo de subida (por defecto 10) |

## Arranque rápido (Docker)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:8000
- Docs (desarrollo): http://localhost:8000/docs

## Desarrollo local sin Docker

```bash
# Backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate | Unix: source .venv/bin/activate
pip install -e ".[dev]"
export DATABASE_URL=postgresql+psycopg://aula:aula@localhost:5432/aula
alembic upgrade head
uvicorn app.main:app --reload

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

## Tests

```bash
make test            # o manualmente:
cd backend && pytest --cov=app --cov-fail-under=80
cd frontend && npm run test
```

## Lint / formato

```bash
make lint
# backend
cd backend && ruff check . && ruff format --check . && mypy app
# frontend
cd frontend && npm run lint && npm run format:check
```

## Primer admin

```bash
cd backend
# Variables (o usar .env): AULA_ADMIN_EMAIL / AULA_ADMIN_PASSWORD
python -m scripts.create_admin
```

Los PINs de estudiantes los genera el admin desde el panel (se muestran una
sola vez) o con `python -m scripts.seed_demo` para el curso de demostración.

## Migraciones

```bash
cd backend
alembic upgrade head          # aplicar
alembic revision --autogenerate -m "descripcion"  # nueva migración
```

## Seed de demo

```bash
make seed
# Curso "Java" 3×5, 1 profesora, 15 estudiantes
```

## Comandos útiles (Makefile)

| Comando | Descripción |
|---------|-------------|
| `make install` | Instala backend y frontend |
| `make lint` | Lint + formato |
| `make test` | Tests backend + frontend |
| `make migrate` | Aplica migraciones |
| `make up` / `make down` | Levanta/baja Docker Compose |
| `make dev-backend` / `make dev-frontend` | Servidores de desarrollo |

## Licencia

Ver [LICENSE](./LICENSE).
