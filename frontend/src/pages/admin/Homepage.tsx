import { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faTimes,
  faGripHorizontal,
  faClipboardList,
  faBoxOpen,
  faLayerGroup,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import {
  BARANG_PRODUKSI,
  KARYAWAN,
  MANAJEMEN,
  NAV_INTEGRASI,
  NAV_MANAGEMENT,
  WAREHOUSE,
} from "../../layouts/admin/navigation";
import { ModuleSection, type HomeSection } from "../../components/HomeTiles";

const SECTIONS: HomeSection[] = [
  { title: BARANG_PRODUKSI.label, description: "Kelola aktivitas dan proses produksi", items: BARANG_PRODUKSI.children },
  { title: MANAJEMEN.label, description: "Kelola data dan kebutuhan operasional", items: MANAJEMEN.children },
  { title: KARYAWAN.label, description: "Kelola data master karyawan", items: KARYAWAN.children },
  { title: WAREHOUSE.label, description: "Kelola aktivitas dan persediaan warehouse", items: WAREHOUSE.children },
  { title: NAV_INTEGRASI.label, description: "Hubungkan sistem dengan layanan dan perangkat lain", items: NAV_INTEGRASI.children },
  { title: "Lainnya", description: "Pengaturan dan modul pendukung", items: NAV_MANAGEMENT },
];

function Homepage() {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter modul berdasarkan kata kunci (dengan type cast aman agar tidak error TypeScript)
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SECTIONS;

    return SECTIONS.map((section) => {
      const filteredItems = section.items.filter((item) => {
        const target = item as unknown as { label?: string; description?: string; path?: string };
        const matchTitle = target.label?.toLowerCase().includes(q);
        const matchDesc = target.description?.toLowerCase().includes(q);
        const matchPath = target.path?.toLowerCase().includes(q);

        return Boolean(matchTitle || matchDesc || matchPath);
      });

      return {
        ...section,
        items: filteredItems,
      };
    }).filter((section) => section.items.length > 0);
  }, [searchQuery]);

  const totalModules = useMemo(() => {
    return SECTIONS.reduce((acc, sec) => acc + sec.items.length, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-8">
        
        {/* Header Ringkas & Responsif */}
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl sm:shadow-lg">
          <div className="relative p-4 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              
              {/* Judul & Badge */}
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#1E3A5F]/10 to-[#00A8E8]/10 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-[#1E3A5F] sm:px-3 sm:text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00A8E8] animate-pulse" />
                  RSV Management System
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Selamat Datang
                </h1>
                <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
                  Pusat kendali operasional produksi, warehouse, dan manajemen terpadu.
                </p>
              </div>

              {/* Total Modul Counter */}
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 self-start sm:self-auto sm:p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#1E3A5F] to-[#00A8E8] text-white shadow-sm sm:h-11 sm:w-11">
                  <FontAwesomeIcon icon={faGripHorizontal} className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="text-lg font-black text-[#1E3A5F] tabular-nums leading-none sm:text-2xl">{totalModules}</p>
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">Modul Aktif</p>
                </div>
              </div>

            </div>

            {/* Search Bar Real-Time */}
            <div className="mt-4 sm:mt-6">
              <div className="relative flex items-center">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="pointer-events-none absolute left-3.5 h-3.5 w-3.5 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama modul atau menu..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-9 text-xs font-medium text-slate-800 placeholder-slate-400 transition outline-none focus:border-[#00A8E8] focus:bg-white focus:ring-2 focus:ring-[#00A8E8]/20 sm:rounded-2xl sm:py-3 sm:pl-10 sm:text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Bersihkan pencarian"
                    className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  >
                    <FontAwesomeIcon icon={faTimes} className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Elemen Dekoratif */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#1E3A5F]/[0.04] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-10 h-40 w-40 rounded-full bg-[#00A8E8]/[0.04] blur-3xl" />
        </header>

        {/* Pintasan Akses Cepat */}
        {!searchQuery && (
          <section aria-label="Akses Cepat Pintasan" className="space-y-2">
            <h2 className="px-1 text-[0.68rem] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
              Pintasan Utama
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              <a
                href="/permintaan-barang"
                className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs transition hover:border-[#00A8E8] sm:rounded-2xl sm:p-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1E3A5F] transition group-hover:bg-[#1E3A5F] group-hover:text-white sm:h-10 sm:w-10">
                    <FontAwesomeIcon icon={faClipboardList} className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">Permintaan Barang</h3>
                    <p className="text-[0.68rem] text-slate-500">Form pengajuan baru</p>
                  </div>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#00A8E8]" />
              </a>

              <a
                href="/warehouse/stok"
                className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs transition hover:border-[#00A8E8] sm:rounded-2xl sm:p-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1E3A5F] transition group-hover:bg-[#1E3A5F] group-hover:text-white sm:h-10 sm:w-10">
                    <FontAwesomeIcon icon={faBoxOpen} className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">Stok Warehouse</h3>
                    <p className="text-[0.68rem] text-slate-500">Master data persediaan</p>
                  </div>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#00A8E8]" />
              </a>

              <a
                href="/produksi"
                className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs transition hover:border-[#00A8E8] sm:rounded-2xl sm:p-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1E3A5F] transition group-hover:bg-[#1E3A5F] group-hover:text-white sm:h-10 sm:w-10">
                    <FontAwesomeIcon icon={faLayerGroup} className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">Barang Produksi</h3>
                    <p className="text-[0.68rem] text-slate-500">Aktivitas & proses</p>
                  </div>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#00A8E8]" />
              </a>
            </div>
          </section>
        )}

        {/* Section Modul Navigation */}
        <div className="space-y-6 sm:space-y-8">
          {filteredSections.length > 0 ? (
            filteredSections.map((s) => (
              <ModuleSection key={s.title} {...s} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1E3A5F]">
                <FontAwesomeIcon icon={faSearch} className="h-4 w-4" />
              </div>
              <h3 className="mt-3 text-xs font-bold text-slate-800 sm:text-sm">
                Modul Tidak Ditemukan
              </h3>
              <p className="mt-1 text-[0.7rem] text-slate-500 sm:text-xs">
                Tidak ada hasil untuk <span className="font-bold text-slate-800">"{searchQuery}"</span>.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-4 rounded-lg bg-[#1E3A5F] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#00A8E8]"
              >
                Reset Pencarian
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Homepage;