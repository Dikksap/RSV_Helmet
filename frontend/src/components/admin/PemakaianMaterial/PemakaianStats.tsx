import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileLines,
  faBuilding,
  faBoxesStacked,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import type { SummaryStatItem } from "./types";

interface PemakaianStatsProps {
  stats: SummaryStatItem[];
}

export const PemakaianStats: React.FC<PemakaianStatsProps> = ({ stats }) => {
  const getIcon = (type: SummaryStatItem["iconType"]) => {
    switch (type) {
      case "record":
        return faFileLines;
      case "divisi":
        return faBuilding;
      case "material":
        return faBoxesStacked;
      case "sisa":
        return faWarehouse;
      default:
        return faBoxesStacked;
    }
  };

  return (
    <section aria-label="Ringkasan Statistik Pemakaian Material" className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <article
          key={stat.label}
          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4.5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#1E3A5F] sm:text-3xl">
                {stat.value}
              </p>
            </div>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105"
              style={{
                backgroundColor: `${stat.accent}15`,
                color: stat.accent,
              }}
            >
              <FontAwesomeIcon icon={getIcon(stat.iconType)} className="text-base" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: stat.accent }}
            />
            <span className="truncate">{stat.hint}</span>
          </div>
        </article>
      ))}
    </section>
  );
};
