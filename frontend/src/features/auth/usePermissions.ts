import { useQuery } from "@tanstack/react-query";
import { apiGet, type PermissionCatalog } from "../../lib/api";
import { useAuth } from "./AuthContext";

export function usePermissions() {
  const { isAuthenticated, mustChange } = useAuth();
  return useQuery({
    queryKey: ["auth-permissions"],
    queryFn: ({ signal }) => apiGet<PermissionCatalog>("/auth/permissions", signal),
    enabled: isAuthenticated && !mustChange,
  });
}
