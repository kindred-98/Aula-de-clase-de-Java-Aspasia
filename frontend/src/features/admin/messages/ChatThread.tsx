import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, type MessagePublic } from "../../../lib/api";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";
import { MessageComposer } from "./MessageComposer";

type Props = {
  otherUserId: number | null;
  otherName: string;
  meId: number;
};

export function ChatThread({ otherUserId, otherName, meId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const messages = useQuery({
    queryKey: ["messages", otherUserId],
    queryFn: ({ signal }) => apiGet<MessagePublic[]>(`/messages/${otherUserId}`, signal),
    enabled: otherUserId != null,
    refetchInterval: 8000,
  });

  const markRead = useMutation({
    mutationFn: () => apiSend<void>("POST", `/messages/${otherUserId}/read`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  useEffect(() => {
    if (otherUserId != null && messages.isSuccess) {
      const hasUnread = messages.data.some((m) => m.sender_id === otherUserId && !m.read_at);
      if (hasUnread) markRead.mutate();
    }
  }, [otherUserId, messages.isSuccess, messages.data, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  if (otherUserId == null) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-surface">
        <p className="text-sm text-muted">Selecciona una conversación</p>
      </div>
    );
  }

  if (messages.isPending) return <Spinner label="Cargando mensajes" />;
  if (messages.isError)
    return (
      <ErrorState
        message="No se pudieron cargar los mensajes"
        onRetry={() => void messages.refetch()}
      />
    );

  return (
    <div className="flex h-[28rem] flex-col rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <p className="font-semibold">{otherName}</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.data.length === 0 ? (
          <EmptyState title="Sin mensajes">Escribe abajo para empezar</EmptyState>
        ) : (
          messages.data.map((m) => {
            const mine = m.sender_id === meId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-primary text-white" : "border border-border bg-bg"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>
                    {new Date(m.created_at).toLocaleString()}
                    {mine && m.read_at ? " · ✓✓" : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <MessageComposer
        recipientId={otherUserId}
        onSent={() => {
          void queryClient.invalidateQueries({ queryKey: ["messages", otherUserId] });
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }}
      />
    </div>
  );
}
