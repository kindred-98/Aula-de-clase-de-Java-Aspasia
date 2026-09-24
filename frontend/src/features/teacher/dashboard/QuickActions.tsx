import { Link } from "react-router-dom";

const actions: { to: string; label: string; hint: string }[] = [
  { to: "/teacher/queue", label: "Cola de evaluación", hint: "Entregas por revisar" },
  { to: "/courses", label: "Mis cursos", hint: "Aulas y contenido" },
  { to: "/calendar", label: "Calendario", hint: "Fechas límite y anuncios" },
  { to: "/messages", label: "Mensajes", hint: "Alumnos y equipo" },
];

export function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className="rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
        >
          <p className="font-medium">{action.label}</p>
          <p className="mt-1 text-xs text-muted">{action.hint}</p>
        </Link>
      ))}
    </div>
  );
}
