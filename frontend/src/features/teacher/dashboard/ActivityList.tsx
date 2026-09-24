import { EmptyState } from "../../../components/ui/EmptyState";
import type { TeacherRecentItem } from "../../../lib/api";

type Props = { items: TeacherRecentItem[] };

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  submitted: "Entregado",
  reviewed: "Revisado",
  needs_changes: "Requiere cambios",
};

export function ActivityList({ items }: Props) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 font-semibold">Entregas recientes</h2>
      {items.length === 0 ? (
        <EmptyState title="Sin actividad">Las entregas de tus alumnos aparecerán aquí.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={`${item.course_id}-${index}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.student_name}</p>
                <p className="truncate text-xs text-muted">
                  {[item.assignment_title ?? "Entrega libre", item.course_name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                {statusLabel[item.status] ?? item.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
