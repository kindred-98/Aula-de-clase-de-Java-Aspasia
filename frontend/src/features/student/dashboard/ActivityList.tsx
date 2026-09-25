import { EmptyState } from "../../../components/ui/EmptyState";
import type { StudentRecentEvaluation } from "../../../lib/api";

type Props = { items: StudentRecentEvaluation[] };

export function ActivityList({ items }: Props) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 font-semibold">Evaluaciones recientes</h2>
      {items.length === 0 ? (
        <EmptyState title="Sin evaluaciones">
          Cuando el profesorado revise tus entregas aparecerán aquí.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={`${item.course_id}-${index}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.assignment_title ?? "Entrega libre"}</p>
                <p className="truncate text-xs text-muted">{item.course_name}</p>
              </div>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                {item.score ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
