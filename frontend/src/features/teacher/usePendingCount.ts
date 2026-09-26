import { useQuery } from "@tanstack/react-query";
import { apiGet, type PendingCount } from "../../lib/api";
import { useAuth } from "../auth/AuthContext";

export function usePendingCount() {
  const { isAuthenticated, mustChange, user } = useAuth();
  const isStaff = user?.role === "teacher" || user?.role === "org_admin";
  return useQuery({
    queryKey: ["teacher-pending-count"],
    queryFn: ({ signal }) => apiGet<PendingCount>("/teacher/pending-count", signal),
    enabled: isAuthenticated && !mustChange && isStaff,
    refetchInterval: 30000,
  });
}
