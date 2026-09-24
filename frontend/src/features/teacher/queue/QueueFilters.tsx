import type { CoursePublic } from "../../../lib/api";

type Props = {
  courses: CoursePublic[];
  courseId: string;
  status: string;
  onCourseChange: (value: string) => void;
  onStatusChange: (value: string) => void;
};

export function QueueFilters({ courses, courseId, status, onCourseChange, onStatusChange }: Props) {
  const selectClass =
    "rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
      <label className="block space-y-1 text-sm">
        <span className="text-muted">Curso</span>
        <select
          className={selectClass}
          value={courseId}
          onChange={(e) => onCourseChange(e.target.value)}
        >
          <option value="">Todos mis cursos</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name} ({course.code})
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted">Estado</span>
        <select
          className={selectClass}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="">Pendientes (todos)</option>
          <option value="submitted">Entregado</option>
          <option value="needs_changes">Requiere cambios</option>
        </select>
      </label>
    </div>
  );
}
