import React, { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faBoxesStacked,
  faCirclePlus,
  faMagnifyingGlass,
  faCheckCircle,
  faTriangleExclamation,
  faCircleXmark,
  faCalendarDays,
  faFilter,
} from "@fortawesome/free-solid-svg-icons";
import type { StokDivisiRecord, StokDivisiMaterial } from "../../../api/pemakaianMaterial";

interface StokDivisiBoardProps {
  stokDivisi: StokDivisiRecord[];
  periode: { dari: string; sampai: string };
  onPeriodeChange: (periode: { dari: string; sampai: string }) => void;
  onRecordPemakaianForDivisi: (divisiId: number) => void;
}

export const StokDivisiBoard: React.FC<StokDivisiBoardProps> = ({
  stokDivisi,
  periode,
  onPeriodeChange,
  onRecordPemakaianForDivisi,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDivisiId, setSelectedDivisiId] = useState<number | "all">("all");

  const formatNumber = (value: number) => {
    if (!Number.isFinite(value)) return "0";
    return value.toLocaleString("id-ID", {
      maximumFractionDigits: 6,
      minimumFractionDigits: 0,
    });
  };

  const filteredDivisi = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return stokDivisi
      .filter((group) => {
        if (selectedDivisiId !== "all" && group.divisiId !== selectedDivisiId) {
          return false;
        }
        return true;
      })
      .map((group) => {
        if (!q) return group;
        const matchingMaterials = group.materials.filter(
          (m) =>
            m.nama.toLowerCase().includes(q) ||
            (m.jenis && m.jenis.toLowerCase().includes(q))
        );
        return {
          ...group,
          materials: matchingMaterials,
        };
      })
      .filter((group) => group.materials.length > 0 || !searchTerm.trim());
  }, [stokDivisi, searchTerm, selectedDivisiId]);

  const groupByJenis = (materials: StokDivisiMaterial[]) => {
    const groups = new Map<string, StokDivisiMaterial[]>();
    for (const material of materials) {
      const jenis = (material.jenis ?? "").trim() || "Lain-lain";
      const list = groups.get(jenis);
      if (list) list.push(material);
      else groups.set(jenis, [material]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  const getStockBadge = (sisa: number) => {
    if (sisa <= 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
          <FontAwesomeIcon icon={faCircleXmark} className="text-[10px]" />
          <span>Habis</span>
        </span>
      );
    }
    if (sisa <= 5) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-[10px]" />
          <span>Menipis</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        <FontAwesomeIcon icon={faCheckCircle} className="text-[10px]" />
        <span>Tersedia</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-md">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
            />
            <input
              type="text"
              placeholder="Cari material atau jenis di stok divisi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="board-divisi" className="text-xs font-semibold text-slate-600 shrink-0">
              Divisi:
            </label>
            <select
              id="board-divisi"
              value={selectedDivisiId}
              onChange={(e) =>
                setSelectedDivisiId(
                  e.target.value === "all" ? "all" : Number(e.target.value)
                )
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
            >
              <option value="all">Semua Divisi ({stokDivisi.length})</option>
              {stokDivisi.map((group) => (
                <option key={group.divisiId} value={group.divisiId}>
                  {group.divisiNama}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter tanggal: kosong = saldo terkini, diisi = mutasi periode */}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label htmlFor="board-dari" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Dari tanggal
              </label>
              <input
                id="board-dari"
                type="date"
                value={periode.dari}
                max={periode.sampai || undefined}
                onChange={(e) => onPeriodeChange({ ...periode, dari: e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
              />
            </div>
            <div>
              <label htmlFor="board-sampai" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Sampai tanggal
              </label>
              <input
                id="board-sampai"
                type="date"
                value={periode.sampai}
                min={periode.dari || undefined}
                onChange={(e) => onPeriodeChange({ ...periode, sampai: e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
              />
            </div>
            {(periode.dari || periode.sampai) && (
              <button
                type="button"
                onClick={() => onPeriodeChange({ dari: "", sampai: "" })}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 active:scale-[0.98]"
              >
                <FontAwesomeIcon icon={faFilter} className="text-[11px]" />
                <span>Reset tanggal</span>
              </button>
            )}
          </div>

          <p className="flex items-center gap-1.5 text-xs text-slate-500 sm:pb-2.5">
            <FontAwesomeIcon icon={faCalendarDays} className="text-slate-400" />
            {periode.dari || periode.sampai
              ? "Diterima = stok awal periode, Dipakai = total periode, Sisa = akhir periode."
              : "Tanpa tanggal: saldo stok terkini per divisi."}
          </p>
        </div>
      </div>

      {/* Grid of Division Stock Cards */}
      {filteredDivisi.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <FontAwesomeIcon icon={faBoxesStacked} className="text-3xl text-slate-300" />
          <h4 className="mt-3 text-base font-bold text-[#1E3A5F]">
            Tidak Ada Material Ditemukan
          </h4>
          <p className="mt-1 text-sm text-slate-500">
            Coba sesuaikan kata kunci pencarian, filter divisi, atau rentang tanggal Anda.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredDivisi.map((group) => {
            const totalItems = group.materials.length;
            const totalSisa = group.materials.reduce((acc, m) => acc + m.sisa, 0);

            return (
              <article
                key={group.divisiId}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-[#00A8E8]">
                        <FontAwesomeIcon icon={faBuilding} className="text-sm" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#1E3A5F]">
                          {group.divisiNama}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {totalItems} jenis material • Total sisa: {formatNumber(totalSisa)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRecordPemakaianForDivisi(group.divisiId)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-1.5 text-xs font-bold text-[#00A8E8] transition hover:bg-sky-100 active:scale-95"
                    >
                      <FontAwesomeIcon icon={faCirclePlus} />
                      <span>Catat Pemakaian</span>
                    </button>
                  </div>

                  {/* Card Body: Materials Table grouped by Jenis */}
                  <div className="p-5 space-y-4">
                    {group.materials.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">
                        Belum ada stok material tercatat pada divisi ini.
                      </p>
                    ) : (
                      groupByJenis(group.materials).map(([jenis, materials]) => (
                        <div key={jenis} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              {jenis}
                            </span>
                            <span className="h-px flex-1 bg-slate-100" />
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-slate-100">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50/75 text-[11px] font-semibold uppercase text-slate-500">
                                <tr>
                                  <th className="px-3.5 py-2">Material</th>
                                  <th className="px-3.5 py-2 text-right">Diterima</th>
                                  <th className="px-3.5 py-2 text-right">Dipakai</th>
                                  <th className="px-3.5 py-2 text-right">Sisa Terkini</th>
                                  <th className="px-3.5 py-2 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {materials.map((m) => (
                                  <tr
                                    key={m.key}
                                    className="hover:bg-slate-50/50 transition"
                                  >
                                    <td className="px-3.5 py-2 font-medium text-slate-800">
                                      {m.nama}
                                    </td>
                                    <td className="px-3.5 py-2 text-right tabular-nums text-slate-500">
                                      {formatNumber(m.diterima)} {m.satuan || ""}
                                    </td>
                                    <td className="px-3.5 py-2 text-right tabular-nums text-slate-500">
                                      {formatNumber(m.dipakai)} {m.satuan || ""}
                                    </td>
                                    <td className="px-3.5 py-2 text-right font-bold tabular-nums text-[#1E3A5F]">
                                      {formatNumber(m.sisa)} {m.satuan || ""}
                                    </td>
                                    <td className="px-3.5 py-2 text-center">
                                      {getStockBadge(m.sisa)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
