import { Outlet, Link, NavLink } from "react-router-dom";
import { useTheme } from "./theme";
import { useAuth } from "../features/auth/AuthContext";

export function AppLayout() {
  const { theme, toggle } = useTheme();
  const { isAuthenticated, mustChange, logout, user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-primary">
            Aula Virtual
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            {isAuthenticated && !mustChange ? (
              <>
                <NavLink
                  to="/courses"
                  className={({ isActive }) =>
                    isActive ? "text-primary underline" : "text-muted hover:text-text"
                  }
                >
                  Cursos
                </NavLink>
                {isAdmin ? (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      isActive ? "text-primary underline" : "text-muted hover:text-text"
                    }
                  >
                    Admin
                  </NavLink>
                ) : null}
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md border border-border px-3 py-1.5 hover:bg-bg"
                >
                  Salir
                </button>
              </>
            ) : isAuthenticated ? null : (
              <Link to="/login" className="rounded-md border border-border px-3 py-1.5 hover:bg-bg">
                Entrar
              </Link>
            )}
            <button
              type="button"
              onClick={toggle}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg"
              aria-pressed={theme === "dark"}
            >
              {theme === "dark" ? "Modo claro" : "Modo oscuro"}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
