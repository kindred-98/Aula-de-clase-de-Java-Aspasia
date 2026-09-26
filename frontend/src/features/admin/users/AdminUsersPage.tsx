import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  apiGet,
  apiSend,
  type AdminUserCreated,
  type AdminUserPublic,
  type PinResetResponse,
  type StaffPasswordResetResponse,
} from "../../../lib/api";
import { ConfirmDialog, showToast } from "../../../components/ui/Toast";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";
import { TemporarySecretBanner } from "./TemporarySecretBanner";
import { UserCreateForm } from "./UserCreateForm";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

export function AdminUsersPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [showCreate, setShowCreate] = useState(params.get("new") === "1");
  const [secret, setSecret] = useState<{ value: string; role: string } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const queryClient = useQueryClient();

  const users = useQuery({
    queryKey: ["admin-users", q, role],
    queryFn: ({ signal }) => {
      const paramsQs = new URLSearchParams();
      if (q) paramsQs.set("q", q);
      if (role) paramsQs.set("role", role);
      const qs = paramsQs.toString();
      return apiGet<AdminUserPublic[]>(`/admin/users${qs ? `?${qs}` : ""}`, signal);
    },
  });

  const toggle = useMutation({
    mutationFn: (input: { id: number; is_active: boolean }) =>
      apiSend<AdminUserPublic>("PATCH", `/admin/users/${input.id}/status`, {
        is_active: input.is_active,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (error) =>
      showToast(error instanceof Error ? error.message : "No se pudo actualizar", "error"),
  });

  const resetPin = useMutation({
    mutationFn: (userId: number) =>
      apiSend<PinResetResponse>("POST", `/admin/users/${userId}/reset-pin`, {}),
    onSuccess: (data) => {
      setSecret({ value: data.pin, role: "student" });
      setConfirmId(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const resetPassword = useMutation({
    mutationFn: (userId: number) =>
      apiSend<StaffPasswordResetResponse>("POST", `/admin/users/${userId}/reset-password`, {}),
    onSuccess: (data) => {
      setSecret({ value: data.password, role: "teacher" });
      setConfirmId(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const saveEdit = useMutation({
    mutationFn: (input: { id: number; name: string }) =>
      apiSend<AdminUserPublic>("PATCH", `/admin/users/${input.id}`, { name: input.name }),
    onSuccess: () => {
      showToast("Usuario actualizado");
      setEditId(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) =>
      showToast(error instanceof Error ? error.message : "No se pudo guardar", "error"),
  });

  const erase = useMutation({
    mutationFn: (userId: number) => apiSend<void>("DELETE", `/admin/users/${userId}/data`),
    onSuccess: () => {
      showToast("Datos anonimizados (RGPD)");
      setConfirmId(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo borrar", "error");
      setConfirmId(null);
    },
  });

  function toggleCreate() {
    setShowCreate((v) => {
      const next = !v;
      if (next) params.set("new", "1");
      else params.delete("new");
      setParams(params, { replace: true });
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Identidades del centro</p>
          <h1 className="text-2xl font-bold">Usuarios</h1>
        </div>
        <button
          type="button"
          onClick={toggleCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          {showCreate ? "Ocultar" : "+ Nuevo usuario"}
        </button>
      </header>

      {showCreate ? (
        <UserCreateForm
          onCreated={(u: AdminUserCreated) => {
            if (u.temporary_secret) setSecret({ value: u.temporary_secret, role: u.role });
            setShowCreate(false);
            params.delete("new");
            setParams(params, { replace: true });
            void users.refetch();
          }}
        />
      ) : null}

      {secret ? (
        <TemporarySecretBanner
          secret={secret.value}
          role={secret.role}
          onDismiss={() => setSecret(null)}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Buscar nombre, email o usuario"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar usuarios"
        />
        <select
          className={`${inputClass} max-w-[10rem]`}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Filtrar por rol"
        >
          <option value="">Todos los roles</option>
          <option value="org_admin">org_admin</option>
          <option value="teacher">teacher</option>
          <option value="student">student</option>
        </select>
      </div>

      {users.isPending ? <Spinner label="Cargando usuarios" /> : null}
      {users.isError ? (
        <ErrorState message="Error al cargar" onRetry={() => void users.refetch()} />
      ) : null}
      {users.isSuccess && users.data.length === 0 ? <EmptyState title="Sin usuarios" /> : null}

      {users.isSuccess && users.data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Identidad</th>
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Activo</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {editId === u.id ? (
                      <form
                        className="flex gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveEdit.mutate({ id: u.id, name: editName });
                        }}
                      >
                        <input
                          className={inputClass}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                        />
                        <button
                          type="submit"
                          className="rounded bg-primary px-2 text-xs text-white"
                        >
                          OK
                        </button>
                      </form>
                    ) : (
                      u.name
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{u.username ?? u.email ?? "—"}</td>
                  <td className="px-3 py-2">{u.role}</td>
                  <td className="px-3 py-2">{u.is_active ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => toggle.mutate({ id: u.id, is_active: !u.is_active })}
                        disabled={toggle.isPending}
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-bg"
                      >
                        {u.is_active ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(u.id);
                          setEditName(u.name);
                        }}
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-bg"
                      >
                        Renombrar
                      </button>
                      {u.role === "student" ? (
                        <button
                          type="button"
                          onClick={() => setConfirmId(u.id)}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-bg"
                        >
                          Reset PIN
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(u.id)}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-bg"
                        >
                          Reset pass
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmId(-u.id)}
                        className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10"
                      >
                        RGPD
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {confirmId != null && confirmId > 0 ? (
        <ConfirmDialog
          title="¿Resetear credenciales?"
          body="Se generará un nuevo PIN o contraseña que verás una sola vez. El usuario deberá cambiarlo al entrar."
          confirmLabel="Generar"
          onConfirm={() => {
            const target = users.data?.find((u) => u.id === confirmId);
            if (target?.role === "student") resetPin.mutate(confirmId);
            else resetPassword.mutate(confirmId);
          }}
          onCancel={() => setConfirmId(null)}
        />
      ) : null}

      {confirmId != null && confirmId < 0 ? (
        <ConfirmDialog
          title="¿Borrar datos del usuario (RGPD)?"
          body="Se anonimizará la cuenta y se desactivará. No se puede deshacer."
          confirmLabel="Sí, borrar"
          onConfirm={() => erase.mutate(-confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      ) : null}
    </div>
  );
}
