import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiSend, type CoursePublic } from "../../../lib/api";
import { showToast } from "../../../components/ui/Toast";
import { ErrorState } from "../../../components/ui/ErrorState";

type Props = {
  courseId?: number;
};

export function CloneCoursePanel({ courseId }: Props) {
  const [sourceId, setSourceId] = useState(courseId ? String(courseId) : "");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const clone = useMutation({
    mutationFn: () =>
      apiSend<CoursePublic>("POST", `/courses/${sourceId}/clone`, {
        name,
        code,
      }),
    onSuccess: (course) => {
      showToast(`Clon creado: ${course.name}`);
      setName("");
      setCode("");
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo clonar", "error");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    clone.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-semibold">Clonar curso</h2>
      <p className="text-xs text-muted">
        Copia nombre, aula y rúbricas de un curso plantilla. Útil para repetir la misma estructura
        cada trimestre.
      </p>
      <label className="block space-y-1 text-sm">
        <span className="text-muted">Curso origen (id)</span>
        <input
          type="number"
          required
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Nombre del clon</span>
          <input
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Código nuevo</span>
          <input
            required
            maxLength={16}
            pattern="[A-Za-z0-9_-]+"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </label>
      </div>
      {clone.isError ? (
        <ErrorState message={clone.error instanceof Error ? clone.error.message : "Error"} />
      ) : null}
      <button
        type="submit"
        disabled={clone.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        {clone.isPending ? "Clonando…" : "Clonar"}
      </button>
    </form>
  );
}
