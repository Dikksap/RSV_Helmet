import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  BARANG_PRODUKSI,
  MANAJEMEN,
  WAREHOUSE,
  NAV_INTEGRASI,
  NAV_MANAGEMENT,
  KARYAWAN,
} from "../../layouts/admin/navigation";

function Homepage() {
  return (
    <div className="w-full space-y-7">
      {/* =====================================================
          WELCOME
      ====================================================== */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative px-6 py-6 sm:px-7">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center rounded-full bg-[#1E3A5F]/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1E3A5F]">
              RSV Management System
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Selamat Datang
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Kelola aktivitas produksi, manajemen, warehouse,
              integrasi, dan modul lainnya dari satu tempat.
            </p>
          </div>

          {/* Decorative element */}
          <div className="pointer-events-none absolute -right-10 -top-14 hidden h-48 w-48 rounded-full bg-[#1E3A5F]/[0.035] sm:block" />
          <div className="pointer-events-none absolute -bottom-16 right-24 hidden h-32 w-32 rounded-full bg-[#00A8E8]/[0.035] sm:block" />
        </div>
      </header>

      {/* =====================================================
          BARANG PRODUKSI
      ====================================================== */}
      <ModuleSection
        title={BARANG_PRODUKSI.label}
        description="Kelola aktivitas dan proses produksi"
        items={BARANG_PRODUKSI.children}
      />

      {/* =====================================================
          MANAJEMEN
      ====================================================== */}
      <ModuleSection
        title={MANAJEMEN.label}
        description="Kelola data dan kebutuhan operasional"
        items={MANAJEMEN.children}
      />

      {/* =====================================================
          KARYAWAN
      ====================================================== */}
      <ModuleSection
        title={KARYAWAN.label}
        description="Kelola data master karyawan"
        items={KARYAWAN.children}
      />

      {/* =====================================================
          WAREHOUSE
      ====================================================== */}
      <section>
        <SectionHeader
          title={WAREHOUSE.label}
          description="Kelola aktivitas dan persediaan warehouse"
        />

        {WAREHOUSE.children.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <span className="text-lg">—</span>
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-600">
              Belum ada modul
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Modul warehouse akan tersedia di sini.
            </p>
          </div>
        ) : (
          <MenuGrid items={WAREHOUSE.children} />
        )}
      </section>

      {/* =====================================================
          INTEGRASI
      ====================================================== */}
      <ModuleSection
        title={NAV_INTEGRASI.label}
        description="Hubungkan sistem dengan layanan dan perangkat lain"
        items={NAV_INTEGRASI.children}
      />

      {/* =====================================================
          LAINNYA
      ====================================================== */}
      <ModuleSection
        title="Lainnya"
        description="Pengaturan dan modul pendukung"
        items={NAV_MANAGEMENT}
      />
    </div>
  );
}

/* =========================================================
   SECTION
========================================================= */

function ModuleSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: any[];
}) {
  return (
    <section aria-label={title}>
      <SectionHeader
        title={title}
        description={description}
      />

      <MenuGrid items={items} />
    </section>
  );
}

/* =========================================================
   SECTION HEADER
========================================================= */

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-sm font-bold text-slate-900">
          {title}
        </h2>

        <p className="mt-0.5 text-xs text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   MENU GRID
========================================================= */

function MenuGrid({
  items,
}: {
  items: any[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <MenuCard
          key={item.to}
          to={item.to}
          label={item.label}
          icon={item.icon}
        />
      ))}
    </div>
  );
}

/* =========================================================
   MENU CARD
========================================================= */

function MenuCard({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentProps<
    typeof FontAwesomeIcon
  >["icon"];
}) {
  return (
    <Link
      to={to}
      className={[
        "group relative flex min-h-[82px] items-center gap-4",
        "rounded-2xl border border-slate-200/90 bg-white px-4 py-4",
        "shadow-sm transition-all duration-150",
        "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40",
      ].join(" ")}
    >
      {/* Icon */}
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1E3A5F]/[0.06] text-[#1E3A5F] transition-colors duration-150 group-hover:bg-[#1E3A5F] group-hover:text-white">
        <FontAwesomeIcon
          icon={icon}
          className="h-4.5 w-4.5"
        />
      </span>

      {/* Label */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-800 transition-colors group-hover:text-[#1E3A5F]">
          {label}
        </span>

        <span className="mt-0.5 block text-[11px] text-slate-400">
          Buka modul
        </span>
      </span>

      {/* Arrow */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-all duration-150 group-hover:translate-x-0.5 group-hover:bg-slate-100 group-hover:text-[#1E3A5F]">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M4 10h11M11 6l4 4-4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}

export default Homepage;
