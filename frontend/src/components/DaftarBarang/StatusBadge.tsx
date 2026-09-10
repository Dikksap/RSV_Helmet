import type { StatusBarang } from "../../api/barang";

const STATUS_STYLES: Record<
  StatusBarang,
  { bg: string; text: string; dot: string; border: string }
> = {
  REGISTER: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    border: "border-amber-200",
  },
  FINISHGOOD: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-[#10B981]",
    border: "border-emerald-200",
  },
  RETUR: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    dot: "bg-[#00A8E8]",
    border: "border-sky-200",
  },
  OUT: {
    bg: "bg-[#1E3A5F]/5",
    text: "text-[#1E3A5F]",
    dot: "bg-[#1E3A5F]",
    border: "border-[#1E3A5F]/15",
  },
  BAD: {
    bg: "bg-red-50",
    text: "text-[#EF4444]",
    dot: "bg-[#EF4444]",
    border: "border-red-200",
  },
};

type StatusBadgeProps = {
  status: StatusBarang;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.REGISTER;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}
