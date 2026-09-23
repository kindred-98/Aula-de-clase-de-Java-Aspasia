import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  apiGet,
  apiSend,
  type AttendanceDayResponse,
  type AttendanceStatus,
  type AttendanceSummaryItem,
  type ClassroomPayload,
} from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { showToast } from "../../components/ui/Toast";

const STATUSES: AttendanceStatus[] = ["present", "late", "absent", "excused"];

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Presente",
  late: "Tardanza",
  absent: "Ausente",
  excused: "Justificada",
};

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AttendancePage() {
  const courseId = useParams().courseId ?? "";
  const queryClient = useQueryClient();
  const [day, setDay] = useState(todayIso);
  const [draft, setDraft] = useState<Record<number, AttendanceStatus>>({});
  const [showSummary, setShowSummary] = useState(false);

  const room = useQuery({
    queryKey: ["classroom", courseId],
    queryFn: ({ signal }) => apiGet<ClassroomPayload>(`/courses/${courseId}/classroom`, signal),
    enabled: Boolean(courseId),
  });

  const attendance = useQuery({
    queryKey: ["attendance", courseId, day],
    queryFn: ({ signal }) =>
      apiGet<AttendanceDayResponse>(
        `/courses/${courseId}/attendance?date=${encodeURIComponent(day)}`,
        signal,
      ),
    enabled: Boolean(courseId),
  });

  const serverByStudent = useMemo(() => {
    const map: Record<number, AttendanceStatus> = {};
    for (const r of attendance.data?.records ?? []) map[r.student_id] = r.status;
    return map;
  }, [attendance.data]);

  const summary = useQuery({
    queryKey: ["attendance-summary", courseId],
    queryFn: ({ signal }) =>
      apiGet<AttendanceSummaryItem[]>(`/courses/${courseId}/attendance/summary`, signal),
    enabled: Boolean(courseId) && showSummary,
  });

  const save = useMutation({
    mutationFn: (items: { student_id: number; status: AttendanceStatus }[]) =>
      apiSend<AttendanceDayResponse>("PUT", `/courses/${courseId}/attendance`, {
        date: day,
        items,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance", courseId] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-summary", courseId] });
      showToast("Asistencia guardada");
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo guardar", "error");
    },
  });

  const enrolled = useMemo(() => {
    if (!room.data) return [];
    return room.data.seats.filter((s) => s.enrollment_id != null && s.student_id != null);
  }, [room.data]);

  function statusFor(studentId: number): AttendanceStatus {
    return draft[studentId] ?? serverByStudent[studentId] ?? "present";
  }

  function setStatus(studentId: number, status: AttendanceStatus): void {
    setDraft((prev) => ({ ...prev, [studentId]: status }));
  }

  function markAll(status: AttendanceStatus): void {
    const next: Record<number, AttendanceStatus> = {};
    for (const s of enrolled) {
      if (s.student_id != null) next[s.student_id] = status;
    }
    setDraft(next);
  }

  function onSave(event: FormEvent) {
    event.preventDefault();
    const items = enrolled
      .filter((s) => s.student_id != null)
      .map((s) => ({
        student_id: s.student_id as number,
        status: statusFor(s.student_id as number),
      }));
    if (items.length === 0) {
      showToast("Marca al menos un estudiante", "error");
      return;
    }
    save.mutate(items);
  }

  if (room.isPending) return <Spinner label="Cargando aula" />;
  if (room.isError) {
    return (
      <ErrorState
        message={room.error instanceof Error ? room.error.message : "No se pudo cargar el aula"}
        onRetry={() => void room.refetch()}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Asistencia</h1>
        <p className="mt-1 text-sm text-muted">
          Pasa la lista tocando los asientos del curso {room.data.course.code}.
        </p>
      </div>

      <form onSubmit={onSave} className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Fecha</span>
            <input
              type="date"
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              required
            />
          </label>
          <button
            type="button"
            onClick={() => markAll("present")}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg"
          >
            Todos presentes
          </button>
          <button
            type="button"
            onClick={() => markAll("absent")}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg"
          >
            Todos ausentes
          </button>
          <button
            type="button"
            onClick={() => setShowSummary((v) => !v)}
            aria-pressed={showSummary}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg"
          >
            {showSummary ? "Ocultar resumen" : "Resumen por estudiante"}
          </button>
        </div>

        {attendance.isPending ? <Spinner label="Cargando asistencia" /> : null}
        {attendance.isError ? (
          <ErrorState
            message={attendance.error instanceof Error ? attendance.error.message : "Error"}
            onRetry={() => void attendance.refetch()}
          />
        ) : null}

        {enrolled.length === 0 ? (
          <EmptyState title="Sin matrículas">Asigna asientos en el aula primero.</EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enrolled.map((seat) => {
              const sid = seat.student_id as number;
              const currentStatus = statusFor(sid);
              return (
                <li
                  key={seat.seat_id}
                  className="rounded-md border border-border bg-bg p-3 text-sm"
                >
                  <div className="font-medium">
                    {seat.row},{seat.col} · {seat.student_name ?? "Sin nombre"}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted">
                    {seat.student_username ?? ""}
                  </div>
                  <div
                    className="mt-2 flex flex-wrap gap-1"
                    role="radiogroup"
                    aria-label={`Estado de ${seat.student_name ?? sid}`}
                  >
                    {STATUSES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        role="radio"
                        aria-checked={currentStatus === st}
                        onClick={() => setStatus(sid, st)}
                        className={`rounded border px-2 py-1 text-xs ${
                          currentStatus === st
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border hover:bg-surface"
                        }`}
                      >
                        {STATUS_LABEL[st]}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {save.isPending ? "Guardando…" : "Guardar asistencia"}
        </button>
      </form>

      {showSummary ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Resumen del curso</h2>
          {summary.isPending ? <Spinner label="Cargando resumen" /> : null}
          {summary.isError ? <ErrorState message="Error al cargar el resumen" /> : null}
          {summary.isSuccess && summary.data.length === 0 ? <EmptyState title="Sin datos" /> : null}
          {summary.isSuccess && summary.data.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Estudiante</th>
                    <th className="px-3 py-2">Presente</th>
                    <th className="px-3 py-2">Tarde</th>
                    <th className="px-3 py-2">Ausente</th>
                    <th className="px-3 py-2">Justificada</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.data.map((row) => (
                    <tr key={row.student_id} className="border-t border-border">
                      <td className="px-3 py-2">
                        {row.student_name ?? row.student_username ?? `#${row.student_id}`}
                      </td>
                      <td className="px-3 py-2">{row.present}</td>
                      <td className="px-3 py-2">{row.late}</td>
                      <td className="px-3 py-2">{row.absent}</td>
                      <td className="px-3 py-2">{row.excused}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
