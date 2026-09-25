/**
 * Destino tras iniciar sesión / cambiar credenciales.
 * El teacher tiene panel en /teacher (D-T2 del plan del profesor) y el
 * student en /student (D-S2 del plan del alumno).
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
  const role = roleFromAccessToken();
  if (role === "teacher") return "/teacher";
  if (role === "student") return "/student";
  return "/";
}
