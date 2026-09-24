import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type StudentCourseDetail } from "../../../lib/api";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";
import { KpiCard } from "../dashboard/KpiCard";

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  submitted: "Entregado",
  reviewed: "Revisado",
  needs_changes: "Requiere cambios",
};

export function StudentDetailPage() {
  const { courseId, studentId } = useParams();
  const detail = useQuery({
    queryKey: ["teacher-student-detail", courseId, studentId],
    queryFn: ({ signal }) =>
      apiGet<StudentCourseDetail>(`/courses/${courseId}/students/${studentId}`, signal),
    enabled: Boolean(courseId && studentId),
  });

  if (detail.isPending) return <Spinner label="Cargando ficha del alumno…" />;
  if (detail.isError)
    return (
      <ErrorState
        message="No se pudo cargar la ficha del alumno"
        onRetry={() => void detail.refetch()}
      />
    );

  const d = detail.data;
  const att = d.attendance;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{d.course_name}</p>
          <h1 className="text-2xl font-bold">{d.name}</h1>
          {d.username ? <p className="text-sm text-muted">@{d.username}</p> : null}
        </div>
        <Link to={`/teacher/courses/${courseId}`} className="text-sm text-primary hover:underline">
          ← Volver al curso
        </Link>
      </header>

      <section aria-label="Resumen" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Nota media"
          value={d.average_score !== null ? d.average_score : "—"}
          accent="primary"
        />
        <KpiCard label="Entregadas" value={d.submitted} accent="success" />
        <KpiCard
          label="Pendientes"
          value={d.pending}
          accent={d.pending > 0 ? "warning" : "success"}
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

      <section aria-label="Entregas" className="space-y-3">
        <h2 className="font-semibold">Entregas y evaluaciones</h2>
        {d.submissions.length === 0 ? (
          <EmptyState title="Sin entregas">
            Este alumno aún no ha entregado nada en este curso.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {d.submissions.map((row) => (
              <li
                key={row.submission_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{row.assignment_title ?? "Entrega libre"}</p>
                  <p className="text-xs text-muted">
                    {row.submitted_at
                      ? `Entregado el ${new Date(row.submitted_at).toLocaleString()}`
                      : "Sin fecha de entrega"}
                    {row.evaluated_at
                      ? ` · evaluado el ${new Date(row.evaluated_at).toLocaleDateString()}`
                      : ""}
                  </p>
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
