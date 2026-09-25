import { Link } from "react-router-dom";
import type { StudentDashboardCourse } from "../../../lib/api";

type Props = { course: StudentDashboardCourse };

export function CourseCard({ course }: Props) {
  const nextDue = course.next_due_at
    ? new Date(course.next_due_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <Link
      to={`/student/courses/${course.id}`}
      className="block rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{course.name}</p>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted">
          {course.code}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span className={course.pending > 0 ? "font-medium text-warning" : ""}>
          {course.pending} por entregar
        </span>
      </div>
      {nextDue ? (
        <p className="mt-2 text-xs text-muted">Próxima entrega: {nextDue}</p>
      ) : (
        <p className="mt-2 text-xs text-muted">Sin fechas próximas</p>
      )}
    </Link>
  );
}
