import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiSend, type UserPublic } from "../../lib/api";
import { useAuth } from "../auth/AuthContext";
import { showToast } from "../../components/ui/Toast";
import { ErrorState } from "../../components/ui/ErrorState";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

export function ProfileForm() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const save = useMutation({
    mutationFn: () =>
      apiSend<UserPublic>("PATCH", "/auth/me", {
        name,
        email: email || null,
      }),
    onSuccess: async () => {
      showToast("Perfil actualizado");
      await refreshUser();
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo guardar", "error");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-semibold">Mi perfil</h2>
      <label className="block space-y-1 text-sm">
        <span className="text-muted">Nombre</span>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted">Email (opcional)</span>
        <input
          type="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={320}
        />
      </label>
      {save.isError ? (
        <ErrorState message={save.error instanceof Error ? save.error.message : "Error"} />
      ) : null}
      <button
        type="submit"
        disabled={save.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {save.isPending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () =>
      apiSend<UserPublic>("PATCH", "/auth/change-credentials", {
        current_secret: current,
        new_secret: next,
      }),
    onSuccess: () => {
      showToast("Contraseña cambiada");
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "No se pudo cambiar");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (next !== confirm) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    if (next.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    setError(null);
    change.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-semibold">Cambiar contraseña</h2>
      <label className="block space-y-1 text-sm">
        <span className="text-muted">Contraseña actual</span>
        <input
          type="password"
          className={inputClass}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted">Nueva contraseña</span>
        <input
          type="password"
          className={inputClass}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted">Repetir nueva contraseña</span>
        <input
          type="password"
          className={inputClass}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
      </label>
      {error ? <ErrorState message={error} /> : null}
      <button
        type="submit"
        disabled={change.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {change.isPending ? "Cambiando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}

export function AccountSettingsPage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header>
        <p className="text-sm text-muted">Cuenta</p>
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
      </header>
      <ProfileForm />
      {/* El PIN de estudiante lo gestiona el admin/profesor: sin formulario de cambio */}
      {user?.role !== "student" ? <ChangePasswordForm /> : null}
    </div>
  );
}
