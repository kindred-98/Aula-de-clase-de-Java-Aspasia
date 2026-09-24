import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiDownload, apiGet, type CoursePublic } from "../../../lib/api";
import { showToast } from "../../../components/ui/Toast";
import { Spinner } from "../../../components/ui/Spinner";
import { EmptyState } from "../../../components/ui/EmptyState";
import { CloneCoursePanel } from "./CloneCoursePanel";

export function AdminToolsPage() {
  const [params] = useSearchParams();
  const presetCourse = params.get("course_id") ?? "";
  const [courseId, setCourseId] = useState(presetCourse);
  const [downloading, setDownloading] = useState(false);

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: ({ signal }) => apiGet<CoursePublic[]>("/courses", signal),
  });

  const metrics = useQuery({
    queryKey: ["admin-metrics", courseId],
    queryFn: ({ signal }) =>
      apiGet<Record<string, number>>(`/admin/metrics/course/${courseId}`, signal),
    enabled: Boolean(courseId),
  });

  async function onExport(path: string, filename: string) {
    setDownloading(true);
    try {
      await apiDownload(path, filename);
      showToast("CSV descargado");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo exportar", "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">Operativa del centro</p>
        <h1 className="text-2xl font-bold">Herramientas</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <CloneCoursePanel courseId={presetCourse ? Number(presetCourse) : undefined} />

        <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-semibold">Exportar CSV y métricas</h2>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Curso</span>
            <select
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {(courses.data ?? []).map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={downloading || !courseId}
              onClick={() =>
                void onExport(
                  `/courses/${courseId}/export/grades.csv`,
                  `notas-curso-${courseId}.csv`,
                )
              }
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg disabled:opacity-50"
            >
              {downloading ? "Descargando…" : "Notas del curso"}
            </button>
          </div>

          {courseId ? (
            metrics.isPending ? (
              <Spinner label="Cargando métricas" />
            ) : metrics.isSuccess ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                {Object.entries(metrics.data).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-border bg-bg p-3">
                    <dt className="text-xs uppercase text-muted">{key}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyState title="Sin métricas" />
            )
          ) : (
            <p className="text-sm text-muted">Elige un curso para ver métricas y exportar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
