import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faXmark,
  faCalendarDays,
  faFilter,
} from "@fortawesome/free-solid-svg-icons";
import type { Divisi } from "../../../api/divisi";
import type { PemakaianFilterState } from "./types";

interface PemakaianFilterProps {
  filters: PemakaianFilterState;
  onChange: (filters: PemakaianFilterState) => void;
  divisis: Divisi[];
  onReset: () => void;
  isFiltered: boolean;
}

export const PemakaianFilter: React.FC<PemakaianFilterProps> = ({
  filters,
  onChange,
  divisis,
  onReset,
  isFiltered,
}) => {
  const today = new Date().toISOString().slice(0, 10);

  const handleDateFromChange = (val: string) => {
    const next = { ...filters, dateFrom: val };
    if (val && filters.dateTo && val > filters.dateTo) {
      next.dateTo = val;
    }
    onChange(next);
  };

  const handleDateToChange = (val: string) => {
    onChange({ ...filters, dateTo: val });
  };

  const isInvalidDateRange =
    Boolean(filters.dateFrom) &&
    Boolean(filters.dateTo) &&
    filters.dateFrom > filters.dateTo;

  return (
    <section
      aria-label="Filter Pemakaian Material"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Search Input */}
        <div>
          <label
            htmlFor="filter-search"
            className="mb-1.5 block text-xs font-semibold text-slate-700"
          >
            Pencarian
          </label>
          <div className="relative">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
            />
            <input
              id="filter-search"
              type="text"
              placeholder="Cari no. transaksi / peminta..."
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, search: "" })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="Hapus pencarian"
              >
                <FontAwesomeIcon icon={faXmark} className="text-xs" />
              </button>
            )}
          </div>
        </div>

        {/* Divisi Dropdown */}
        <div>
          <label
            htmlFor="filter-divisi"
            className="mb-1.5 block text-xs font-semibold text-slate-700"
          >
            Divisi
          </label>
          <select
            id="filter-divisi"
            value={filters.divisiId}
            onChange={(e) => onChange({ ...filters, divisiId: e.target.value })}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
          >
            <option value="">Semua Divisi</option>
            {divisis.map((divisi) => (
              <option key={divisi.id} value={divisi.id}>
                {divisi.nama}
              </option>
            ))}
          </select>
        </div>

        {/* Tanggal Mulai */}
        <div>
          <label
            htmlFor="filter-date-from"
            className="mb-1.5 block text-xs font-semibold text-slate-700"
          >
            Tanggal Mulai
          </label>
          <div className="relative">
            <input
              id="filter-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
            />
          </div>
        </div>

        {/* Tanggal Akhir */}
        <div>
          <label
            htmlFor="filter-date-to"
            className="mb-1.5 block text-xs font-semibold text-slate-700"
          >
            Tanggal Akhir
          </label>
          <div className="relative">
            <input
              id="filter-date-to"
              type="date"
              min={filters.dateFrom || undefined}
              value={filters.dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
            />
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...filters, dateTo: today })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-[0.98]"
          >
            <FontAwesomeIcon icon={faCalendarDays} className="text-[11px] text-slate-400" />
            <span>Sampai Hari Ini</span>
          </button>

          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 active:scale-[0.98]"
            >
              <FontAwesomeIcon icon={faFilter} className="text-[11px]" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {isInvalidDateRange && (
          <p className="text-xs font-semibold text-red-600">
            Tanggal akhir tidak boleh lebih awal dari tanggal mulai.
          </p>
        )}
      </div>
    </section>
  );
};
