type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "danger";
};

const accents: Record<string, string> = {
  primary: "border-primary/40 bg-primary/5",
  success: "border-success/40 bg-success/10",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-danger/40 bg-danger/10",
};

export function KpiCard({ label, value, hint, accent = "primary" }: Props) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${accents[accent]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
