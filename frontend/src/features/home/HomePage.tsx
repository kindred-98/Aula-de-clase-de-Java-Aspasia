import { useQuery } from "@tanstack/react-query";
import { apiGet, type HealthPayload } from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

export function HomePage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => apiGet<HealthPayload>("/health", signal),
  });

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plataforma de aula virtual</h1>
        <p className="mt-1 text-muted">
          Multi-curso: asientos, entregas, evaluaciones y más. (Fase 0: andamiaje)
        </p>
      </div>

      <article className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-semibold">Estado de la API</h2>
        {health.isPending ? <Spinner label="Consultando API" /> : null}
        {health.isError ? (
          <div className="mt-3">
            <ErrorState
              message={
                health.error instanceof Error
                  ? health.error.message
                  : "No se pudo conectar con el backend."
              }
              onRetry={() => void health.refetch()}
            />
          </div>
        ) : null}
        {health.isSuccess ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">Estado</dt>
              <dd className="font-medium text-success">{health.data.status}</dd>
            </div>
            <div>
              <dt className="text-muted">Aplicación</dt>
              <dd className="font-medium">{health.data.app}</dd>
            </div>
            <div>
              <dt className="text-muted">Versión</dt>
              <dd className="font-mono">{health.data.version}</dd>
            </div>
          </dl>
        ) : null}
      </article>

      <EmptyState title="Aún no hay cursos">
        En la Fase 1 se podrán crear y abrir aulas con su cuadrícula de asientos.
      </EmptyState>
    </section>
  );
}
