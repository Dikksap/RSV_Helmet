import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxesStacked,
  faCalculator,
  faCalendarCheck,
  faCircleCheck,
  faFlask,
  faIndustry,
  faTruckRampBox,
  faUserPen,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import { getUser } from "../../api/auth";

const TABS = [
  { id: "produksi", label: "Catat Hasil Produksi", icon: faIndustry },
  { id: "material", label: "Stok Bahan Masuk", icon: faTruckRampBox },
  { id: "bom", label: "Formula BOM", icon: faFlask },
  { id: "stok", label: "Stok & Riwayat Data", icon: faBoxesStacked },
] as const;

type TabId = (typeof TABS)[number]["id"];

const kpis = [
  { label: "Varian Produk", icon: faBoxesStacked, accent: "border-zinc-900", tone: "text-zinc-900" },
  { label: "Total Hasil Produksi", icon: faCircleCheck, accent: "border-red-600", tone: "text-red-600" },
  { label: "Bahan Terpakai (BOM)", icon: faFlask, accent: "border-zinc-700", tone: "text-zinc-800" },
  { label: "Jenis Bahan Material", icon: faWarehouse, accent: "border-red-800", tone: "text-red-800" },
];

const panelClass = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6";
const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-sm text-zinc-500 disabled:cursor-not-allowed";

function PendingNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <FontAwesomeIcon icon={faCalendarCheck} className="mt-0.5 shrink-0" />
      <p>
        Halaman ini masih dalam tahap tampilan. Pencatatan dan data produksi belum dihubungkan ke backend.
      </p>
    </div>
  );
}

function DisabledField({ label, type = "text", placeholder }: { label: string; type?: string; placeholder?: string }) {
  return (
    <label className="block text-xs font-semibold text-zinc-700">
      {label}
      <input type={type} placeholder={placeholder} disabled className={fieldClass} />
    </label>
  );
}

function EmptyTable({ columns, message }: { columns: string[]; message: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200">
      {/* shortcut: tabel butuh lebar, di mobile cukup pesan kosong sampai ada data untuk layout kartu */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[480px] text-left text-xs sm:text-sm">
          <thead className="bg-zinc-900 text-[10px] uppercase tracking-wide text-zinc-300 sm:text-xs">
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-xs text-zinc-500 sm:px-4 sm:text-sm">
                {message}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="px-4 py-10 text-center text-xs text-zinc-500 sm:hidden">{message}</p>
    </div>
  );
}

function ProduksiHome() {
  const [activeTab, setActiveTab] = useState<TabId>("produksi");
  const user = getUser();
  const selectTab = (id: TabId) => {
    setActiveTab(id);
    window.scrollTo(0, 0);
  };
  const today = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-100 text-zinc-800">
      <header className="sticky top-0 z-30 overflow-hidden border-b-4 border-red-600 bg-zinc-900 text-white shadow-lg">
        <div className="flex flex-col gap-4 border-b border-zinc-800 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-600 text-lg font-black">RMI</span>
            <div>
              <p className="text-sm font-extrabold tracking-wider">PT. RMI</p>
              <p className="text-[11px] font-medium tracking-wide text-zinc-400">RSV MANUFACTURE INDONESIA</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200">
              <FontAwesomeIcon icon={faIndustry} className="text-red-500" />
              <span className="text-zinc-400">Divisi</span>
              <span>{user?.divisi?.nama ?? "Tanpa divisi"}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200">
              <FontAwesomeIcon icon={faCalendarCheck} className="text-red-500" />
              <time>{today}</time>
            </div>
            <Link
              to="/profil"
              className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-red-600 hover:text-white"
            >
              <FontAwesomeIcon icon={faUserPen} className="text-red-500" />
              Profil
            </Link>
          </div>
        </div>
        <nav aria-label="Menu produksi" className="hidden overflow-x-auto bg-zinc-950 px-2 sm:flex sm:px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-bold transition-colors sm:px-4 sm:text-sm ${
                activeTab === tab.id
                  ? "border-red-600 text-red-400"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <FontAwesomeIcon icon={tab.icon} />
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 py-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 sm:pb-8">
        <PendingNotice />

        <section aria-label="Ringkasan produksi" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className={`flex items-start justify-between gap-2 rounded-2xl border border-zinc-200 border-l-4 ${kpi.accent} bg-white p-3 shadow-sm sm:items-center sm:p-4`}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase leading-snug tracking-wide text-zinc-400 sm:text-xs">
                {kpi.label}
              </p>
              <p className={`mt-1 text-xs font-bold leading-snug sm:text-sm ${kpi.tone}`}>Belum tersedia</p>
            </div>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-xs text-zinc-700 sm:h-10 sm:w-10 sm:rounded-xl sm:text-base">
              <FontAwesomeIcon icon={kpi.icon} />
            </span>
          </article>
        ))}
        </section>

        {activeTab === "produksi" && (
        <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <div className={`${panelClass} min-w-0 space-y-4 md:mx-auto md:w-full md:max-w-2xl lg:col-span-5 lg:mx-0 lg:max-w-none`}>
            <div className="border-b border-zinc-100 pb-3">
              <p className="text-base font-extrabold text-zinc-900">Input Produksi Harian PT RMI</p>
              <p className="mt-1 text-xs text-zinc-500">Catat hasil produksi dan pemakaian material berdasarkan BOM.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DisabledField label="Tanggal Produksi" type="date" />
              <DisabledField label="Divisi Produksi" placeholder="Pilih divisi produksi" />
            </div>
            <DisabledField label="Produk Hasil Produksi" placeholder="Pilih produk jadi" />
            <div className="grid gap-4 sm:grid-cols-2">
              <DisabledField label="Jumlah Hasil Produksi" type="number" placeholder="Jumlah" />
              <DisabledField label="Satuan Produk" placeholder="Satuan" />
            </div>
            <div className="rounded-xl border-l-4 border-red-600 bg-zinc-900 p-4 text-white">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-red-300">
                <FontAwesomeIcon icon={faCalculator} />
                Kalkulasi Bahan Material (BOM)
              </div>
              <p className="mt-2 text-xs text-zinc-400">Kalkulasi akan ditampilkan setelah data produk dan BOM tersedia.</p>
            </div>
            <DisabledField label="Tujuan Pengiriman / Output Barang" placeholder="Tujuan output barang" />
            <button type="button" disabled className="h-11 w-full cursor-not-allowed rounded-xl bg-red-600 font-bold text-white opacity-50">
              Simpan Produksi
            </button>
          </div>
          <div className={`${panelClass} min-w-0 space-y-4 lg:col-span-7`}>
            <div>
              <p className="text-base font-extrabold text-zinc-900">Monitoring Material PT RMI</p>
              <p className="mt-1 text-xs text-zinc-500">Ringkasan stok material yang digunakan dalam produksi.</p>
            </div>
            <EmptyTable
              columns={["Bahan Material", "Gudang", "Sisa Stok", "Status"]}
              message="Data stok material belum tersedia."
            />
          </div>
        </section>
        )}

        {activeTab === "material" && (
        <section className={`${panelClass} space-y-4 md:mx-auto md:w-full md:max-w-2xl`}>
          <div className="border-b border-zinc-100 pb-3">
            <p className="text-base font-extrabold text-zinc-900">Penerimaan Bahan Material PT RMI</p>
            <p className="mt-1 text-xs text-zinc-500">Tambah persediaan bahan baku yang datang dari vendor atau supplier.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DisabledField label="Tanggal Penerimaan" type="date" />
            <DisabledField label="Divisi / Lokasi Penerima" placeholder="Pilih lokasi penerima" />
          </div>
          <DisabledField label="Nama Bahan Material" placeholder="Pilih bahan material" />
          <div className="grid gap-4 sm:grid-cols-3">
            <DisabledField label="Stok Sekarang" placeholder="—" />
            <DisabledField label="Jumlah Masuk (+)" type="number" placeholder="Jumlah" />
            <DisabledField label="Satuan" placeholder="Satuan" />
          </div>
          <button type="button" disabled className="h-11 w-full cursor-not-allowed rounded-xl bg-red-600 font-bold text-white opacity-50 sm:w-auto sm:px-6">
            Simpan Penerimaan
          </button>
        </section>
        )}

        {activeTab === "bom" && (
        <section className={`${panelClass} space-y-4`}>
          <div>
            <p className="text-base font-extrabold text-zinc-900">Formula BOM (Resep)</p>
            <p className="mt-1 text-xs text-zinc-500">Kebutuhan material untuk setiap produk.</p>
          </div>
          <EmptyTable
            columns={["Produk", "Bahan Material", "Kebutuhan", "Satuan"]}
            message="Formula BOM belum tersedia."
          />
        </section>
        )}

        {activeTab === "stok" && (
        <section className={`${panelClass} space-y-4`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-base font-extrabold text-zinc-900">Stok & Riwayat Data</p>
              <p className="mt-1 text-xs text-zinc-500">Pantau perubahan stok dan aktivitas produksi.</p>
            </div>
            <input
              type="search"
              aria-label="Cari riwayat"
              placeholder="Pencarian belum tersedia"
              disabled
              className="h-10 rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-sm text-zinc-500 sm:w-64"
            />
          </div>
          <EmptyTable
            columns={["Tanggal", "Barang", "Stok Awal", "Masuk", "Keluar", "Sisa", "Tujuan"]}
            message="Riwayat transaksi belum tersedia."
          />
        </section>
        )}
      </main>

      <nav
        aria-label="Navigasi produksi mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-red-600 bg-zinc-950 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:hidden"
      >
        <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            const mobileLabel = {
              produksi: "Produksi",
              material: "Bahan",
              bom: "BOM",
              stok: "Riwayat",
            }[tab.id];

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg py-1 transition-colors ${
                  active ? "font-extrabold text-red-500" : "font-medium text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <FontAwesomeIcon icon={tab.icon} className="text-lg" />
                <span>{mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default ProduksiHome;
