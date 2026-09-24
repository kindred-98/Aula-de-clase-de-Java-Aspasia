import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, type AdminUserPublic } from "../../../lib/api";
import { showToast } from "../../../components/ui/Toast";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

type Props = { courseId: number };

export function EnrollmentManager({ courseId }: Props) {
  const [username, setUsername] = useState("");
  const queryClient = useQueryClient();
  const key = ["course-enrollments", courseId];

  const enrollments = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      apiGet<
        {
          id: number;
          student_id: number;
          student_name: string | null;
          student_username: string | null;
          seat_row: number | null;
          seat_col: number | null;
          status: string;
        }[]
      >(`/courses/${courseId}/enrollments`, signal),
  });

  const students = useQuery({
    queryKey: ["admin-users", "students", "all"],
    queryFn: ({ signal }) =>
      apiGet<AdminUserPublic[]>("/admin/users?role=student&limit=500", signal),
  });

  const add = useMutation({
    mutationFn: (user: AdminUserPublic) =>
      apiSend("POST", `/courses/${courseId}/enrollments`, { student_id: user.id }),
    onSuccess: () => {
      showToast("Estudiante matriculado");
      setUsername("");
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo matricular", "error");
    },
  });

  const remove = useMutation({
    mutationFn: (enrollmentId: number) =>
      apiSend<void>("DELETE", `/courses/${courseId}/enrollments/${enrollmentId}`),
    onSuccess: () => {
      showToast("Matrícula eliminada");
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo quitar", "error");
    },
  });

  function onAdd(event: FormEvent) {
    event.preventDefault();
    const q = username.trim().toLowerCase();
    if (!q) return;
    const match = (students.data ?? []).find(
      (s) =>
        (s.username ?? "").toLowerCase() === q ||
        s.name.toLowerCase() === q ||
        (s.email ?? "").toLowerCase() === q,
    );
    if (!match) {
      showToast("No encontré ese estudiante (username o nombre exacto)", "error");
      return;
    }
    add.mutate(match);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-semibold">Matrículas</h2>
      <form onSubmit={onAdd} className="flex flex-wrap gap-2">
        <input
          className={`${inputClass} max-w-xs flex-1`}
          placeholder="username o nombre exacto"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-label="Estudiante a matricular"
        />
        <button
          type="submit"
          disabled={add.isPending}
          className="rounded-md bg-primary px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          Matricular
        </button>
      </form>

      {enrollments.isPending ? <Spinner label="Cargando matrículas" /> : null}
      {enrollments.isError ? <ErrorState message="Error al cargar matrículas" /> : null}
      {enrollments.isSuccess ? (
        enrollments.data.length === 0 ? (
          <p className="text-sm text-muted">Sin matrículas todavía.</p>
        ) : (
          <ul className="divide-y divide-border">
            {enrollments.data.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium">{e.student_name}</p>
                  <p className="text-xs text-muted">
                    {e.student_username}
                    {e.seat_row != null
                      ? ` · asiento ${e.seat_row},${e.seat_col}`
                      : " · sin asiento"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(e.id)}
                  disabled={remove.isPending}
                  className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
