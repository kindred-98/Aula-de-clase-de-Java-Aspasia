import { useQuery } from "@tanstack/react-query";
import { apiGet, type CourseChatRoomSummary } from "../../../lib/api";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Spinner } from "../../../components/ui/Spinner";

type Props = {
  selectedId: number | null;
  onSelect: (courseId: number) => void;
};

export function CourseRoomList({ selectedId, onSelect }: Props) {
  const rooms = useQuery({
    queryKey: ["course-chats"],
    queryFn: ({ signal }) => apiGet<CourseChatRoomSummary[]>("/me/course-chats", signal),
    refetchInterval: 15000,
  });

  if (rooms.isPending) return <Spinner label="Cargando salas" />;

  if (rooms.data?.length === 0) {
    return (
      <EmptyState title="Sin salas de curso">
        Cuando te matriculen a un curso aparecerá aquí su chat global.
      </EmptyState>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {(rooms.data ?? []).map((room) => (
        <li key={room.course_id}>
          <button
            type="button"
            onClick={() => onSelect(room.course_id)}
            className={`w-full px-3 py-3 text-left transition hover:bg-bg ${
              selectedId === room.course_id ? "bg-primary/5" : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{room.course_name}</span>
              <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
                {room.course_code}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm text-muted">
                {room.last_message ?? "Sin mensajes aún"}
              </p>
              {room.unread > 0 ? (
                <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-white">
                  {room.unread}
                </span>
              ) : null}
            </div>
            {room.last_at ? (
              <p className="mt-0.5 text-xs text-muted/80">
                {room.last_sender_name ? `${room.last_sender_name} · ` : ""}
                {new Date(room.last_at).toLocaleString()}
              </p>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
