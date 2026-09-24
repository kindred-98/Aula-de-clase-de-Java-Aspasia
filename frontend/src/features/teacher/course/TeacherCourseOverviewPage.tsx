import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type CourseOverview } from "../../../lib/api";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";
import { AssignmentProgressRow } from "./AssignmentProgressRow";
import { StudentCard } from "./StudentCard";

const quickLinks: { to: string; label: string }[] = [
  { to: "", label: "Aula" },
  { to: "/attendance", label: "Asistencia" },
  { to: "/gradebook", label: "Notas" },
  { to: "/rubrics", label: "Rúbricas" },
  { to: "/content", label: "Contenido y anuncios" },
  { to: "/messages/course", label: "Chat del curso" },
];

export function TeacherCourseOverviewPage() {
  const { courseId } = useParams();
  const overview = useQuery({
    queryKey: ["teacher-course-overview", courseId],
    queryFn: ({ signal }) => apiGet<CourseOverview>(`/courses/${courseId}/overview`, signal),
    enabled: Boolean(courseId),
  });

  if (overview.isPending) return <Spinner label="Cargando panel del curso…" />;
  if (overview.isError)
    return (
      <ErrorState message="No se pudo cargar el curso" onRetry={() => void overview.refetch()} />
    );

  const d = overview.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Panel del curso</p>
          <h1 className="text-2xl font-bold">{d.course_name}</h1>
        </div>
        <Link to="/teacher" className="text-sm text-primary hover:underline">
          ← Volver al panel
        </Link>
      </header>

      <section aria-label="Accesos rápidos">
        <h2 className="mb-3 font-semibold">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-2">
          {quickLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to === "/messages/course" ? link.to : `/courses/${courseId}${link.to}`}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm transition hover:border-primary"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Tareas" className="space-y-3">
        <h2 className="font-semibold">Progreso por tarea</h2>
        {d.assignment_stats.length === 0 ? (
          <EmptyState title="Sin tareas">
            Crea tareas desde el aula para ver su progreso de entrega aquí.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {d.assignment_stats.map((stat) => (
              <AssignmentProgressRow key={stat.assignment_id} stat={stat} />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Alumnos" className="space-y-3">
        <h2 className="font-semibold">Alumnos</h2>
        {d.student_stats.length === 0 ? (
          <EmptyState title="Sin alumnos matriculados">
            Matricula alumnos desde el aula para ver su estado aquí.
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {d.student_stats.map((student) => (
              <StudentCard key={student.student_id} courseId={d.course_id} student={student} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
