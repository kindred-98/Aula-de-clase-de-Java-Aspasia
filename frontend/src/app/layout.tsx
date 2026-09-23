import { Outlet, Link } from "react-router-dom";
import { useTheme } from "./theme";

export function AppLayout() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-primary">
            Aula Virtual
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg"
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
