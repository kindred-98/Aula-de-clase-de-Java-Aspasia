import { useQuery } from "@tanstack/react-query";
import { apiGet, type PendingCount } from "../../lib/api";
import { useAuth } from "../auth/AuthContext";

export function usePendingCount() {
  const { isAuthenticated, mustChange, user } = useAuth();
  const isStudent = user?.role === "student" || user?.role === "org_admin";
  return useQuery({
    queryKey: ["student-pending-count"],
    queryFn: ({ signal }) => apiGet<PendingCount>("/student/pending-count", signal),
    enabled: isAuthenticated && !mustChange && isStudent,
    refetchInterval: 30000,
  });
}
