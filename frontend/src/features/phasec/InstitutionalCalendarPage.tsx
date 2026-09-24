import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet, type InstitutionalCalendarItem } from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function InstitutionalCalendarPage() {
  const calendar = useQuery({
    queryKey: ["institutional-calendar"],
    queryFn: ({ signal }) => apiGet<InstitutionalCalendarItem[]>("/calendar/institutional", signal),
  });

  if (calendar.isPending) return <Spinner label="Cargando calendario institucional…" />;
  if (calendar.isError)
    return (
      <ErrorState
        message="No se pudo cargar el calendario"
        onRetry={() => void calendar.refetch()}
      />
    );

  const items = calendar.data;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-muted">Todos tus cursos</p>
        <h1 className="text-2xl font-bold">Calendario institucional</h1>
      </header>

      {items.length === 0 ? (
        <EmptyState title="Sin eventos">
          No hay tareas con fecha ni anuncios en tus cursos.
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {items.map((item) => (
            <li
              key={`${item.kind}-${item.id}`}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      item.kind === "assignment"
                        ? "bg-warning/20 text-warning"
                        : "bg-primary/15 text-primary"
                    }`}
                  >
                    {item.kind === "assignment" ? "Tarea" : "Anuncio"}
                  </span>
                  <h2 className="mt-2 font-semibold">{item.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {item.course_name} ({item.course_code}) ·{" "}
                    {formatWhen(item.ends_at ?? item.starts_at)}
                  </p>
                </div>
                <Link
                  to={`/courses/${item.course_id}`}
                  className="text-sm text-primary hover:underline"
                >
                  Ir al curso →
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
