import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, type AdminUserPublic, type CoursePublic } from "../../../lib/api";
import { showToast } from "../../../components/ui/Toast";
import { Spinner } from "../../../components/ui/Spinner";

type Props = { courseId: number };

type TeacherRef = { id: number; name: string };

export function TeacherManager({ courseId }: Props) {
  const [selected, setSelected] = useState("");
  const queryClient = useQueryClient();
  const key = ["course", courseId];

  const course = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiGet<CoursePublic>(`/courses/${courseId}`, signal),
  });

  const teachers = useQuery({
    queryKey: ["admin-users", "teachers"],
    queryFn: ({ signal }) =>
      apiGet<AdminUserPublic[]>("/admin/users?role=teacher&limit=200", signal),
  });

  const classroom = useQuery({
    queryKey: ["classroom", courseId],
    queryFn: ({ signal }) =>
      apiGet<{ teachers: TeacherRef[] }>(`/courses/${courseId}/classroom`, signal),
  });

  const assign = useMutation({
    mutationFn: (teacherId: number) =>
      apiSend<void>("POST", `/courses/${courseId}/teachers/${teacherId}`),
    onSuccess: () => {
      showToast("Profesora asignada");
      setSelected("");
      void queryClient.invalidateQueries({ queryKey: ["classroom", courseId] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo asignar", "error");
    },
  });

  const unassign = useMutation({
    mutationFn: (teacherId: number) =>
      apiSend<void>("DELETE", `/courses/${courseId}/teachers/${teacherId}`),
    onSuccess: () => {
      showToast("Profesora quitada del curso");
      void queryClient.invalidateQueries({ queryKey: ["classroom", courseId] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo quitar", "error");
    },
  });

  const assigned = classroom.data?.teachers ?? [];

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-semibold">Profesorado</h2>
      {classroom.isPending ? <Spinner label="Cargando profesorado" /> : null}
      {assigned.length === 0 && classroom.isSuccess ? (
        <p className="text-sm text-muted">Nadie asignado a este curso.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {assigned.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm"
            >
              {t.name}
              <button
                type="button"
                onClick={() => unassign.mutate(t.id)}
                className="text-xs text-danger hover:underline"
                aria-label={`Quitar a ${t.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (selected) assign.mutate(Number(selected));
        }}
      >
        <select
          className="max-w-xs flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label="Profesora a asignar"
        >
          <option value="">Selecciona una profesora…</option>
          {(teachers.data ?? [])
            .filter((t) => !assigned.some((a) => a.id === t.id))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.email})
              </option>
            ))}
        </select>
        <button
          type="submit"
          disabled={!selected || assign.isPending}
          className="rounded-md bg-primary px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          Asignar
        </button>
      </form>
      {course.data ? (
        <p className="text-xs text-muted">
          Código <span className="font-mono">{course.data.code}</span>
        </p>
      ) : null}
    </div>
  );
}
