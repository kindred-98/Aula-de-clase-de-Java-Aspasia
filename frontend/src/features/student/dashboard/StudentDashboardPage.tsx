import { EmptyState } from "../../../components/ui/EmptyState";

export function StudentDashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted">Tu espacio</p>
        <h1 className="text-2xl font-bold">Panel del alumno</h1>
      </header>
      <EmptyState title="Dashboard en preparación">
        En la Fase S1 verás aquí tus cursos, entregas pendientes y próximas fechas.
      </EmptyState>
    </div>
  );
}
