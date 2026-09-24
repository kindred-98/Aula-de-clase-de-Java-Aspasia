import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, type AdminUserPublic } from "../../../lib/api";
import { showToast } from "../../../components/ui/Toast";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuth } from "../../auth/AuthContext";
import { ChatThread } from "./ChatThread";
import { ConversationList } from "./ConversationList";

type MessageDirectoryProps = {
  selectedId: number | null;
  onSelect: (userId: number) => void;
};

function MessageDirectory({ selectedId, onSelect }: MessageDirectoryProps) {
  const users = useQuery({
    queryKey: ["admin-users", "messageable"],
    queryFn: ({ signal }) => apiGet<AdminUserPublic[]>("/admin/users?limit=500", signal),
  });

  if (users.isPending) return <Spinner label="Cargando personas" />;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold text-muted">Todas las personas</h2>
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {(users.data ?? []).map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => onSelect(u.id)}
              className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-bg ${
                selectedId === u.id ? "bg-primary/10" : ""
              }`}
            >
              {u.name} <span className="text-xs text-muted">({u.role})</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminMessagesPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const users = useQuery({
    queryKey: ["admin-users", "messageable"],
    queryFn: ({ signal }) => apiGet<AdminUserPublic[]>("/admin/users?limit=500", signal),
    enabled: selectedId != null,
  });

  const otherName = users.data?.find((u) => u.id === selectedId)?.name ?? "Conversación";
  const meId = user?.id ?? 0;

  const start = useMutation({
    mutationFn: (userId: number) =>
      apiSend("POST", "/messages", { recipient_id: userId, body: "Hola 👋" }),
    onSuccess: (_data, userId) => {
      setSelectedId(userId);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setSearch("");
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo iniciar", "error");
    },
  });

  function onStart(event: FormEvent) {
    event.preventDefault();
    const q = search.trim().toLowerCase();
    if (!q) return;
    const match = (users.data ?? []).find(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.username ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q),
    );
    if (!match) {
      showToast("No encontré a esa persona", "error");
      return;
    }
    start.mutate(match.id);
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">Comunicación del centro</p>
        <h1 className="text-2xl font-bold">Mensajes</h1>
        <p className="mt-1 text-sm text-muted">
          Chat directo con estudiantes y profesorado (admin puede escribir a cualquiera).
        </p>
      </header>

      <form onSubmit={onStart} className="flex max-w-md gap-2">
        <input
          className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm"
          placeholder="Nombre o username para escribir…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar persona"
        />
        <button
          type="submit"
          disabled={start.isPending}
          className="rounded-md bg-primary px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          Escribir
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
          <MessageDirectory selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <ChatThread otherUserId={selectedId} otherName={otherName} meId={meId} />
      </div>
    </div>
  );
}
