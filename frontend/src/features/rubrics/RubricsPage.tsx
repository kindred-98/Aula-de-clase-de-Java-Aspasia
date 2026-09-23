import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { apiGet, apiSend, type RubricPublic } from "../../lib/api";
import { ConfirmDialog, showToast } from "../../components/ui/Toast";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

type CriterionDraft = { id: string; label: string; max: string };

function emptyCriterion(index: number): CriterionDraft {
  return { id: `c${index + 1}`, label: "", max: "10" };
}

export function RubricsPage() {
  const courseId = useParams().courseId ?? "";
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState<CriterionDraft[]>([emptyCriterion(0)]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const rubrics = useQuery({
    queryKey: ["rubrics", courseId],
    queryFn: ({ signal }) => apiGet<RubricPublic[]>(`/courses/${courseId}/rubrics`, signal),
    enabled: Boolean(courseId),
  });

  const create = useMutation({
    mutationFn: () =>
      apiSend<RubricPublic>("POST", `/courses/${courseId}/rubrics`, {
        title,
        criteria: criteria
          .filter((c) => c.label.trim())
          .map((c) => ({ id: c.id, label: c.label.trim(), max: Number(c.max) || 10 })),
      }),
    onSuccess: () => {
      setTitle("");
      setCriteria([emptyCriterion(0)]);
      void queryClient.invalidateQueries({ queryKey: ["rubrics", courseId] });
      showToast("Rúbrica creada");
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo crear", "error");
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiSend<void>("DELETE", `/courses/${courseId}/rubrics/${id}`),
    onSuccess: () => {
      setDeleteId(null);
      void queryClient.invalidateQueries({ queryKey: ["rubrics", courseId] });
      showToast("Rúbrica eliminada");
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo eliminar", "error");
    },
  });

  function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    create.mutate();
  }

  function startEdit(r: RubricPublic) {
    setEditingId(r.id);
    setTitle(r.title);
    setCriteria(r.criteria.map((c) => ({ id: c.id, label: c.label, max: String(c.max) })));
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setCriteria([emptyCriterion(0)]);
  }

  function updateCriterion(index: number, patch: Partial<CriterionDraft>) {
    setCriteria((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (editingId == null) return;
    apiSend<RubricPublic>("PATCH", `/courses/${courseId}/rubrics/${editingId}`, {
      title,
      criteria: criteria
        .filter((c) => c.label.trim())
        .map((c) => ({ id: c.id, label: c.label.trim(), max: Number(c.max) || 10 })),
    })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["rubrics", courseId] });
        showToast("Rúbrica actualizada");
        cancelEdit();
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Error al guardar", "error");
      });
  }

  if (rubrics.isPending) return <Spinner label="Cargando rúbricas" />;
  if (rubrics.isError) {
    return (
      <ErrorState
        message={rubrics.error instanceof Error ? rubrics.error.message : "Error"}
        onRetry={() => void rubrics.refetch()}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Rúbricas</h1>
        <p className="mt-1 text-sm text-muted">
          Criterios reutilizables para evaluar tareas de este curso.
        </p>
      </div>

      <form
        onSubmit={editingId != null ? saveEdit : onCreate}
        className="space-y-3 rounded-lg border border-border bg-surface p-4"
      >
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Título</span>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm text-muted">Criterios</legend>
          {criteria.map((c, index) => (
            <div key={c.id} className="flex flex-wrap gap-2">
              <input
                className={`${inputClass} min-w-24 max-w-28`}
                value={c.id}
                onChange={(e) => updateCriterion(index, { id: e.target.value })}
                aria-label={`Id criterio ${index + 1}`}
                required
              />
              <input
                className={`${inputClass} min-w-40 flex-1`}
                value={c.label}
                onChange={(e) => updateCriterion(index, { label: e.target.value })}
                placeholder="Etiqueta del criterio"
                aria-label={`Label criterio ${index + 1}`}
                required
              />
              <input
                className={`${inputClass} max-w-24`}
                type="number"
                min="0.01"
                step="0.01"
                value={c.max}
                onChange={(e) => updateCriterion(index, { max: e.target.value })}
                aria-label={`Máximo criterio ${index + 1}`}
                required
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setCriteria((prev) => [...prev, emptyCriterion(prev.length)])}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg"
          >
            Añadir criterio
          </button>
        </fieldset>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {editingId != null ? "Guardar cambios" : "Crear rúbrica"}
          </button>
          {editingId != null ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      {rubrics.data.length === 0 ? (
        <EmptyState title="Sin rúbricas">Crea la primera arriba.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rubrics.data.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{r.title}</h2>
                  <ul className="mt-2 space-y-1 text-xs text-muted">
                    {r.criteria.map((c) => (
                      <li key={c.id}>
                        <span className="font-mono">{c.id}</span> · {c.label} · máx {c.max}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-bg"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(r.id)}
                    className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleteId != null ? (
        <ConfirmDialog
          title="Eliminar rúbrica"
          body="Se borrará la rúbrica del curso. Las tareas que la usen dejarán de mostrar criterios."
          confirmLabel="Eliminar"
          onConfirm={() => remove.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      ) : null}
    </section>
  );
}
