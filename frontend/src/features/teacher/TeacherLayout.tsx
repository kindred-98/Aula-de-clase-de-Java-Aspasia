import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../auth/usePermissions";
import { usePendingCount } from "./usePendingCount";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
    isActive
      ? "bg-primary/10 font-medium text-primary"
      : "text-muted hover:bg-surface hover:text-text"
  }`;

export function TeacherLayout() {
  const { user, logout } = useAuth();
  const permissions = usePermissions();
  const pending = usePendingCount();
  const pendingTotal = pending.data?.pending ?? 0;
  const canSeeReports =
    user?.role === "org_admin" || (permissions.data?.effective ?? []).includes("reports.view");

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-1 lg:sticky lg:top-4 lg:self-start">
        <div className="mb-3 rounded-lg border border-border bg-surface p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Profesorado</p>
          <p className="truncate font-semibold">{user?.name ?? "Docente"}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
        <nav
          aria-label="Secciones del panel del profesor"
          className="flex flex-row flex-wrap gap-1 lg:flex-col"
        >
          <NavLink to="/teacher" end className={navClass}>
            <span aria-hidden>⌂</span> Inicio
          </NavLink>
          <NavLink to="/teacher/queue" className={navClass}>
            <span aria-hidden>⧗</span> Cola de evaluación
            {pendingTotal > 0 ? (
              <span
                className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-white"
                aria-label={`${pendingTotal} entregas por revisar`}
              >
                {pendingTotal}
              </span>
            ) : null}
          </NavLink>
          <NavLink to="/courses" className={navClass}>
            <span aria-hidden>▤</span> Mis cursos
          </NavLink>
          <NavLink to="/messages" className={navClass}>
            <span aria-hidden>✉</span> Mensajes
          </NavLink>
          <NavLink to="/calendar" className={navClass}>
            <span aria-hidden>◷</span> Calendario
          </NavLink>
          {canSeeReports ? (
            <NavLink to="/admin/reports" className={navClass}>
              <span aria-hidden>▥</span> Informes
            </NavLink>
          ) : null}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="mt-4 w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-bg"
        >
          Cerrar sesión
        </button>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
