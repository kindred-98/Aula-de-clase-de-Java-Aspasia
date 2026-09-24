import type { CoursePublic } from "../../../lib/api";

export type ObserverFilterState = {
  course_id: string;
  status: string;
  student_id: string;
};

type Props = {
  value: ObserverFilterState;
  onChange: (next: ObserverFilterState) => void;
  courses: CoursePublic[];
};

const selectClass =
  "rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

export function ObserverFilters({ value, onChange, courses }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3">
      <label className="block space-y-1 text-xs text-muted">
        Curso
        <select
          className={`${selectClass} block`}
          value={value.course_id}
          onChange={(e) => onChange({ ...value, course_id: e.target.value })}
        >
          <option value="">Todos</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-xs text-muted">
        Estado
        <select
          className={`${selectClass} block`}
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
        >
          <option value="">Todos</option>
          <option value="draft">draft</option>
          <option value="submitted">submitted</option>
          <option value="returned">returned</option>
          <option value="accepted">accepted</option>
        </select>
      </label>
      <label className="block space-y-1 text-xs text-muted">
        Alumno (id)
        <input
          type="number"
          className={`${selectClass} block w-28`}
          value={value.student_id}
          onChange={(e) => onChange({ ...value, student_id: e.target.value })}
        />
      </label>
      <button
        type="button"
        onClick={() => onChange({ course_id: "", status: "", student_id: "" })}
        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg"
      >
        Limpiar
      </button>
    </div>
  );
}
