import type { ReactNode } from "react";

/* Token tampilan modul produksi/divisi. Acuan: frontend/DESIGN.md. */
export const CARD = "overflow-hidden rounded-xl border border-[#D1D5DB] bg-white";

export const CARD_HEAD =
  "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[#D1D5DB] px-4 py-3";

export const FIELD =
  "min-h-12 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition focus:border-[#00A8E8] focus:outline-2 focus:outline-offset-0 focus:outline-[#00A8E8]";

export const BADGE_BASE = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-4 text-sm font-semibold text-white transition hover:bg-[#0F1C2E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8] disabled:opacity-50";

export const miniBtn =
  "inline-flex items-center justify-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1E3A5F] ring-1 ring-[#D1D5DB] transition hover:bg-[#F5F7FA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8] disabled:opacity-40";

export const TH = "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]";
export const TD = "px-3 py-2.5 text-sm text-[#1F2937]";

export function Panel({ title, extra, children }: { title: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className={CARD}>
      <div className={CARD_HEAD}>
        <h3 className="text-[15px] font-semibold text-[#1E3A5F]">{title}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return <th className={`${TH} ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-[#6B7280]">{children}</p>;
}

export function Badge({ tone, children }: { tone?: string; children: ReactNode }) {
  return <span className={`${BADGE_BASE} ${tone ?? "bg-slate-100 text-slate-500"}`}>{children}</span>;
}
