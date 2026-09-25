
# Chuleta de arranque express (SQLite ya configurado)

> Manual completo: [COMANDOS_DE_LA_APP.md](COMANDOS_DE_LA_APP.md) · Presentación: [README.md](../../README.md) · Índice de docs: [Explicacion_de_Cada_ARCHIVO.md](../Explicacion_de_Cada_ARCHIVO.md)

# Terminal 1 — API (backend):
- Nota: En la Terminal 1, antes de arrancar uvicorn:

- $env:DEBUG="true"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

O hazlo permanente: añade DEBUG=true al archivo backend\.env y reinicia uvicorn (Ctrl+C y otra vez el comando). Luego http://localhost:8000/docs cargará la Interfaz interactiva.

- cd backend
- .\.venv\Scripts\Activate.ps1
- $env:DATABASE_URL="sqlite:///./dev.db"
- uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

NOTA: Si en Terminal 1 te bloquea la ejecución de scripts: Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned

# Terminal 2 — Frontend: 
-  cd frontend
-  npm run dev

Luego abre http://localhost:5173 (API en http://localhost:8000/docs).

---
[Volver al manual](COMANDOS_DE_LA_APP.md) · [README](../../README.md) · [CHANGELOG](../../CHANGELOG.md)
