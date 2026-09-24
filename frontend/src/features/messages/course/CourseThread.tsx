import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, type CourseChatPage } from "../../../lib/api";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Spinner } from "../../../components/ui/Spinner";
import { CourseComposer } from "./CourseComposer";

type Props = {
  courseId: number | null;
  courseName: string;
  meId: number;
};

export function CourseThread({ courseId, courseName, meId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const messages = useQuery({
    queryKey: ["course-chat", courseId],
    queryFn: ({ signal }) => apiGet<CourseChatPage>(`/courses/${courseId}/chat`, signal),
    enabled: courseId != null,
    refetchInterval: 8000,
  });

  const markRead = useMutation({
    mutationFn: () => apiSend<void>("POST", `/courses/${courseId}/chat/read`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["course-chats"] });
      void queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      void queryClient.invalidateQueries({ queryKey: ["course-chat", courseId] });
    },
  });

  useEffect(() => {
    if (courseId != null && messages.isSuccess && messages.data.unread > 0) {
      markRead.mutate();
    }
  }, [courseId, messages.isSuccess, messages.data, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  if (courseId == null) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-surface">
        <p className="text-sm text-muted">Selecciona un curso</p>
      </div>
    );
  }

  if (messages.isPending) return <Spinner label="Cargando sala" />;
  if (messages.isError)
    return (
      <ErrorState
        message="No se pudo cargar la sala del curso"
        onRetry={() => void messages.refetch()}
      />
    );

  const items = messages.data.items;

  return (
    <div className="flex h-[28rem] flex-col rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <p className="font-semibold">{courseName}</p>
        <p className="text-xs text-muted">Sala global · todos los miembros del curso</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {items.length === 0 ? (
          <EmptyState title="Sin mensajes">Escribe el primer mensaje al curso</EmptyState>
        ) : (
          items.map((m) => {
            const mine = m.sender_id === meId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-primary text-white" : "border border-border bg-bg"
                  }`}
                >
                  {!mine && m.sender_name ? (
                    <p className="mb-0.5 text-[11px] font-medium text-muted">
                      {m.sender_name}
                      {m.sender_role ? ` · ${m.sender_role}` : ""}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <CourseComposer
        courseId={courseId}
        onSent={() => {
          void queryClient.invalidateQueries({ queryKey: ["course-chat", courseId] });
          void queryClient.invalidateQueries({ queryKey: ["course-chats"] });
          void queryClient.invalidateQueries({ queryKey: ["unread-count"] });
        }}
      />
    </div>
  );
}
