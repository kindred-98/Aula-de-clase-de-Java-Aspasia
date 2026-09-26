import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet, apiSend, type CoursePublic, type RgpdExportResponse } from "../../lib/api";
import { ConfirmDialog, showToast } from "../../components/ui/Toast";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../auth/AuthContext";

export function AccountPrivacyPage() {
  const { logout, user } = useAuth();
  const [confirmErase, setConfirmErase] = useState(false);
  const isAdmin = user?.role === "org_admin";

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: ({ signal }) => apiGet<CoursePublic[]>("/courses", signal),
    enabled: isAdmin,
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

  function onConfirmErase() {
    erase.mutate();
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
            onConfirm={onConfirmErase}
            onCancel={() => setConfirmErase(false)}
          />
        ) : null}
      </div>

      {isAdmin ? (
        <p className="text-sm text-muted">
          Herramientas de centro (clonar, CSV, notas):{" "}
          <Link to="/admin/tools" className="text-primary hover:underline">
            Administración → Herramientas
          </Link>
        </p>
      ) : null}

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
