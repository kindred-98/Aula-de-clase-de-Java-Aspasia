import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type StudentCourseProgress } from "../../../lib/api";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";
import { KpiCard } from "../dashboard/KpiCard";

const statusLabel: Record<string, string> = {
  none: "Sin entregar",
  draft: "Borrador",
  submitted: "Entregada",
  reviewed: "Evaluada",
  needs_changes: "Requiere cambios",
};

function formatDue(dueAt: string | null): string {
  if (!dueAt) return "Sin fecha";
  const due = new Date(dueAt);
  const overdue = due.getTime() < Date.now();
  const label = due.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return overdue ? `Vencida · ${label}` : label;
}

export function MyProgressPage() {
  const { courseId } = useParams();
  const progress = useQuery({
    queryKey: ["student-course-progress", courseId],
    queryFn: ({ signal }) =>
      apiGet<StudentCourseProgress>(`/courses/${courseId}/my-progress`, signal),
    enabled: Boolean(courseId),
  });

  if (progress.isPending) return <Spinner label="Cargando mi progreso…" />;
  if (progress.isError)
    return (
      <ErrorState message="No se pudo cargar tu progreso" onRetry={() => void progress.refetch()} />
    );

  const d = progress.data;
  const s = d.summary;
  const att = d.attendance;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Mi progreso</p>
          <h1 className="text-2xl font-bold">{d.course_name}</h1>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link to={`/courses/${courseId}`} className="text-primary hover:underline">
            Ir al aula →
          </Link>
          <Link to={`/courses/${courseId}/work`} className="text-primary hover:underline">
            Ver tareas →
          </Link>
          <Link to="/student" className="text-muted hover:underline">
            ← Panel
          </Link>
        </div>
      </header>

      <section aria-label="Resumen" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Entregadas"
          value={`${s.delivered}/${s.total}`}
          hint={`${s.delivery_pct}% de entrega`}
          accent="primary"
        />
        <KpiCard
          label="Pendientes"
          value={s.pending}
          accent={s.pending > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="Nota media"
          value={s.average_score !== null ? s.average_score : "—"}
          accent="success"
        />
        <KpiCard
          label="Asistencia"
          value={att.pct !== null ? `${att.pct}%` : "—"}
          hint={`${att.present} presentes · ${att.absent} faltas`}
          accent={att.absent > 0 ? "warning" : "success"}
        />
      </section>

      <section
        aria-label="Detalle de asistencia"
        className="rounded-lg border border-border bg-surface p-4"
      >
        <h2 className="mb-2 font-semibold">Asistencia</h2>
        <p className="text-sm text-muted">
          {att.present} presentes · {att.late} tardes · {att.absent} faltas · {att.excused}{" "}
          justificadas
        </p>
      </section>

      <section aria-label="Progreso por tarea" className="space-y-3">
        <h2 className="font-semibold">Progreso por tarea</h2>
        {d.assignment_stats.length === 0 ? (
          <EmptyState title="Sin tareas todavía">
            Cuando el profesor publique tareas verás aquí tu estado y tus notas.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {d.assignment_stats.map((row) => (
              <li
                key={row.assignment_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="min-w-0">
                  <Link
                    to={`/courses/${courseId}/work/${row.assignment_id}`}
                    className="font-medium hover:underline"
                  >
                    {row.title}
                  </Link>
                  <p className="text-xs text-muted">Fecha límite: {formatDue(row.due_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                    {statusLabel[row.status] ?? row.status}
                  </span>
                  {row.score !== null ? (
                    <span className="text-sm font-semibold">{row.score} pts</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
