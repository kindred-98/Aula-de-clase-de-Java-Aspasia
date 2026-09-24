import { useQuery } from "@tanstack/react-query";
import { apiGet, type UnreadCountResponse } from "../../lib/api";
import { useAuth } from "../auth/AuthContext";

export function useUnreadCount() {
  const { isAuthenticated, mustChange } = useAuth();
  return useQuery({
    queryKey: ["unread-count"],
    queryFn: ({ signal }) => apiGet<UnreadCountResponse>("/messages/unread-count", signal),
    enabled: isAuthenticated && !mustChange,
    refetchInterval: 20000,
  });
}
