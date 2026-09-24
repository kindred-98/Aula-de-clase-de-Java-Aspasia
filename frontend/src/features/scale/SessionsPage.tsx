import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { apiGet, apiSend, type ActiveSessionPublic, type AdminUserPublic } from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

function UserActions() {
  const queryClient = useQueryClient();
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: ({ signal }) => apiGet<AdminUserPublic[]>("/admin/users", signal),
  });
  const [userId, setUserId] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const revoke = useMutation({
    mutationFn: () =>
      apiSend<{ revoked: number }>("POST", "/admin/sessions/revoke", {
        user_id: Number(userId),
      }),
    onSuccess: (result) => {
      setFeedback(`${result.revoked} sesión(es) revocada(s)`);
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: () => setFeedback("No se pudieron revocar las sesiones"),
  });

  const unlock = useMutation({
    mutationFn: () =>
      apiSend<{ cleared_failures: number }>("POST", `/admin/users/${userId}/unlock`),
    onSuccess: (result) => {
      setFeedback(`${result.cleared_failures} fallos de login borrados`);
    },
    onError: () => setFeedback("No se pudo desbloquear la cuenta"),
  });

  if (users.isPending) return <Spinner label="Cargando usuarios…" />;
  if (users.isError)
    return (
      <ErrorState
        message="No se pudieron cargar los usuarios"
        onRetry={() => void users.refetch()}
      />
    );

  const onSubmit = (event: FormEvent, action: "revoke" | "unlock") => {
    event.preventDefault();
    if (!userId) return;
    setFeedback(null);
    if (action === "revoke") revoke.mutate();
    else unlock.mutate();
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 font-semibold">Gestión de cuentas</h2>
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-muted">Usuario</span>
        <select className={inputClass} value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Elegir…</option>
          {users.data.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.role})
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <form onSubmit={(e) => onSubmit(e, "revoke")}>
          <button
            type="submit"
            disabled={!userId || revoke.isPending}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-60"
          >
            Revocar sesiones
          </button>
        </form>
        <form onSubmit={(e) => onSubmit(e, "unlock")}>
          <button
            type="submit"
            disabled={!userId || unlock.isPending}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-60"
          >
            Desbloquear cuenta
          </button>
        </form>
      </div>
      {feedback ? (
        <p role="status" className="mt-2 text-sm text-muted">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

export function SessionsPage() {
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: ({ signal }) => apiGet<ActiveSessionPublic[]>("/admin/sessions", signal),
  });

  if (sessions.isPending) return <Spinner label="Cargando sesiones…" />;
  if (sessions.isError)
    return (
      <ErrorState
        message="No se pudieron cargar las sesiones"
        onRetry={() => void sessions.refetch()}
      />
    );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted">Escalabilidad</p>
        <h1 className="text-2xl font-bold">Sesiones activas</h1>
      </header>

      <UserActions />

      {sessions.data.length === 0 ? (
        <EmptyState title="Sin sesiones activas">
          Ningún refresh token válido en este momento.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Usuario</th>
                <th className="px-3 py-2 font-medium">Rol</th>
                <th className="px-3 py-2 font-medium">Inicio</th>
                <th className="px-3 py-2 font-medium">Expira</th>
              </tr>
            </thead>
            <tbody>
              {sessions.data.map((session) => (
                <tr key={session.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{session.user_name}</td>
                  <td className="px-3 py-2">{session.user_role}</td>
                  <td className="px-3 py-2">{new Date(session.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{new Date(session.expires_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
