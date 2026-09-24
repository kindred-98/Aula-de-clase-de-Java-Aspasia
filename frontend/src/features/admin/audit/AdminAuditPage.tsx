import { useQuery } from "@tanstack/react-query";
import { apiGet, type AuditLogPublic } from "../../../lib/api";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";

export function AdminAuditPage() {
  const audit = useQuery({
    queryKey: ["admin-audit"],
    queryFn: ({ signal }) => apiGet<AuditLogPublic[]>("/admin/audit-logs?limit=200", signal),
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">Trazabilidad</p>
        <h1 className="text-2xl font-bold">Auditoría</h1>
        <p className="mt-1 text-sm text-muted">
          Quién hizo qué y cuándo, ordenado por fecha (más reciente primero).
        </p>
      </header>

      {audit.isPending ? <Spinner label="Cargando auditoría" /> : null}
      {audit.isError ? (
        <ErrorState message="No se pudo cargar la auditoría" onRetry={() => void audit.refetch()} />
      ) : null}
      {audit.isSuccess && audit.data.length === 0 ? (
        <EmptyState title="Sin eventos">La actividad aparecerá aquí</EmptyState>
      ) : null}

      {audit.isSuccess && audit.data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Acción</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Entidad</th>
                <th className="px-3 py-2">Curso</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.map((row) => (
                <tr key={row.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-xs text-muted tabular-nums">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.action}</td>
                  <td className="px-3 py-2">{row.actor_name ?? row.actor_id ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.entity_type ? `${row.entity_type}#${row.entity_id ?? ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.course_id ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
