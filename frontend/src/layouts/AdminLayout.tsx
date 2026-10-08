import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAnglesLeft,
  faAnglesRight,
  faArrowLeft,
  faArrowRightFromBracket,
  faBars,
  faChevronDown,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import { checkSession, clearAuth, getToken, getUser, isAdmin, logout } from "../api/auth";

import {
  BARANG_PRODUKSI,
  KARYAWAN,
  MANAJEMEN,
  NAV_INTEGRASI,
  NAV_MAIN,
  WAREHOUSE,
} from "./admin/navigation";

import { NotificationCenter } from "./admin/NotificationCenter";
import logoUrl from "../assets/logo.png";

type NavItem = (typeof NAV_MAIN)[number];

const NAV_GROUPS = [BARANG_PRODUKSI, MANAJEMEN, WAREHOUSE, KARYAWAN, NAV_INTEGRASI].filter(
  (g) => g.children.length > 0,
);

const ALL_ITEMS: NavItem[] = [...NAV_MAIN, ...NAV_GROUPS.flatMap((g) => g.children)];

const COLLAPSE_KEY = "rsv_admin_sidebar_collapsed";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function matches(pathname: string, item: NavItem) {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
}

function SideLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `relative flex h-10 items-center gap-3 rounded-lg text-[13px] font-medium transition-colors ${FOCUS} ${
          collapsed ? "justify-center px-0" : "px-3"
        } ${
          isActive
            ? "bg-[#1E3A5F] text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-[#1E3A5F]"
        }`
      }
    >
      <FontAwesomeIcon icon={item.icon} className="h-4 w-4 shrink-0 opacity-80" fixedWidth />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
}

function SidebarContent({ pathname, collapsed = false }: { pathname: string; collapsed?: boolean }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200 sm:h-16 ${
          collapsed ? "justify-center px-2" : "px-4"
        }`}
      >
        <img src={logoUrl} alt="RSV Logo" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide text-[#1E3A5F]">
              RSV<span className="text-[#00A8E8]">.ADMIN</span>
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">Management</p>
          </div>
        )}
      </div>

      <nav
        aria-label="Navigasi admin"
        className={`flex-1 overflow-y-auto overflow-x-hidden py-4 ${collapsed ? "space-y-2 px-2" : "space-y-4 px-3"}`}
      >
        <div className="space-y-1">
          {NAV_MAIN.map((item) => (
            <SideLink key={item.to} item={item} collapsed={collapsed} />
          ))}
        </div>

        {NAV_GROUPS.map((group) => {
          const active = group.children.some((c) => matches(pathname, c));
          const open = active || !closed[group.label];
          if (collapsed) {
            return (
              <div key={group.label} className="space-y-1 border-t border-slate-100 pt-2">
                {group.children.map((item) => (
                  <SideLink key={item.to} item={item} collapsed />
                ))}
              </div>
            );
          }
          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => setClosed((s) => ({ ...s, [group.label]: open }))}
                aria-expanded={open}
                disabled={active}
                className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 transition-colors enabled:hover:text-slate-600 ${FOCUS}`}
              >
                {group.label}
                {!active && (
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`h-2.5 w-2.5 transition-transform ${open ? "" : "-rotate-90"}`}
                  />
                )}
              </button>
              {open && (
                <div className="mt-1 space-y-1">
                  {group.children.map((item) => (
                    <SideLink key={item.to} item={item} collapsed={false} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className={`shrink-0 border-t border-slate-200 ${collapsed ? "p-2" : "p-3"}`}>
        <Link
          to="/"
          title={collapsed ? "Halaman Utama" : undefined}
          aria-label={collapsed ? "Halaman Utama" : undefined}
          className={`flex h-10 items-center gap-3 rounded-lg text-[13px] font-medium text-slate-600 no-underline transition-colors hover:bg-slate-100 hover:text-[#1E3A5F] ${FOCUS} ${
            collapsed ? "justify-center" : "px-3"
          }`}
        >
          <FontAwesomeIcon icon={faArrowLeft} className="h-4 w-4" fixedWidth />
          {!collapsed && "Halaman Utama"}
        </Link>
      </div>
    </div>
  );
}

function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");
  const [hovered, setHovered] = useState(false);
  const effectiveCollapsed = collapsed && !hovered;

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;
    checkSession().then((valid) => {
      if (cancelled || valid) return;
      clearAuth();
      navigate("/login?session=expired", { replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [navigate, pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tutup drawer/menu saat pindah halaman
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen && !menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setDrawerOpen(false);
      setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, menuOpen]);

  const user = getUser();
  const userName = user?.name ?? "Admin RSV";
  const userRoleLabel = user?.role === "admin" ? "Administrator" : (user?.role ?? "Administrator");
  const pageTitle = ALL_ITEMS.find((i) => matches(pathname, i))?.label ?? "Admin";

  const handleLogout = async () => {
    const token = getToken();
    if (token) await logout(token).catch(() => undefined);
    clearAuth();
    navigate("/login", { replace: true });
  };

  if (!isAdmin()) return null;

  return (
    <div className="app-admin min-h-screen w-full bg-[#F6F8FB] font-sans text-slate-800 antialiased">
      <aside
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white transition-[width] duration-200 lg:block ${
          effectiveCollapsed ? "w-16" : "w-64"
        } ${collapsed && hovered ? "shadow-xl" : ""}`}
      >
        <SidebarContent pathname={pathname} collapsed={effectiveCollapsed} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigasi admin">
          <div className="absolute inset-0 bg-[#0F1C2E]/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(80vw,288px)] bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Tutup navigasi"
              className={`absolute right-2 top-2.5 grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 sm:top-3.5 ${FOCUS}`}
            >
              <FontAwesomeIcon icon={faXmark} className="h-5 w-5" />
            </button>
            <SidebarContent pathname={pathname} />
          </aside>
        </div>
      )}

      <div className={`flex min-h-screen flex-col transition-[padding] duration-200 ${collapsed ? "lg:pl-16" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Buka navigasi"
                aria-expanded={drawerOpen}
                className={`-ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden ${FOCUS}`}
              >
                <FontAwesomeIcon icon={faBars} className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
                title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
                aria-expanded={!collapsed}
                className={`-ml-1.5 hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 lg:grid ${FOCUS}`}
              >
                <FontAwesomeIcon icon={collapsed ? faAnglesRight : faAnglesLeft} className="h-4 w-4" />
              </button>
              <h1 className="truncate text-base font-semibold text-[#0F1C2E] sm:text-lg">{pageTitle}</h1>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <NotificationCenter />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className={`flex items-center gap-2.5 rounded-full p-1 transition-colors hover:bg-slate-100 sm:pr-3 ${FOCUS}`}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1E3A5F] text-[11px] font-bold text-white">
                    {initialsFromName(userName)}
                  </span>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block max-w-[160px] truncate text-[13px] font-semibold text-[#0F1C2E]">{userName}</span>
                    <span className="block text-[11px] text-slate-500">{userRoleLabel}</span>
                  </span>
                  <FontAwesomeIcon icon={faChevronDown} className="hidden h-3 w-3 text-slate-400 sm:block" />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                    <div
                      role="menu"
                      className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_32px_rgba(15,28,46,0.12)]"
                    >
                      <div className="border-b border-slate-100 px-4 py-3 sm:hidden">
                        <p className="truncate text-sm font-semibold text-[#0F1C2E]">{userName}</p>
                        <p className="text-xs text-slate-500">{userRoleLabel}</p>
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[#EF4444] hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none"
                      >
                        <FontAwesomeIcon icon={faArrowRightFromBracket} className="h-4 w-4" />
                        Keluar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-8 pt-5 sm:px-6 md:pt-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
