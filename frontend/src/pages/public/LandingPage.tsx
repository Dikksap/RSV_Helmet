import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoUrl from "../../assets/logo.svg";
import { checkSession, clearAuth, getToken, getUser, isAdmin, isAuthenticated, logout } from "../../api/auth";
import { useStatusOptions } from "../../lib/useStatusOptions";

type Module = { title: string; desc: string; to: string; icon: ReactNode };

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]";

const icon = (d: ReactNode) => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const QR_ICON = icon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM17 17h4M14 20h4M17 20h4" />
  </>,
);

const OPERATOR_MODULES: Module[] = [
  {
    title: "Cetak Label",
    desc: "Cetak QR & hangtag barang",
    to: "/cetak-label",
    icon: icon(
      <>
        <path d="M6 9V4h12v5" />
        <rect x="6" y="11" width="12" height="8" rx="1" />
        <path d="M6 14H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
      </>,
    ),
  },
  {
    title: "Permintaan Barang",
    desc: "Ajukan kebutuhan barang",
    to: "/permintaan-barang",
    icon: icon(<path d="M9 12h6m-6 4h6M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />),
  },
];

const ADMIN_MODULES: Module[] = [
  {
    title: "Inventaris",
    desc: "Kelola data barang",
    to: "/admin/barang",
    icon: icon(<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />),
  },
  {
    title: "Dashboard",
    desc: "Pantau stok & aktivitas",
    to: "/admin/home",
    icon: icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />),
  },
];

const LOCK_ICON = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
  </svg>
);

function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onEscape();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "AD";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function ModuleItem({ m, locked }: { m: Module; locked: boolean }) {
  return (
    <Link
      to={locked ? "/login" : m.to}
      title={locked ? "Butuh login admin" : undefined}
      className={`group flex items-center gap-3 rounded-xl border border-[#E5E9F0] bg-white p-3.5 no-underline shadow-[0_1px_2px_rgba(15,28,46,0.04)] transition-all duration-200 hover:border-[#00A8E8]/50 hover:shadow-[0_8px_24px_rgba(15,28,46,0.08)] sm:flex-col sm:items-start sm:gap-4 sm:p-5 sm:hover:-translate-y-0.5 ${FOCUS}`}
    >
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg transition-colors ${
          locked ? "bg-slate-100 text-[#94A3B8]" : "bg-[#00A8E8]/10 text-[#0088C0] group-hover:bg-[#00A8E8] group-hover:text-white"
        }`}
      >
        {m.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-semibold ${locked ? "text-[#64748B]" : "text-[#0F1C2E]"}`}>{m.title}</span>
        <span className="block truncate text-[13px] text-[#64748B]">{m.desc}</span>
      </span>
      <span className={`shrink-0 sm:hidden ${locked ? "text-[#94A3B8]" : "text-[#94A3B8] group-hover:text-[#0088C0]"}`}>
        {locked ? LOCK_ICON : <span aria-hidden="true" className="text-xl leading-none">›</span>}
      </span>
      {locked && (
        <span className="hidden items-center gap-1.5 text-xs font-medium text-[#64748B] sm:inline-flex">
          {LOCK_ICON}
          Login admin
        </span>
      )}
      {locked && <span className="sr-only"> — butuh login admin</span>}
    </Link>
  );
}

function ModuleGroup({ title, modules, locked }: { title: string; modules: Module[]; locked: boolean }) {
  return (
    <section aria-labelledby={`grp-${title}`}>
      <h2 id={`grp-${title}`} className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
        {title}
      </h2>
      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4">
        {modules.map((m) => (
          <ModuleItem key={m.title} m={m} locked={locked} />
        ))}
      </div>
    </section>
  );
}

function ScanSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"semua" | "dus">("semua");
  const { options, loading, error } = useStatusOptions();
  useEscape(true, onClose);

  const go = (status?: string) => {
    const q = new URLSearchParams();
    if (mode === "dus") q.set("mode", "dus");
    if (status) q.set("status", status);
    const qs = q.toString();
    navigate(qs ? `/scan-qr?${qs}` : "/scan-qr");
  };

  const optionCls = `flex w-full items-center gap-3 rounded-xl border border-[#E5E9F0] bg-white px-4 py-3 text-left transition hover:border-[#00A8E8] hover:bg-[#00A8E8]/5 ${FOCUS}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F1C2E]/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-sheet-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="px-5 pt-4 sm:px-6 sm:pt-6">
          <h2 id="scan-sheet-title" className="text-lg font-bold text-[#0F1C2E]">
            Scan Barang
          </h2>
          <p className="mt-0.5 text-sm text-[#64748B]">Pilih mode, lalu status tujuan.</p>

          <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Mode scan">
            {(["semua", "dus"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${FOCUS} ${
                  mode === m ? "bg-white text-[#1E3A5F] shadow-sm" : "text-[#64748B] hover:text-[#1E3A5F]"
                }`}
              >
                {m === "semua" ? "Semua Barang" : "Per Dus (8)"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex-1 space-y-2 overflow-y-auto px-5 sm:px-6">
          <button type="button" onClick={() => go()} className={optionCls}>
            <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-dashed border-[#94A3B8]" />
            <span className="flex-1">
              <span className="block text-[15px] font-semibold text-[#0F1C2E]">Tanpa status</span>
              <span className="block text-xs text-[#64748B]">Pilih status di halaman scan</span>
            </span>
          </button>
          {loading && <p className="animate-pulse py-2 text-sm text-[#64748B]">Memuat status...</p>}
          {error && (
            <p role="alert" className="py-2 text-sm text-[#EF4444]">
              {error}
            </p>
          )}
          {!loading &&
            options.map((o) => (
              <button key={o.value} type="button" onClick={() => go(o.value)} className={optionCls}>
                <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: o.warna ?? "#94A3B8" }} />
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold text-[#0F1C2E]">{o.label}</span>
                  <span className="block font-mono text-xs text-[#64748B]">{o.value}</span>
                </span>
              </button>
            ))}
        </div>

        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
          <button
            type="button"
            onClick={onClose}
            className={`w-full rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-[#475569] transition hover:bg-slate-200 ${FOCUS}`}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const [admin, setAdmin] = useState(() => isAuthenticated() && isAdmin());
  const [scanOpen, setScanOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const user = admin ? getUser() : null;
  const name = user?.name ?? "Admin";

  useEffect(() => {
    let cancelled = false;
    if (isAuthenticated()) {
      checkSession().then((valid) => {
        if (cancelled) return;
        if (!valid) clearAuth();
        setAdmin(valid && isAdmin());
      });
    }
    const onStorage = () => setAdmin(isAuthenticated() && isAdmin());
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEscape(menuOpen, () => setMenuOpen(false));

  const handleLogout = async () => {
    setMenuOpen(false);
    const token = getToken();
    if (token) await logout(token).catch(() => undefined);
    clearAuth();
    setAdmin(false);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#F6F8FB] font-[Inter,sans-serif] text-[#0F1C2E] antialiased">
      <header className="sticky top-0 z-40 border-b border-[#E5E9F0] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
          <Link to="/" className={`rounded-md ${FOCUS}`} aria-label="RSV Helmet — beranda">
            <img src={logoUrl} alt="RSV Helmet" className="h-8 w-auto sm:h-9" />
          </Link>

          {admin ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className={`flex items-center gap-2.5 rounded-full p-1 transition hover:bg-slate-100 sm:pr-3 ${FOCUS}`}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1E3A5F] text-xs font-bold text-white">
                  {initials(name)}
                </span>
                <span className="hidden max-w-[160px] truncate text-sm font-medium text-[#0F1C2E] sm:block">{name}</span>
                <svg className="hidden h-4 w-4 text-[#64748B] sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[#E5E9F0] bg-white py-1 shadow-[0_12px_32px_rgba(15,28,46,0.12)]"
                  >
                    <div className="border-b border-[#E5E9F0] px-4 py-3">
                      <p className="truncate text-sm font-semibold text-[#0F1C2E]">{name}</p>
                      <p className="flex items-center gap-1.5 text-xs text-[#64748B]">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                        Administrator
                      </p>
                    </div>
                    <Link
                      to="/admin/home"
                      role="menuitem"
                      className="block px-4 py-2.5 text-sm text-[#0F1C2E] no-underline hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                    >
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="block w-full px-4 py-2.5 text-left text-sm text-[#EF4444] hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className={`inline-flex h-9 items-center rounded-lg border border-[#E5E9F0] bg-white px-4 text-sm font-medium text-[#1E3A5F] no-underline transition hover:border-[#1E3A5F]/40 hover:bg-slate-50 ${FOCUS}`}
            >
              Login
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-5 sm:px-6 sm:py-8">
        <section className="relative overflow-hidden rounded-2xl bg-[#1E3A5F] p-5 text-white shadow-[0_8px_24px_rgba(30,58,95,0.25)] sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#00A8E8]/20" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/5" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-white/70">Halo,</p>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">{admin ? name : "Operator"}</h1>
              <p className="mt-2 max-w-md text-sm text-white/75">Scan barang, cetak label, dan ajukan permintaan dari satu tempat.</p>
            </div>
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-[#1E3A5F] shadow-sm transition hover:bg-[#E6F6FD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
            >
              {QR_ICON}
              Scan Barang
            </button>
          </div>
        </section>

        <ModuleGroup title="Operator" modules={OPERATOR_MODULES} locked={false} />
        <ModuleGroup title="Admin" modules={ADMIN_MODULES} locked={!admin} />
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-1 px-4 py-6 text-xs text-[#94A3B8] sm:flex-row sm:px-6">
        <p>© {new Date().getFullYear()} RSV Helmet · Sistem Inventaris</p>
        <a href="mailto:info@rsvhelmet.com" className={`rounded hover:text-[#1E3A5F] ${FOCUS}`}>
          info@rsvhelmet.com
        </a>
      </footer>

      {scanOpen && <ScanSheet onClose={() => setScanOpen(false)} />}
    </div>
  );
}

export default LandingPage;
