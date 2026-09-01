import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
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
    title: "Scan Barang",
    desc: "Input & update data barang instan via kamera atau input manual",
    to: "/scan-barang",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
        <rect x="8" y="8" width="8" height="8" rx="1.5" />
        <path d="M12 10v4M10 12h4" />
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
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
          {/* subtle grid + blur backdrop */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,0,0,0.04),_transparent_60%)]" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-zinc-100 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-zinc-100 blur-3xl" />

          <div className="relative grid grid-cols-1 lg:grid-cols-2">
            {/* Left copy */}
            <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Sistem Inventaris RSV Helmet — Live & Real-time
              </div>

              <h1 className="mt-5 text-3xl font-black leading-[0.95] tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.7rem]">
                REVOLUSI
                <br />
                <span className="text-zinc-500">PENGELOLAAN</span>
                <br />
                INVENTARIS HELMET
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-600 sm:text-base sm:leading-7">
                Optimal, cepat, dan akurat dengan{" "}
                <span className="font-bold text-zinc-900">RSV Helmet Management System</span>.
                Generate barang, cetak hangtag, hingga lacak stok — semua dalam satu alur.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/cetak_barang"
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98]"
                >
                  Buat Barang Baru
                  <span className="ml-2 text-base leading-none">→</span>
                </Link>
                <Link
                  to="/scan-qr"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-sm font-bold text-zinc-900 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.98]"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h3v3h-3zM17 17h4M17 20h4M14 20h2" />
                  </svg>
                  Mulai Scan QR
                </Link>
              </div>

              <div className="mt-8 flex items-center gap-4 border-t border-zinc-100 pt-6">
                <div className="flex -space-x-2">
                  <img src="https://i.pravatar.cc/100?img=11" alt="" className="h-8 w-8 rounded-full border-2 border-white object-cover" />
                  <img src="https://i.pravatar.cc/100?img=12" alt="" className="h-8 w-8 rounded-full border-2 border-white object-cover" />
                  <img src="https://i.pravatar.cc/100?img=13" alt="" className="h-8 w-8 rounded-full border-2 border-white object-cover" />
                </div>
                <div className="text-xs leading-4">
                  <p className="font-bold text-zinc-900">Dipercaya tim operasional</p>
                  <p className="text-zinc-500">Generate & cetak ribuan barang per hari</p>
                </div>
                <div className="ml-auto hidden items-center gap-2 text-xs font-semibold text-zinc-700 sm:flex">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-200">99.9% akurat</span>
                </div>
              </div>
            </div>

            {/* Right visual */}
            <div className="relative flex items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-100 px-6 py-8 sm:px-8 lg:px-10">
              {/* floating labels */}
              <div className="pointer-events-none absolute left-6 top-8 hidden rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm sm:flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> QR Generated
              </div>
              <div className="pointer-events-none absolute bottom-8 right-6 hidden rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm sm:flex items-center gap-2">
                Thermal Print Ready →
              </div>

              <div className="relative flex w-full max-w-lg items-center justify-center">
                {/* Phone mock */}
                <div className="relative z-10 w-48 shrink-0 sm:w-56">
                  <div className="rounded-[2.5rem] border-[5px] border-zinc-900 bg-zinc-900 p-2 shadow-2xl transition hover:rotate-0 duration-300 -rotate-3">
                    <div className="rounded-[2rem] bg-zinc-50">
                      <div className="flex justify-center pt-2">
                        <div className="h-1.5 w-16 rounded-full bg-zinc-900" />
                      </div>
                      <div className="px-3 pb-3 pt-3">
                        <div className="flex items-center justify-center gap-1 border-b border-zinc-200 pb-3">
                          <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[9px] font-black text-white">RSV</span>
                          <span className="text-xs font-bold text-zinc-900">Apps</span>
                          <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" />
                        </div>
                        <div className="mt-4 space-y-2">
                          <Link
                            to="/login"
                            className="flex w-full items-center justify-center rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white shadow-sm"
                          >
                            Login Operator
                          </Link>
                          <div className="space-y-1.5">
                            {[
                              { label: "Scan Barang", sub: "Kamera siap" },
                              { label: "Cetak Stiker", sub: "50×50mm" },
                              { label: "Histori Lacak", sub: "Realtime" },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2.5"
                              >
                                <div>
                                  <p className="text-xs font-semibold text-zinc-900">{item.label}</p>
                                  <p className="text-[10px] text-zinc-500">{item.sub}</p>
                                </div>
                                <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-900 text-white">›</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Helmet */}
                <div className="-ml-14 w-64 shrink-0 sm:-ml-16 sm:w-72 drop-shadow-2xl transition duration-300 hover:scale-[1.02]">
                  <svg viewBox="0 0 320 320" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="carbonGrad" x1="60" y1="50" x2="260" y2="270" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#3f3f46" />
                        <stop offset="40%" stopColor="#18181b" />
                        <stop offset="100%" stopColor="#09090b" />
                      </linearGradient>
                      <linearGradient id="visorGrad" x1="100" y1="100" x2="240" y2="210" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#52525b" stopOpacity="0.95" />
                        <stop offset="50%" stopColor="#09090b" stopOpacity="0.98" />
                        <stop offset="100%" stopColor="#27272a" stopOpacity="0.95" />
                      </linearGradient>
                      <pattern id="patternCarbon" width="8" height="8" patternUnits="userSpaceOnUse">
                        <rect width="4" height="4" fill="#000" fillOpacity="0.35" />
                        <rect x="4" y="4" width="4" height="4" fill="#000" fillOpacity="0.35" />
                        <rect x="4" width="4" height="4" fill="#fff" fillOpacity="0.05" />
                        <rect y="4" width="4" height="4" fill="#fff" fillOpacity="0.05" />
                      </pattern>
                    </defs>
                    <ellipse cx="160" cy="290" rx="110" ry="16" fill="black" fillOpacity="0.2" />
                    <path
                      d="M160 38C90 38 50 98 45 177C42 218 57 258 95 270C130 280 220 280 255 263C285 248 295 193 285 138C270 68 230 38 160 38Z"
                      fill="url(#carbonGrad)"
                      stroke="#18181b"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M160 38C90 38 50 98 45 177C42 218 57 258 95 270C130 280 220 280 255 263C285 248 295 193 285 138C270 68 230 38 160 38Z"
                      fill="url(#patternCarbon)"
                      fillOpacity="0.35"
                    />
                    <path
                      d="M70 178C90 198 130 213 170 213C220 213 260 188 270 168"
                      stroke="#a1a1aa"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      opacity="0.5"
                    />
                    <path
                      d="M90 248C130 260 190 260 230 246"
                      stroke="#e4e4e7"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      opacity="0.3"
                    />
                    <path
                      d="M75 122C70 157 75 192 95 202C125 215 200 215 245 192C260 182 265 147 255 117C240 97 180 88 130 92C95 95 80 107 75 122Z"
                      fill="url(#visorGrad)"
                      stroke="#18181b"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M88 128C87 148 91 177 104 187C108 168 118 128 144 108C120 110 99 118 88 128Z"
                      fill="white"
                      fillOpacity="0.22"
                    />
                    <path d="M125 233L145 226H175L195 233L180 253H140L125 233Z" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
                    <circle cx="160" cy="240" r="3" fill="#e4e4e7" />
                    <ellipse cx="160" cy="76" rx="18" ry="9" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
                    <text
                      x="160"
                      y="80"
                      fontFamily="Inter, sans-serif"
                      fontWeight="900"
                      fontSize="7"
                      fill="#fafafa"
                      textAnchor="middle"
                      letterSpacing="0.8"
                    >
                      RSV
                    </text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Fitur Utama</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl">Sistem yang menyatu, alur yang mulus</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Empat pilar untuk mengelola helm dari gudang hingga pelanggan — tanpa hambatan.</p>
            </div>
            <Link
              to="/admin/dashboard"
              className="hidden items-center gap-2 text-sm font-semibold text-zinc-900 hover:text-zinc-600 sm:inline-flex"
            >
              Lihat dashboard <span>→</span>
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Link
                key={f.title}
                to={f.to}
                className="group relative flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-900 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm transition group-hover:scale-105">
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">{f.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{f.desc}</p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-zinc-900">
                  Buka <span className="transition group-hover:translate-x-1">→</span>
                </span>
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
