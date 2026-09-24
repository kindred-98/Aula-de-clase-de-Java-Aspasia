import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiSend, type CoursePublic } from "../../../lib/api";
import { showToast } from "../../../components/ui/Toast";
import { ErrorState } from "../../../components/ui/ErrorState";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

type Props = {
  onCreated?: (course: CoursePublic) => void;
};

export function CourseCreateForm({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(5);
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      apiSend<CoursePublic>("POST", "/courses", {
        name,
        code,
        description: description || null,
        layout_rows: rows,
        layout_cols: cols,
      }),
    onSuccess: (course) => {
      showToast(`Curso ${course.code} creado`);
      setName("");
      setCode("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
      onCreated?.(course);
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo crear", "error");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-semibold">Crear curso</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="text-muted">Nombre</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            placeholder="Java primero"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Código (único)</span>
          <input
            className={inputClass}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            minLength={2}
            maxLength={16}
            pattern="[A-Za-z0-9_-]+"
            title="Solo letras, números, guion o guion bajo"
            placeholder="JAVA"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Descripción</span>
          <input
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Filas</span>
          <input
            type="number"
            min={1}
            max={20}
            className={inputClass}
            value={rows}
            onChange={(e) => setRows(Number(e.target.value))}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Columnas</span>
          <input
            type="number"
            min={1}
            max={20}
            className={inputClass}
            value={cols}
            onChange={(e) => setCols(Number(e.target.value))}
          />
        </label>
      </div>
      {create.isError ? (
        <ErrorState
          message={create.error instanceof Error ? create.error.message : "Error al crear"}
        />
      ) : null}
      <button
        type="submit"
        disabled={create.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {create.isPending ? "Creando…" : "Crear curso"}
      </button>
    </form>
  );
}
