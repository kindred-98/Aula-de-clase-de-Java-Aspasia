import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  apiGet,
  apiSend,
  type AutoEnrollResult,
  type CategoryPublic,
  type CohortPublic,
} from "../../lib/api";
import { showToast } from "../../components/ui/Toast";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

type Props = {
  courseId: number;
  categoryId: number | null;
  cohortId: number | null;
};

export function CourseTaxonomyPanel({ courseId, categoryId, cohortId }: Props) {
  const queryClient = useQueryClient();
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => apiGet<CategoryPublic[]>("/categories", signal),
  });
  const cohorts = useQuery({
    queryKey: ["cohorts"],
    queryFn: ({ signal }) => apiGet<CohortPublic[]>("/admin/cohorts", signal),
  });
  const [category, setCategory] = useState(String(categoryId ?? ""));
  const [cohort, setCohort] = useState(String(cohortId ?? ""));

  const save = useMutation({
    mutationFn: () =>
      apiSend<{ course_id: number }>("PATCH", `/admin/courses/${courseId}/taxonomy`, {
        category_id: category === "" ? null : Number(category),
        cohort_id: cohort === "" ? null : Number(cohort),
      }),
    onSuccess: () => {
      showToast("Taxonomía guardada");
      void queryClient.invalidateQueries({ queryKey: ["course", courseId] });
    },
    onError: () => showToast("No se pudo guardar la taxonomía", "error"),
  });

  const autoEnroll = useMutation({
    mutationFn: () => apiSend<AutoEnrollResult>("POST", `/courses/${courseId}/auto-enroll`),
    onSuccess: (result) => {
      const detail =
        result.reason === "no_cohort"
          ? "Este curso no tiene cohort asignado"
          : result.reason === "empty_cohort"
            ? "El cohort está vacío"
            : `Matriculados: ${result.enrolled} · omitidos: ${result.skipped}`;
      showToast(detail, result.enrolled > 0 ? "success" : "error");
      void queryClient.invalidateQueries({ queryKey: ["course", courseId] });
    },
    onError: () => showToast("No se pudo ejecutar el autoenrolamiento", "error"),
  });

  if (!categories.data || !cohorts.data) return null;

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-semibold">Categoría y cohort</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Categoría</span>
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">— Sin categoría —</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Cohort (autoenrolamiento)</span>
          <select className={inputClass} value={cohort} onChange={(e) => setCohort(e.target.value)}>
            <option value="">— Sin cohort —</option>
            {cohorts.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {save.isPending ? "Guardando…" : "Guardar taxonomía"}
        </button>
        <button
          type="button"
          onClick={() => autoEnroll.mutate()}
          disabled={autoEnroll.isPending}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-bg disabled:opacity-60"
        >
          {autoEnroll.isPending ? "Matriculando…" : "Autoenrolar cohort"}
        </button>
      </div>
    </section>
  );
}
