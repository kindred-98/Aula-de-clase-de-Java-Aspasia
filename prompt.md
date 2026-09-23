# ROL Y OBJETIVO

Actúa como ingeniero senior full stack. Construye una plataforma web de aula virtual multi-curso, profesional y lista para producción. Trabaja por fases, en orden, y NO avances a la siguiente fase hasta que la actual tenga tests pasando y la hayas verificado ejecutándola.

Antes de escribir código: crea un plan en PLAN.md con el esquema de datos, la matriz de permisos y la estructura de carpetas, y sigue ese plan. Responde y documenta en español; el código, nombres de variables y commits en inglés.

# CONTEXTO DEL PRODUCTO

Una plataforma para gestionar aulas de cursos de programación. El primer caso de uso es una clase de Java: 3 filas de 5 estudiantes, con la profesora al frente. Debe servir para muchos cursos futuros: crear un curso nuevo con nombre debe bastar para tenerlo operativo.

Cada estudiante tiene un espacio de trabajo propio (su "asiento") donde sube archivos y enlaces a GitHub. La profesora evalúa desde la propia app. Los estudiantes pueden ver los trabajos de la profesora y de sus compañeros para comprobar que van bien, pero NUNCA las notas ni los comentarios de evaluación de otros.

# STACK (no lo cambies sin justificarlo en PLAN.md)

- Backend: Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic (migraciones), Pydantic v2
- Base de datos: PostgreSQL
- Frontend: React + Vite + TypeScript, Tailwind CSS, TanStack Query, React Router
- Auth: JWT de corta duración + refresh token, contraseñas y PINs hasheados con argon2
- Almacenamiento de archivos: interfaz abstracta con implementación local en disco para desarrollo y preparada para S3 compatible en producción
- Tests: pytest (backend), Vitest + Testing Library (frontend)
- Infra: Docker Compose (api, db, frontend), .env.example, Makefile con comandos comunes
- Calidad: ruff, mypy, eslint, prettier, pre-commit, GitHub Actions ejecutando lint + tests

# MODELO DE DATOS (multi-tenant desde el día 1)

Todo dato de un curso lleva course_id y toda consulta filtra por él.

- User: id, name, email (opcional para estudiantes), role (admin | teacher | student), pin_hash o password_hash, is_active, must_change_credentials, created_at
- Course: id, name, description, code (único, corto), status (active | archived), layout_rows, layout_cols, settings (JSON: visibilidad por defecto de entregas entre compañeros, etc.)
- CourseTeacher: course_id, teacher_id
- Seat: id, course_id, row, col, UNIQUE(course_id, row, col). Se generan automáticamente según layout_rows x layout_cols
- Enrollment: id, course_id, student_id, seat_id (nullable), status. UNIQUE(course_id, student_id) y UNIQUE(course_id, seat_id). El asiento y el estudiante son entidades SEPARADAS: cambiar a un estudiante de sitio no debe perder sus entregas
- Section: id, course_id, title, slug, order, kind (content | external), body_markdown, external_url. Son las secciones del menú (HTML, CSS, Java, JS, Información externa...) y las crea el admin/profesor por curso, nunca cableadas en el código
- Assignment: id, course_id, section_id (nullable), title, description_markdown, due_at, max_score, visibility (private | class), created_by
- Submission: id, assignment_id (nullable, para entregas libres), course_id, student_id, github_url (nullable), notes, status (draft | submitted | reviewed | needs_changes), submitted_at, version
- SubmissionFile: id, submission_id, original_name, stored_name, mime, size_bytes, sha256
- Evaluation: id, submission_id, teacher_id, score (nullable), rubric_scores (JSON), comment_markdown, created_at. Historial: no se sobrescribe, se añade nueva versión
- Announcement: id, course_id, author_id, title, body_markdown, created_at
- AttendanceRecord: id, course_id, student_id, date, status (present | late | absent | excused)
- AuditLog: id, actor_id, action, entity_type, entity_id, course_id, payload (JSON), ip, created_at

Índices en todas las claves foráneas y en las columnas de filtrado frecuente.

# MATRIZ DE PERMISOS (impuesta SIEMPRE en el backend)

- admin: acceso total, gestiona cursos, profesores, estudiantes y PINs
- teacher: solo sus cursos. Crea secciones, tareas y anuncios; ve todas las entregas de sus cursos; evalúa; pasa lista
- student: solo cursos donde está matriculado.
  - Escribe únicamente en SUS propias entregas
  - Lee los archivos y enlaces de compañeros solo si la visibilidad de la tarea es "class"
  - Lee su propia evaluación
  - NUNCA accede a notas o comentarios de evaluación de otros estudiantes
  - No puede ver cursos donde no está matriculado

Implementa las comprobaciones como dependencias/políticas reutilizables de FastAPI, no repetidas endpoint por endpoint.

# AUTENTICACIÓN Y PIN (requisitos de seguridad)

- Login de estudiante: código de curso + identificador (usuario) + PIN de 6 dígitos mínimo. Nunca solo el PIN
- Hash con argon2; jamás guardar PIN en claro ni loguearlo
- Rate limiting por IP y por cuenta; bloqueo temporal tras 5 intentos fallidos; registrar intentos en AuditLog
- El admin puede generar y resetear PINs (mostrar el PIN nuevo una sola vez); el estudiante debe cambiarlo en el primer acceso
- Refresh token rotatorio y revocable; logout invalida sesión
- Teachers y admins: email + contraseña fuerte

# ARCHIVOS Y ENLACES

- Lista blanca de extensiones (.java, .zip, .pdf, .txt, .md, .png, .jpg, .html, .css, .js, .json), tamaño máximo configurable por curso (por defecto 10 MB)
- Validar tipo real del contenido (no solo extensión), nombres de archivo saneados, almacenamiento con nombre aleatorio y sha256
- Nunca ejecutar ni interpretar archivos subidos; servir con Content-Disposition y cabeceras seguras
- Descarga siempre a través de un endpoint que compruebe permisos (no URLs públicas directas)
- Validar github_url: debe ser https://github.com/<usuario>/<repo>. Mostrar en la UI metadatos vía API pública de GitHub (lenguaje, último commit, README) con caché y manejo de límites de tasa; si falla, degradar sin romper

# FUNCIONALIDAD POR PANTALLA

1. Login (estudiante y staff), cambio de PIN obligatorio en primer acceso
2. Vista de aula (pantalla principal del curso): cuadrícula según layout con la profesora al frente. Cada asiento muestra nombre y color de estado (sin entregar, entregado, revisado, atrasado). Clic en un asiento abre el espacio de ese estudiante
3. Espacio del estudiante: sus entregas, archivos, enlaces GitHub, estado y su evaluación. Otros estudiantes ven solo lo permitido por visibilidad
4. Menú lateral con las secciones del curso (dinámicas), contenido en Markdown con resaltado de código, y sección de información externa con enlaces
5. Tareas: listado, detalle, fecha límite, entrega, reentrega con versiones
6. Panel de evaluación (teacher): cola de entregas pendientes, ver archivos/repo, nota + rúbrica + comentario Markdown, marcar "requiere cambios", exportar notas a CSV
7. Anuncios del curso y calendario con fechas límite
8. Asistencia: pasar lista tocando los asientos, resumen por estudiante
9. Panel admin: CRUD de cursos (archivar en vez de borrar, clonar curso como plantilla), gestión de profesores, estudiantes, matrícula y asignación de asientos, importación de estudiantes por CSV con generación de PINs en lote, reset de PIN, activar/desactivar cuentas, visor de AuditLog con filtros, métricas básicas (tasa de entrega por curso)
10. Crear un curso nuevo debe ser: nombre + código + tamaño de aula, y opcionalmente clonar secciones de otro curso

# UX Y DISEÑO

- Diseño profesional y consistente: sistema de diseño con tokens (colores, espaciado, tipografía), modo claro y oscuro
- Responsive real (los estudiantes usarán el móvil); la vista de aula debe seguir siendo usable en pantallas pequeñas
- Estados de carga, vacío y error en todas las vistas; toasts para acciones; confirmación en acciones destructivas
- Accesibilidad básica: navegación con teclado, contraste AA, etiquetas ARIA, foco visible
- Los estados por color del aula deben tener también texto/icono (no depender solo del color)

# SEGURIDAD TRANSVERSAL

- HTTPS en producción, CORS restrictivo por lista de orígenes, cabeceras de seguridad, protección XSS (sanitizar Markdown renderizado), validación estricta de entrada con Pydantic
- Secretos solo en variables de entorno; .env.example sin valores reales
- Sin SQL manual concatenado; solo consultas parametrizadas / ORM
- Logs estructurados, sin datos sensibles (PIN, tokens, contraseñas)
- Datos personales mínimos; endpoint para exportar y borrar los datos de un estudiante (RGPD)

# TESTS OBLIGATORIOS (criterio de aceptación)

Los tests de permisos son los más importantes. Deben existir y pasar:
- Un estudiante NO puede leer evaluaciones de otro estudiante
- Un estudiante NO puede escribir ni borrar entregas de otro
- Un estudiante NO puede acceder a un curso donde no está matriculado
- Un teacher NO puede acceder a cursos que no son suyos
- Bloqueo tras intentos fallidos de PIN
- Subida rechazada por extensión, tamaño o contenido no permitido
- Aislamiento entre cursos (multi-tenant): ninguna consulta devuelve datos de otro course_id
- Cambiar a un estudiante de asiento no pierde sus entregas
Además: tests de integración de los flujos principales y cobertura mínima del 80% en el backend.

# FASES (una a una, con verificación al final de cada una)

Fase 0: PLAN.md, estructura del repo, Docker Compose, CI, linters, base de datos con migraciones
Fase 1 (MVP): auth con PIN seguro, cursos, asientos, matrículas, vista de aula, entregas con archivos y GitHub, evaluación básica de la profesora, tests de permisos
Fase 2: secciones dinámicas con Markdown, tareas con fechas límite y versiones, visibilidad configurable, panel admin completo, importación CSV, anuncios, AuditLog
Fase 3: rúbricas, asistencia, calendario, metadatos de GitHub, clonar cursos, métricas, exportación CSV, RGPD, pulido de UX y accesibilidad

Al terminar cada fase: ejecuta lint + tests, arranca la app con Docker Compose, comprueba manualmente el flujo principal y resume en CHANGELOG.md qué se hizo, qué se probó y qué queda pendiente. Si una decisión es ambigua, elige la opción más segura, anótala en PLAN.md y continúa; no me hagas preguntas triviales.

# REGLAS DE TRABAJO

- Commits pequeños y descriptivos por unidad lógica
- No inventes dependencias ni APIs: verifica que existen y su versión antes de usarlas
- No dejes TODOs ni datos de ejemplo hardcodeados en código de producción; el seed de demo va en un script aparte (un curso "Java" de ejemplo con 3x5 asientos, 1 profesora y 15 estudiantes)
- README con instrucciones de instalación, variables de entorno, cómo correr tests y cómo crear el primer admin

Empieza por la Fase 0 y muéstrame PLAN.md antes de continuar con la Fase 1.