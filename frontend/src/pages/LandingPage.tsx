import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import logoUrl from "../assets/logo.svg";
import helmUrl from "../assets/gambar_helm.svg";
import { isAdmin, isAuthenticated } from "../api/auth";

type Module = {
  title: string;
  desc: string;
  to: string;
  icon: ReactNode;
};

const PUBLIC_MODULES: Module[] = [
  {
    title: "Cetak Label",
    desc: "Cetak QR & hangtag barang",
    to: "/cetak-label",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
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
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM17 17h4M14 20h4M17 20h4" />
      </svg>
    ),
  },
];

const ADMIN_MODULES: Module[] = [
  {
    title: "Inventaris",
    desc: "Kelola data barang",
    to: "/admin/barang",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    title: "Dashboard",
    desc: "Pantau stok & aktivitas",
    to: "/admin/dashboard",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path strokeLinecap="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
];

const CARD_BASE =
  "group relative flex flex-col rounded-xl p-6 no-underline text-left transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]";
const CARD_OPEN =
  "border border-white/70 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(15,28,46,0.14)]";
const CARD_LOCKED =
  "border border-[#E5E7EB] bg-[#F5F7FA] shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(15,28,46,0.10)]";

function ModuleCard({ m, locked }: { m: Module; locked: boolean }) {
  return (
    <Link
      to={locked ? "/login" : m.to}
      title={locked ? "Butuh login admin" : undefined}
      className={`${CARD_BASE} ${locked ? CARD_LOCKED : CARD_OPEN}`}
    >
      <span
        className={`mb-5 grid h-11 w-11 place-items-center rounded-lg transition-colors duration-200 ${
          locked
            ? "bg-white text-[#6B7280] shadow-sm"
            : "bg-[#00A8E8]/10 text-[#0088C0] group-hover:bg-[#00A8E8] group-hover:text-white"
        }`}
      >
        {m.icon}
      </span>

      <h3 className={`text-[18px] font-semibold leading-[1.4] ${locked ? "text-[#1F2937]" : "text-[#1E3A5F]"}`}>
        {m.title}
      </h3>
      <p className="mt-1 flex-1 text-sm leading-[1.5] text-[#6B7280]">{m.desc}</p>

      <span
        className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium ${
          locked ? "text-[#6B7280]" : "text-[#1E3A5F]"
        }`}
      >
        {locked ? (
          <>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
            </svg>
            Akses admin
            <span className="sr-only"> — butuh login admin</span>
          </>
        ) : (
          <>
            Buka modul
            <span aria-hidden="true" className="text-[#0088C0] transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </>
        )}
      </span>
    </Link>
  );
}

function LandingPage() {
  const year = new Date().getFullYear();
  const [admin, setAdmin] = useState(() => isAuthenticated() && isAdmin());

  useEffect(() => {
    const id = window.setInterval(() => setAdmin(isAuthenticated() && isAdmin()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-transparent font-[Inter,sans-serif] text-[#1F2937] antialiased">
      <header className="sticky top-0 z-40 border-b border-white/50 bg-white/70 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6 md:h-[72px] md:px-12">
          <Link
            to="/"
            className="inline-flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00A8E8]"
            aria-label="RSV Helmet — beranda"
          >
            <img src={logoUrl} alt="RSV Helmet" className="h-9 w-auto md:h-10" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-[13px] font-medium text-[#6B7280] shadow-sm sm:inline-flex">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${admin ? "bg-[#10B981]" : "bg-[#00A8E8]"}`}
              />
              {admin ? "Admin" : "Operator"}
            </span>
            <Link
              to={admin ? "/admin/dashboard" : "/login"}
              className={`inline-flex h-11 items-center justify-center rounded-lg px-5 text-[15px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8] ${
                admin
                  ? "bg-[#00A8E8] text-white shadow-sm hover:bg-[#0088C0]"
                  : "border-2 border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F]/8"
              }`}
            >
              {admin ? "Dashboard" : "Login Admin"}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 md:px-12">
        <section className="grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[1fr_auto] lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#1E3A5F]/15 bg-white/70 px-3 py-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#1E3A5F] shadow-sm">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#00A8E8]" />
              Sistem Inventaris
            </span>
            <h1 className="mt-4 text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] md:text-[48px]">
              RSV Helmet
              <br />
              Produksi &amp; Stok Terpusat
            </h1>
            <p className="mt-4 max-w-xl text-base leading-[1.6] text-[#6B7280] md:text-lg">
              Pilih modul untuk mulai bekerja. Cetak hangtag, scan QR, dan pantau stok real-time dalam satu
              platform.
            </p>
          </div>

          <div className="relative hidden justify-self-end lg:block">
            <div
              aria-hidden="true"
              className="absolute -inset-10 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(0,168,232,0.16),transparent_65%)]"
            />
            <img
              src={helmUrl}
              alt=""
              aria-hidden="true"
              className="relative w-[340px] opacity-90 drop-shadow-[0_20px_36px_rgba(15,28,46,0.18)]"
            />
          </div>
        </section>

        <section className="pb-14 md:pb-20">
          <div className="mb-4 flex items-baseline justify-between gap-4 border-t border-[#1E3A5F]/10 pt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#1E3A5F]">Modul</h2>
            <p className="text-[13px] text-[#6B7280]">
              {admin ? "4 modul tersedia" : "2 modul terbuka · 2 butuh login"}
            </p>
          </div>

          <nav aria-label="Modul utama" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PUBLIC_MODULES.map((m) => (
              <ModuleCard key={m.title} m={m} locked={false} />
            ))}
            {ADMIN_MODULES.map((m) => (
              <ModuleCard key={m.title} m={m} locked={!admin} />
            ))}
          </nav>
        </section>
      </main>

      <footer className="mt-auto bg-[#0F1C2E]">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-6 py-5 text-[13px] md:flex-row md:px-12">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="RSV Helmet" className="h-5 w-auto brightness-0 invert" />
            <span className="text-slate-400">Sistem Inventaris</span>
          </div>
          <a
            href="mailto:info@rsvhelmet.com"
            className="rounded text-slate-400 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]"
          >
            info@rsvhelmet.com
          </a>
          <p className="text-slate-400">© {year} RSV Helmet</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
