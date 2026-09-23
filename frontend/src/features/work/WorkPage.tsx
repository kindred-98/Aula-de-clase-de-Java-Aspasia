import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  apiGet,
  apiSend,
  apiUpload,
  type AssignmentPublic,
  type SubmissionPublic,
} from "../../lib/api";
import { Markdown } from "../../components/content/Markdown";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

export function WorkPage() {
  const courseId = useParams().courseId ?? "";
  const queryClient = useQueryClient();
  const [now] = useState(() => Date.now());
  const [githubUrl, setGithubUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [activeAssignment, setActiveAssignment] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const assignments = useQuery({
    queryKey: ["assignments", courseId],
    queryFn: ({ signal }) => apiGet<AssignmentPublic[]>(`/courses/${courseId}/assignments`, signal),
    enabled: Boolean(courseId),
  });

  const submissions = useQuery({
    queryKey: ["submissions", courseId],
    queryFn: ({ signal }) => apiGet<SubmissionPublic[]>(`/courses/${courseId}/submissions`, signal),
    enabled: Boolean(courseId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      course_id: number;
      assignment_id: number | null;
      github_url: string | null;
      notes: string;
      submit: boolean;
    }) => apiSend<SubmissionPublic>("POST", "/submissions", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["submissions", courseId] });
      setGithubUrl("");
      setNotes("");
    },
  });

  async function onCreate(event: FormEvent, submit: boolean) {
    event.preventDefault();
    createMutation.mutate({
      course_id: Number(courseId),
      assignment_id: activeAssignment,
      github_url: githubUrl.trim() ? githubUrl.trim() : null,
      notes,
      submit,
    });
  }

  async function onUpload(submissionId: number, file: File | undefined) {
    if (!file) return;
    setFileError(null);
    try {
      await apiUpload(`/submissions/${submissionId}/files`, file);
      void queryClient.invalidateQueries({ queryKey: ["submissions", courseId] });
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "No se pudo subir el archivo");
    }
  }

  const inputClass =
    "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Entregas</h1>
        <p className="mt-1 text-sm text-muted">
          Crea o actualiza tu entrega con enlace de GitHub, notas y archivos.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link to={`/courses/${courseId}/content`} className="text-primary hover:underline">
            Contenido del curso
          </Link>
        </div>
      </div>

      <article className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-semibold">Tareas del curso</h2>
        {assignments.isPending ? <Spinner label="Cargando tareas" /> : null}
        {assignments.isError ? (
          <div className="mt-2">
            <ErrorState message="No se pudieron cargar las tareas" />
          </div>
        ) : null}
        {assignments.isSuccess && assignments.data.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No hay tareas todavía.</p>
        ) : null}
        {assignments.isSuccess && assignments.data.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {assignments.data.map((a) => {
              const overdue = a.due_at ? new Date(a.due_at).getTime() < now : false;
              return (
                <li key={a.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      to={`/courses/${courseId}/work/${a.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {a.title}
                    </Link>
                    <span className={`text-xs ${overdue ? "text-danger" : "text-muted"}`}>
                      {a.due_at
                        ? `${overdue ? "Atrasada · " : ""}${new Date(a.due_at).toLocaleString()}`
                        : "Sin fecha límite"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                    <span>visibilidad: {a.visibility}</span>
                    <span>máx. {a.max_score}</span>
                  </div>
                  {a.description_markdown ? (
                    <div className="mt-2 text-sm opacity-90">
                      <Markdown source={a.description_markdown.slice(0, 240)} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </article>

      <article className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-semibold">Nueva / actualizar entrega</h2>
        {assignments.isPending ? <Spinner label="Cargando tareas" /> : null}
        {assignments.isError ? (
          <div className="mt-2">
            <ErrorState message="No se pudieron cargar las tareas" />
          </div>
        ) : null}
        {assignments.isSuccess && assignments.data.length > 0 ? (
          <label className="mt-3 block space-y-1 text-sm">
            <span className="text-muted">Tarea (opcional)</span>
            <select
              className={inputClass}
              value={activeAssignment ?? ""}
              onChange={(e) => setActiveAssignment(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Sin tarea específica</option>
              {assignments.data.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <form className="mt-3 space-y-3" onSubmit={(e) => void onCreate(e, true)}>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">URL de GitHub (repositorio)</span>
            <input
              className={inputClass}
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/usuario/repo"
              pattern="https://github\.com/.+"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Notas</span>
            <textarea
              className={inputClass}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {createMutation.isError ? (
            <ErrorState
              message={
                createMutation.error instanceof Error
                  ? createMutation.error.message
                  : "Error al guardar"
              }
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Enviar entrega
            </button>
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={(e) => void onCreate(e as unknown as FormEvent, false)}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Guardar borrador
            </button>
          </div>
        </form>
      </article>

      <article className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-semibold">Mis entregas en este curso</h2>
        {submissions.isPending ? <Spinner label="Cargando entregas" /> : null}
        {submissions.isError ? (
          <div className="mt-2">
            <ErrorState message="No se pudieron cargar las entregas" />
          </div>
        ) : null}
        {submissions.isSuccess && submissions.data.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aún no hay entregas.</p>
        ) : null}
        {fileError ? (
          <div className="mt-2">
            <ErrorState message={fileError} />
          </div>
        ) : null}
        <ul className="mt-3 space-y-3">
          {(submissions.data ?? []).map((sub) => (
            <li key={sub.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase text-primary">{sub.status}</span>
                <span className="text-xs text-muted">
                  v{sub.version} · {new Date(sub.created_at).toLocaleString()}
                </span>
              </div>
              {sub.github_url ? (
                <a
                  href={sub.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all text-sm text-primary hover:underline"
                >
                  {sub.github_url}
                </a>
              ) : null}
              {sub.notes ? <p className="mt-1 text-sm text-muted">{sub.notes}</p> : null}
              {sub.latest_evaluation ? (
                <p className="mt-2 rounded bg-success/10 p-2 text-sm">
                  <strong>Evaluación:</strong> {sub.latest_evaluation.score ?? "—"} ·{" "}
                  {sub.latest_evaluation.comment_markdown || "sin comentario"}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {sub.files.map((f) => (
                  <span key={f.id} className="rounded bg-bg px-2 py-1">
                    {f.original_name}
                  </span>
                ))}
                <label className="cursor-pointer rounded border border-border px-2 py-1 hover:bg-bg">
                  Subir archivo
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => void onUpload(sub.id, e.target.files?.[0])}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
