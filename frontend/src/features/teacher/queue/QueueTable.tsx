import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { TeacherQueueItem } from "../../../lib/api";

type Props = {
  items: TeacherQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

const statusLabel: Record<string, string> = {
  submitted: "Entregado",
  needs_changes: "Requiere cambios",
};

export function QueueTable({ items, total, page, pageSize, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (items.length === 0) {
    return (
      <EmptyState title="Cola vacía">
        No hay entregas pendientes con estos filtros. Buen trabajo.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.submission_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <div className="min-w-0">
              <p className="font-medium">{item.student_name}</p>
              <p className="truncate text-sm text-muted">
                {[item.assignment_title ?? "Entrega libre", item.course_name]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {item.submitted_at
                  ? `Entregado el ${new Date(item.submitted_at).toLocaleString()}`
                  : "Sin fecha de entrega"}
                {item.due_at
                  ? ` · límite ${new Date(item.due_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                  : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                {statusLabel[item.status] ?? item.status}
              </span>
              <Link
                to={`/courses/${item.course_id}/evaluate`}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
              >
                Evaluar
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-md border border-border px-3 py-1.5 hover:bg-bg disabled:opacity-60"
          >
            Anterior
          </button>
          <span className="text-muted">
            Página {page} de {totalPages} · {total} entregas
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-md border border-border px-3 py-1.5 hover:bg-bg disabled:opacity-60"
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </div>
  );
}
