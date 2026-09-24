import { useQuery } from "@tanstack/react-query";
import { apiGet, type MessageDirectoryEntry } from "../../../lib/api";
import { Spinner } from "../../../components/ui/Spinner";

type Props = {
  selectedId: number | null;
  onSelect: (userId: number) => void;
};

const roleLabel: Record<string, string> = {
  admin: "Admin",
  teacher: "Profe",
  student: "Alumno",
};

export function DirectoryList({ selectedId, onSelect }: Props) {
  const people = useQuery({
    queryKey: ["message-directory"],
    queryFn: ({ signal }) => apiGet<MessageDirectoryEntry[]>("/messages/directory", signal),
  });

  if (people.isPending) return <Spinner label="Cargando personas" />;

  if (people.data?.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-muted">
        No hay personas disponibles para escribir.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold text-muted">
        Personas con las que puedes escribir
      </h2>
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {(people.data ?? []).map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => onSelect(u.id)}
              className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-bg ${
                selectedId === u.id ? "bg-primary/10" : ""
              }`}
            >
              {u.name} <span className="text-xs text-muted">({roleLabel[u.role] ?? u.role})</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
