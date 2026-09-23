import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiSend, type AssignmentPublic } from "../../lib/api";
import { Markdown } from "../../components/content/Markdown";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../auth/AuthContext";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

function dueLabel(due: string | null): string {
  if (!due) return "Sin fecha límite";
  const d = new Date(due);
  const overdue = d.getTime() < Date.now();
  return `${overdue ? "Atrasada · " : ""}${d.toLocaleString()}`;
}

export function AssignmentDetailPage() {
  const { courseId, assignmentId } = useParams();
  const { user } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "teacher";
  const queryClient = useQueryClient();
  const [now] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [maxScore, setMaxScore] = useState("100.00");

  const assignment = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: ({ signal }) => apiGet<AssignmentPublic>(`/assignments/${assignmentId}`, signal),
    enabled: Boolean(assignmentId),
  });

  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiSend<AssignmentPublic>("PATCH", `/assignments/${assignmentId}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
      void queryClient.invalidateQueries({ queryKey: ["assignments", courseId] });
      setEditing(false);
    },
  });

  function startEdit(a: AssignmentPublic) {
    setTitle(a.title);
    setDescription(a.description_markdown);
    setDueAt(a.due_at ? a.due_at.slice(0, 16) : "");
    setVisibility(a.visibility);
    setMaxScore(a.max_score);
    setEditing(true);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    update.mutate({
      title,
      description_markdown: description,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      visibility,
      max_score: maxScore,
    });
  }

  if (assignment.isPending) return <Spinner label="Cargando tarea" />;
  if (assignment.isError) {
    return (
      <ErrorState
        message={assignment.error instanceof Error ? assignment.error.message : "No se pudo cargar"}
        onRetry={() => void assignment.refetch()}
      />
    );
  }

  const a = assignment.data;
  const overdue = a.due_at ? new Date(a.due_at).getTime() < now : false;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to={`/courses/${courseId}/work`} className="text-sm text-primary hover:underline">
            ← Volver a entregas
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{a.title}</h1>
        </div>
        {isStaff ? (
          <button
            type="button"
            onClick={() => (editing ? setEditing(false) : startEdit(a))}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
          >
            {editing ? "Cancelar" : "Editar"}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span
          className={`rounded-md border px-3 py-1 ${overdue ? "border-danger text-danger" : "border-border"}`}
        >
          {dueLabel(a.due_at)}
        </span>
        <span className="rounded-md border border-border px-3 py-1">
          Visibilidad: <strong>{a.visibility}</strong>
        </span>
        <span className="rounded-md border border-border px-3 py-1">Máx. {a.max_score}</span>
      </div>

      {editing ? (
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-lg border border-border bg-surface p-4"
        >
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Título</span>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Descripción (Markdown)</span>
            <textarea
              className={inputClass}
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Fecha límite</span>
              <input
                className={inputClass}
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Visibilidad</span>
              <select
                className={inputClass}
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="private">private</option>
                <option value="class">class</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Puntuación máxima</span>
              <input
                className={inputClass}
                type="number"
                min="0.01"
                step="0.01"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
              />
            </label>
          </div>
          {update.isError ? (
            <ErrorState message={update.error instanceof Error ? update.error.message : "Error"} />
          ) : null}
          <button
            type="submit"
            disabled={update.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Guardar cambios
          </button>
        </form>
      ) : (
        <article className="rounded-lg border border-border bg-surface p-4">
          <Markdown source={a.description_markdown || "_Sin descripción._"} />
        </article>
      )}

      <p className="text-xs text-muted">
        Las reentregas crean una nueva versión; el historial se conserva en la vista de evaluación.
      </p>
    </section>
  );
}
