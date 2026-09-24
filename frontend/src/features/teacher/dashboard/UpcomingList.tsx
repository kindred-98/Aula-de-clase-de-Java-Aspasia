import { EmptyState } from "../../../components/ui/EmptyState";
import type { TeacherUpcomingItem } from "../../../lib/api";

type Props = { items: TeacherUpcomingItem[] };

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
            <li key={item.assignment_id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted">{item.course_name}</p>
              </div>
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
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
