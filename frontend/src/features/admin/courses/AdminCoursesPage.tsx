import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { apiGet, type CoursePublic } from "../../../lib/api";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";
import { CourseCreateForm } from "./CourseCreateForm";

export function AdminCoursesPage() {
  const [params] = useSearchParams();
  const [showCreate, setShowCreate] = useState(params.get("new") === "1");
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: ({ signal }) => apiGet<CoursePublic[]>("/courses", signal),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Gestión del centro</p>
          <h1 className="text-2xl font-bold">Cursos</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          {showCreate ? "Ocultar formulario" : "+ Nuevo curso"}
        </button>
      </header>

      {showCreate ? (
        <CourseCreateForm
          onCreated={() => {
            setShowCreate(false);
            void courses.refetch();
          }}
        />
      ) : null}

      {courses.isPending ? <Spinner label="Cargando cursos" /> : null}
      {courses.isError ? (
        <ErrorState message="Error al cargar cursos" onRetry={() => void courses.refetch()} />
      ) : null}
      {courses.isSuccess && courses.data.length === 0 ? (
        <EmptyState title="Sin cursos">
          Crea el primero con “Nuevo curso” o clona una plantilla en Herramientas.
        </EmptyState>
      ) : null}

      {courses.isSuccess && courses.data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Curso</th>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Aula</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {courses.data.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-3 py-2">
                    {c.layout_rows}×{c.layout_cols}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        c.status === "active"
                          ? "bg-success/15 text-success"
                          : "bg-muted/20 text-muted"
                      }`}
                    >
                      {c.status === "active" ? "Activo" : "Archivado"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/admin/courses/${c.id}`}
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-bg"
                      >
                        Gestionar
                      </Link>
                      <Link
                        to={`/courses/${c.id}`}
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-bg"
                      >
                        Ver aula
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
