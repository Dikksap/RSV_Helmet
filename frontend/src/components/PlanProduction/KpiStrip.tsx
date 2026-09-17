export interface Kpi {
  label: string;
  value: string;
  tone?: "navy" | "green" | "red" | "muted";
}

const TONE: Record<NonNullable<Kpi["tone"]>, string> = {
  navy: "text-[#1E3A5F]",
  green: "text-emerald-700",
  red: "text-[#EF4444]",
  muted: "text-[#6B7280]",
};

export default function KpiStrip({ items }: { items: Kpi[] }) {
  if (items.length === 0) return null;
  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] ring-1 ring-slate-200/70">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">{k.label}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${TONE[k.tone ?? "navy"]}`}>{k.value}</p>
        </div>
      ))}
    </section>
  );
}
