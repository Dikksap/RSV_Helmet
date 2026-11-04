import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import {
  faArrowRight,
  faArrowUpRightFromSquare,
  faBoxesStacked,
  faClipboardList,
  faMagnifyingGlass,
  faPrint,
  faQrcode,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import {
  BARANG_PRODUKSI,
  KARYAWAN,
  MANAJEMEN,
  NAV_INTEGRASI,
  PENGATURAN,
  WAREHOUSE,
} from "../../layouts/admin/navigation";
import { getUser } from "../../api/auth";

type ModuleSection = {
  key: string;
  label: string;
  description: string;
  icon: IconDefinition;
  items: { to: string; label: string; icon: IconDefinition; description?: string }[];
};

const SECTIONS: ModuleSection[] = [
  { key: "produksi", label: BARANG_PRODUKSI.label, description: "Kelola aktivitas dan proses produksi", icon: BARANG_PRODUKSI.icon, items: BARANG_PRODUKSI.children },
  { key: "manajemen", label: MANAJEMEN.label, description: "Perencanaan dan pencatatan operasional", icon: MANAJEMEN.icon, items: MANAJEMEN.children },
  { key: "warehouse", label: WAREHOUSE.label, description: "Persediaan, opname, dan pergerakan stok", icon: WAREHOUSE.icon, items: WAREHOUSE.children },
  { key: "karyawan", label: KARYAWAN.label, description: "Data personalia, peran, dan hak akses", icon: KARYAWAN.icon, items: KARYAWAN.children },
  { key: "pengaturan", label: PENGATURAN.label, description: "Variant produk dan data acuan sistem", icon: PENGATURAN.icon, items: PENGATURAN.children },
  { key: "integrasi", label: NAV_INTEGRASI.label, description: "Sinkronisasi dengan layanan eksternal", icon: NAV_INTEGRASI.icon, items: NAV_INTEGRASI.children },
];

const QUICK_ACTIONS: { to: string; label: string; description: string; icon: IconDefinition }[] = [
  { to: "/scan-qr", label: "Scan barang", description: "Cari barang lewat QR / barcode", icon: faQrcode },
  { to: "/cetak-label", label: "Cetak label", description: "Label QR dan hangtag siap tempel", icon: faPrint },
  { to: "/admin/permintaan-barang", label: "Permintaan barang", description: "Tinjau dan setujui pengajuan", icon: faClipboardList },
  { to: "/admin/stok-produksi", label: "Stok produksi", description: "Pantau stok koli hasil produksi", icon: faBoxesStacked },
];

const totalModules = SECTIONS.reduce((total, section) => total + section.items.length, 0);

function formatToday() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function Homepage() {
  const [query, setQuery] = useState("");
  const firstName = getUser()?.name?.trim().split(/\s+/)[0] ?? "Admin";

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SECTIONS;

    return SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        [item.label, item.description ?? "", section.label].some((value) =>
          value.toLowerCase().includes(needle),
        ),
      ),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  const visibleModules = sections.reduce((total, section) => total + section.items.length, 0);

  return (
    <div className="w-full space-y-6">
      {/* Page header */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,28,46,0.04)] sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-accent-500/[0.07] blur-2xl"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-600/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-navy-600">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              Dashboard
            </span>
            <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-navy-900 sm:text-[30px]">
              Beranda administrator
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-500">
              Selamat bekerja, {firstName}. Semua modul produksi, warehouse, dan master data bisa
              dibuka dari satu tempat.
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-[11.5px] font-medium text-slate-600">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {formatToday()}
            </span>
            <p className="text-[11px] text-slate-400">
              <span className="font-semibold tabular-nums text-slate-600">{totalModules}</span> modul
              aktif · 6 grup kerja
            </p>
          </div>
        </div>

        <div className="relative mt-5">
          <label htmlFor="module-search" className="sr-only">
            Cari modul
          </label>
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          />
          <input
            id="module-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari modul, misalnya “opname”, “BOM”, atau “karyawan”…"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-10 text-[13px] text-navy-900 outline-none transition placeholder:text-slate-400 focus:border-accent-500/60 focus:bg-white focus:ring-2 focus:ring-accent-500/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Bersihkan pencarian"
              className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
            </button>
          )}
          {query && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              {visibleModules} modul cocok dengan “{query}”.
            </p>
          )}
        </div>
      </section>

      {/* Quick actions */}
      {!query && (
        <section aria-labelledby="quick-actions-title" className="space-y-2.5">
          <h2
            id="quick-actions-title"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
          >
            Akses cepat
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 no-underline shadow-[0_1px_2px_rgba(15,28,46,0.03)] transition hover:border-accent-500/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-600/[0.06] text-navy-600 transition group-hover:bg-navy-600 group-hover:text-white">
                  <FontAwesomeIcon icon={action.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-navy-900">
                    {action.label}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {action.description}
                  </span>
                </span>
                <FontAwesomeIcon
                  icon={faArrowRight}
                  className="h-3 w-3 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-accent-500"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Modules */}
      <section aria-labelledby="modules-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="modules-title" className="text-base font-semibold tracking-tight text-navy-900">
              Modul kerja
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Dikelompokkan mengikuti alur kerja, dari produksi sampai integrasi.
            </p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
            {visibleModules} modul
          </span>
        </div>

        {sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-navy-900">Modul tidak ditemukan</p>
            <p className="mt-1 text-xs text-slate-500">
              Tidak ada modul yang cocok dengan “{query}”.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-4 rounded-lg bg-navy-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50"
            >
              Reset pencarian
            </button>
          </div>
        ) : (
          <div className="grid gap-3.5 lg:grid-cols-2">
            {sections.map((section) => (
              <section
                key={section.key}
                aria-labelledby={`module-${section.key}`}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,28,46,0.03)]"
              >
                <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-navy-600/[0.06] text-navy-600">
                    <FontAwesomeIcon icon={section.icon} className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3
                      id={`module-${section.key}`}
                      className="truncate text-[13.5px] font-semibold text-navy-900"
                    >
                      {section.label}
                    </h3>
                    <p className="truncate text-[11.5px] text-slate-500">{section.description}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-slate-500">
                    {section.items.length}
                  </span>
                </header>

                <ul className="flex-1 p-1.5">
                  {section.items.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 no-underline transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40"
                      >
                        <FontAwesomeIcon
                          icon={item.icon}
                          className="h-3 w-3 shrink-0 text-slate-400 transition group-hover:text-accent-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-slate-700 group-hover:text-navy-900">
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="block truncate text-[11px] text-slate-400">
                              {item.description}
                            </span>
                          )}
                        </span>
                        <FontAwesomeIcon
                          icon={faArrowUpRightFromSquare}
                          className="h-2.5 w-2.5 shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Homepage;
