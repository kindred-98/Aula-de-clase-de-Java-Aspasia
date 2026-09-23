import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { apiGet, apiSend, type RubricPublic, type SubmissionPublic } from "../../lib/api";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { showToast } from "../../components/ui/Toast";
import { GithubMetaPanel } from "./GithubMetaPanel";

export function EvaluatePage() {
  const courseId = useParams().courseId ?? "";
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");
  const [rubricScores, setRubricScores] = useState<Record<string, string>>({});
  const [rubricId, setRubricId] = useState("");

  const submissions = useQuery({
    queryKey: ["all-submissions", courseId],
    queryFn: ({ signal }) => apiGet<SubmissionPublic[]>(`/courses/${courseId}/submissions`, signal),
    enabled: Boolean(courseId),
  });

  const rubrics = useQuery({
    queryKey: ["rubrics", courseId],
    queryFn: ({ signal }) => apiGet<RubricPublic[]>(`/courses/${courseId}/rubrics`, signal),
    enabled: Boolean(courseId),
  });

  const evaluate = useMutation({
    mutationFn: (payload: {
      score: number | null;
      comment_markdown: string;
      rubric_scores?: Record<string, number>;
    }) => apiSend("POST", `/submissions/${selectedId}/evaluations`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["all-submissions", courseId] });
      setScore("");
      setComment("");
      setRubricScores({});
      showToast("Evaluación guardada");
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo evaluar", "error");
    },
  });

  const rows = submissions.data ?? [];
  const selected = rows.find((s) => s.id === selectedId) ?? null;
  const activeRubric =
    (rubrics.data ?? []).find((r) => String(r.id) === rubricId) ?? rubrics.data?.[0] ?? null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (selectedId == null) return;
    const mapped: Record<string, number> = {};
    if (activeRubric) {
      for (const c of activeRubric.criteria) {
        const raw = rubricScores[c.id];
        if (raw != null && raw !== "") mapped[c.id] = Number(raw);
      }
    }
    evaluate.mutate({
      score: score === "" ? null : Number(score),
      comment_markdown: comment,
      ...(activeRubric && Object.keys(mapped).length > 0 ? { rubric_scores: mapped } : {}),
    });
  }

  const inputClass =
    "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Evaluar entregas</h1>
        <p className="mt-1 text-sm text-muted">Curso #{courseId}: revisa y puntúa cada entrega.</p>
      </div>

      {submissions.isPending ? <Spinner label="Cargando entregas" /> : null}
      {submissions.isError ? (
        <ErrorState
          message={submissions.error instanceof Error ? submissions.error.message : "Error"}
          onRetry={() => void submissions.refetch()}
        />
      ) : null}
      {submissions.isSuccess && rows.length === 0 ? (
        <p className="text-sm text-muted">No hay entregas en este curso.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="space-y-2">
          {rows.map((sub) => (
            <li key={sub.id}>
              <button
                type="button"
                onClick={() => setSelectedId(sub.id)}
                className={`w-full rounded-md border p-3 text-left text-sm ${
                  selectedId === sub.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface hover:border-primary/50"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{sub.student_name ?? `#${sub.student_id}`}</span>
                  <span className="font-mono text-xs text-muted">{sub.status}</span>
                </div>
                {sub.github_url ? (
                  <span className="mt-1 block truncate text-xs text-primary">{sub.github_url}</span>
                ) : null}
                {sub.latest_evaluation ? (
                  <span className="mt-1 block text-xs text-success">
                    Ya evaluada: {sub.latest_evaluation.score ?? "—"}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>

        <article className="rounded-lg border border-border bg-surface p-4">
          {!selected ? (
            <p className="text-sm text-muted">Selecciona una entrega a la izquierda.</p>
          ) : (
            <>
              <h2 className="font-semibold">{selected.student_name ?? "Estudiante"}</h2>
              <p className="mt-1 text-sm text-muted">{selected.notes || "Sin notas"}</p>
              {selected.github_url ? (
                <div className="mt-2">
                  <a
                    href={selected.github_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm text-primary hover:underline"
                  >
                    {selected.github_url}
                  </a>
                  <div className="mt-2">
                    <GithubMetaPanel submissionId={selected.id} />
                  </div>
                </div>
              ) : null}
              {selected.files.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {selected.files.map((f) => (
                    <li key={f.id}>
                      {f.original_name} ({f.size_bytes} B)
                    </li>
                  ))}
                </ul>
              ) : null}
              {selected.latest_evaluation ? (
                <p className="mt-3 rounded bg-success/10 p-2 text-sm">
                  Actual: {selected.latest_evaluation.score ?? "—"} ·{" "}
                  {selected.latest_evaluation.comment_markdown}
                </p>
              ) : null}
              <form onSubmit={onSubmit} className="mt-4 space-y-3">
                {(rubrics.data ?? []).length > 0 ? (
                  <label className="block space-y-1 text-sm">
                    <span className="text-muted">Rúbrica</span>
                    <select
                      className={inputClass}
                      value={rubricId || String(rubrics.data?.[0]?.id ?? "")}
                      onChange={(e) => setRubricId(e.target.value)}
                    >
                      {(rubrics.data ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {activeRubric ? (
                  <fieldset className="space-y-2 rounded border border-border p-2">
                    <legend className="px-1 text-xs text-muted">Criterios</legend>
                    {activeRubric.criteria.map((c) => (
                      <label key={c.id} className="block space-y-1 text-sm">
                        <span className="text-muted">
                          {c.label} (0–{c.max})
                        </span>
                        <input
                          className={inputClass}
                          type="number"
                          min={0}
                          max={c.max}
                          step="0.01"
                          value={rubricScores[c.id] ?? ""}
                          onChange={(e) =>
                            setRubricScores((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                        />
                      </label>
                    ))}
                  </fieldset>
                ) : null}

                <label className="block space-y-1 text-sm">
                  <span className="text-muted">Puntuación (0–100)</span>
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-muted">Comentario (Markdown)</span>
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </label>
                {evaluate.isError ? (
                  <ErrorState
                    message={
                      evaluate.error instanceof Error ? evaluate.error.message : "Error al evaluar"
                    }
                  />
                ) : null}
                <button
                  type="submit"
                  disabled={evaluate.isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {evaluate.isPending ? "Guardando…" : "Guardar evaluación"}
                </button>
              </form>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
