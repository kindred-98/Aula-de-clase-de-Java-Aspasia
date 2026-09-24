import { EmptyState } from "../../../components/ui/EmptyState";

export function EvaluationQueuePage() {
  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm text-muted">Profesorado</p>
        <h1 className="text-2xl font-bold">Cola de evaluación</h1>
      </header>
      <EmptyState title="Cola en construcción">
        Las entregas pendientes de todos tus cursos aparecerán aquí en la Fase T2.
      </EmptyState>
    </section>
  );
}
