import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type CoursePublic, type ObserverResponse } from "../../../lib/api";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";
import { ObserverFilters, type ObserverFilterState } from "./ObserverFilters";

function readFilters(search: string): ObserverFilterState {
  const params = new URLSearchParams(search);
  return {
    course_id: params.get("course_id") ?? "",
    status: params.get("status") ?? "",
    student_id: params.get("student_id") ?? "",
  };
}

export function AdminObserverPage() {
  const [location] = useSearchParams();
  const [filters, setFilters] = useState<ObserverFilterState>(() =>
    readFilters(location.toString()),
  );

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: ({ signal }) => apiGet<CoursePublic[]>("/courses", signal),
  });

  const qs = new URLSearchParams();
  if (filters.course_id) qs.set("course_id", filters.course_id);
  if (filters.status) qs.set("status", filters.status);
  if (filters.student_id) qs.set("student_id", filters.student_id);
  const query = qs.toString();

  const submissions = useQuery({
    queryKey: ["observer", query],
    queryFn: ({ signal }) =>
      apiGet<ObserverResponse>(`/admin/observer/submissions${query ? `?${query}` : ""}`, signal),
  });

  const evaluations = useQuery({
    queryKey: ["observer-evals", query],
    queryFn: ({ signal }) =>
      apiGet<{
        total: number;
        items: {
          id: number;
          submission_id: number;
          student_name: string | null;
          course_name: string | null;
          score: string;
          comment: string;
          evaluated_at: string;
        }[];
      }>(`/admin/observer/evaluations${query ? `?${query}` : ""}`, signal),
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">Visibilidad total del aula</p>
        <h1 className="text-2xl font-bold">Observador</h1>
        <p className="mt-1 text-sm text-muted">
          Entregas, archivos y notas de todos los cursos, en un solo lugar.
        </p>
      </header>

      <ObserverFilters value={filters} onChange={setFilters} courses={courses.data ?? []} />

      <section aria-label="Entregas" className="space-y-3">
        <h2 className="font-semibold">
          Entregas{" "}
          {submissions.isSuccess ? (
            <span className="text-sm font-normal text-muted">({submissions.data.total})</span>
          ) : null}
        </h2>
        {submissions.isPending ? <Spinner label="Cargando entregas" /> : null}
        {submissions.isError ? (
          <ErrorState
            message="No se pudieron cargar las entregas"
            onRetry={() => void submissions.refetch()}
          />
        ) : null}
        {submissions.isSuccess && submissions.data.items.length === 0 ? (
          <EmptyState title="Sin entregas">Ajusta los filtros o espera a los alumnos</EmptyState>
        ) : null}
        {submissions.isSuccess && submissions.data.items.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Alumno</th>
                  <th className="px-3 py-2">Curso</th>
                  <th className="px-3 py-2">Tarea</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Archivos</th>
                  <th className="px-3 py-2">Nota</th>
                  <th className="px-3 py-2">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {submissions.data.items.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{row.student_name}</td>
                    <td className="px-3 py-2">{row.course_name}</td>
                    <td className="px-3 py-2">{row.assignment_title ?? "—"}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2 tabular-nums">{row.file_count}</td>
                    <td className="px-3 py-2 tabular-nums">{row.latest_score ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {new Date(row.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section aria-label="Notas" className="space-y-3">
        <h2 className="font-semibold">
          Notas{" "}
          {evaluations.isSuccess ? (
            <span className="text-sm font-normal text-muted">({evaluations.data.total})</span>
          ) : null}
        </h2>
        {evaluations.isPending ? <Spinner label="Cargando notas" /> : null}
        {evaluations.isError ? <ErrorState message="No se pudieron cargar las notas" /> : null}
        {evaluations.isSuccess && evaluations.data.items.length === 0 ? (
          <EmptyState title="Sin notas" />
        ) : null}
        {evaluations.isSuccess && evaluations.data.items.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Alumno</th>
                  <th className="px-3 py-2">Curso</th>
                  <th className="px-3 py-2">Nota</th>
                  <th className="px-3 py-2">Comentario</th>
                  <th className="px-3 py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.data.items.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{row.student_name}</td>
                    <td className="px-3 py-2">{row.course_name}</td>
                    <td className="px-3 py-2 tabular-nums">{row.score}</td>
                    <td className="px-3 py-2 text-muted">{row.comment || "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {new Date(row.evaluated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
