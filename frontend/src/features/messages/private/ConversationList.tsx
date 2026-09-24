import { useQuery } from "@tanstack/react-query";
import { apiGet, type ConversationSummary } from "../../../lib/api";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Spinner } from "../../../components/ui/Spinner";

type Props = {
  selectedId: number | null;
  onSelect: (userId: number) => void;
};

export function ConversationList({ selectedId, onSelect }: Props) {
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: ({ signal }) => apiGet<ConversationSummary[]>("/messages/conversations", signal),
    refetchInterval: 15000,
  });

  if (conversations.isPending) return <Spinner label="Cargando chats" />;

  if (conversations.data?.length === 0) {
    return (
      <EmptyState title="Sin conversaciones">
        Escribe el primer mensaje a un compañero, profesor o administración.
      </EmptyState>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {(conversations.data ?? []).map((c) => (
        <li key={c.user_id}>
          <button
            type="button"
            onClick={() => onSelect(c.user_id)}
            className={`w-full px-3 py-3 text-left transition hover:bg-bg ${
              selectedId === c.user_id ? "bg-primary/5" : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{c.name}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">
                {new Date(c.last_at).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm text-muted">{c.last_message}</p>
              {c.unread_count > 0 ? (
                <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-white">
                  {c.unread_count}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-muted/80">
              {c.role}
              {c.username ? ` · ${c.username}` : c.email ? ` · ${c.email}` : ""}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
