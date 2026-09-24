/**
 * Destino tras iniciar sesión / cambiar credenciales.
 * El teacher tiene panel propio en /teacher (D-T2 del plan del profesor).
 */
function roleFromAccessToken(): string | null {
  const token = localStorage.getItem("aula.access_token");
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64)) as { role?: string };
    return json.role ?? null;
  } catch {
    return null;
  }
}

export function homePathAfterLogin(): string {
  return roleFromAccessToken() === "teacher" ? "/teacher" : "/";
}
