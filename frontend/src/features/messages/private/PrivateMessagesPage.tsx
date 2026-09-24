import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, type MessageDirectoryEntry } from "../../../lib/api";
import { showToast } from "../../../components/ui/Toast";
import { useAuth } from "../../auth/AuthContext";
import { ConversationList } from "./ConversationList";
import { DirectoryList } from "./DirectoryList";
import { PrivateThread } from "./PrivateThread";

export function PrivateMessagesPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const directory = useQuery({
    queryKey: ["message-directory"],
    queryFn: ({ signal }) => apiGet<MessageDirectoryEntry[]>("/messages/directory", signal),
    enabled: selectedId != null,
  });

  const otherName = directory.data?.find((e) => e.id === selectedId)?.name ?? "Conversación";
  const meId = user?.id ?? 0;

  const start = useMutation({
    mutationFn: (userId: number) =>
      apiSend("POST", "/messages", { recipient_id: userId, body: "Hola 👋" }),
    onSuccess: (_data, userId) => {
      setSelectedId(userId);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["unread-count"] });
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
    const match = (directory.data ?? []).find(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.username ?? "").toLowerCase().includes(q) ||
        (e.email ?? "").toLowerCase().includes(q),
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
        <p className="text-sm text-muted">Chat privado</p>
        <h1 className="text-2xl font-bold">Mensajes directos</h1>
        <p className="mt-1 text-sm text-muted">
          Solo puedes escribir a personas con las que compartes curso o a la administración.
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
          <DirectoryList selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <PrivateThread otherUserId={selectedId} otherName={otherName} meId={meId} />
      </div>
    </div>
  );
}
