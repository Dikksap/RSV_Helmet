import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logoUrl from "../assets/logo.png";
import { isAdmin, isAuthenticated } from "../api/auth";

const PUBLIC_MODULES = [
  {
    title: "Cetak Label",
    desc: "Cetak QR & hangtag barang",
    to: "/cetak-label",
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
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
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM17 17h4M14 20h4M17 20h4" />
      </svg>
    ),
  },
];

const LOCKED_MODULES = [
  {
    title: "Inventaris",
    desc: "Kelola data barang",
    to: "/admin/barang",
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    title: "Dashboard",
    desc: "Pantau stok & aktivitas",
    to: "/admin/dashboard",
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path strokeLinecap="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
];

function LockBadge() {
  return (
    <svg className="absolute right-4 top-4 h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
    </svg>
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
    <div className="flex min-h-dvh flex-col bg-transparent font-[Inter,sans-serif] text-slate-800 antialiased">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="RSV Helmet" className="h-8 w-8 object-contain" />
          <span className="text-sm font-bold tracking-tight text-slate-900">RSV HELMET</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Status: {admin ? "Admin" : "Operator"}</span>
          <Link
            to={admin ? "/admin/dashboard" : "/login"}
            className="rounded-full border border-blue-600 px-4 py-1 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-600 hover:text-white"
          >
            {admin ? "Dashboard" : "Login Admin"}
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 pb-12 md:px-6">
        <div className="mb-8 text-center md:text-left">
          <h2 className="mb-1 text-2xl font-bold text-slate-900 md:text-3xl">
            Sistem Inventaris RSV Helmet
          </h2>
          <p className="text-slate-500">Pilih modul untuk mulai bekerja.</p>
        </div>

        <nav aria-label="Modul utama" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PUBLIC_MODULES.map((m) => (
            <Link
              key={m.title}
              to={m.to}
              className="group block rounded-xl border-b-[3px] border-b-transparent bg-white p-6 text-slate-800 no-underline shadow-[0_4px_6px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-b-blue-600 hover:shadow-[0_10px_15px_rgba(0,0,0,0.10)]"
            >
              <div className="mb-4 text-slate-600 transition-colors group-hover:text-blue-600">
                {m.icon}
              </div>
              <h5 className="mb-1 font-bold">{m.title}</h5>
              <p className="mb-4 text-sm text-slate-500">{m.desc}</p>
              <span className="text-sm font-semibold text-blue-600">
                Buka <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}

          {LOCKED_MODULES.map((m) => (
            <Link
              key={m.title}
              to={admin ? m.to : "/login"}
              title={admin ? undefined : "Butuh login admin"}
              className={
                admin
                  ? "group block rounded-xl border-b-[3px] border-b-transparent bg-white p-6 text-slate-800 no-underline shadow-[0_4px_6px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-b-blue-600 hover:shadow-[0_10px_15px_rgba(0,0,0,0.10)]"
                  : "relative block cursor-pointer rounded-xl bg-slate-100 p-6 text-slate-800 no-underline opacity-70 shadow-[0_4px_6px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_15px_rgba(0,0,0,0.10)]"
              }
            >
              {!admin && <LockBadge />}
              <div className={`mb-4 ${admin ? "text-slate-600 transition-colors group-hover:text-blue-600" : "text-slate-600"}`}>{m.icon}</div>
              <h5 className={`mb-1 font-bold ${admin ? "" : "text-slate-500"}`}>{m.title}</h5>
              <p className="mb-4 text-sm text-slate-500">{m.desc}</p>
              {admin ? (
                <span className="text-sm font-semibold text-blue-600">
                  Buka <span aria-hidden="true">→</span>
                </span>
              ) : (
                <span className="text-sm font-semibold text-slate-500">Akses Admin</span>
              )}
            </Link>
          ))}
        </nav>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-[#0f172a] text-sm text-slate-300">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-3 text-center md:flex-row md:px-6 md:text-left">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Logo RSV Helmet" className="h-6 w-6 object-contain brightness-0 invert" />
            <span className="font-bold text-white">RSV HELMET</span>
          </div>
          <a href="mailto:info@rsvhelmet.com" className="hidden transition-colors hover:text-white md:block">
            info@rsvhelmet.com
          </a>
          <p className="text-[13px] text-slate-500">© {year} RSV Helmet</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
