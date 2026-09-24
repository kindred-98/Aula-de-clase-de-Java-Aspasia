import { Link } from "react-router-dom";
import type { CourseStudentStat } from "../../../lib/api";

type Props = { courseId: number; student: CourseStudentStat };

export function StudentCard({ courseId, student }: Props) {
  return (
    <Link
      to={`/teacher/courses/${courseId}/students/${student.student_id}`}
      className="block rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{student.name}</p>
        {student.last_score !== null ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
            {student.last_score} pts
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>{student.submitted} entregadas</span>
        <span className={student.pending > 0 ? "font-medium text-warning" : ""}>
          {student.pending} pendientes
        </span>
        <span>
          {student.attendance_pct !== null
            ? `${student.attendance_pct}% asistencia`
            : "Sin asistencia"}
        </span>
      </div>
    </Link>
  );
}
