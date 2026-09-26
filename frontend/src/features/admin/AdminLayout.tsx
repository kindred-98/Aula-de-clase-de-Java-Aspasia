import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../auth/usePermissions";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
    isActive
      ? "bg-primary/10 font-medium text-primary"
      : "text-muted hover:bg-surface hover:text-text"
  }`;

export function AdminLayout() {
  const { user, logout } = useAuth();
  const permissions = usePermissions();
  const isAdmin = user?.role === "org_admin";
  const canSeeReports = isAdmin || (permissions.data?.effective ?? []).includes("reports.view");

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-1 lg:sticky lg:top-4 lg:self-start">
        <div className="mb-3 rounded-lg border border-border bg-surface p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Panel</p>
          <p className="truncate font-semibold">{user?.name ?? "Admin"}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
        <nav aria-label="Secciones de administración" className="flex flex-col gap-1">
          {isAdmin ? (
            <>
              <NavLink to="/admin" end className={navClass}>
                <span aria-hidden>⌂</span> Dashboard
              </NavLink>
              <NavLink to="/admin/multi" className={navClass}>
                <span aria-hidden>▦</span> Multi-curso
              </NavLink>
              <NavLink to="/admin/courses" className={navClass}>
                <span aria-hidden>▤</span> Cursos
              </NavLink>
              <NavLink to="/admin/users" className={navClass}>
                <span aria-hidden>☺</span> Usuarios
              </NavLink>
            </>
          ) : null}
          <NavLink to="/messages" className={navClass}>
            <span aria-hidden>✉</span> Mensajes
          </NavLink>
          {isAdmin ? (
            <>
              <NavLink to="/admin/observer" className={navClass}>
                <span aria-hidden>◉</span> Observador
              </NavLink>
              <NavLink to="/admin/import" className={navClass}>
                <span aria-hidden>⇪</span> Importar CSV
              </NavLink>
            </>
          ) : null}
          {canSeeReports ? (
            <NavLink to="/admin/reports" className={navClass}>
              <span aria-hidden>▥</span> Reportes
            </NavLink>
          ) : null}
          {isAdmin ? (
            <>
              <NavLink to="/admin/categories" className={navClass}>
                <span aria-hidden>⊞</span> Categorías
              </NavLink>
              <NavLink to="/admin/cohorts" className={navClass}>
                <span aria-hidden>◍</span> Cohorts
              </NavLink>
              <NavLink to="/admin/roles" className={navClass}>
                <span aria-hidden>◆</span> Roles
              </NavLink>
              <NavLink to="/admin/sessions" className={navClass}>
                <span aria-hidden>◷</span> Sesiones
              </NavLink>
              <NavLink to="/admin/audit" className={navClass}>
                <span aria-hidden>☰</span> Auditoría
              </NavLink>
              <NavLink to="/admin/tools" className={navClass}>
                <span aria-hidden>⚒</span> Herramientas
              </NavLink>
              <NavLink to="/admin/settings" className={navClass}>
                <span aria-hidden>⚙</span> Ajustes
              </NavLink>
            </>
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
