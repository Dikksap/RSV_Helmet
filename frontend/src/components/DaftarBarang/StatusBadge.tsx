import type { StatusBarang } from "../../api/barang";

const STATUS_STYLES: Record<
  StatusBarang,
  { bg: string; text: string; dot: string; border: string }
> = {
  REGISTER: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-400",
    border: "border-amber-500/20",
  },
  FINISHGOOD: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    border: "border-emerald-500/20",
  },
  RETUR: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    dot: "bg-blue-400",
    border: "border-blue-500/20",
  },
  OUT: {
    bg: "bg-brand-gold/10",
    text: "text-brand-gold",
    dot: "bg-brand-gold",
    border: "border-brand-gold/20",
  },
  BAD: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    dot: "bg-rose-400",
    border: "border-rose-500/20",
  },
};

type StatusBadgeProps = {
  status: StatusBarang;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.REGISTER;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}
