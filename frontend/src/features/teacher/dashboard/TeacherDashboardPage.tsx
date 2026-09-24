import { EmptyState } from "../../../components/ui/EmptyState";

export function TeacherDashboardPage() {
  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm text-muted">Profesorado</p>
        <h1 className="text-2xl font-bold">Panel del profesor</h1>
      </header>
      <EmptyState title="Dashboard en construcción">
        Los KPIs de tus cursos (entregas pendientes, alumnos, próximas fechas) llegarán en la Fase
        T1.
      </EmptyState>
    </section>
  );
}
