type Props = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ title = "Algo salió mal", message, onRetry }: Props) {
  return (
    <div className="rounded-lg border border-danger/40 bg-surface p-6" role="alert">
      <p className="font-semibold text-danger">{title}</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
