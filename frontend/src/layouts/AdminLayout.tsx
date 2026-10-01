import { useEffect, useState } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faXmark,
  faChevronDown,
  faArrowRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

import {
  clearAuth,
  getToken,
  getUser,
  isAdmin,
  logout,
} from "../api/auth";

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

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "AD";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0][0] + parts[parts.length - 1][0]
  ).toUpperCase();
}

/* =========================================================
   DESKTOP NAV ITEM
========================================================= */

const navItemClass = ({
  isActive,
}: {
  isActive: boolean;
}) =>
  [
    "relative flex h-11 items-center gap-2.5 rounded-lg px-3.5 text-[13px] font-medium transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40",
    isActive
      ? "bg-[#1E3A5F]/[0.07] text-[#1E3A5F]"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  ].join(" ");

/* =========================================================
   DROPDOWN NAV BUTTON
========================================================= */

function dropdownButtonClass(isActive: boolean) {
  return [
    "relative flex h-11 items-center gap-2.5 rounded-lg px-3.5 text-[13px] font-medium transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40",
    isActive
      ? "bg-[#1E3A5F]/[0.07] text-[#1E3A5F]"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  ].join(" ");
}

/* =========================================================
   DROPDOWN
========================================================= */

function NavDropdown({
  item,
  active,
}: {
  item: any;
  active: boolean;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-haspopup="true"
        className={dropdownButtonClass(active)}
      >
        <FontAwesomeIcon
          icon={item.icon}
          className="h-4 w-4 shrink-0"
          fixedWidth
        />

        <span>{item.label}</span>

        <FontAwesomeIcon
          icon={faChevronDown}
          className="ml-0.5 h-3 w-3 text-slate-400 transition-transform duration-200 group-hover:rotate-180"
        />

        {active && (
          <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-[#00A8E8]" />
        )}
      </button>

      <div className="invisible absolute left-0 top-full z-50 w-[270px] translate-y-2 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.12)]">
          {/* Dropdown Header */}
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Menu
            </p>

            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {item.label}
            </p>
          </div>

          {/* Dropdown Items */}
          <div className="p-1.5">
            {item.children.map((child: any) => (
              <NavLink
                key={child.to}
                to={child.to}
                end={child.end}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                    isActive
                      ? "bg-[#1E3A5F]/[0.07] font-semibold text-[#1E3A5F]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  ].join(" ")
                }
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <FontAwesomeIcon
                    icon={child.icon}
                    className="h-3.5 w-3.5"
                    fixedWidth
                  />
                </span>

                <span className="min-w-0 flex-1 truncate">
                  {child.label}
                </span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MOBILE NAV ITEM
========================================================= */

function MobileNavItem({
  item,
}: {
  item: any;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-[#1E3A5F]/[0.07] text-[#1E3A5F]"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        ].join(" ")
      }
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <FontAwesomeIcon
          icon={item.icon}
          className="h-4 w-4"
          fixedWidth
        />
      </span>

      <span>{item.label}</span>
    </NavLink>
  );
}

/* =========================================================
   MOBILE GROUP
========================================================= */

function MobileGroup({
  label,
  children,
}: {
  label: string;
  children: any[];
}) {
  return (
    <div className="space-y-1">
      <div className="px-3 pb-1 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>
      </div>

      {children.map((child) => (
        <MobileNavItem
          key={child.to}
          item={child}
        />
      ))}
    </div>
  );
}

/* =========================================================
   ADMIN LAYOUT
========================================================= */

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);

  const inBarangProduksi =
    BARANG_PRODUKSI.children.some(
      (c) =>
        location.pathname === c.to ||
        location.pathname.startsWith(c.to + "/")
    );

  const inManajemen =
    MANAJEMEN.children.some(
      (c) =>
        location.pathname === c.to ||
        location.pathname.startsWith(c.to + "/")
    );

  const inWarehouse =
    WAREHOUSE.children.some(
      (c) =>
        location.pathname === c.to ||
        location.pathname.startsWith(c.to + "/")
    );

  const inIntegrasi =
    NAV_INTEGRASI.children.some(
      (c) =>
        location.pathname === c.to ||
        location.pathname.startsWith(c.to + "/")
    );

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/login", {
        replace: true,
      });

      return;
    }
  }, [navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const user = getUser();

  const userName =
    user?.name ?? "Admin RSV";

  const userRoleLabel =
    user?.role === "admin"
      ? "Administrator"
      : user?.role ?? "Administrator";

  const userInitials = user?.name
    ? initialsFromName(user.name)
    : "AD";

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

    navigate("/login", {
      replace: true,
    });
  };

  if (!isAdmin()) return null;

  return (
    <div className="app-admin flex min-h-screen w-full flex-col bg-[#F6F8FB] font-sans text-slate-800 antialiased">
      {/* =====================================================
          TOP HEADER
      ====================================================== */}
      <header className="sticky top-0 z-50 border-b border-slate-800/20 bg-[#172F4F] text-white shadow-sm">
        <div className="flex h-[60px] w-full items-center justify-between px-4 sm:px-5 lg:px-7">
          {/* Brand */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
              <img
                src={logoUrl}
                alt="RSV Logo"
                className="h-full w-full object-contain p-0.5"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center">
                <h1 className="text-[15px] font-bold tracking-wide">
                  RSV
                  <span className="text-[#00A8E8]">
                    .ADMIN
                  </span>
                </h1>
              </div>

              <p className="mt-0.5 hidden text-[9px] font-medium uppercase tracking-[0.14em] text-slate-300 sm:block">
                Management System
              </p>
            </div>
          </div>

          {/* User Area */}
          <div className="flex shrink-0 items-center">
            {/* User Info */}
            <div className="mr-3 hidden border-r border-white/10 pr-4 text-right sm:block">
              <p className="max-w-[180px] truncate text-xs font-semibold text-white">
                {userName}
              </p>

              <p className="mt-0.5 text-[10px] text-slate-300">
                {userRoleLabel}
              </p>
            </div>

            {/* Notification */}
            <div className="mr-1">
              <NotificationCenter />
            </div>

            {/* Avatar */}
            <div className="ml-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[11px] font-bold text-white">
              {userInitials}
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              title="Keluar"
              aria-label="Keluar"
              className="ml-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/60"
            >
              <FontAwesomeIcon
                icon={faArrowRightFromBracket}
                className="h-4 w-4"
              />
            </button>

            {/* Mobile Toggle */}
            <button
              type="button"
              onClick={() =>
                setMobileOpen((o) => !o)
              }
              aria-label={
                mobileOpen
                  ? "Tutup navigasi"
                  : "Buka navigasi"
              }
              aria-expanded={mobileOpen}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/60 lg:hidden"
            >
              <FontAwesomeIcon
                icon={
                  mobileOpen
                    ? faXmark
                    : faBars
                }
                className="h-5 w-5"
              />
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================
          DESKTOP NAVIGATION
      ====================================================== */}
      <nav
        aria-label="Navigasi admin"
        className="sticky top-[60px] z-40 hidden border-b border-slate-200 bg-white lg:block"
      >
        <div className="flex min-h-[54px] w-full items-center px-5 xl:px-7">
          <div className="flex items-center gap-1">
            {/* Main */}
            {NAV_MAIN.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navItemClass}
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className="h-4 w-4"
                  fixedWidth
                />

                <span>{item.label}</span>
              </NavLink>
            ))}

            {/* Barang Produksi */}
            <NavDropdown
              item={BARANG_PRODUKSI}
              active={inBarangProduksi}
            />

            {/* Manajemen */}
            <NavDropdown
              item={MANAJEMEN}
              active={inManajemen}
            />

            {/* Warehouse */}
            {WAREHOUSE.children.length > 0 && (
              <NavDropdown
                item={WAREHOUSE}
                active={inWarehouse}
              />
            )}

            {/* Integrasi */}
            <NavDropdown
              item={NAV_INTEGRASI}
              active={inIntegrasi}
            />

            {/* Management */}
            {NAV_MANAGEMENT.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navItemClass}
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className="h-4 w-4"
                  fixedWidth
                />

                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* =====================================================
          MOBILE NAVIGATION
      ====================================================== */}
      {mobileOpen && (
        <div className="fixed inset-x-0 top-[60px] z-40 border-b border-slate-200 bg-white shadow-xl lg:hidden">
          <div className="max-h-[calc(100vh-60px)] overflow-y-auto p-3">
            <div className="space-y-1">
              {NAV_MAIN.map((item) => (
                <MobileNavItem
                  key={item.to}
                  item={item}
                />
              ))}
            </div>

            <MobileGroup
              label={BARANG_PRODUKSI.label}
              children={BARANG_PRODUKSI.children}
            />

            <MobileGroup
              label={MANAJEMEN.label}
              children={MANAJEMEN.children}
            />

            {WAREHOUSE.children.length > 0 && (
              <MobileGroup
                label={WAREHOUSE.label}
                children={WAREHOUSE.children}
              />
            )}

            <MobileGroup
              label={NAV_INTEGRASI.label}
              children={NAV_INTEGRASI.children}
            />

            <MobileGroup
              label="Lainnya"
              children={NAV_MANAGEMENT}
            />
          </div>
        </div>
      )}

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}
      <main className="min-w-0 flex-1 px-4 pb-8 pt-5 sm:px-5 md:px-6 md:pt-6 xl:px-7">
        <div className="mx-auto w-full max-w-[1600px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
