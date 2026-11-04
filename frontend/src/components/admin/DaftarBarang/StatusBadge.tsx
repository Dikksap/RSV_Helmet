import { statusVisual } from "./statusVisuals";

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const visual = statusVisual(status);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${visual.soft} ${visual.text} ${visual.border}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${visual.dot}`} aria-hidden="true" />
      {status}
    </span>
  );
}
