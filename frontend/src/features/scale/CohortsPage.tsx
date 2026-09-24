import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { apiGet, apiSend, type CohortDetail, type CohortPublic } from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

function CohortMembers({ cohortId }: { cohortId: number }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["cohort", cohortId],
    queryFn: ({ signal }) => apiGet<CohortDetail>(`/admin/cohorts/${cohortId}`, signal),
  });
  const [studentId, setStudentId] = useState("");

  const add = useMutation({
    mutationFn: () =>
      apiSend<unknown>("POST", `/admin/cohorts/${cohortId}/members`, {
        student_id: Number(studentId),
      }),
    onSuccess: () => {
      setStudentId("");
      void queryClient.invalidateQueries({ queryKey: ["cohort", cohortId] });
      void queryClient.invalidateQueries({ queryKey: ["cohorts"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiSend<void>("DELETE", `/admin/cohorts/${cohortId}/members/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cohort", cohortId] });
      void queryClient.invalidateQueries({ queryKey: ["cohorts"] });
    },
  });

  if (detail.isPending) return <Spinner label="Cargando miembros…" />;
  if (detail.isError)
    return (
      <ErrorState message="No se pudo cargar el cohort" onRetry={() => void detail.refetch()} />
    );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (Number.isFinite(Number(studentId))) add.mutate();
  };

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <h3 className="text-sm font-semibold">Miembros ({detail.data.member_count})</h3>
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} w-40`}
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="ID de alumno"
          inputMode="numeric"
          required
        />
        <button
          type="submit"
          disabled={add.isPending}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-60"
        >
          Añadir
        </button>
      </form>
      {detail.data.members.length === 0 ? (
        <p className="text-sm text-muted">Sin miembros todavía.</p>
      ) : (
        <ul className="space-y-1">
          {detail.data.members.map((member) => (
            <li key={member.student_id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {member.name}
                {member.username ? <span className="text-muted"> @{member.username}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => remove.mutate(member.student_id)}
                className="text-danger hover:underline"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CohortsPage() {
  const queryClient = useQueryClient();
  const cohorts = useQuery({
    queryKey: ["cohorts"],
    queryFn: ({ signal }) => apiGet<CohortPublic[]>("/admin/cohorts", signal),
  });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => apiSend<CohortPublic>("POST", "/admin/cohorts", { name, code }),
    onSuccess: () => {
      setName("");
      setCode("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["cohorts"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "No se pudo crear"),
  });

  if (cohorts.isPending) return <Spinner label="Cargando cohorts…" />;
  if (cohorts.isError)
    return (
      <ErrorState
        message="No se pudieron cargar los cohorts"
        onRetry={() => void cohorts.refetch()}
      />
    );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted">Escalabilidad</p>
        <h1 className="text-2xl font-bold">Cohorts</h1>
        <p className="mt-1 text-sm text-muted">
          Grupos de alumnos para autoenrolamiento masivo en cursos.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Nombre</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Código</span>
          <input
            className={inputClass}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            maxLength={16}
            placeholder="GA1"
          />
        </label>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {create.isPending ? "Creando…" : "Crear cohort"}
        </button>
        {error ? (
          <p role="alert" className="w-full text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>

      {cohorts.data.length === 0 ? (
        <EmptyState title="Sin cohorts">Crea el primer grupo con el formulario.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {cohorts.data.map((cohort) => (
            <li key={cohort.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{cohort.name}</p>
                  <p className="text-xs text-muted">
                    <span className="font-mono">{cohort.code}</span> · {cohort.member_count} miembro
                    {cohort.member_count === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(openId === cohort.id ? null : cohort.id)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg"
                >
                  {openId === cohort.id ? "Cerrar" : "Miembros"}
                </button>
              </div>
              {openId === cohort.id ? <CohortMembers cohortId={cohort.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
