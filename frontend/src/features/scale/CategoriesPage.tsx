import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { apiGet, apiSend, type CategoryPublic } from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";

const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => apiGet<CategoryPublic[]>("/categories", signal),
  });
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      apiSend<CategoryPublic>("POST", "/admin/categories", { name, slug, description: null }),
    onSuccess: () => {
      setName("");
      setSlug("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "No se pudo crear"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiSend<void>("DELETE", `/admin/categories/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["categories"] }),
    onError: (err) => setError(err instanceof Error ? err.message : "No se pudo borrar"),
  });

  if (categories.isPending) return <Spinner label="Cargando categorías…" />;
  if (categories.isError)
    return (
      <ErrorState
        message="No se pudieron cargar las categorías"
        onRetry={() => void categories.refetch()}
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
        <h1 className="text-2xl font-bold">Categorías de cursos</h1>
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
          <span className="mb-1 block text-muted">Slug</span>
          <input
            className={inputClass}
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            required
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            placeholder="programacion"
          />
        </label>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {create.isPending ? "Creando…" : "Crear categoría"}
        </button>
        {error ? (
          <p role="alert" className="w-full text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>

      {categories.data.length === 0 ? (
        <EmptyState title="Sin categorías">Crea la primera categoría con el formulario.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {categories.data.map((category) => (
            <li
              key={category.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <div>
                <p className="font-medium">{category.name}</p>
                <p className="text-xs text-muted">
                  <span className="font-mono">{category.slug}</span> · {category.course_count} curso
                  {category.course_count === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(category.id)}
                disabled={remove.isPending}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-60"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
