import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-muted">No se encontró la página solicitada.</p>
      <Link to="/" className="text-primary underline">
        Volver al inicio
      </Link>
    </div>
  );
}
