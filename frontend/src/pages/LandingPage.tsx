import { Link } from "react-router-dom";
import logoUrl from "../assets/logo.png";

const FEATURES = [
  {
    title: "Generate Barang",
    desc: "Generate Barcode & QR Code unik otomatis dalam satu klik",
    to: "/cetak_barang",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 8h3v8H7zM14 8h3v5h-3zM10 16h4" />
      </svg>
    ),
  },
  {
    title: "Printer Integration",
    desc: "Cetak hangtag otomatis ke printer thermal dengan ukuran presisi",
    to: "/print_manager",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 9V4h12v5" />
        <rect x="6" y="11" width="12" height="8" rx="1" />
        <circle cx="15" cy="15" r="1" fill="currentColor" />
        <path d="M6 14H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
      </svg>
    ),
  },
  {
    title: "Lacak Inventaris",
    desc: "Lacak lokasi & riwayat barang secara realtime di dashboard",
    to: "/admin/dashboard",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0" />
        <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0" />
        <path d="M12 7v2M12 15v2M7 12h2M15 12h2" />
      </svg>
    ),
  },
];

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 antialiased selection:bg-zinc-900 selection:text-white">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[2.5rem] border border-zinc-100 bg-white shadow-sm ring-1 ring-zinc-900/5">
          {/* subtle grid + blur backdrop */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,0,0,0.02),_transparent_60%)]" />

          <div className="relative grid grid-cols-1 lg:grid-cols-2">
            {/* Left copy */}
            <div className="flex flex-col justify-center px-8 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Sistem Operasional RSV Helmet
              </div>

              <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                Solusi Inventaris{" "}
                <span className="text-zinc-500">Modern</span>
                <br />
                untuk Produksi.
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-zinc-600">
                Tingkatkan efisiensi gudang dengan sistem terintegrasi. Generate barcode, cetak hangtag presisi, dan pantau stok secara *real-time* dalam satu platform.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  to="/cetak_barang"
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-zinc-950/20 transition hover:bg-zinc-800 active:scale-95"
                >
                  Mulai Sekarang
                </Link>
                <Link
                  to="/scan-qr"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-950 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-95"
                >
                  Scan Barang
                </Link>
              </div>
            </div>

            {/* Right visual - Simplified */}
            <div className="relative flex items-center justify-center bg-zinc-50 px-8 py-12 lg:bg-transparent">
              <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-tr from-zinc-100 to-transparent rounded-full opacity-50 blur-3xl"></div>
                <div className="relative font-mono text-xs text-zinc-400 p-8 border border-zinc-200 bg-white rounded-3xl shadow-xl w-64 rotate-3">
                  <div className="flex gap-2 items-center mb-4">
                     <div className="w-2 h-2 rounded-full bg-red-500"></div>
                     <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                     <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  </div>
                  <div className="space-y-2">
                    <p>Scanning Item...</p>
                    <p className="text-zinc-950 font-bold">ID: RSV-A01-BLK</p>
                    <p>Status: <span className="text-emerald-600 font-bold">Verified</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="mt-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-950">Kemudahan dalam Genggaman</h2>
              <p className="mt-2 text-sm text-zinc-600">Alat bantu operasional yang dirancang untuk kecepatan.</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Link
                key={f.title}
                to={f.to}
                className="group relative flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50 text-zinc-950 shadow-sm border border-zinc-100 transition group-hover:bg-zinc-950 group-hover:text-white">
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-950">{f.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{f.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* STATS / STEPS */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900">Alur Kerja 3 Langkah</h3>
              <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-bold text-white">Cepat & akurat</span>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { n: "01", t: "Generate", d: "Pilih varian, buat kode unik & QR" },
                { n: "02", t: "Cetak", d: "Kirim ke thermal printer presisi" },
                { n: "03", t: "Lacak", d: "Pantau status & lokasi realtime" },
              ].map((s) => (
                <div key={s.n} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-black tracking-widest text-zinc-400">{s.n}</p>
                  <p className="mt-1 text-sm font-bold text-zinc-900">{s.t}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{s.d}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-900 p-6 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Ringkasan Operasional</p>
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <p className="text-3xl font-black tracking-tight">10k+</p>
                <p className="mt-1 text-xs text-zinc-400">Barang tercatat</p>
              </div>
              <div>
                <p className="text-3xl font-black tracking-tight">4.9/5</p>
                <p className="mt-1 text-xs text-zinc-400">Kepuasan tim</p>
              </div>
              <div>
                <p className="text-3xl font-black tracking-tight">&lt;2s</p>
                <p className="mt-1 text-xs text-zinc-400">Generate per item</p>
              </div>
              <div>
                <p className="text-3xl font-black tracking-tight">24/7</p>
                <p className="mt-1 text-xs text-zinc-400">Monitor live view</p>
              </div>
            </div>
            <Link
              to="/live-view"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-zinc-900 transition hover:bg-zinc-100"
            >
              Buka Live View
            </Link>
          </div>
        </section>
      </main>

      <footer className="mt-12 border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 text-zinc-900">
            <img src={logoUrl} alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
            <span className="text-sm font-black tracking-tight">RSV HELMET</span>
          </Link>
          <p className="text-center font-medium">© 2024 RSV Helmet. All Rights Reserved.</p>
          <p className="font-medium">
            Email:{" "}
            <a href="mailto:info@rsvhelmet.com" className="font-semibold text-zinc-900 hover:underline">
              info@rsvhelmet.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
