import LaporanProduksiContent from "../../components/admin/LaporanProduksi/LaporanProduksiContent";

export default function LaporanProduksi() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#00A8E8]">Laporan</p>
          <h1 className="mt-1 text-xl font-extrabold text-[#1E3A5F] sm:text-2xl">Laporan Produksi</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Finished Goods, konsumsi material (theoretical vs actual), traceability unit, dan
            rekonsiliasi produksi. Unit FINISHGOOD ditentukan dari waktu pertama status FINISHGOOD,
            bukan status terkini.
          </p>
        </header>
        <LaporanProduksiContent />
      </div>
    </div>
  );
}
