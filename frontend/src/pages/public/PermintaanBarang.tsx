const URL_BARU = "https://wh.rsv-manufacture.site/permintaan-barang";

function PermintaanBarang() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-800">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg shadow-slate-200">
        <h1 className="text-lg font-black tracking-tight text-slate-900">
          RSV<span className="text-[#E30613]">HELMET</span>
        </h1>
        <p className="mt-4 text-sm font-medium leading-relaxed text-slate-600">
          Form Permintaan Barang ini telah beralih.
        </p>
        <a
          href={URL_BARU}
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#E30613] px-6 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-red-600/25 transition hover:bg-[#c00510]"
        >
          Klik di sini
        </a>
        <p className="mt-4 break-all text-xs text-slate-400">{URL_BARU}</p>
      </div>
    </div>
  );
}

export default PermintaanBarang;
