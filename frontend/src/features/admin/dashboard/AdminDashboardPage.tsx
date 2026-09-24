import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet, type AdminDashboardStats } from "../../../lib/api";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";
import { ActivityList } from "./ActivityList";
import { KpiCard } from "./KpiCard";
import { QuickActions } from "./QuickActions";

export function AdminDashboardPage() {
  const dashboard = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: ({ signal }) => apiGet<AdminDashboardStats>("/admin/dashboard", signal),
  });

  if (dashboard.isPending) return <Spinner label="Cargando panel…" />;
  if (dashboard.isError)
    return (
      <ErrorState
        message="No se pudo cargar el dashboard"
        onRetry={() => void dashboard.refetch()}
      />
    );

  const d = dashboard.data;
  const auditItems = d.recent_audit.map((row) => ({
    id: row.id,
    primary: row.action,
    secondary: [row.actor_name, row.course_id ? `curso #${row.course_id}` : null]
      .filter(Boolean)
      .join(" · "),
    meta: new Date(row.created_at).toLocaleString(),
  }));
  const subItems = d.recent_submissions.map((row) => ({
    id: row.id,
    primary: row.student_name ?? `Entrega #${row.id}`,
    secondary: [row.course_name, row.status].filter(Boolean).join(" · "),
    meta: new Date(row.updated_at).toLocaleString(),
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Centro de mando</p>
          <h1 className="text-2xl font-bold">Dashboard</h1>
        </div>
        <Link to="/admin/courses" className="text-sm text-primary hover:underline">
          Gestionar cursos →
        </Link>
      </header>

      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Cursos activos"
          value={d.courses_active}
          hint={`${d.courses_total} en total`}
          accent="primary"
        />
        <KpiCard
          label="Usuarios"
          value={d.users_total}
          hint={`${d.students_total} alumnos · ${d.teachers_total} profes`}
          accent="success"
        />
        <KpiCard
          label="Por revisar"
          value={d.submissions_pending}
          hint={`${d.submissions_total} entregas`}
          accent={d.submissions_pending > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="Matrículas"
          value={d.enrollments_total}
          hint="Asientos ocupados"
          accent="primary"
        />
      </section>

      <section aria-label="Acciones rápidas">
        <h2 className="mb-3 font-semibold">Acciones rápidas</h2>
        <QuickActions />
      </section>

      <section aria-label="Actividad" className="grid gap-4 lg:grid-cols-2">
        <ActivityList title="Entregas recientes" items={subItems} />
        <ActivityList title="Auditoría reciente" items={auditItems} />
      </section>
    </div>
  );
}
