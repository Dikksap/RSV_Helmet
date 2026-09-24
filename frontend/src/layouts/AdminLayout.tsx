import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronDown,
  faBars,
  faXmark,
  faArrowRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { clearAuth, getToken, getUser, isAdmin, logout } from "../api/auth";
import {
  NAV_MAIN,
  BARANG_PRODUKSI,
  NAV_INTEGRASI,
  NAV_MANAGEMENT,
  ADMIN_MOBILE_NAV,
  AdminMobileNavLink,
} from "./admin/navigation";
import { NotificationCenter } from "./admin/NotificationCenter";
import logoUrl from "../assets/logo.png";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#00A8E8]",
    isActive
      ? "bg-[#1E3A5F]/5 text-[#1E3A5F]"
      : "text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  // Efektif ciut hanya bila di-pin ciut DAN tidak sedang di-hover.
  const collapsed = isCollapsed && !hoverOpen;

  const inBarangProduksiGroup = BARANG_PRODUKSI.children.some(
    (c) => location.pathname === c.to || location.pathname.startsWith(c.to + "/"),
  );
  const [barangProduksiOpen, setBarangProduksiOpen] = useState(() => inBarangProduksiGroup);

  useEffect(() => {
    if (inBarangProduksiGroup) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync group open state with route
      setBarangProduksiOpen(true);
    }
  }, [inBarangProduksiGroup]);

  const user = getUser();
  const userName = user?.name ?? "Admin RSV";
  const userEmail = user?.email ?? "";
  const userRoleLabel = user?.role === "admin" ? "Administrator" : (user?.role ?? "Administrator");
  const userInitials = user?.name ? initialsFromName(user.name) : "AD";

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/login", { replace: true });
      return;
    }
  }, [navigate]);

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

  const closeSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  // Avoid flashing the full admin layout for non-admin before redirect
  if (!isAdmin()) return null;

  return (
    <div className="app-admin flex min-h-screen w-full bg-[#F5F7FA] font-sans text-[#1F2937] antialiased">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setHoverOpen(true)}
        onMouseLeave={() => setHoverOpen(false)}
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 transform flex-col border-r border-slate-200 bg-white transition-all duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-20" : ""}`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Sidebar Header */}
          <div
            className={`flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-6 md:h-[72px] ${
              collapsed ? "lg:justify-center lg:px-0" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="RSV Logo"
                className="h-10 w-10 rounded-xl object-contain"
              />
              <div className={collapsed ? "lg:hidden" : ""}>
                <h1 className="text-lg font-bold tracking-wide text-[#1E3A5F]">
                  RSV<span className="text-[#00A8E8]">.ADMIN</span>
                </h1>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#6B7280]">
                  Management System
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeSidebar}
              className="rounded-lg p-1 text-[#6B7280] transition-colors duration-200 hover:bg-[#F5F7FA] hover:text-[#1F2937] lg:hidden"
              aria-label="Tutup sidebar"
            >
              <FontAwesomeIcon icon={faXmark} className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav aria-label="Navigasi admin" className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-4">
            <p
              className={`mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] ${
                collapsed ? "lg:hidden" : ""
              }`}
            >
              Menu Utama
            </p>

            {NAV_MAIN.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeSidebar}
                title={item.label}
                className={({ isActive }) =>
                  [navLinkClass({ isActive }), collapsed ? "lg:justify-center lg:px-0" : ""].join(" ")
                }
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className="h-5 w-5 shrink-0"
                  fixedWidth
                />
                <span className={collapsed ? "lg:hidden" : ""}>
                  {item.label}
                </span>
              </NavLink>
            ))}

            {/* Barang Produksi Section */}
            <div>
              <button
                type="button"
                onClick={() => setBarangProduksiOpen((o) => !o)}
                title={BARANG_PRODUKSI.label}
                aria-expanded={barangProduksiOpen}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#00A8E8] ${
                  barangProduksiOpen
                    ? "bg-[#1E3A5F]/5 text-[#1E3A5F]"
                    : "text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]"
                } ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
              >
                <FontAwesomeIcon
                  icon={BARANG_PRODUKSI.icon}
                  className="h-5 w-5 shrink-0"
                  fixedWidth
                />
                <span
                  className={`flex-1 text-left ${collapsed ? "lg:hidden" : ""}`}
                >
                  {BARANG_PRODUKSI.label}
                </span>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`h-4 w-4 transition-transform duration-200 ${
                    barangProduksiOpen ? "rotate-180" : ""
                  } ${collapsed ? "lg:hidden" : ""}`}
                />
              </button>
              <div
                className={`grid transition-all duration-200 ease-in-out ${
                  barangProduksiOpen
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-1 pt-1">
                    {BARANG_PRODUKSI.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.end}
                        onClick={closeSidebar}
                        title={child.label}
                        className={({ isActive }) =>
                          [
                            navLinkClass({ isActive }),
                            "py-2 text-sm",
                            collapsed
                              ? "lg:justify-center lg:px-0 lg:pl-0"
                              : "pl-11",
                          ].join(" ")
                        }
                      >
                        <FontAwesomeIcon
                          icon={child.icon}
                          className="h-4 w-4 shrink-0"
                          fixedWidth
                        />
                        <span className={collapsed ? "lg:hidden" : ""}>
                          {child.label}
                        </span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p
              className={`mb-2 px-3 pt-4 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] ${
                collapsed ? "lg:hidden" : ""
              }`}
            >
              {NAV_INTEGRASI.label}
            </p>

            {NAV_INTEGRASI.children.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeSidebar}
                title={item.label}
                className={({ isActive }) =>
                  [navLinkClass({ isActive }), collapsed ? "lg:justify-center lg:px-0" : ""].join(" ")
                }
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className="h-5 w-5 shrink-0"
                  fixedWidth
                />
                <span className={collapsed ? "lg:hidden" : ""}>
                  {item.label}
                </span>
              </NavLink>
            ))}

            <p
              className={`mb-2 px-3 pt-4 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] ${
                collapsed ? "lg:hidden" : ""
              }`}
            >
              Manajemen
            </p>

            {NAV_MANAGEMENT.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeSidebar}
                title={item.label}
                className={({ isActive }) =>
                  [navLinkClass({ isActive }), collapsed ? "lg:justify-center lg:px-0" : ""].join(" ")
                }
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className="h-5 w-5 shrink-0"
                  fixedWidth
                />
                <span className={collapsed ? "lg:hidden" : ""}>
                  {item.label}
                </span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer - User Profile */}
        <div className="shrink-0 border-t border-slate-200 p-4">
          <div
            className={`flex items-center justify-between rounded-xl border border-slate-200 bg-[#F5F7FA] p-2 transition-all duration-200 ${
              collapsed ? "lg:flex-col lg:gap-2 lg:p-2" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1E3A5F] text-sm font-bold text-white">
                  {userInitials}
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#10B981]"></span>
              </div>
              <div
                className={`overflow-hidden ${collapsed ? "lg:hidden" : ""}`}
              >
                <h4 className="truncate text-sm font-semibold text-[#1F2937]">
                  {userName}
                </h4>
                <p className="truncate text-xs text-[#6B7280]">
                  {userRoleLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Keluar"
              aria-label="Keluar"
              className="rounded-lg p-1.5 text-[#6B7280] transition-colors duration-200 hover:bg-white hover:text-[#EF4444] focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
            >
              <FontAwesomeIcon
                icon={faArrowRightFromBracket}
                className="h-5 w-5"
              />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#F5F7FA]">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur md:h-[72px] md:px-12">
          <div className="flex flex-1 items-center gap-4 max-w-xl">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Buka sidebar"
              className="rounded-lg p-2 text-[#6B7280] transition-colors duration-200 hover:bg-[#F5F7FA] hover:text-[#1E3A5F] lg:hidden"
            >
              <FontAwesomeIcon icon={faBars} className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => setIsCollapsed((v) => !v)}
              title={isCollapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
              aria-label={
                isCollapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"
              }
              className="hidden rounded-lg p-2 text-[#6B7280] transition-colors duration-200 hover:bg-[#F5F7FA] hover:text-[#1E3A5F] lg:block"
            >
              <FontAwesomeIcon
                icon={faChevronLeft}
                className={`h-5 w-5 transition-transform duration-200 ${
                  isCollapsed ? "rotate-180" : ""
                }`}
              />
            </button>
            <div className="hidden sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">
                Panel Administrasi
              </p>
              <h2 className="text-xl font-semibold leading-none tracking-tight text-[#1E3A5F]">
                Management Area
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden flex-col text-right sm:flex">
              <span className="text-sm font-semibold text-[#1F2937]">{userName}</span>
              {userEmail && (
                <span className="text-xs text-[#6B7280]">
                  {userEmail}
                </span>
              )}
            </div>

            <NotificationCenter />

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E3A5F] text-sm font-bold text-white">
              {userInitials}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-6 pb-24 pt-6 md:px-12 md:pt-8 lg:pb-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navigasi admin mobile"
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      >
        <div
          className="mx-3 mb-3 rounded-xl border border-slate-200 bg-white/95 shadow-[0_8px_30px_rgba(0,0,0,0.10)] backdrop-blur-xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-center p-1">
            {(() => {
              const centerIndex = ADMIN_MOBILE_NAV.findIndex((i) => i.center);
              const leftItems = ADMIN_MOBILE_NAV.slice(0, centerIndex);
              const centerItem = ADMIN_MOBILE_NAV[centerIndex];
              const rightItems = ADMIN_MOBILE_NAV.slice(centerIndex + 1);
              return (
                <>
                  <div className="flex flex-1 items-center justify-around">
                    {leftItems.map((item) => (
                      <AdminMobileNavLink key={item.to} item={item} />
                    ))}
                  </div>
                  <NavLink
                    to={centerItem.to}
                    end={centerItem.end}
                    aria-label="Dasbor utama"
                    className="flex min-w-[64px] shrink-0 flex-col items-center gap-1 px-2 pb-2 pt-0"
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`-mt-7 grid h-14 w-14 place-items-center rounded-full ${
                            isActive
                              ? "bg-[#00A8E8] text-white ring-4 ring-[#00A8E8]/30"
                              : "bg-[#00A8E8]/15 text-[#0088C0] ring-4 ring-white"
                          } shadow-lg transition-transform duration-200 active:scale-95`}
                        >
                          <FontAwesomeIcon
                            icon={centerItem.icon}
                            className="h-6 w-6"
                            fixedWidth
                          />
                        </span>
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-tight ${
                            isActive ? "text-[#1E3A5F]" : "text-[#6B7280]"
                          }`}
                        >
                          {centerItem.label}
                        </span>
                      </>
                    )}
                  </NavLink>
                  <div className="flex flex-1 items-center justify-around">
                    {rightItems.map((item) => (
                      <AdminMobileNavLink key={item.to} item={item} />
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </nav>
    </div>
  );
}

export default AdminLayout;
