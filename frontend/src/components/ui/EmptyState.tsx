import type { ReactNode } from "react";

type Props = {
  title?: string;
  children?: ReactNode;
};

export function EmptyState({ title = "Sin datos", children }: Props) {
  return (
    <div
      className="rounded-lg border border-dashed border-border bg-surface p-8 text-center"
      role="status"
    >
      <p className="font-medium">{title}</p>
      {children ? <p className="mt-2 text-sm text-muted">{children}</p> : null}
    </div>
  );
}
