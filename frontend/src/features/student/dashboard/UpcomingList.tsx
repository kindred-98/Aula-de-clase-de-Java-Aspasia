import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { StudentUpcomingItem } from "../../../lib/api";

type Props = { items: StudentUpcomingItem[] };

export function UpcomingList({ items }: Props) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 font-semibold">Próximas entregas</h2>
      {items.length === 0 ? (
        <EmptyState title="Sin fechas próximas">
          Las tareas con fecha límite aparecerán aquí.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.assignment_id}>
              <Link
                to={`/courses/${item.course_id}/work/${item.assignment_id}`}
                className="flex items-start justify-between gap-3 rounded-md px-1 py-1 text-sm transition hover:bg-bg"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-muted">{item.course_name}</span>
                </span>
                <time
                  dateTime={item.due_at}
                  className="shrink-0 text-xs text-muted"
                  title={new Date(item.due_at).toLocaleString()}
                >
                  {new Date(item.due_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
