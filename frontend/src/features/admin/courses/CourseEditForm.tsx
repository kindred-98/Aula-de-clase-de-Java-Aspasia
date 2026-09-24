import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiSend, type CoursePublic } from "../../../lib/api";
import { showToast } from "../../../components/ui/Toast";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

type Props = {
  course: CoursePublic;
  onSaved?: () => void;
};

export function CourseEditForm({ course, onSaved }: Props) {
  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(course.description ?? "");
  const [status, setStatus] = useState(course.status);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () =>
      apiSend<CoursePublic>("PATCH", `/courses/${course.id}`, {
        name,
        description: description || null,
        status,
      }),
    onSuccess: () => {
      showToast("Curso actualizado");
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
      void queryClient.invalidateQueries({ queryKey: ["course", course.id] });
      onSaved?.();
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo guardar", "error");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-semibold">Editar curso</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="text-muted">Nombre</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="text-muted">Descripción</span>
          <textarea
            className={inputClass}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Estado</span>
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as CoursePublic["status"])}
          >
            <option value="active">Activo</option>
            <option value="archived">Archivado</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {save.isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted">
        Código <span className="font-mono">{course.code}</span> · aula {course.layout_rows}×
        {course.layout_cols} (no editable; clona para otra planta)
      </p>
    </form>
  );
}
