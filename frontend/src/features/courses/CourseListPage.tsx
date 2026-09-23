import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet, type CoursePublic } from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

export function CourseListPage() {
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: ({ signal }) => apiGet<CoursePublic[]>("/courses", signal),
  });

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mis cursos</h1>
        <p className="mt-1 text-sm text-muted">Abre un aula para ver la cuadrícula de asientos.</p>
      </div>

      {courses.isPending ? <Spinner label="Cargando cursos" /> : null}
      {courses.isError ? (
        <ErrorState
          message={courses.error instanceof Error ? courses.error.message : "Error al cargar"}
          onRetry={() => void courses.refetch()}
        />
      ) : null}
      {courses.isSuccess && courses.data.length === 0 ? (
        <EmptyState title="Sin cursos todavía">Pide a un admin que te matricule.</EmptyState>
      ) : null}

      {courses.isSuccess && courses.data.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {courses.data.map((course) => (
            <li key={course.id}>
              <Link
                to={`/courses/${course.id}`}
                className="block rounded-lg border border-border bg-surface p-4 hover:border-primary"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold">{course.name}</h2>
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                    {course.code}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {course.description ?? "Sin descripción"} · {course.layout_rows}×
                  {course.layout_cols}
                </p>
                <p className="mt-2 text-xs uppercase tracking-wide text-muted">{course.status}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
