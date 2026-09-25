import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { StudentPendingItem } from "../../../lib/api";

type Props = { items: StudentPendingItem[] };

function formatDue(item: StudentPendingItem): { text: string; overdue: boolean } {
  if (!item.due_at) return { text: "Sin fecha", overdue: false };
  const due = new Date(item.due_at);
  const label = due.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return due.getTime() < Date.now()
    ? { text: `Vencida · ${label}`, overdue: true }
    : { text: label, overdue: false };
}

export function PendingList({ items }: Props) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 font-semibold">Por entregar</h2>
      {items.length === 0 ? (
        <EmptyState title="Nada por entregar">Tus tareas pendientes aparecerán aquí.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const due = formatDue(item);
            return (
              <li key={item.assignment_id}>
                <Link
                  to={`/courses/${item.course_id}/work/${item.assignment_id}`}
                  className="flex items-start justify-between gap-3 rounded-md px-1 py-1 text-sm transition hover:bg-bg"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-muted">{item.course_name}</span>
                  </span>
                  <span
                    className={`shrink-0 text-xs ${
                      due.overdue ? "font-medium text-danger" : "text-muted"
                    }`}
                  >
                    {due.text}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
