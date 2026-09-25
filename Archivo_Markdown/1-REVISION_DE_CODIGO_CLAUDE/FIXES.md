# Fixes — Revisión de código (commit `e3c3292`)

Priorizado por gravedad. 🔴 bloquea el despliegue. 🟠 hay que resolverlo antes de dar la URL a la clase. 🟡 menor, pero déjalo anotado.

---

## 🔴 1. La app no arranca — `NameError: Enrollment`

**Archivo:** `backend/app/models/user.py`, línea 47

**Causa:** `Enrollment` solo está importado bajo `TYPE_CHECKING`, así que en tiempo de ejecución el nombre no existe. `Mapped[list[Enrollment]]` se evalúa en tiempo de ejecución (no es un string), así que revienta al importar `app.main`.

```diff
-    enrollments: Mapped[list[Enrollment]] = relationship(
+    enrollments: Mapped[list["Enrollment"]] = relationship(
         back_populates="student",
         cascade="all, delete-orphan",
         lazy="selectin",
     )
```

**Verificación:** con este cambio, `python -c "import app.main"` no falla, y `pytest` pasa 123/123 con 87.6% de cobertura.

**Antes de seguir:** revisa la pestaña *Actions* de GitHub para este commit. Si tu CI está en verde a pesar de este bug, algo está mal configurado en el CI (quizás corre sobre una rama o un caché distintos). Si está en rojo, esto lo confirma.

---

## 🔴 2. El estudiante puede cambiar su propio PIN

Contradice el requisito: **las credenciales del alumno las gestiona el admin/profesor, no el alumno.**

**Archivo:** `backend/app/api/v1/routes/auth.py`, endpoint `PATCH /auth/change-credentials`

```diff
 @router.patch("/change-credentials", response_model=UserPublic)
 def change_credentials(
     body: ChangeCredentialsRequest,
     request: Request,
     db: DbSession,
     user: Annotated[object, Depends(CurrentUserWithPendingChange)],
 ) -> UserPublic:
     from app.models import User

     assert isinstance(user, User)
+    if user.role is UserRole.student:
+        raise HTTPException(
+            status_code=403,
+            detail="Students cannot change their own PIN; ask your teacher to reset it",
+        )
     ip = request.client.host if request.client else None
     try:
         updated = auth_service.change_credentials(
```

(Añade `UserRole` al import de `app.models` en la cabecera del archivo.)

**Además**, en `auth_service.change_credentials` puedes quitar del todo la rama `if user.role is UserRole.student:` ya que nunca se volverá a alcanzar — o dejarla como defensa en profundidad, tu decisión.

**Frontend:** en la pantalla de "cambiar credenciales" que se muestra en el primer login, si `user.role === "student"` no debe existir ese formulario. El PIN inicial que genera el admin/profesor es directamente el definitivo. Sustituye esa pantalla, para estudiantes, por un mensaje: *"Tu PIN lo gestiona tu profesor. Si lo has olvidado, pídele que te lo restablezca."*

**Efecto colateral a revisar:** si actualmente creas estudiantes con `must_change_credentials=True`, cámbialo a `False` en la creación — si no, quedarán bloqueados en un flujo de cambio de credenciales al que ya no tienen acceso.

---

## 🔴 3. `SECRET_KEY` inseguro, usable en producción sin aviso

**Archivo:** `backend/app/core/config.py`

El valor por defecto (`"dev-only-insecure-secret-change-me-32chars"`) pasa la validación (`min_length=16`) y nada impide usarlo con `environment=production`. Tu `docker-compose.yml` lo referencia como fallback si `SECRET_KEY` no está exportada.

```diff
+from pydantic import Field, field_validator, model_validator
-from pydantic import Field, field_validator

 class Settings(BaseSettings):
     ...
     secret_key: str = Field(
         default="dev-only-insecure-secret-change-me-32chars",
         min_length=16,
     )
     ...

+    @model_validator(mode="after")
+    def _check_production_secret(self) -> "Settings":
+        insecure = "dev-only-insecure-secret-change-me-32chars"
+        if self.environment == "production" and (
+            self.secret_key == insecure or len(self.secret_key) < 32
+        ):
+            raise ValueError(
+                "SECRET_KEY debe definirse explícitamente (>= 32 caracteres) en producción"
+            )
+        return self
```

Que la app **falle al arrancar** en producción sin `SECRET_KEY` real es la única forma fiable de que esto no se cuele en un despliegue con prisa.

---

## 🔴 4. `TrustedHostMiddleware` hardcodeado a `localhost` rompería producción

**Archivo:** `backend/app/main.py`

```python
if settings.environment == "production":
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1"])
```

En un despliegue real tu dominio no es `localhost`. Tal como está, el día que pongas `ENVIRONMENT=production`, **todas las peticiones devolverán 400** porque el `Host` real no está en la lista permitida.

**Fix — `config.py`:**
```diff
     cors_origins: str = "http://localhost:5173"
+    allowed_hosts: str = "localhost,127.0.0.1"

     @field_validator("cors_origins", mode="before")
     ...

+    @property
+    def allowed_host_list(self) -> list[str]:
+        return [h.strip() for h in self.allowed_hosts.split(",") if h.strip()]
```

**Fix — `main.py`:**
```diff
     if settings.environment == "production":
         app.add_middleware(
             TrustedHostMiddleware,
-            allowed_hosts=["localhost", "127.0.0.1"],
+            allowed_hosts=settings.allowed_host_list,
         )
```

Y en el `.env` de producción: `ALLOWED_HOSTS=tudominio.com,www.tudominio.com`.

---

## 🟠 5. El refresh token se guarda en `localStorage`

**Archivo:** `frontend/src/lib/api.ts`

El backend hace bien las cosas: pone el refresh token en una cookie `httponly` + `samesite=strict`. Pero `TokenResponse` también lo devuelve en el body de la respuesta, y el frontend lo guarda además en `localStorage`. Un XSS (aunque venga de una dependencia de terceros, no de tu propio código) puede leer `localStorage` y robar el refresh token — justo lo que el cookie `httponly` existía para evitar.

**Fix recomendado (el correcto):**
1. Backend: deja de incluir `refresh_token` en el body de `POST /auth/login/*` y `POST /auth/refresh`. Solo la cookie.
2. Frontend: quita `REFRESH_KEY` de `localStorage` por completo. Para refrescar, haz `fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" })` sin mandar nada en el body — el navegador manda la cookie solo.
3. El `access_token` sí puede seguir en memoria (una variable de módulo/estado de React), no hace falta `localStorage` para él tampoco — así minimizas superficie de robo por XSS. Si necesitas persistirlo entre recargas de página, `sessionStorage` es preferible a `localStorage` (se borra al cerrar pestaña, razonable en ordenadores compartidos de aula).

Si por tiempo no puedes tocar el flujo entero ahora, el mínimo aceptable es el paso 1+2 (sacar el refresh token de la ecuación JS-accesible). El `access_token` en `localStorage` es un riesgo menor porque expira en minutos.

---

## 🟠 6. Login de estudiante acepta el nombre como identificador

**Archivo:** `backend/app/services/auth_service.py`, función `login_student`

```python
User.username == identifier) | (User.email == identifier) | (User.name == identifier)
```

El nombre completo del alumno es visible para sus compañeros en el mapa de asientos del aula. Si el identificador de login puede ser ese mismo nombre público, tu "segundo factor" (usuario + PIN) se reduce en la práctica a solo el PIN para cualquiera que haya visto el aula una vez.

```diff
     user = db.scalar(
         select(User).where(
             User.role == UserRole.student,
-            (User.username == identifier) | (User.email == identifier) | (User.name == identifier),
+            User.username == identifier,
         )
     )
```

Si algún alumno no tiene `username` asignado, ese es el bug a arreglar (todo estudiante debería tener uno al crearse), no ampliar el login para compensarlo.

---

## 🟠 7. Test de permisos con aserción demasiado permisiva

**Archivo:** `backend/tests/test_permissions.py`, `test_student_cannot_read_others_evaluations`

Rompí a propósito `can_read_submission` para que devolviera `True` siempre (cualquiera podría leer la entrega de cualquiera). **Ningún test falló.** La causa:

```python
assert other.status_code in (404, 200)
if other.status_code == 200:
    assert other.json() == []
```

Esto solo comprueba que no se filtren notas/evaluaciones, no que la entrega en sí (`notes`, `github_url`, archivos) sea invisible para quien no debería verla.

**Fix — separa el test en dos:**

```python
def test_student_cannot_read_others_submission_detail(client, db):
    """GET /submissions/{id} de un assignment privado: 404 estricto para un peer."""
    ctx = _setup_two_students(db)
    # ... crear assignment(visibility=private), submission de `a` ...
    resp = client.get(f"/api/v1/submissions/{sub.id}", headers=auth_headers(ctx["b"]))
    assert resp.status_code == 404  # ya no "in (404, 200)"


def test_student_cannot_read_evaluations_of_others(client, db):
    """Cuando SÍ puede ver la entrega (visibility=class), jamás ve evaluaciones ajenas."""
    # ... assignment(visibility=class) ...
    resp = client.get(f"/api/v1/submissions/{sub.id}/evaluations", headers=auth_headers(ctx["b"]))
    assert resp.status_code == 200
    assert resp.json() == []
```

**Añade además** un test de aislamiento entre cursos para `work.py` (no solo para `courses.py`): estudiante matriculado en el curso A, `GET /submissions/{id}` de una entrega del curso B → `404`.

---

## 🟡 8. Menores

**a) Router duplicado — `backend/app/main.py`**
```python
app.include_router(api_router, prefix=settings.api_prefix)
app.include_router(api_router)  # alias sin prefijo para health en raíz
```
Duplica cada endpoint bajo dos rutas solo para exponer `/health` en la raíz. Mejor:
```python
app.include_router(api_router, prefix=settings.api_prefix)
app.include_router(health.router)  # solo el router de health, sin prefijo
```

**b) `course_code` sin normalizar**
`backend/app/services/auth_service.py`, `login_student`: `Course.code == course_code` es una comparación exacta. Si el admin crea `JAVA-26` y el alumno escribe `java-26`, falla el login.
```diff
-    course = db.scalar(select(Course).where(Course.code == course_code))
+    course = db.scalar(select(Course).where(Course.code == course_code.strip().upper()))
```
Aplica el mismo `.strip().upper()` al crear el curso, para que quede consistente.

**c) Módulos sin auditar con el mismo detalle**
No revisé con la misma profundidad `phase3.py`, `phase_c.py`, `phase_d.py`, `admin.py`, `attendance.py`. Antes de desplegar, aplícales el mismo ejercicio: rompe a propósito su función de permisos principal y confirma que algún test falla.

---

## Orden sugerido para aplicar esto

1. Fix 1 (arranca la app) — sin esto no puedes probar nada más.
2. Fixes 3 y 4 (config de producción) — bloquean cualquier despliegue real, mejor resolverlos ya aunque no despliegues hoy.
3. Fix 2 (PIN de estudiante) — es un requisito tuyo explícito, no una sugerencia mía.
4. Fixes 5 y 6 (seguridad de sesión) — antes de dar la URL a alumnos reales.
5. Fix 7 (test) — en paralelo, no bloquea nada pero evita que el bug 2 vuelva sin que nadie se entere.
6. Fix 8 — cuando tengas un rato.
