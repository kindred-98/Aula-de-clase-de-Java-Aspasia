import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  apiGet,
  apiSend,
  type AdminUserPublic,
  type CustomRolePublic,
  type PermissionCatalog,
} from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

function AssignForm({ roles }: { roles: CustomRolePublic[] }) {
  const queryClient = useQueryClient();
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: ({ signal }) => apiGet<AdminUserPublic[]>("/admin/users", signal),
  });
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const assign = useMutation({
    mutationFn: () =>
      apiSend<CustomRolePublic | null>("POST", `/admin/users/${userId}/custom-role`, {
        custom_role_id: roleId === "" ? null : Number(roleId),
      }),
    onSuccess: (result) => {
      setFeedback(result ? `Rol ${result.name} asignado` : "Rol quitado");
      void queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => setFeedback("No se pudo asignar el rol"),
  });

  if (users.isPending) return <Spinner label="Cargando usuarios…" />;
  if (users.isError)
    return (
      <ErrorState
        message="No se pudieron cargar los usuarios"
        onRetry={() => void users.refetch()}
      />
    );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (userId) assign.mutate();
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Usuario</span>
        <select
          className={inputClass}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        >
          <option value="">Elegir…</option>
          {users.data.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.role})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Rol personalizado</span>
        <select className={inputClass} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">— Sin rol —</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={assign.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Asignar
      </button>
      {feedback ? (
        <p role="status" className="w-full text-sm text-muted">
          {feedback}
        </p>
      ) : null}
    </form>
  );
}

export function RolesPage() {
  const queryClient = useQueryClient();
  const roles = useQuery({
    queryKey: ["admin-roles"],
    queryFn: ({ signal }) => apiGet<CustomRolePublic[]>("/admin/roles", signal),
  });
  const catalog = useQuery({
    queryKey: ["permissions"],
    queryFn: ({ signal }) => apiGet<PermissionCatalog>("/admin/permissions", signal),
  });
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      apiSend<CustomRolePublic>("POST", "/admin/roles", { name, permissions: selected }),
    onSuccess: () => {
      setName("");
      setSelected([]);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "No se pudo crear"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiSend<void>("DELETE", `/admin/roles/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-roles"] }),
    onError: (err) => setError(err instanceof Error ? err.message : "No se pudo borrar"),
  });

  if (roles.isPending || catalog.isPending) return <Spinner label="Cargando roles…" />;
  if (roles.isError || catalog.isError)
    return (
      <ErrorState
        message="No se pudieron cargar los roles"
        onRetry={() => {
          void roles.refetch();
          void catalog.refetch();
        }}
      />
    );

  const toggle = (perm: string) => {
    setSelected((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted">Escalabilidad</p>
        <h1 className="text-2xl font-bold">Roles personalizados</h1>
        <p className="mt-1 text-sm text-muted">
          Complementan el rol base con permisos puntuales (reportes, ajustes…).
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-lg border border-border bg-surface p-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Nombre del rol</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            placeholder="Coordinador"
          />
        </label>
        <fieldset>
          <legend className="mb-1 text-sm text-muted">Permisos</legend>
          <div className="flex flex-wrap gap-3">
            {catalog.data.permissions.map((perm) => (
              <label key={perm} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(perm)}
                  onChange={() => toggle(perm)}
                />
                <span className="font-mono">{perm}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {create.isPending ? "Creando…" : "Crear rol"}
        </button>
      </form>

      <AssignForm roles={roles.data} />

      {roles.data.length === 0 ? (
        <EmptyState title="Sin roles personalizados">
          Crea un rol para dar permisos puntuales a profes o admin.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {roles.data.map((role) => (
            <li
              key={role.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <div>
                <p className="font-medium">
                  {role.name}{" "}
                  <span className="text-xs text-muted">· {role.assigned_count} asignado(s)</span>
                </p>
                <p className="font-mono text-xs text-muted">{role.permissions.join(", ")}</p>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(role.id)}
                disabled={remove.isPending}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-60"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
