import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet, type CoursePublic } from "../../../lib/api";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";
import { CourseEditForm } from "./CourseEditForm";
import { EnrollmentManager } from "./EnrollmentManager";
import { TeacherManager } from "./TeacherManager";
import { CourseBackupButton } from "../../phasec/CourseBackupButton";
import { CourseTaxonomyPanel } from "../../scale/CourseTaxonomyPanel";

export function AdminCourseDetailPage() {
  const { courseId } = useParams();
  const id = Number(courseId);

  const course = useQuery({
    queryKey: ["course", id],
    queryFn: ({ signal }) => apiGet<CoursePublic>(`/courses/${id}`, signal),
    enabled: Number.isFinite(id),
  });

  if (course.isPending) return <Spinner label="Cargando curso…" />;
  if (course.isError)
    return (
      <ErrorState message="No se pudo cargar el curso" onRetry={() => void course.refetch()} />
    );

  const c = course.data;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            <Link to="/admin/courses" className="text-primary hover:underline">
              Cursos
            </Link>{" "}
            / {c.code}
          </p>
          <h1 className="text-2xl font-bold">{c.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/courses/${c.id}`}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg"
          >
            Ver aula
          </Link>
          <Link
            to={`/courses/${c.id}/gradebook`}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg"
          >
            Gradebook
          </Link>
          <Link
            to={`/admin/observer?course_id=${c.id}`}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg"
          >
            Observar entregas
          </Link>
          <CourseBackupButton courseId={c.id} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <CourseEditForm key={`${c.id}-${c.name}-${c.status}`} course={c} />
        <div className="space-y-4">
          <TeacherManager courseId={c.id} />
          <EnrollmentManager courseId={c.id} />
        </div>
      </div>

      <CourseTaxonomyPanel courseId={c.id} categoryId={c.category_id} cohortId={c.cohort_id} />

      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        Métricas y CSV del curso:{" "}
        <Link to={`/admin/tools?course_id=${c.id}`} className="text-primary hover:underline">
          ver en Herramientas
        </Link>
      </div>
    </div>
  );
}
