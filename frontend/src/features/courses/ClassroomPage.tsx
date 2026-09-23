import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet, type ClassroomPayload } from "../../lib/api";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

function statusColor(status: string | null): string {
  switch (status) {
    case "submitted":
      return "bg-warning/20 border-warning";
    case "reviewed":
      return "bg-success/20 border-success";
    case "needs_changes":
      return "bg-danger/20 border-danger";
    case "draft":
      return "bg-primary/15 border-primary";
    default:
      return "bg-bg border-border";
  }
}

export function ClassroomPage() {
  const courseId = useParams().courseId ?? "";
  const room = useQuery({
    queryKey: ["classroom", courseId],
    queryFn: ({ signal }) => apiGet<ClassroomPayload>(`/courses/${courseId}/classroom`, signal),
    enabled: Boolean(courseId),
  });

  if (room.isPending) return <Spinner label="Abriendo el aula" />;
  if (room.isError) {
    return (
      <ErrorState
        message={room.error instanceof Error ? room.error.message : "No se pudo abrir el aula"}
        onRetry={() => void room.refetch()}
      />
    );
  }

  const data = room.data;
  const byCell = new Map(data.seats.map((s) => [`${s.row}-${s.col}`, s]));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            {data.course.name}{" "}
            <span className="font-mono text-base text-primary">{data.course.code}</span>
          </h1>
          <p className="text-sm text-muted">
            {data.rows} filas × {data.cols} columnas ·{" "}
            {data.teachers.map((t) => t.name).join(", ") || "sin profesorado"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/courses/${courseId}/content`}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
          >
            Contenido
          </Link>
          <Link
            to={`/courses/${courseId}/work`}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
          >
            Ir a entregas
          </Link>
        </div>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${data.cols}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Cuadrícula del aula"
      >
        {Array.from({ length: data.rows }, (_, r) =>
          Array.from({ length: data.cols }, (_, c) => {
            const seat = byCell.get(`${r + 1}-${c + 1}`);
            if (!seat) return null;
            const label = seat.student_name ?? "Libre";
            return (
              <div
                key={seat.seat_id}
                role="gridcell"
                title={`${seat.row},${seat.col} — ${label}${seat.status && seat.status !== "none" ? ` (${seat.status})` : ""}`}
                className={`rounded-md border p-2 text-xs ${statusColor(seat.status)}`}
              >
                <div className="font-mono opacity-60">
                  {seat.row},{seat.col}
                </div>
                <div className="mt-1 truncate font-medium">{label}</div>
                {seat.student_username ? (
                  <div className="truncate text-muted">{seat.student_username}</div>
                ) : null}
              </div>
            );
          }),
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        <span>
          <i className="inline-block size-2 rounded-full bg-warning" /> submitted
        </span>
        <span>
          <i className="inline-block size-2 rounded-full bg-success" /> reviewed
        </span>
        <span>
          <i className="inline-block size-2 rounded-full bg-danger" /> needs_changes
        </span>
        <span>
          <i className="inline-block size-2 rounded-full bg-primary" /> draft
        </span>
      </div>
    </section>
  );
}
