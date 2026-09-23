import { useQuery } from "@tanstack/react-query";
import { apiGet, type GithubMetaResponse } from "../../lib/api";
import { Spinner } from "../../components/ui/Spinner";

export function GithubMetaPanel({ submissionId }: { submissionId: number }) {
  const meta = useQuery({
    queryKey: ["github-meta", submissionId],
    queryFn: ({ signal }) =>
      apiGet<GithubMetaResponse>(`/submissions/${submissionId}/github-meta`, signal),
    retry: false,
  });

  if (meta.isPending) return <Spinner label="Consultando GitHub…" />;
  if (meta.isError) {
    return (
      <p className="rounded border border-border bg-bg p-2 text-xs text-muted">
        No se pudieron cargar los metadatos de GitHub.
      </p>
    );
  }

  const data = meta.data;
  if (!data.ok) {
    return (
      <p className="rounded border border-warning/40 bg-warning/10 p-2 text-xs">
        GitHub no disponible ({data.error ?? "error"}). El enlace sigue siendo válido.
      </p>
    );
  }

  return (
    <div className="rounded border border-border bg-bg p-3 text-xs" aria-live="polite">
      <p className="font-medium">
        {data.full_name ?? data.url}
        {data.language ? <span className="ml-2 text-muted">{data.language}</span> : null}
        {data.stars != null ? <span className="ml-2 text-muted">★ {data.stars}</span> : null}
      </p>
      {data.description ? <p className="mt-1 text-muted">{data.description}</p> : null}
      <p className="mt-1 text-muted">
        {data.pushed_at
          ? `Último push: ${new Date(data.pushed_at).toLocaleString()}`
          : "Sin datos de actividad"}
      </p>
      {data.html_url ? (
        <a
          href={data.html_url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1 inline-block text-primary hover:underline"
        >
          Abrir repositorio
        </a>
      ) : null}
      {data.cached ? <span className="ml-2 text-muted">(caché)</span> : null}
    </div>
  );
}
