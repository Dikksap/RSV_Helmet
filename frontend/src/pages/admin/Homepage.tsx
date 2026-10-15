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
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header Section */}
        <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
          <div className="relative px-8 py-12 sm:px-10">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center rounded-full bg-gradient-to-r from-[#1E3A5F]/10 to-[#00A8E8]/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#1E3A5F]">
               RSV Management System
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Selamat Datang
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Kelola aktivitas produksi, manajemen, warehouse, integrasi, dan modul lainnya dari satu dashboard terpusat.
              </p>
            </div>
            {/* Decorative Elements */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#1E3A5F]/[0.04] blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 right-10 h-40 w-40 rounded-full bg-[#00A8E8]/[0.04] blur-3xl" />
          </div>
        </header>

        {/* Sections */}
        <div className="space-y-10">
          {SECTIONS.map((s) => (
            <ModuleSection key={s.title} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Homepage;
