import { Link } from "react-router-dom";

const actions = [
  { to: "/admin/courses?new=1", label: "Nuevo curso", desc: "Nombre, código y aula" },
  { to: "/admin/users?new=1", label: "Nuevo usuario", desc: "Admin, profe o alumno" },
  { to: "/admin/import", label: "Importar CSV", desc: "Alta masiva con PINs" },
  { to: "/admin/messages", label: "Escribir mensaje", desc: "Chat con el centro" },
  { to: "/admin/observer", label: "Ver aula", desc: "Entregas y notas" },
  { to: "/admin/tools", label: "Clonar / notas", desc: "Plantillas y CSV" },
];

export function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {actions.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="group rounded-lg border border-border bg-surface p-4 transition hover:border-primary/50 hover:shadow"
        >
          <p className="font-semibold text-text group-hover:text-primary">{a.label}</p>
          <p className="mt-1 text-sm text-muted">{a.desc}</p>
        </Link>
      ))}
    </div>
  );
}
