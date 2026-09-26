# Aula Virtual — Backend

API FastAPI de la plataforma de aula virtual.

```bash
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
pytest --cov=app --cov-fail-under=80
```

### Stripe local (Fase B)

```bash
stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe  # whsec_ → STRIPE_WEBHOOK_SECRET (local ≠ producción)
stripe trigger checkout.session.completed
```

Solo claves test (`sk_test_`/`pk_test_`); Resend en modo prueba. Detalle: [../Archivo_Markdown/COMANDOS/COMANDOS_DE_LA_APP.md](../Archivo_Markdown/COMANDOS/COMANDOS_DE_LA_APP.md).

Ver [../README.md](../README.md) y [PLAN_CLAUDE.md](../Archivo_Markdown/PLAN/PLAN_CLAUDE.md) del monorepo; índice de documentación: [Explicacion_de_Cada_ARCHIVO.md](../Archivo_Markdown/Explicacion_de_Cada_ARCHIVO.md).
