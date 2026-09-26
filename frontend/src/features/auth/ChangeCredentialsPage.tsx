import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { homePathAfterLogin } from "./homePath";
import { ErrorState } from "../../components/ui/ErrorState";
import { getSessionRole } from "../../lib/api";

export function ChangeCredentialsPage() {
  const { changeCredentials, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("Las contraseñas/PIN no coinciden.");
      return;
    }
    setPending(true);
    try {
      await changeCredentials({ current_secret: current, new_secret: next });
      navigate(homePathAfterLogin(), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

  // Los estudiantes no cambian su PIN: lo gestiona el admin/profesor
  if (getSessionRole() === "student") {
    return (
      <section className="mx-auto max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Tu PIN lo gestiona tu profesor</h1>
          <p className="mt-1 text-sm text-muted">
            Tu PIN lo gestiona tu profesor. Si lo has olvidado, pídele que te lo restablezca.
          </p>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Salir
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Cambia tus credenciales</h1>
        <p className="mt-1 text-sm text-muted">
          Es obligatorio en el primer acceso. El PIN de estudiante debe tener 6+ dígitos; el
          personal, 8+ caracteres.
        </p>
      </div>
      {error ? <ErrorState message={error} /> : null}
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-lg border border-border bg-surface p-4"
      >
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Actual</span>
          <input
            className={inputClass}
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            minLength={6}
            autoComplete="current-password"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Nueva</span>
          <input
            className={inputClass}
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Confirmar</span>
          <input
            className={inputClass}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            Salir
          </button>
        </div>
      </form>
    </section>
  );
}
