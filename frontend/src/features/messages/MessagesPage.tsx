import { NavLink, Outlet } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm transition ${
    isActive
      ? "bg-primary/10 font-medium text-primary"
      : "text-muted hover:bg-surface hover:text-text"
  }`;

export function MessagesPage() {
  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Mensajes</h1>
        <p className="mt-1 text-sm text-muted">
          Chat privado con las personas de tu centro y salas globales por curso.
        </p>
      </header>
      <nav aria-label="Tipos de mensaje" className="flex gap-2">
        <NavLink to="/messages" end className={tabClass}>
          Privado
        </NavLink>
        <NavLink to="/messages/course" className={tabClass}>
          Por curso
        </NavLink>
      </nav>
      <Outlet />
    </section>
  );
}
