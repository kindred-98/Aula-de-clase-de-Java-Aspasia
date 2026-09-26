import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiSend, type AdminUserCreated } from "../../../lib/api";
import { showToast } from "../../../components/ui/Toast";
import { ErrorState } from "../../../components/ui/ErrorState";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

type Props = {
  onCreated?: (user: AdminUserCreated) => void;
};

export function UserCreateForm({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"org_admin" | "teacher" | "student">("teacher");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name, role };
      if (role === "student") body.username = username;
      else body.email = email;
      return apiSend<AdminUserCreated>("POST", "/admin/users", body);
    },
    onSuccess: (user) => {
      showToast(`Usuario ${user.name} creado`);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onCreated?.(user);
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo crear", "error");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-semibold">Crear usuario</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="text-muted">Nombre completo</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Rol</span>
          <select
            className={inputClass}
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="teacher">Profesora</option>
            <option value="org_admin">Administración</option>
            <option value="student">Estudiante</option>
          </select>
        </label>
        {role === "student" ? (
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Username</span>
            <input
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              maxLength={100}
              pattern="[A-Za-z0-9_.-]+"
            />
          </label>
        ) : (
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Email</span>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={320}
            />
          </label>
        )}
      </div>
      <p className="text-xs text-muted">
        Se genera un secreto temporal (PIN o contraseña) que se muestra{" "}
        <strong>una sola vez</strong>. El usuario deberá cambiarlo al entrar.
      </p>
      {create.isError ? (
        <ErrorState
          message={create.error instanceof Error ? create.error.message : "Error al crear"}
        />
      ) : null}
      <button
        type="submit"
        disabled={create.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {create.isPending ? "Creando…" : "Crear usuario"}
      </button>
    </form>
  );
}
