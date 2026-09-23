import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet, type CalendarEvent } from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

function eventDate(e: CalendarEvent): string | null {
  return e.ends_at ?? e.starts_at;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function CalendarPage() {
  const courseId = useParams().courseId ?? "";

  const calendar = useQuery({
    queryKey: ["calendar", courseId],
    queryFn: ({ signal }) => apiGet<CalendarEvent[]>(`/courses/${courseId}/calendar`, signal),
    enabled: Boolean(courseId),
  });

  if (calendar.isPending) return <Spinner label="Cargando calendario" />;
  if (calendar.isError) {
    return (
      <ErrorState
        message={calendar.error instanceof Error ? calendar.error.message : "Error"}
        onRetry={() => void calendar.refetch()}
      />
    );
  }

  const events = calendar.data;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Calendario</h1>
        <p className="mt-1 text-sm text-muted">Fechas límite de tareas y anuncios del curso.</p>
        <Link
          to={`/courses/${courseId}`}
          className="mt-1 inline-block text-sm text-primary hover:underline"
        >
          ← Volver al aula
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState title="Sin eventos">
          Todavía no hay tareas con fecha límite ni anuncios.
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {events.map((e) => (
            <li
              key={`${e.kind}-${e.id}`}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      e.kind === "assignment"
                        ? "bg-warning/20 text-warning"
                        : "bg-primary/15 text-primary"
                    }`}
                  >
                    {e.kind === "assignment" ? "Tarea" : "Anuncio"}
                  </span>
                  <h2 className="mt-2 font-semibold">{e.title}</h2>
                  <p className="mt-1 text-sm text-muted">{formatWhen(eventDate(e))}</p>
                </div>
                {e.kind === "assignment" ? (
                  <Link
                    to={`/courses/${courseId}/work/${e.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Ver tarea
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
