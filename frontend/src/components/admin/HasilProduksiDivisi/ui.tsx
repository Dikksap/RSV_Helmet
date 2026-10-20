import type { ReactNode } from "react";

export const FIELD =
  "rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-[15px] focus:outline-2 focus:outline-[#00A8E8]";

export const CARD = "overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]";

export const BADGE_BASE = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";

export const btnPrimary =
  "h-[46px] rounded-lg bg-[#1E3A5F] px-4 text-[15px] font-semibold text-white hover:bg-[#162C48] focus-visible:outline-2 focus-visible:outline-[#00A8E8]";

export const miniBtn =
  "rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1E3A5F] ring-1 ring-slate-200 transition hover:bg-[#F5F7FA] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#00A8E8]";

export function Panel({ title, extra, children }: { title: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-4">
        <h3 className="font-semibold text-[#1E3A5F]">{title}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return <th className={`px-3 py-3 font-semibold${right ? " text-right" : ""}`}>{children}</th>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="p-6 text-center text-[#6B7280]">{children}</p>;
}

export function Badge({ tone, children }: { tone?: string; children: ReactNode }) {
  return <span className={`${BADGE_BASE} ${tone ?? "bg-slate-100 text-slate-500"}`}>{children}</span>;
}
