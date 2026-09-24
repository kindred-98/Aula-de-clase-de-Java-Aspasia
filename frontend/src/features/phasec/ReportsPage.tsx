import { useQuery } from "@tanstack/react-query";
import { apiDownload, apiGet, type ReportOverview } from "../../lib/api";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

export function ReportsPage() {
  const reports = useQuery({
    queryKey: ["reports-overview"],
    queryFn: ({ signal }) => apiGet<ReportOverview>("/admin/reports/overview", signal),
  });

  if (reports.isPending) return <Spinner label="Cargando informes…" />;
  if (reports.isError)
    return (
      <ErrorState message="No se pudo cargar el informe" onRetry={() => void reports.refetch()} />
    );

  const data = reports.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Informe del centro · {data.center_name}</p>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="mt-1 text-xs text-muted">
            Generado: {new Date(data.generated_at).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void apiDownload("/admin/reports/overview.csv", "report_overview.csv")}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg"
        >
          Exportar CSV
        </button>
      </header>

      <section aria-label="Totales" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Cursos", value: data.totals.courses ?? 0 },
          { label: "Matrículas", value: data.totals.enrolled ?? 0 },
          { label: "Entregas", value: data.totals.submissions ?? 0 },
          { label: "Revisadas", value: data.totals.reviewed ?? 0 },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </section>

      <section aria-label="Cursos" className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Curso</th>
              <th className="px-3 py-2 font-medium">Alumnos</th>
              <th className="px-3 py-2 font-medium">Tareas</th>
              <th className="px-3 py-2 font-medium">Entregas</th>
              <th className="px-3 py-2 font-medium">Revisadas</th>
              <th className="px-3 py-2 font-medium">Nota media</th>
              <th className="px-3 py-2 font-medium">Asistencia</th>
            </tr>
          </thead>
          <tbody>
            {data.courses.map((row) => (
              <tr key={row.course_id} className="border-t border-border">
                <td className="px-3 py-2">
                  <span className="font-medium">{row.name}</span>{" "}
                  <span className="text-muted">({row.code})</span>
                </td>
                <td className="px-3 py-2">{row.enrolled}</td>
                <td className="px-3 py-2">{row.assignments}</td>
                <td className="px-3 py-2">{row.submissions}</td>
                <td className="px-3 py-2">{row.reviewed}</td>
                <td className="px-3 py-2">{row.avg_score ?? "—"}</td>
                <td className="px-3 py-2">
                  {row.attendance_present} presentes / {row.attendance_absent} ausentes
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
