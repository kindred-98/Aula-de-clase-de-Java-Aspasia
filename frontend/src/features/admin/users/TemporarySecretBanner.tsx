type Props = {
  secret: string;
  role: string;
  onDismiss: () => void;
};

export function TemporarySecretBanner({ secret, role, onDismiss }: Props) {
  const label = role === "student" ? "PIN" : "Contraseña temporal";
  return (
    <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm" role="status">
      <p className="font-semibold">{label} (se muestra una sola vez)</p>
      <p className="mt-2 break-all font-mono text-xl tracking-wider">{secret}</p>
      <p className="mt-1 text-xs text-muted">
        Anótalo y entrégalo al usuario. No volverá a mostrarse.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 rounded-md border border-border px-3 py-1 text-xs"
      >
        Ocultar
      </button>
    </div>
  );
}
