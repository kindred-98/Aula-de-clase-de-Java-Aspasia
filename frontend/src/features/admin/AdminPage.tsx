import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiGet,
  apiSend,
  type AdminUserPublic,
  type AuditLogPublic,
  type CoursePublic,
  type CsvImportResult,
  type PinResetResponse,
} from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

type Tab = "users" | "import" | "audit" | "metrics";

export function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [pinFor, setPinFor] = useState<number | null>(null);
  const [resetPin, setResetPin] = useState<PinResetResponse | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvCourseId, setCsvCourseId] = useState("");
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);
  const [auditAction, setAuditAction] = useState("");
  const [metricsCourseId, setMetricsCourseId] = useState("");
  const queryClient = useQueryClient();

  const users = useQuery({
    queryKey: ["admin-users", q, role],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (role) params.set("role", role);
      const qs = params.toString();
      return apiGet<AdminUserPublic[]>(`/admin/users${qs ? `?${qs}` : ""}`, signal);
    },
  });

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: ({ signal }) => apiGet<CoursePublic[]>("/courses", signal),
  });

  const auditLogs = useQuery({
    queryKey: ["admin-audit", auditAction],
    queryFn: ({ signal }) => {
      const qs = auditAction ? `?action=${encodeURIComponent(auditAction)}` : "";
      return apiGet<AuditLogPublic[]>(`/admin/audit-logs${qs}`, signal);
    },
    enabled: tab === "audit",
  });

  const metrics = useQuery({
    queryKey: ["admin-metrics", metricsCourseId],
    queryFn: ({ signal }) =>
      apiGet<Record<string, number>>(`/admin/metrics/course/${metricsCourseId}`, signal),
    enabled: tab === "metrics" && Boolean(metricsCourseId),
  });

  const toggleStatus = useMutation({
    mutationFn: (input: { id: number; is_active: boolean }) =>
      apiSend<AdminUserPublic>("PATCH", `/admin/users/${input.id}/status`, {
        is_active: input.is_active,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const resetMutation = useMutation({
    mutationFn: (userId: number) =>
      apiSend<PinResetResponse>("POST", `/admin/users/${userId}/reset-pin`, {}),
    onSuccess: (data) => {
      setResetPin(data);
      setPinFor(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const importMutation = useMutation({
    mutationFn: () =>
      apiSend<CsvImportResult>("POST", `/admin/courses/${csvCourseId}/import-students`, {
        csv_text: csvText,
      }),
    onSuccess: (data) => {
      setImportResult(data);
      setCsvText("");
    },
  });

  function onImport(event: FormEvent) {
    event.preventDefault();
    if (!csvCourseId) return;
    importMutation.mutate();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "users", label: "Usuarios" },
    { id: "import", label: "Importar CSV" },
    { id: "audit", label: "Audit log" },
    { id: "metrics", label: "Métricas" },
  ];

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <p className="mt-1 text-sm text-muted">
          Usuarios, PINs, importación CSV, auditoría y métricas básicas.
        </p>
      </div>

      <div role="tablist" aria-label="Secciones admin" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              tab === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              className={`${inputClass} max-w-xs`}
              placeholder="Buscar por nombre, email o usuario"
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
              <option value="admin">admin</option>
              <option value="teacher">teacher</option>
              <option value="student">student</option>
            </select>
          </div>

          {resetPin ? (
            <div
              className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm"
              role="status"
            >
              <p className="font-semibold">PIN generado (se muestra una sola vez)</p>
              <p className="mt-1 font-mono text-lg">{resetPin.pin}</p>
              <button
                type="button"
                onClick={() => setResetPin(null)}
                className="mt-2 rounded-md border border-border px-3 py-1 text-xs"
              >
                Ocultar
              </button>
            </div>
          ) : null}

          {users.isPending ? <Spinner label="Cargando usuarios" /> : null}
          {users.isError ? (
            <ErrorState
              message={users.error instanceof Error ? users.error.message : "Error"}
              onRetry={() => void users.refetch()}
            />
          ) : null}
          {users.isSuccess && users.data.length === 0 ? <EmptyState title="Sin usuarios" /> : null}

          {users.isSuccess && users.data.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Usuario</th>
                    <th className="px-3 py-2">Rol</th>
                    <th className="px-3 py-2">Activo</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{u.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {u.username ?? u.email ?? "—"}
                      </td>
                      <td className="px-3 py-2">{u.role}</td>
                      <td className="px-3 py-2">{u.is_active ? "Sí" : "No"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              toggleStatus.mutate({ id: u.id, is_active: !u.is_active })
                            }
                            disabled={toggleStatus.isPending}
                            className="rounded border border-border px-2 py-1 text-xs hover:bg-bg"
                          >
                            {u.is_active ? "Desactivar" : "Activar"}
                          </button>
                          {u.role === "student" ? (
                            <button
                              type="button"
                              onClick={() => setPinFor(u.id)}
                              className="rounded border border-border px-2 py-1 text-xs hover:bg-bg"
                            >
                              Reset PIN
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {pinFor != null ? (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm">
              <p>
                ¿Resetear el PIN del usuario <strong>#{pinFor}</strong>? Se generará un PIN de 6
                dígitos que deberás anotar.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => resetMutation.mutate(pinFor)}
                  disabled={resetMutation.isPending}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-60"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setPinFor(null)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                >
                  Cancelar
                </button>
              </div>
              {resetMutation.isError ? (
                <div className="mt-2">
                  <ErrorState
                    message={
                      resetMutation.error instanceof Error ? resetMutation.error.message : "Error"
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "import" ? (
        <form
          onSubmit={onImport}
          className="space-y-3 rounded-lg border border-border bg-surface p-4"
        >
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Curso destino</span>
            <select
              className={inputClass}
              value={csvCourseId}
              onChange={(e) => setCsvCourseId(e.target.value)}
              required
            >
              <option value="">Selecciona un curso</option>
              {(courses.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">
              CSV: name[,email][,username] por línea (cabecera opcional)
            </span>
            <textarea
              className={`${inputClass} font-mono`}
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"name,email,username\nAna,ana@example.com,ana1"}
              required
            />
          </label>
          {importMutation.isError ? (
            <ErrorState
              message={
                importMutation.error instanceof Error ? importMutation.error.message : "Error"
              }
            />
          ) : null}
          <button
            type="submit"
            disabled={importMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {importMutation.isPending ? "Importando…" : "Importar estudiantes"}
          </button>

          {importResult ? (
            <div className="rounded border border-success/40 bg-success/10 p-3 text-sm">
              <p>
                Creados: <strong>{importResult.created}</strong> · Omitidos:{" "}
                <strong>{importResult.skipped}</strong>
              </p>
              {Object.keys(importResult.pins).length > 0 ? (
                <div className="mt-2">
                  <p className="font-medium">PINs (una sola vez):</p>
                  <ul className="mt-1 space-y-0.5 font-mono text-xs">
                    {Object.entries(importResult.pins).map(([username, pin]) => (
                      <li key={username}>
                        {username}: {pin}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : null}

      {tab === "audit" ? (
        <div className="space-y-3">
          <input
            className={`${inputClass} max-w-xs`}
            placeholder="Filtrar por action (ej. pin.reset)"
            value={auditAction}
            onChange={(e) => setAuditAction(e.target.value)}
            aria-label="Filtrar acción"
          />
          {auditLogs.isPending ? <Spinner label="Cargando auditoría" /> : null}
          {auditLogs.isError ? <ErrorState message="Error al cargar audit log" /> : null}
          {auditLogs.isSuccess && auditLogs.data.length === 0 ? (
            <EmptyState title="Sin eventos" />
          ) : null}
          {auditLogs.isSuccess && auditLogs.data.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Cuándo</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Acción</th>
                    <th className="px-3 py-2">Entidad</th>
                    <th className="px-3 py-2">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.data.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">{row.actor_name ?? row.actor_id ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">{row.action}</td>
                      <td className="px-3 py-2">
                        {row.entity_type}
                        {row.entity_id ? `#${row.entity_id}` : ""}
                        {row.course_id ? ` · course#${row.course_id}` : ""}
                      </td>
                      <td className="px-3 py-2 font-mono">{row.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "metrics" ? (
        <div className="space-y-3">
          <label className="block max-w-xs space-y-1 text-sm">
            <span className="text-muted">Curso</span>
            <select
              className={inputClass}
              value={metricsCourseId}
              onChange={(e) => setMetricsCourseId(e.target.value)}
            >
              <option value="">Selecciona un curso</option>
              {(courses.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </label>
          {!metricsCourseId ? (
            <EmptyState title="Elige un curso">
              Se mostrarán matrículas y entregas por estado.
            </EmptyState>
          ) : null}
          {metrics.isPending ? <Spinner label="Cargando métricas" /> : null}
          {metrics.isError ? <ErrorState message="Error al cargar métricas" /> : null}
          {metrics.isSuccess ? (
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(metrics.data).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-border bg-surface p-4">
                  <dt className="text-xs uppercase text-muted">{key}</dt>
                  <dd className="mt-1 text-2xl font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
