type Props = {
  label?: string;
};

export function Spinner({ label = "Cargando" }: Props) {
  return (
    <div className="flex items-center justify-center gap-3 py-8" role="status" aria-live="polite">
      <span
        className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden="true"
      />
      <span className="text-sm text-muted">{label}…</span>
    </div>
  );
}
