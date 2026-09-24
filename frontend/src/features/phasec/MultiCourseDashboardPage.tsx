import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet, type MultiCourseDashboard } from "../../lib/api";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

export function MultiCourseDashboardPage() {
  const dashboard = useQuery({
    queryKey: ["multi-dashboard"],
    queryFn: ({ signal }) => apiGet<MultiCourseDashboard>("/admin/dashboard/multi", signal),
  });

  if (dashboard.isPending) return <Spinner label="Cargando panel multi-curso…" />;
  if (dashboard.isError)
    return (
      <ErrorState
        message="No se pudo cargar el dashboard multi-curso"
        onRetry={() => void dashboard.refetch()}
      />
    );

  const { totals, courses } = dashboard.data;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted">Centro de mando</p>
        <h1 className="text-2xl font-bold">Vista multi-curso</h1>
      </header>

      <section aria-label="Totales" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Cursos", value: totals.courses ?? 0 },
          { label: "Matrículas", value: totals.enrolled ?? 0 },
          { label: "Tareas", value: totals.assignments ?? 0 },
          { label: "Entregas", value: totals.submissions ?? 0 },
          { label: "Pendientes", value: totals.pending ?? 0 },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </section>

      <section aria-label="Cursos" className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Curso</th>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Alumnos</th>
              <th className="px-3 py-2 font-medium">Tareas</th>
              <th className="px-3 py-2 font-medium">Entregas</th>
              <th className="px-3 py-2 font-medium">Pendientes</th>
              <th className="px-3 py-2 font-medium">Avance</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {courses.map((row) => (
              <tr key={row.course_id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2">{row.code}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{row.enrolled}</td>
                <td className="px-3 py-2">{row.assignments}</td>
                <td className="px-3 py-2">{row.submissions_total}</td>
                <td className="px-3 py-2">{row.submissions_pending}</td>
                <td className="px-3 py-2">{row.completion_rate}%</td>
                <td className="px-3 py-2">
                  <Link
                    to={`/admin/courses/${row.course_id}`}
                    className="text-primary hover:underline"
                  >
                    Gestionar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
