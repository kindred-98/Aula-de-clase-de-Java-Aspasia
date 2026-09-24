import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, apiSend, type CenterSettings } from "../../lib/api";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

type FormState = Omit<CenterSettings, "support_email" | "terms_markdown"> & {
  support_email: string;
  terms_markdown: string;
};

function toForm(s: CenterSettings): FormState {
  return {
    center_name: s.center_name,
    support_email: s.support_email ?? "",
    default_visibility: s.default_visibility,
    allow_peer_submissions: s.allow_peer_submissions,
    pin_length: s.pin_length,
    max_upload_mb: s.max_upload_mb,
    terms_markdown: s.terms_markdown,
  };
}

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-primary focus:outline-none";

export function CenterSettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["center-settings"],
    queryFn: ({ signal }) => apiGet<CenterSettings>("/admin/settings", signal),
  });
  const [draft, setDraft] = useState<FormState | null>(null);
  const [saved, setSaved] = useState(false);
  const form = draft ?? (settings.data ? toForm(settings.data) : null);

  const save = useMutation({
    mutationFn: (body: CenterSettings) => apiSend<CenterSettings>("PUT", "/admin/settings", body),
    onSuccess: (data) => {
      setDraft(toForm(data));
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ["center-settings"] });
    },
  });

  if (settings.isPending) return <Spinner label="Cargando ajustes…" />;
  if (settings.isError)
    return (
      <ErrorState
        message="No se pudieron cargar los ajustes del centro"
        onRetry={() => void settings.refetch()}
      />
    );

  if (!form) return <Spinner label="Preparando formulario…" />;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setSaved(false);
    setDraft({ ...form, [key]: value });
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSaved(false);
    save.mutate({
      center_name: form.center_name,
      support_email: form.support_email.trim() === "" ? null : form.support_email.trim(),
      default_visibility: form.default_visibility,
      allow_peer_submissions: form.allow_peer_submissions,
      pin_length: form.pin_length,
      max_upload_mb: form.max_upload_mb,
      terms_markdown: form.terms_markdown,
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <p className="text-sm text-muted">Configuración institucional</p>
        <h1 className="text-2xl font-bold">Ajustes del centro</h1>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-border bg-surface p-5"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nombre del centro</span>
          <input
            className={inputClass}
            value={form.center_name}
            onChange={(e) => update("center_name", e.target.value)}
            required
            minLength={1}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Email de soporte</span>
          <input
            className={inputClass}
            type="email"
            value={form.support_email}
            onChange={(e) => update("support_email", e.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Visibilidad por defecto</span>
            <select
              className={inputClass}
              value={form.default_visibility}
              onChange={(e) => update("default_visibility", e.target.value)}
            >
              <option value="private">Privada</option>
              <option value="class">Visible en clase</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Largo del PIN</span>
            <input
              className={inputClass}
              type="number"
              min={4}
              max={12}
              value={form.pin_length}
              onChange={(e) => update("pin_length", Number(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tamaño máx. de archivo (MB)</span>
            <input
              className={inputClass}
              type="number"
              min={1}
              max={100}
              value={form.max_upload_mb}
              onChange={(e) => update("max_upload_mb", Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allow_peer_submissions}
              onChange={(e) => update("allow_peer_submissions", e.target.checked)}
            />
            Permitir entregas entre compañeros
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Términos (Markdown)</span>
          <textarea
            className={`${inputClass} min-h-32`}
            value={form.terms_markdown}
            onChange={(e) => update("terms_markdown", e.target.value)}
          />
        </label>

        {save.isError ? (
          <p className="text-sm text-danger" role="alert">
            No se pudieron guardar los ajustes
          </p>
        ) : null}
        {saved && !save.isError ? (
          <p className="text-sm text-success" role="status">
            Ajustes guardados
          </p>
        ) : null}

        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {save.isPending ? "Guardando…" : "Guardar ajustes"}
        </button>
      </form>
    </div>
  );
}
