import React, { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCirclePlus,
  faRotate,
  faSpinner,
  faFileCsv,
  faClipboardList,
  faBoxesStacked,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
import type { ActiveTab } from "./types";

interface PemakaianHeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenCreate: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  onExportCsv: (mode: "ringkas" | "rincian") => void;
  hasData: boolean;
}

export const PemakaianHeader: React.FC<PemakaianHeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenCreate,
  onRefresh,
  refreshing,
  onExportCsv,
  hasData,
}) => {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#00A8E8] ring-1 ring-inset ring-sky-500/20">
            <span>Warehouse</span>
            <span className="text-slate-300">•</span>
            <span>Material Divisi</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1E3A5F] sm:text-3xl">
            Pemakaian Material
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pencatatan konsumsi dan pemantauan saldo material divisi secara akurat dan real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Refresh button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            title="Muat ulang data"
          >
            <FontAwesomeIcon
              icon={refreshing ? faSpinner : faRotate}
              spin={refreshing}
              className="text-slate-400"
            />
            <span className="hidden sm:inline">{refreshing ? "Memuat..." : "Refresh"}</span>
          </button>

          {/* Export CSV Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setExportMenuOpen((prev) => !prev)}
              disabled={!hasData}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faFileCsv} className="text-emerald-600" />
              <span>Ekspor CSV</span>
              <FontAwesomeIcon icon={faChevronDown} className="text-[10px] text-slate-400" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 z-30 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-200/50">
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    onExportCsv("ringkas");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-[#00A8E8]"
                >
                  <FontAwesomeIcon icon={faClipboardList} className="text-slate-400" />
                  <div>
                    <div>Ekspor Ringkasan</div>
                    <div className="text-[11px] font-normal text-slate-400">1 baris per transaksi</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    onExportCsv("rincian");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-[#00A8E8]"
                >
                  <FontAwesomeIcon icon={faBoxesStacked} className="text-slate-400" />
                  <div>
                    <div>Ekspor Rincian Item</div>
                    <div className="text-[11px] font-normal text-slate-400">1 baris per item material</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Primary CTA */}
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00A8E8] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0088C0] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50"
          >
            <FontAwesomeIcon icon={faCirclePlus} />
            <span>Catat Pemakaian</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => onTabChange("riwayat")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "riwayat"
              ? "border-[#00A8E8] text-[#00A8E8]"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <FontAwesomeIcon icon={faClipboardList} />
          <span>Riwayat Pemakaian</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("stok")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "stok"
              ? "border-[#00A8E8] text-[#00A8E8]"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <FontAwesomeIcon icon={faBoxesStacked} />
          <span>Monitoring WIP Divisi</span>
        </button>
      </div>
    </header>
  );
};
