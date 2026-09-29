import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faXmark,
  faChevronDown,
  faArrowRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { clearAuth, getToken, getUser, isAdmin, logout } from "../api/auth";
import {
  NAV_MAIN,
  BARANG_PRODUKSI,
  MANAJEMEN,
  WAREHOUSE,
  NAV_INTEGRASI,
  NAV_MANAGEMENT,
} from "./admin/navigation";
import { NotificationCenter } from "./admin/NotificationCenter";
import logoUrl from "../assets/logo.png";

const topLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#00A8E8]",
    isActive
      ? "border-[#00A8E8] text-[#1E3A5F]"
      : "border-transparent text-[#6B7280] hover:border-slate-300 hover:text-[#1F2937]",
  ].join(" ");

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const inBarangProduksi = BARANG_PRODUKSI.children.some(
    (c) => location.pathname === c.to || location.pathname.startsWith(c.to + "/"),
  );
  const inManajemen = MANAJEMEN.children.some(
    (c) => location.pathname === c.to || location.pathname.startsWith(c.to + "/"),
  );
  const inWarehouse = WAREHOUSE.children.some(
    (c) => location.pathname === c.to || location.pathname.startsWith(c.to + "/"),
  );
  const inIntegrasi = NAV_INTEGRASI.children.some(
    (c) => location.pathname === c.to || location.pathname.startsWith(c.to + "/"),
  );

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/login", { replace: true });
      return;
    }
  }, [navigate]);

  // Tutup menu mobile tiap pindah route
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const user = getUser();
  const userName = user?.name ?? "Admin RSV";
  const userRoleLabel = user?.role === "admin" ? "Administrator" : (user?.role ?? "Administrator");
  const userInitials = user?.name ? initialsFromName(user.name) : "AD";

  const handleLogout = async () => {
    const token = getToken();
    if (token) {
      try {
        await logout(token);
      } catch {
        // Fail-open
      }
    }
    clearAuth();
    navigate("/login", { replace: true });
  };

  // Avoid flashing the full admin layout for non-admin before redirect
  if (!isAdmin()) return null;

  return (
    <div className="app-admin flex min-h-screen w-full flex-col bg-[#F5F7FA] font-sans text-[#1F2937] antialiased">
      {/* =====================================================
          TOP BAR — brand + user
      ===================================================== */}
      <div className="bg-[#1E3A5F] text-white">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logoUrl}
              alt="RSV Logo"
              className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5"
            />
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-none tracking-wide">
                RSV<span className="text-[#00A8E8]">.ADMIN</span>
              </h1>
              <p className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-wider text-slate-300 sm:block">
                Management System
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden text-right md:block">
              <p className="truncate text-sm font-semibold leading-none">{userName}</p>
              <p className="mt-0.5 text-[11px] leading-none text-slate-300">{userRoleLabel}</p>
            </div>
            <NotificationCenter />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
              {userInitials}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Keluar"
              aria-label="Keluar"
              className="rounded-lg p-2 text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
            >
              <FontAwesomeIcon icon={faArrowRightFromBracket} className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? "Tutup navigasi" : "Buka navigasi"}
              aria-expanded={mobileOpen}
              className="rounded-lg p-2 text-slate-200 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            >
              <FontAwesomeIcon icon={mobileOpen ? faXmark : faBars} className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          NAVBAR — ERP style horizontal
      ===================================================== */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          {/* Desktop */}
          <nav aria-label="Navigasi admin" className="hidden items-stretch gap-1 lg:flex">
            {NAV_MAIN.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={topLinkClass}>
                <FontAwesomeIcon icon={item.icon} className="h-4 w-4" fixedWidth />
                {item.label}
              </NavLink>
            ))}

            {/* Dropdown: Barang Produksi */}
            <div className="group relative flex items-stretch">
              <button
                type="button"
                aria-haspopup="true"
                className={[
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#00A8E8]",
                  inBarangProduksi
                    ? "border-[#00A8E8] text-[#1E3A5F]"
                    : "border-transparent text-[#6B7280] group-hover:border-slate-300 group-hover:text-[#1F2937]",
                ].join(" ")}
              >
                <FontAwesomeIcon icon={BARANG_PRODUKSI.icon} className="h-4 w-4" fixedWidth />
                {BARANG_PRODUKSI.label}
                <FontAwesomeIcon icon={faChevronDown} className="h-3 w-3 transition-transform group-hover:rotate-180" />
              </button>
              <div className="invisible absolute left-0 top-full z-40 w-60 translate-y-1 rounded-b-xl border border-slate-200 bg-white py-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                {BARANG_PRODUKSI.children.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    end={child.end}
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-[#1E3A5F]/5 font-semibold text-[#1E3A5F]"
                          : "text-[#4B5563] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
                      ].join(" ")
                    }
                  >
                    <FontAwesomeIcon icon={child.icon} className="h-4 w-4 shrink-0 text-[#6B7280]" fixedWidth />
                    {child.label}
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Dropdown: Manajemen */}
            <div className="group relative flex items-stretch">
              <button
                type="button"
                aria-haspopup="true"
                className={[
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#00A8E8]",
                  inManajemen
                    ? "border-[#00A8E8] text-[#1E3A5F]"
                    : "border-transparent text-[#6B7280] group-hover:border-slate-300 group-hover:text-[#1F2937]",
                ].join(" ")}
              >
                <FontAwesomeIcon icon={MANAJEMEN.icon} className="h-4 w-4" fixedWidth />
                {MANAJEMEN.label}
                <FontAwesomeIcon icon={faChevronDown} className="h-3 w-3 transition-transform group-hover:rotate-180" />
              </button>
              <div className="invisible absolute left-0 top-full z-40 w-60 translate-y-1 rounded-b-xl border border-slate-200 bg-white py-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                {MANAJEMEN.children.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    end={child.end}
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-[#1E3A5F]/5 font-semibold text-[#1E3A5F]"
                          : "text-[#4B5563] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
                      ].join(" ")
                    }
                  >
                    <FontAwesomeIcon icon={child.icon} className="h-4 w-4 shrink-0 text-[#6B7280]" fixedWidth />
                    {child.label}
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Dropdown: Warehouse (muncul setelah ada isi) */}
            {WAREHOUSE.children.length > 0 && (
              <div className="group relative flex items-stretch">
                <button
                  type="button"
                  aria-haspopup="true"
                  className={[
                    "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#00A8E8]",
                    inWarehouse
                      ? "border-[#00A8E8] text-[#1E3A5F]"
                      : "border-transparent text-[#6B7280] group-hover:border-slate-300 group-hover:text-[#1F2937]",
                  ].join(" ")}
                >
                  <FontAwesomeIcon icon={WAREHOUSE.icon} className="h-4 w-4" fixedWidth />
                  {WAREHOUSE.label}
                  <FontAwesomeIcon icon={faChevronDown} className="h-3 w-3 transition-transform group-hover:rotate-180" />
                </button>
                <div className="invisible absolute left-0 top-full z-40 w-60 translate-y-1 rounded-b-xl border border-slate-200 bg-white py-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                  {WAREHOUSE.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.end}
                      className={({ isActive }) =>
                        [
                          "flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
                          isActive
                            ? "bg-[#1E3A5F]/5 font-semibold text-[#1E3A5F]"
                            : "text-[#4B5563] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
                        ].join(" ")
                      }
                    >
                      <FontAwesomeIcon icon={child.icon} className="h-4 w-4 shrink-0 text-[#6B7280]" fixedWidth />
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}

            {/* Dropdown: Integrasi */}
            <div className="group relative flex items-stretch">
              <button
                type="button"
                aria-haspopup="true"
                className={[
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#00A8E8]",
                  inIntegrasi
                    ? "border-[#00A8E8] text-[#1E3A5F]"
                    : "border-transparent text-[#6B7280] group-hover:border-slate-300 group-hover:text-[#1F2937]",
                ].join(" ")}
              >
                <FontAwesomeIcon icon={NAV_INTEGRASI.icon} className="h-4 w-4" fixedWidth />
                {NAV_INTEGRASI.label}
                <FontAwesomeIcon icon={faChevronDown} className="h-3 w-3 transition-transform group-hover:rotate-180" />
              </button>
              <div className="invisible absolute left-0 top-full z-40 w-60 translate-y-1 rounded-b-xl border border-slate-200 bg-white py-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                {NAV_INTEGRASI.children.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    end={child.end}
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-[#1E3A5F]/5 font-semibold text-[#1E3A5F]"
                          : "text-[#4B5563] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
                      ].join(" ")
                    }
                  >
                    <FontAwesomeIcon icon={child.icon} className="h-4 w-4 shrink-0 text-[#6B7280]" fixedWidth />
                    {child.label}
                  </NavLink>
                ))}
              </div>
            </div>

            {NAV_MANAGEMENT.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={topLinkClass}>
                <FontAwesomeIcon icon={item.icon} className="h-4 w-4" fixedWidth />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile */}
          {mobileOpen && (
            <nav aria-label="Navigasi admin mobile" className="space-y-1 py-3 lg:hidden">
              {NAV_MAIN.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      isActive
                        ? "bg-[#1E3A5F]/5 text-[#1E3A5F]"
                        : "text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
                    ].join(" ")
                  }
                >
                  <FontAwesomeIcon icon={item.icon} className="h-4 w-4" fixedWidth />
                  {item.label}
                </NavLink>
              ))}

              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                {BARANG_PRODUKSI.label}
              </p>
              {BARANG_PRODUKSI.children.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  end={child.end}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      isActive
                        ? "bg-[#1E3A5F]/5 text-[#1E3A5F]"
                        : "text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
                    ].join(" ")
                  }
                >
                  <FontAwesomeIcon icon={child.icon} className="h-4 w-4" fixedWidth />
                  {child.label}
                </NavLink>
              ))}

              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                {MANAJEMEN.label}
              </p>
              {MANAJEMEN.children.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  end={child.end}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      isActive
                        ? "bg-[#1E3A5F]/5 text-[#1E3A5F]"
                        : "text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
                    ].join(" ")
                  }
                >
                  <FontAwesomeIcon icon={child.icon} className="h-4 w-4" fixedWidth />
                  {child.label}
                </NavLink>
              ))}

              {WAREHOUSE.children.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    {WAREHOUSE.label}
                  </p>
                  {WAREHOUSE.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.end}
                      className={({ isActive }) =>
                        [
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                          isActive
                            ? "bg-[#1E3A5F]/5 text-[#1E3A5F]"
                            : "text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
                        ].join(" ")
                      }
                    >
                      <FontAwesomeIcon icon={child.icon} className="h-4 w-4" fixedWidth />
                      {child.label}
                    </NavLink>
                  ))}
                </>
              )}

              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                {NAV_INTEGRASI.label}
              </p>
              {NAV_INTEGRASI.children.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  end={child.end}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      isActive
                        ? "bg-[#1E3A5F]/5 text-[#1E3A5F]"
                        : "text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
                    ].join(" ")
                  }
                >
                  <FontAwesomeIcon icon={child.icon} className="h-4 w-4" fixedWidth />
                  {child.label}
                </NavLink>
              ))}

              {NAV_MANAGEMENT.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      isActive
                        ? "bg-[#1E3A5F]/5 text-[#1E3A5F]"
                        : "text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
                    ].join(" ")
                  }
                >
                  <FontAwesomeIcon icon={item.icon} className="h-4 w-4" fixedWidth />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 pb-8 pt-6 md:px-6 md:pt-8">
        <div className="w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
