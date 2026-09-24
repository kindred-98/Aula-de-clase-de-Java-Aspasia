import { useState } from "react";
import { apiDownload } from "../../lib/api";

export function CourseBackupButton({ courseId }: { courseId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiDownload(`/courses/${courseId}/backup`, `curso-${courseId}-backup.json`);
    } catch {
      setError("No se pudo exportar el curso");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-60"
      >
        {busy ? "Exportando…" : "Exportar backup (JSON)"}
      </button>
      {error ? (
        <span role="alert" className="ml-2 text-sm text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
