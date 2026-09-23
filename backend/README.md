# Aula Virtual — Backend

API FastAPI de la plataforma de aula virtual.

```bash
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
pytest --cov=app --cov-fail-under=80
```

Ver `../PLAN.md` y `../README.md` del monorepo.
