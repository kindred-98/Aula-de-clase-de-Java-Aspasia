import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet, type StudentDashboard } from "../../../lib/api";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";
import { ActivityList } from "./ActivityList";
import { CourseCard } from "./CourseCard";
import { KpiCard } from "./KpiCard";
import { QuickActions } from "./QuickActions";
import { UpcomingList } from "./UpcomingList";

export function StudentDashboardPage() {
  const dashboard = useQuery({
    queryKey: ["student-dashboard"],
    queryFn: ({ signal }) => apiGet<StudentDashboard>("/student/dashboard", signal),
  });

  if (dashboard.isPending) return <Spinner label="Cargando panel…" />;
  if (dashboard.isError)
    return (
      <ErrorState message="No se pudo cargar tu panel" onRetry={() => void dashboard.refetch()} />
    );

  const d = dashboard.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Tu espacio</p>
          <h1 className="text-2xl font-bold">Panel del alumno</h1>
        </div>
        <Link to="/courses" className="text-sm text-primary hover:underline">
          Ver mis cursos →
        </Link>
      </header>

      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Cursos" value={d.totals.courses_count} />
        <KpiCard
          label="Por entregar"
          value={d.totals.pending_submissions}
          accent={d.totals.pending_submissions > 0 ? "warning" : "success"}
        />
        <KpiCard label="Fechas esta semana" value={d.totals.due_this_week} accent="primary" />
        <KpiCard
          label="Evaluadas"
          value={d.totals.graded_submissions}
          hint="Entregas revisadas"
          accent="success"
        />
      </section>

      <section aria-label="Acciones rápidas">
        <h2 className="mb-3 font-semibold">Acciones rápidas</h2>
        <QuickActions />
      </section>

      <section aria-label="Cursos" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Mis cursos</h2>
          <Link to="/courses" className="text-sm text-primary hover:underline">
            Ver todos →
          </Link>
        </div>
        {d.courses.length === 0 ? (
          <EmptyState title="Sin cursos matriculados">
            Un administrador debe matricularte en un curso para verlo aquí.
          </EmptyState>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {d.courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Actividad" className="grid gap-4 lg:grid-cols-2">
        <UpcomingList items={d.upcoming} />
        <ActivityList items={d.recent} />
      </section>
    </div>
  );
}
