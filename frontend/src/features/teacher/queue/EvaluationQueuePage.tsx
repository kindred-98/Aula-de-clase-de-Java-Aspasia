import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type CoursePublic, type TeacherQueuePage } from "../../../lib/api";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";
import { QueueFilters } from "./QueueFilters";
import { QueueTable } from "./QueueTable";

const PAGE_SIZE = 20;

export function EvaluationQueuePage() {
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const courses = useQuery({
    queryKey: ["me-courses"],
    queryFn: ({ signal }) => apiGet<CoursePublic[]>("/me/courses", signal),
  });

  const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
  if (courseId) params.set("course_id", courseId);
  if (status) params.set("status", status);

  const queue = useQuery({
    queryKey: ["teacher-queue", courseId, status, page],
    queryFn: ({ signal }) =>
      apiGet<TeacherQueuePage>(`/teacher/queue?${params.toString()}`, signal),
  });

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-muted">Profesorado</p>
        <h1 className="text-2xl font-bold">Cola de evaluación</h1>
        <p className="mt-1 text-sm text-muted">
          Entregas pendientes de todos tus cursos, ordenadas por fecha límite.
        </p>
      </header>

      <QueueFilters
        courses={courses.data ?? []}
        courseId={courseId}
        status={status}
        onCourseChange={(value) => {
          setCourseId(value);
          setPage(1);
        }}
        onStatusChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
      />

      {queue.isPending ? <Spinner label="Cargando cola…" /> : null}
      {queue.isError ? (
        <ErrorState message="No se pudo cargar la cola" onRetry={() => void queue.refetch()} />
      ) : null}
      {queue.isSuccess ? (
        <QueueTable
          items={queue.data.items}
          total={queue.data.total}
          page={queue.data.page}
          pageSize={queue.data.page_size}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
