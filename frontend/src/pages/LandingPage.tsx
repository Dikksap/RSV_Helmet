import { Link } from "react-router-dom";
import logoUrl from "../assets/logo.png";

const MODULES = [
  {
    title: "Cetak Label",
    desc: "Cetak QR & hangtag barang",
    to: "/cetak-label",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 9V4h12v5" />
        <rect x="6" y="11" width="12" height="8" rx="1" />
        <path d="M6 14H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
      </svg>
    ),
  },
  {
    title: "Scan Barang",
    desc: "Entry & update status stok",
    to: "/scan-qr",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM17 17h4M14 20h4M17 20h4" />
      </svg>
    ),
  },
  {
    title: "Inventaris",
    desc: "Kelola data barang",
    to: "/admin/barang",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    title: "Dashboard",
    desc: "Pantau stok & aktivitas",
    to: "/admin/dashboard",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
];

function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FA] font-[Inter,sans-serif] text-[#1F2937] antialiased">
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-12 md:px-12 md:py-16">
        <div className="max-w-2xl">
          <h1 className="text-[32px] font-bold leading-[1.2] text-[#1E3A5F] md:text-5xl">
            Sistem Inventaris RSV Helmet
          </h1>
          <p className="mt-3 text-base leading-[1.6] text-[#6B7280] md:text-lg">
            Pilih modul untuk mulai bekerja.
          </p>
        </div>

        <nav aria-label="Modul utama" className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <Link
              key={m.title}
              to={m.to}
              className="group rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1E3A5F]/5 text-[#1E3A5F] transition-colors duration-200 group-hover:bg-[#00A8E8] group-hover:text-white">
                {m.icon}
              </div>
              <h2 className="mt-4 text-xl font-semibold leading-[1.4]">{m.title}</h2>
              <p className="mt-1 text-[15px] text-[#6B7280]">{m.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#00A8E8]">
                Buka <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </nav>
      </main>

      <footer className="bg-[#0F1C2E] text-slate-400">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 px-6 py-6 text-sm md:flex-row md:px-12">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo RSV Helmet" className="h-7 w-7 object-contain brightness-0 invert" />
            <span className="font-bold text-white">RSV HELMET</span>
          </div>
          <a href="mailto:info@rsvhelmet.com" className="transition-colors duration-200 hover:text-white">
            info@rsvhelmet.com
          </a>
          <p className="text-[13px] text-slate-500">© {year} RSV Helmet</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
