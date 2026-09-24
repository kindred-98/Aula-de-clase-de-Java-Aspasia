import { EmptyState } from "../../../components/ui/EmptyState";

type Props = {
  title: string;
  items: { id: number; primary: string; secondary?: string; meta?: string }[];
  empty?: string;
};

export function ActivityList({ title, items, empty = "Sin actividad reciente" }: Props) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {items.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.primary}</p>
                {item.secondary ? (
                  <p className="truncate text-xs text-muted">{item.secondary}</p>
                ) : null}
              </div>
              {item.meta ? (
                <span className="shrink-0 text-xs text-muted tabular-nums">{item.meta}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
