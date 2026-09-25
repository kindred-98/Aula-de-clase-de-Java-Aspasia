# Aula Virtual — Backend

API FastAPI de la plataforma de aula virtual.

```bash
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
pytest --cov=app --cov-fail-under=80
```

Ver [../README.md](../README.md) y [PLAN_CLAUDE.md](../Archivo_Markdown/PLAN/PLAN_CLAUDE.md) del monorepo; índice de documentación: [Explicacion_de_Cada_ARCHIVO.md](../Archivo_Markdown/Explicacion_de_Cada_ARCHIVO.md).
