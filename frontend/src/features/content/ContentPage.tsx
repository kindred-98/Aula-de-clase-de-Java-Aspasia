import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { apiGet, apiSend, type AnnouncementPublic, type SectionPublic } from "../../lib/api";
import { Markdown } from "../../components/content/Markdown";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../auth/AuthContext";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

export function ContentPage() {
  const courseId = useParams().courseId ?? "";
  const { user } = useAuth();
  const isStaff = user?.role === "org_admin" || user?.role === "teacher";
  const queryClient = useQueryClient();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [secTitle, setSecTitle] = useState("");
  const [secSlug, setSecSlug] = useState("");
  const [secBody, setSecBody] = useState("");
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");

  const sections = useQuery({
    queryKey: ["sections", courseId],
    queryFn: ({ signal }) => apiGet<SectionPublic[]>(`/courses/${courseId}/sections`, signal),
    enabled: Boolean(courseId),
  });

  const announcements = useQuery({
    queryKey: ["announcements", courseId],
    queryFn: ({ signal }) =>
      apiGet<AnnouncementPublic[]>(`/courses/${courseId}/announcements`, signal),
    enabled: Boolean(courseId),
  });

  const createSection = useMutation({
    mutationFn: (payload: { title: string; slug: string; body_markdown: string }) =>
      apiSend<SectionPublic>("POST", `/courses/${courseId}/sections`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sections", courseId] });
      setShowSectionForm(false);
      setSecTitle("");
      setSecSlug("");
      setSecBody("");
    },
  });

  const createAnnouncement = useMutation({
    mutationFn: (payload: { title: string; body_markdown: string }) =>
      apiSend<AnnouncementPublic>("POST", `/courses/${courseId}/announcements`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["announcements", courseId] });
      setShowAnnForm(false);
      setAnnTitle("");
      setAnnBody("");
    },
  });

  function onCreateSection(event: FormEvent) {
    event.preventDefault();
    createSection.mutate({ title: secTitle, slug: secSlug, body_markdown: secBody });
  }

  function onCreateAnn(event: FormEvent) {
    event.preventDefault();
    createAnnouncement.mutate({ title: annTitle, body_markdown: annBody });
  }

  const list = sections.data ?? [];
  const active = list.find((s) => s.slug === activeSlug) ?? list[0] ?? null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Contenido del curso</h1>
          <p className="mt-1 text-sm text-muted">
            Secciones dinámicas y anuncios. El contenido se muestra en Markdown.
          </p>
        </div>
        {isStaff ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowSectionForm((v) => !v)}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
            >
              {showSectionForm ? "Cancelar sección" : "Nueva sección"}
            </button>
            <button
              type="button"
              onClick={() => setShowAnnForm((v) => !v)}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
            >
              {showAnnForm ? "Cancelar anuncio" : "Nuevo anuncio"}
            </button>
          </div>
        ) : null}
      </div>

      {showSectionForm ? (
        <form
          onSubmit={onCreateSection}
          className="space-y-2 rounded-lg border border-border bg-surface p-4"
        >
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Título</span>
            <input
              className={inputClass}
              value={secTitle}
              onChange={(e) => setSecTitle(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Slug (a-z, 0-9, guiones)</span>
            <input
              className={inputClass}
              value={secSlug}
              onChange={(e) => setSecSlug(e.target.value)}
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Contenido Markdown</span>
            <textarea
              className={inputClass}
              rows={5}
              value={secBody}
              onChange={(e) => setSecBody(e.target.value)}
            />
          </label>
          {createSection.isError ? (
            <ErrorState
              message={createSection.error instanceof Error ? createSection.error.message : "Error"}
            />
          ) : null}
          <button
            type="submit"
            disabled={createSection.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Crear sección
          </button>
        </form>
      ) : null}

      {showAnnForm ? (
        <form
          onSubmit={onCreateAnn}
          className="space-y-2 rounded-lg border border-border bg-surface p-4"
        >
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Título del anuncio</span>
            <input
              className={inputClass}
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Cuerpo Markdown</span>
            <textarea
              className={inputClass}
              rows={4}
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
            />
          </label>
          {createAnnouncement.isError ? (
            <ErrorState
              message={
                createAnnouncement.error instanceof Error
                  ? createAnnouncement.error.message
                  : "Error"
              }
            />
          ) : null}
          <button
            type="submit"
            disabled={createAnnouncement.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Publicar anuncio
          </button>
        </form>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Secciones del curso" className="space-y-1">
          <h2 className="text-sm font-semibold text-muted">Secciones</h2>
          {sections.isPending ? <Spinner label="Cargando secciones" /> : null}
          {sections.isError ? <ErrorState message="No se pudieron cargar las secciones" /> : null}
          {sections.isSuccess && list.length === 0 ? (
            <EmptyState title="Sin secciones">
              El profesorado aún no ha creado contenido.
            </EmptyState>
          ) : null}
          <ul className="space-y-1">
            {list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActiveSlug(s.slug)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                    active?.id === s.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface hover:border-primary/50"
                  }`}
                >
                  {s.title}
                  {s.kind === "external" ? (
                    <span className="ml-1 text-xs text-primary">↗</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <article className="rounded-lg border border-border bg-surface p-4">
          {!active ? (
            <p className="text-sm text-muted">Selecciona una sección.</p>
          ) : active.kind === "external" && active.external_url ? (
            <div>
              <h2 className="text-xl font-semibold">{active.title}</h2>
              <p className="mt-2 text-sm text-muted">Recurso externo:</p>
              <a
                href={active.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-primary underline"
              >
                {active.external_url}
              </a>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold">{active.title}</h2>
              <div className="mt-3">
                <Markdown source={active.body_markdown} />
              </div>
            </div>
          )}
        </article>
      </div>

      <article className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-semibold">Anuncios</h2>
        {announcements.isPending ? <Spinner label="Cargando anuncios" /> : null}
        {announcements.isError ? <ErrorState message="No se pudieron cargar los anuncios" /> : null}
        {announcements.isSuccess && announcements.data.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No hay anuncios.</p>
        ) : null}
        <ul className="mt-3 space-y-3">
          {(announcements.data ?? []).map((a) => (
            <li key={a.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">{a.title}</h3>
                <span className="text-xs text-muted">
                  {a.author_name ?? "—"} · {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
              <div className="mt-2">
                <Markdown source={a.body_markdown} />
              </div>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
