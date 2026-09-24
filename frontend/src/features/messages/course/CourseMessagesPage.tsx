import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type CourseChatRoomSummary } from "../../../lib/api";
import { CourseRoomList } from "./CourseRoomList";
import { CourseThread } from "./CourseThread";
import { useAuth } from "../../auth/AuthContext";

export function CourseMessagesPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { user } = useAuth();

  const rooms = useQuery({
    queryKey: ["course-chats"],
    queryFn: ({ signal }) => apiGet<CourseChatRoomSummary[]>("/me/course-chats", signal),
  });

  const courseName =
    rooms.data?.find((r) => r.course_id === selectedId)?.course_name ?? "Sala de curso";

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">Chat global por curso</p>
        <h1 className="text-2xl font-bold">Salas de curso</h1>
        <p className="mt-1 text-sm text-muted">
          Cada curso tiene una sala compartida: profesorado y alumnos matriculados.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <CourseRoomList selectedId={selectedId} onSelect={setSelectedId} />
        <CourseThread courseId={selectedId} courseName={courseName} meId={user?.id ?? 0} />
      </div>
    </div>
  );
}
