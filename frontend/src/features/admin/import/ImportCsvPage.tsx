import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiGet, apiSend, type CoursePublic, type CsvImportResult } from "../../../lib/api";
import { showToast } from "../../../components/ui/Toast";
import { ErrorState } from "../../../components/ui/ErrorState";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

export function ImportCsvPage() {
  const [courseId, setCourseId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: ({ signal }) => apiGet<CoursePublic[]>("/courses", signal),
  });

  const importCsv = useMutation({
    mutationFn: () =>
      apiSend<CsvImportResult>("POST", `/admin/courses/${courseId}/import-students`, {
        csv_text: csvText,
      }),
    onSuccess: (data) => {
      setResult(data);
      setCsvText("");
      showToast(`Importados: ${data.created}`);
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo importar", "error");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!courseId) return;
    importCsv.mutate();
  }

  const pinEntries = result ? Object.entries(result.pins) : [];

  return (
    <div className="max-w-2xl space-y-5">
      <header>
        <p className="text-sm text-muted">Alta masiva</p>
        <h1 className="text-2xl font-bold">Importar CSV</h1>
        <p className="mt-1 text-sm text-muted">
          Una fila por estudiante: <code className="font-mono">name[,email][,username]</code>.
          Cabecera opcional <code className="font-mono">name,email,username</code>. Cada alta
          matricula al estudiante en el curso elegido y genera un PIN de 6 dígitos.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-lg border border-border bg-surface p-4"
      >
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Curso destino</span>
          <select
            className={inputClass}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
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
          <span className="text-muted">Contenido CSV</span>
          <textarea
            className={`${inputClass} h-48 font-mono`}
            placeholder={"name,email,username\nAna Pérez,ana@example.com,ana1\nLuis Gómez,,"}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            required
          />
        </label>
        {importCsv.isError ? (
          <ErrorState
            message={importCsv.error instanceof Error ? importCsv.error.message : "Error"}
          />
        ) : null}
        <button
          type="submit"
          disabled={importCsv.isPending || !courseId}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {importCsv.isPending ? "Importando…" : "Importar"}
        </button>
      </form>

      {result ? (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm">
          <p>
            <strong>{result.created}</strong> creados · <strong>{result.skipped}</strong> omitidos
          </p>
          {pinEntries.length > 0 ? (
            <div className="mt-3">
              <p className="font-medium">PINs (se muestran una sola vez):</p>
              <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto font-mono text-xs">
                {pinEntries.map(([username, pin]) => (
                  <li key={username}>
                    {username}: {pin}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
