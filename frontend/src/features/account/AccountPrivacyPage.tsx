import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  apiDownload,
  apiGet,
  apiSend,
  type CoursePublic,
  type RgpdExportResponse,
} from "../../lib/api";
import { ConfirmDialog, showToast } from "../../components/ui/Toast";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../auth/AuthContext";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

export function AccountPrivacyPage() {
  const { logout, user } = useAuth();
  const [confirmErase, setConfirmErase] = useState(false);
  const [cloneSource, setCloneSource] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [cloneCode, setCloneCode] = useState("");
  const isAdmin = user?.role === "admin";

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: ({ signal }) => apiGet<CoursePublic[]>("/courses", signal),
    enabled: isAdmin,
  });

  const clone = useMutation({
    mutationFn: () =>
      apiSend<CoursePublic>("POST", `/courses/${cloneSource}/clone`, {
        name: cloneName,
        code: cloneCode,
      }),
    onSuccess: (created) => {
      showToast(`Curso clonado: ${created.code}`);
      setCloneName("");
      setCloneCode("");
      setCloneSource("");
      void courses.refetch();
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo clonar", "error");
    },
  });

  const erase = useMutation({
    mutationFn: () => apiSend<void>("DELETE", "/me/data"),
    onSuccess: () => {
      showToast("Datos anonimizados");
      logout();
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo borrar", "error");
      setConfirmErase(false);
    },
  });

  function onExport() {
    apiGet<RgpdExportResponse>("/me/export")
      .then((data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `rgpd-export-${user?.id ?? "me"}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast("Exportación descargada");
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Error al exportar", "error");
      });
  }

  function onClone(event: FormEvent) {
    event.preventDefault();
    if (!cloneSource) return;
    clone.mutate();
  }

  function exportGrades(courseId: number, code: string) {
    void apiDownload(`/courses/${courseId}/export/grades.csv`, `grades_${code}.csv`)
      .then(() => showToast("CSV descargado"))
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Error al exportar", "error");
      });
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cuenta y privacidad</h1>
        <p className="mt-1 text-sm text-muted">
          Exporta o elimina tus datos personales (RGPD). Las acciones destructivas piden
          confirmación.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-semibold">Mis datos (RGPD)</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExport}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg"
          >
            Exportar mis datos (JSON)
          </button>
          <button
            type="button"
            onClick={() => setConfirmErase(true)}
            className="rounded-md border border-danger/50 px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
          >
            Borrar mis datos
          </button>
        </div>
        <p className="text-xs text-muted">
          Borrar datos anonimiza tu nombre/usuario, desactiva la cuenta y elimina enlaces y notas de
          tus entregas. No se puede deshacer.
        </p>
        {confirmErase ? (
          <ConfirmDialog
            title="¿Borrar tus datos?"
            body="Tu cuenta se anonimizará y desactivará. Se perderán enlaces y notas de entregas."
            confirmLabel="Sí, borrar"
            onConfirm={() => erase.mutate()}
            onCancel={() => setConfirmErase(false)}
          />
        ) : null}
      </div>

      {isAdmin ? (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-semibold">Exportar notas (CSV)</h2>
          <p className="text-sm text-muted">
            Descarga el CSV de notas de cualquier curso donde seas staff.
          </p>
          <ul className="flex flex-wrap gap-2">
            {(courses.data ?? []).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => exportGrades(c.id, c.code)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg"
                >
                  {c.name} ({c.code})
                </button>
              </li>
            ))}
          </ul>

          <h2 className="pt-2 font-semibold">Clonar curso</h2>
          <form onSubmit={onClone} className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1 text-sm sm:col-span-3">
              <span className="text-muted">Curso origen</span>
              <select
                className={inputClass}
                value={cloneSource}
                onChange={(e) => setCloneSource(e.target.value)}
                required
              >
                <option value="">Selecciona un curso</option>
                {(courses.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Nombre del clon</span>
              <input
                className={inputClass}
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Código</span>
              <input
                className={inputClass}
                value={cloneCode}
                onChange={(e) => setCloneCode(e.target.value)}
                required
                minLength={2}
                maxLength={16}
                pattern="[A-Za-z0-9_-]+"
                title="Solo letras, números, guion bajo o guion"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={clone.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {clone.isPending ? "Clonando…" : "Clonar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {user?.role === "student" ? null : (
        <p className="text-sm text-muted">
          Los estudiantes pueden gestionar sus datos desde esta misma página.
        </p>
      )}

      <p className="text-sm">
        <Link to="/" className="text-primary hover:underline">
          ← Volver al inicio
        </Link>
      </p>
      {courses.isError ? <ErrorState message="No se pudieron cargar los cursos" /> : null}
      {courses.isPending && isAdmin ? <Spinner label="Cargando cursos" /> : null}
    </section>
  );
}
