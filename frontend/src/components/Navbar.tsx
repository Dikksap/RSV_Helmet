import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  isAuthenticated,
  clearAuth,
  logout,
  getToken,
  isAdmin,
} from "../api/auth";
import logoUrl from "../assets/logo.svg";

type NavItem = {
  to: string;
  label: string;
  end: boolean;
  icon?: React.ReactNode;
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

  const icHome = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-5H9v5H4a1 1 0 0 1-1-1V9.5Z" />
    </svg>
  );
  const icGenerate = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 8h3v8H7zM14 8h3v5h-3z" />
    </svg>
  );
  const icPrinter = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M6 9V4h12v5" />
      <rect x="6" y="11" width="12" height="8" rx="1" />
      <path d="M6 14H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
    </svg>
  );
  const icQr = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM17 17h4M14 20h4M17 20h4" />
    </svg>
  );

  const NAV_ITEMS: NavItem[] = [
    { to: "/", label: "Home", end: true, icon: icHome },
    { to: "/cetak_barang", label: "Generate", end: false, icon: icGenerate },
    { to: "/print_manager", label: "Printer", end: false, icon: icPrinter },
    { to: "/scan-qr", label: "Scan QR", end: false, icon: icQr },
  ];

  const showAdmin = authenticated && isAdmin();

  const desktopLink = ({ isActive }: { isActive: boolean }) =>
    [
      "inline-flex items-center gap-1.5 px-3 py-2 text-[15px] font-medium rounded-lg transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#00A8E8]",
      isActive ? "text-[#1E3A5F] bg-[#1E3A5F]/5" : "text-[#1F2937] hover:text-[#00A8E8]",
    ].join(" ");

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-slate-100 bg-white/95 backdrop-blur md:h-[72px]">
      <nav
        className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-6 md:px-12"
        aria-label="Navigasi utama"
      >
        {/* Logo kiri */}
        <NavLink
          to="/"
          aria-label="RSV Helmet - beranda"
          className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
          onClick={closeMenu}
        >
          <img src={logoUrl} alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
          <span className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight text-[#1E3A5F]">
              RSV HELMET
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7280] sm:block">
              Inventory System
            </span>
          </span>
        </NavLink>

        {/* Menu tengah/kanan */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={desktopLink}>
              <span className="opacity-70">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          {showAdmin && (
            <NavLink to="/admin/dashboard" className={desktopLink}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" aria-hidden="true" />
              Admin
            </NavLink>
          )}
        </div>

        {/* CTA kanan */}
        <div className="hidden items-center lg:flex">
          {!authenticated ? (
            <NavLink
              to="/login"
              className="rounded-lg bg-[#00A8E8] px-6 py-3 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#0088C0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]"
            >
              Hubungi Kami
            </NavLink>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border-2 border-[#1E3A5F] px-6 py-2.5 text-[15px] font-medium text-[#1E3A5F] transition-colors duration-200 hover:bg-[#1E3A5F] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"
            >
              Keluar
            </button>
          )}
        </div>

        {/* Hamburger mobile */}
        <button
          ref={hamburgerRef}
          type="button"
          onClick={toggleMenu}
          aria-expanded={isOpen}
          aria-controls="nav-links"
          aria-label={isOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
          className="rounded-lg p-2 text-[#1E3A5F] transition-colors duration-200 hover:bg-[#F5F7FA] focus-visible:outline-2 focus-visible:outline-[#00A8E8] lg:hidden"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {isOpen ? <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /> : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {/* Drawer mobile */}
      <div
        ref={navLinksRef}
        id="nav-links"
        className={[
          "absolute inset-x-0 top-full z-40 border-b border-slate-100 bg-white shadow-xl lg:hidden",
          "transition-all duration-200 ease-out",
          isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0",
        ].join(" ")}
      >
        <div className="mx-auto max-w-[1280px] px-6 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-colors duration-200",
                      isActive ? "bg-[#1E3A5F]/5 text-[#1E3A5F]" : "text-[#1F2937] hover:bg-[#F5F7FA]",
                    ].join(" ")
                  }
                >
                  <span className="opacity-70">{item.icon}</span>
                  {item.label}
                  <span className="ml-auto text-[#6B7280]" aria-hidden="true">›</span>
                </NavLink>
              </li>
            ))}
            {showAdmin && (
              <li>
                <NavLink
                  to="/admin/dashboard"
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-colors duration-200",
                      isActive ? "bg-[#1E3A5F]/5 text-[#1E3A5F]" : "text-[#1F2937] hover:bg-[#F5F7FA]",
                    ].join(" ")
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" aria-hidden="true" />
                  Admin
                  <span className="ml-auto text-[#6B7280]" aria-hidden="true">›</span>
                </NavLink>
              </li>
            )}
            <li className="pt-2">
              {!authenticated ? (
                <NavLink
                  to="/login"
                  onClick={closeMenu}
                  className="block rounded-lg bg-[#00A8E8] px-3 py-3 text-center text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#0088C0]"
                >
                  Hubungi Kami
                </NavLink>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    handleLogout();
                  }}
                  className="block w-full rounded-lg border-2 border-[#1E3A5F] px-3 py-3 text-center text-[15px] font-medium text-[#1E3A5F] transition-colors duration-200 hover:bg-[#1E3A5F] hover:text-white"
                >
                  Keluar
                </button>
              )}
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
