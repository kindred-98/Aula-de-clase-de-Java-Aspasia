import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet, type GradebookMatrix } from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

export function GradebookPage() {
  const courseId = useParams().courseId ?? "";
  const gradebook = useQuery({
    queryKey: ["gradebook", courseId],
    queryFn: ({ signal }) => apiGet<GradebookMatrix>(`/courses/${courseId}/gradebook`, signal),
    enabled: Boolean(courseId),
  });

  if (gradebook.isPending) return <Spinner label="Cargando gradebook…" />;
  if (gradebook.isError)
    return (
      <ErrorState
        message="No se pudo cargar el gradebook (solo profes y admin)"
        onRetry={() => void gradebook.refetch()}
      />
    );

  const data = gradebook.data;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-muted">
          <Link to={`/admin/courses/${courseId}`} className="text-primary hover:underline">
            Curso
          </Link>{" "}
          / Notas
        </p>
        <h1 className="text-2xl font-bold">Gradebook · {data.course_name}</h1>
      </header>

      {data.columns.length === 0 || data.students.length === 0 ? (
        <EmptyState title="Sin datos">
          Todavía no hay tareas o alumnos matriculados para mostrar.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Alumno</th>
                {data.columns.map((col) => (
                  <th key={col.assignment_id} className="px-3 py-2 font-medium">
                    {col.title}
                    <span className="block text-xs font-normal">/ {col.max_score}</span>
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">Media</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((student) => (
                <tr key={student.student_id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {student.name}
                    {student.username ? (
                      <span className="block text-xs text-muted">@{student.username}</span>
                    ) : null}
                  </td>
                  {data.columns.map((col) => {
                    const cell = student.cells[String(col.assignment_id)];
                    return (
                      <td key={col.assignment_id} className="px-3 py-2">
                        {cell?.score ?? (
                          <span className="text-xs text-muted">{cell?.status ?? "—"}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 font-semibold">{student.average ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
