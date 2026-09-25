# Fases pendientes para el despliegue

Punto de partida: el MVP funciona, tiene CI, Docker Compose, Alembic y buena cobertura de tests. Esto no es "montar de cero", es cerrar huecos concretos antes de dar la URL a una clase real. Asume que ya aplicaste `FIXES.md`.

---

## Fase 0 — Confirmar que el estado actual es real

- [ ] Revisar la pestaña *Actions* de GitHub para el último commit de `main`. Si está en rojo, hay una desincronización entre lo que tienes en local y lo que está subido — resuélvelo antes de nada.
- [ ] Aplicar los fixes 🔴 de `FIXES.md` (1, 2, 3, 4) y confirmar que `pytest`, `ruff check`, `ruff format --check` y `mypy app` pasan en local antes de hacer push.
- [ ] Aplicar los fixes 🟠 (5, 6, 7) antes de continuar — son de sesión/seguridad, no de infraestructura, y son baratos de arreglar ahora comparado con arreglarlos con usuarios reales dentro.

---

## Fase 1 — Infraestructura mínima de producción

Tu `docker-compose.yml` actual expone HTTP directo en los puertos 8000 y 3000. Eso vale para desarrollo, no para producción.

- [ ] **Reverse proxy con TLS.** Caddy es la opción con menos fricción (certificado automático de Let's Encrypt sin configuración manual); Nginx o Traefik si ya los conoces. El proxy es quien recibe 443, no la API ni el frontend directamente.
- [ ] **Variables de entorno de producción**, todas explícitas (nada de defaults del compose):
  - `ENVIRONMENT=production`
  - `DEBUG=false`
  - `SECRET_KEY=<generado con `openssl rand -hex 32`, guardado en un gestor de secretos, no en el repo>`
  - `CORS_ORIGINS=https://tudominio.com`
  - `ALLOWED_HOSTS=tudominio.com` (nueva variable del fix 4)
  - `DATABASE_URL` apuntando a tu Postgres de producción
- [ ] **Dominio y DNS** apuntando al servidor donde despliegues.
- [ ] Confirmar que el `Dockerfile` del backend corre `alembic upgrade head` como paso de arranque (o como *init container* / paso previo del deploy) antes de levantar `uvicorn`. Revísalo explícitamente: si no está, una migración pendiente se queda sin aplicar y la app arranca contra un esquema desactualizado sin avisar.

---

## Fase 2 — Datos: los que no se pueden perder

Ahora mismo, si se pierde el volumen `uploads` o el contenedor de Postgres, se pierden entregas de alumnos reales. Esto no es opcional.

- [ ] **Backup de Postgres** automático y programado (`pg_dump` diario a almacenamiento externo, o el backup gestionado si usas Postgres en la nube — Railway, Render, Supabase, etc., todos lo ofrecen).
- [ ] **Backup del volumen de `uploads`** (los archivos que suben los alumnos). Si migras a `S3Storage` (ya tienes la interfaz preparada en `storage/__init__.py`, solo falta implementarla), el propio proveedor S3 ya te da redundancia — es la opción que menos mantenimiento pide.
- [ ] **Probar la restauración una vez**, no solo el backup. Un backup que nunca restauraste no es un backup, es una promesa.

---

## Fase 3 — Observabilidad mínima

No necesitas nada elaborado para un aula, pero sí necesitas enterarte si algo se cae.

- [ ] **Uptime check** simple contra `/health` (UptimeRobot, Better Uptime, o un cron con `curl` que te avise por Telegram/email si falla).
- [ ] **Logs accesibles.** Ya tienes `core/logging.py` con logging estructurado — confirma que en producción esos logs van a algún sitio que puedas consultar después de un incidente (aunque sea `docker logs` con `docker compose logs -f` a mano, para empezar).
- [ ] **Alerta de espacio en disco** si usas `LocalStorage` — los archivos de alumnos crecen y un disco lleno tira la app entera, incluida la base de datos si comparten volumen.

---

## Fase 4 — Rate limiting a nivel de proxy

Tu `auth_service` ya cuenta intentos fallidos consultando `AuditLog`, lo cual funciona para tu escala. Añadir una capa en el proxy (Caddy y Nginx lo soportan de forma nativa) da protección adicional que no depende de que tu base de datos esté sana para funcionar — si la base de datos está bajo presión, quieres que el proxy siga frenando ataques sin depender de una consulta SQL.

- [ ] Rate limit por IP en el proxy para `/api/v1/auth/*` (ej. 20 peticiones/minuto es generoso para uso legítimo y molesto para fuerza bruta).

---

## Fase 5 — Prueba de humo antes de dar la URL a la clase

Hazlo a mano, una vez, contra el dominio real (no `localhost`), con una cuenta de prueba:

- [ ] Login de estudiante con PIN correcto → entra.
- [ ] Login de estudiante con PIN incorrecto 5 veces → bloqueo temporal, y el bloqueo se levanta pasado el tiempo esperado.
- [ ] Login de profesor → entra, puede cambiar su propia contraseña.
- [ ] Estudiante sube un archivo `.java` → aparece en su entrega.
- [ ] Estudiante intenta subir un `.exe` renombrado a `.java` → rechazado (valida el fix de `validate_content`, no solo la extensión).
- [ ] Profesor evalúa la entrega → estudiante ve su nota; un compañero no.
- [ ] Descarga de un archivo subido → el nombre y contenido del archivo descargado coinciden con lo subido.
- [ ] Cerrar sesión → el refresh token queda revocado (intenta reusarlo contra `/auth/refresh`, debe fallar).
- [ ] Comprobar en las herramientas de desarrollador del navegador que no hay ningún token de larga duración en `localStorage` (si aplicaste el fix 5).

---

## Fase 6 — Solo si vas a escalar más allá de tu aula (opcional, no bloqueante hoy)

Esto no lo necesitas para lanzar; que quede aquí para cuando el proyecto crezca a más cursos o más centros.

- [ ] Mover de `LocalStorage` a `S3Storage` (implementar la clase que ya tienes preparada como esqueleto).
- [ ] Rate limiting basado en algo más rápido que consultas a Postgres (Redis) si el volumen de intentos de login crece mucho.
- [ ] Métricas (Prometheus + Grafana, o algo más simple como un dashboard de tu proveedor cloud) si necesitas ver tendencias, no solo estar/no estar caído.
- [ ] Aplicar el mismo nivel de auditoría de seguridad (mutation testing de permisos) a `phase3.py`, `phase_c.py`, `phase_d.py`, `admin.py` y `attendance.py`, que no revisé con el mismo detalle que `auth`/`work`/`policies`.

---

## Resumen: qué es realmente bloqueante hoy

Fases **0, 1, 2 y 5** son las que separan "funciona en mi máquina" de "puedo dar esta URL a mis compañeros de clase con datos reales". Las fases 3 y 4 son las que evitan que un problema pequeño se convierta en uno grande sin que te enteres. La fase 6 es para cuando esto deje de ser un proyecto de curso.
