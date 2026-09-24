import type { CourseAssignmentStat } from "../../../lib/api";

type Props = { stat: CourseAssignmentStat };

export function AssignmentProgressRow({ stat }: Props) {
  const pct = Math.min(100, Math.max(0, stat.pct));
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{stat.title}</p>
        <span className="text-sm text-muted">
          {stat.submitted}/{stat.total} entregas · {stat.pct}%
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-bg"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso de ${stat.title}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}
