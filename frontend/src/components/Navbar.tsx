import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logoUrl from "../assets/logo.png";
import {
  isAuthenticated,
  clearAuth,
  logout,
  getToken,
  isAdmin,
} from "../api/auth";

type NavItem = {
  to: string;
  label: string;
  end: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
};

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const navLinksRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const id = setInterval(() => setAuthenticated(isAuthenticated()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => {
    const token = getToken();
    if (token) {
      try {
        await logout(token);
      } catch {
        // Fail-open: logout tetap berjalan meskipun API gagal
      }
    }
    clearAuth();
    setAuthenticated(false);
    navigate("/login");
  };

  const closeMenu = () => setIsOpen(false);
  const toggleMenu = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeMenu();
        hamburgerRef.current?.focus();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        navLinksRef.current &&
        !navLinksRef.current.contains(e.target as Node) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // icons — subtle, professional stroke 1.6
  const icHome = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-5H9v5H4a1 1 0 0 1-1-1V9.5Z" />
    </svg>
  );
  const icGenerate = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 8h3v8H7zM14 8h3v5h-3z" />
    </svg>
  );
  const icScan = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x="8" y="8" width="8" height="8" rx="1.3" />
    </svg>
  );
  const icPrinter = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M6 9V4h12v5" />
      <rect x="6" y="11" width="12" height="8" rx="1" />
      <path d="M6 14H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
    </svg>
  );
  const icQr = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM17 17h4M14 20h4M17 20h4" />
    </svg>
  );

  const NAV_ITEMS: NavItem[] = [
    { to: "/", label: "Home", end: true, icon: icHome },
    { to: "/cetak_barang", label: "Generate", end: false, icon: icGenerate },
    { to: "/scan-barang", label: "Scan", end: false, icon: icScan },
    { to: "/print_manager", label: "Printer", end: false, icon: icPrinter },
    { to: "/scan-qr", label: "Scan QR", end: false, icon: icQr },
  ];

  const adminItem: NavItem | null =
    authenticated && isAdmin()
      ? { to: "/admin/dashboard", label: "Admin", end: false }
      : null;

  const linkBase =
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2";

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      linkBase,
      isActive
        ? "bg-zinc-900 text-white shadow-sm"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
    ].join(" ");

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
      <nav
        className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
        aria-label="Navigasi utama"
      >
        {/* Brand */}
        <NavLink
          to="/"
          aria-label="RSV Helmet - beranda"
          className="flex items-center gap-3 no-underline"
          onClick={closeMenu}
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 shadow-sm">
            <img src={logoUrl} alt="" aria-hidden="true" className="h-7 w-7 object-contain brightness-0 invert" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-black tracking-tight text-zinc-900 sm:text-base">
              RSV HELMET
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:block">
              Inventory System
            </span>
          </span>
        </NavLink>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              <span className="opacity-70">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Right actions */}
        <div className="hidden items-center gap-2 lg:flex">
          {adminItem && (
            <NavLink
              to={adminItem.to}
              className={({ isActive }) =>
                [
                  linkBase,
                  "border",
                  isActive
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
                ].join(" ")
              }
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Admin
            </NavLink>
          )}

          {!authenticated ? (
            <NavLink
              to="/login"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            >
              Masuk
            </NavLink>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                {(() => {
                  try {
                    const u = JSON.parse(localStorage.getItem("rsv_auth_user") || "null");
                    return (u?.name?.[0] || "U").toUpperCase();
                  } catch {
                    return "U";
                  }
                })()}
              </span>
              Keluar
            </button>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          ref={hamburgerRef}
          type="button"
          onClick={toggleMenu}
          aria-expanded={isOpen}
          aria-controls="nav-links"
          aria-label={isOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
          className="grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-900 shadow-sm transition hover:bg-zinc-50 active:scale-95 lg:hidden"
        >
          <span className="relative block h-4 w-4">
            <span
              className={`absolute left-0 top-0 block h-0.5 w-4 rounded-full bg-current transition-all ${isOpen ? "translate-y-1.5 rotate-45" : ""}`}
            />
            <span
              className={`absolute left-0 top-1.5 block h-0.5 w-4 rounded-full bg-current transition-opacity ${isOpen ? "opacity-0" : "opacity-100"}`}
            />
            <span
              className={`absolute left-0 top-3 block h-0.5 w-4 rounded-full bg-current transition-all ${isOpen ? "-translate-y-1.5 -rotate-45" : ""}`}
            />
          </span>
        </button>
      </nav>

      {/* Mobile panel */}
      <div
        ref={navLinksRef}
        id="nav-links"
        className={[
          "absolute inset-x-0 top-full z-30 origin-top border-b border-zinc-200 bg-white shadow-xl lg:hidden",
          "transition-all duration-200 ease-out",
          isOpen
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-2 opacity-0",
        ].join(" ")}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="grid gap-1">
            <p className="px-2 pb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Menu</p>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeMenu}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition",
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
                  ].join(" ")
                }
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-100 text-zinc-700 group-[.bg-zinc-900]:bg-white/10">
                  {item.icon}
                </span>
                {item.label}
                <span className="ml-auto text-zinc-400">›</span>
              </NavLink>
            ))}
          </div>

          <div className="mt-4 grid gap-2 border-t border-zinc-100 pt-4">
            {adminItem && (
              <NavLink
                to={adminItem.to}
                onClick={closeMenu}
                className={({ isActive }) =>
                  [
                    "flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold transition",
                    isActive
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-zinc-50 text-zinc-900 hover:bg-white",
                  ].join(" ")
                }
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Dashboard Admin
                </span>
                <span>›</span>
              </NavLink>
            )}

            {!authenticated ? (
              <NavLink
                to="/login"
                onClick={closeMenu}
                className="flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-zinc-800"
              >
                Masuk ke Akun
              </NavLink>
            ) : (
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  handleLogout();
                }}
                className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 hover:bg-zinc-50"
              >
                Keluar
              </button>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-zinc-400">RSV Helmet Inventory • v1.0</p>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
