import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxesStacked,
  faChartPie,
  faChevronDown,
  faChevronLeft,
  faGaugeHigh,
  faGear,
  faRightFromBracket,
  faTags,
  faBell,
  faDatabase,
  faHouse,
} from "@fortawesome/free-solid-svg-icons";
import { clearAuth, getToken, isAdmin, logout } from "../api/auth";
import { useLiveSocketContext } from "../lib/LiveSocketContext";

const NAV_MAIN = [
  {
    to: "/admin/dashboard",
    label: "Dasbor Utama",
    icon: faGaugeHigh,
    end: true,
  }
];

const BARANG_PRODUKSI = {
  label: "Barang Produksi",
  icon: faBoxesStacked,
  children: [
    {
      to: "/admin/barang",
      label: "Daftar Barang",
      icon: faBoxesStacked,
      end: false,
    },
    {
      to: "/admin/barang/statistik",
      label: "Statistik Barang",
      icon: faChartPie,
      end: false,
    },
    {
     to: "/admin/variant-produk",
     label: "Variant Produk",
     icon: faTags,
     end: false,
   },
    {
      to: "/admin/master-data",
      label: "Master Data",
      icon: faDatabase,
      end: false,
    }
  ],
};

const NAV_MANAGEMENT = [
  { to: "/", label: "Halaman Utama", icon: faGear, end: false },
];

const ADMIN_MOBILE_NAV = [
  { to: "/", label: "Home", icon: faHouse, end: true, center: false },
  { to: "/admin/barang", label: "Barang", icon: faBoxesStacked, end: true, center: false },
  { to: "/admin/dashboard", label: "Dasbor", icon: faGaugeHigh, end: true, center: true },
  { to: "/admin/barang/statistik", label: "Statistik", icon: faChartPie, end: false, center: false },
  { to: "/admin/variant-produk", label: "Varian", icon: faTags, end: false, center: false },
];

type AdminMobileNavItem = (typeof ADMIN_MOBILE_NAV)[number];

function AdminMobileNavLink({ item }: { item: AdminMobileNavItem }) {
  return (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          "flex min-w-[52px] flex-col items-center gap-1 rounded-xl px-1.5 py-2.5 transition-all duration-200",
          isActive
            ? "scale-105 bg-brand-gold/10 text-brand-gold"
            : "text-brand-grey hover:bg-brand-surface hover:text-white",
        ].join(" ")
      }
    >
      <FontAwesomeIcon icon={item.icon} className="h-5 w-5" fixedWidth />
      <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
    </NavLink>
  );
}

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [barangProduksiOpen, setBarangProduksiOpen] = useState(
    () =>
      location.pathname.startsWith("/admin/barang") ||
      location.pathname.startsWith("/admin/barang/statistik"),
  );
  const [notifCount, setNotifCount] = useState(0);
  const [notifList, setNotifList] = useState<
    { type: string; message: string; data: string; fullData: string; time: string }[]
  >([]);
  const [showNotif, setShowNotif] = useState(false);
  const [liveToasts, setLiveToasts] = useState<{ id: number; type: string; message: string }[]>([]);
  const [notifHeight, setNotifHeight] = useState(208);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef<number>(0);
  const resizeStartH = useRef<number>(208);
  const [selectedNotif, setSelectedNotif] = useState<{ type: string; message: string; data: string; fullData: string; time: string } | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { subscribe } = useLiveSocketContext();

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/login", { replace: true });
      return;
    }
  }, [navigate]);

  useEffect(() => {
    const pushToast = (type: string, message: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const toast = { id, type, message: message || type };
      setLiveToasts((prev) => [...prev, toast].slice(-5));
      window.setTimeout(() => setLiveToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };
    const unsub = subscribe((payload) => {
      const full = payload.data !== null && payload.data !== undefined ? JSON.stringify(payload.data, null, 2) : "";
      const notif = {
        type: payload.type,
        message: payload.message,
        data: full.slice(0, 120),
        fullData: full,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
      setNotifCount((prev) => prev + 1);
      setNotifList((prev) => [notif, ...prev.slice(0, 19)]);
      pushToast(payload.type, payload.message || payload.type);
    });
    const onAppToast = (e: Event) => {
      const ce = e as CustomEvent<{ type?: string; message?: string }>;
      const type = ce.detail?.type || "info";
      const message = ce.detail?.message || "";
      if (!message) return;
      pushToast(type, message);
      setNotifCount((prev) => prev + 1);
      setNotifList((prev) => [{ type, message, data: "", fullData: "", time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }, ...prev.slice(0, 19)]);
    };
    window.addEventListener("app:toast" as unknown as string, onAppToast as EventListener);
    return () => {
      unsub();
      window.removeEventListener("app:toast" as unknown as string, onAppToast as EventListener);
    };
  }, [subscribe]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        notifRef.current &&
        !notifRef.current.contains(e.target as Node)
      ) {
        setShowNotif(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!selectedNotif) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedNotif(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNotif]);

  // drag resize up/down
  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientY - resizeStartY.current;
      const next = Math.min(560, Math.max(160, resizeStartH.current + delta));
      setNotifHeight(next);
    };
    const onUp = () => setIsResizing(false);
    const onTouchMove = (e: TouchEvent) => {
      const delta = e.touches[0].clientY - resizeStartY.current;
      const next = Math.min(560, Math.max(160, resizeStartH.current + delta));
      setNotifHeight(next);
    };
    const onTouchEnd = () => setIsResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isResizing]);

  const startResize = (e: React.MouseEvent | React.TouchEvent) => {
    const y = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    resizeStartY.current = y;
    resizeStartH.current = notifHeight;
    setIsResizing(true);
  };

  const clearNotif = () => {
    setNotifCount(0);
    setNotifList([]);
    setShowNotif(false);
    localStorage.removeItem("rsv_notif_count");
    localStorage.removeItem("rsv_notif_list");
  };

  useEffect(() => {
    localStorage.setItem("rsv_notif_count", String(notifCount));
  }, [notifCount]);

  useEffect(() => {
    localStorage.setItem("rsv_notif_list", JSON.stringify(notifList));
  }, [notifList]);

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

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="app-admin flex min-h-screen w-full bg-brand-black font-sans text-brand-grey-light antialiased">
      {liveToasts.length > 0 && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[70] flex w-[min(92vw,560px)] -translate-x-1/2 flex-col gap-2">
          {liveToasts.map((t) => (
            <div key={t.id} className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-brand-gold/30 bg-brand-surface-card/95 px-4 py-3 text-sm shadow-2xl backdrop-blur">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-gold text-xs font-bold text-brand-black">✓</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold uppercase tracking-wide text-brand-gold">{t.type}</p>
                <p className="truncate text-sm font-medium text-white">{t.message}</p>
              </div>
              <button type="button" onClick={() => setLiveToasts((prev) => prev.filter((x) => x.id !== t.id))} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">×</button>
            </div>
          ))}
        </div>
      )}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        ></div>
      )}

      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-64 transform flex-col border-r border-brand-border bg-brand-surface transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "lg:w-20" : ""}`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className={`flex h-20 shrink-0 items-center justify-between border-b border-brand-border px-6 ${isCollapsed ? "lg:justify-center lg:px-0" : ""}`}>
            <div className="flex items-center gap-3">
              <img
                src="/rsv_logo.png"
                alt="RSV"
                className="h-10 w-10 rounded-xl object-contain"
              />
              <div>
                <h1 className={`text-lg font-bold tracking-wide text-white ${isCollapsed ? "lg:hidden" : ""}`}>
                  RSV<span className="text-brand-gold">.ADMIN</span>
                </h1>
              </div>
            </div>
            <button
              onClick={closeSidebar}
              className="text-brand-grey transition hover:text-white lg:hidden"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-4">
            <p className={`mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-grey ${isCollapsed ? "lg:hidden" : ""}`}>
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
                  [
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-all",
                    isActive
                      ? "border border-brand-gold/20 bg-brand-gold/10 text-brand-gold"
                      : "text-brand-grey hover:bg-brand-surface-card hover:text-white",
                    isCollapsed ? "lg:justify-center lg:px-0" : "",
                  ].join(" ")
                }
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className="h-5 w-5 shrink-0"
                  fixedWidth
                />
                <span className={isCollapsed ? "lg:hidden" : ""}>{item.label}</span>
              </NavLink>
            ))}

            <div>
              <button
                type="button"
                onClick={() => setBarangProduksiOpen((o) => !o)}
                title={BARANG_PRODUKSI.label}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-all ${
                  barangProduksiOpen
                    ? "border border-brand-gold/20 bg-brand-gold/10 text-brand-gold"
                    : "text-brand-grey hover:bg-brand-surface-card hover:text-white"
                } ${isCollapsed ? "lg:justify-center lg:px-0" : ""}`}
              >
                <FontAwesomeIcon
                  icon={BARANG_PRODUKSI.icon}
                  className="h-5 w-5 shrink-0"
                  fixedWidth
                />
                <span className={`flex-1 text-left ${isCollapsed ? "lg:hidden" : ""}`}>
                  {BARANG_PRODUKSI.label}
                </span>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`h-4 w-4 transition-transform duration-300 ${
                    barangProduksiOpen ? "rotate-180" : ""
                  } ${isCollapsed ? "lg:hidden" : ""}`}
                />
              </button>
              <div
                className={`grid transition-all duration-300 ease-in-out ${
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
                            "flex items-center gap-3 rounded-lg py-2 pr-3 text-sm font-medium transition-all",
                            isActive
                              ? "border border-brand-gold/20 bg-brand-gold/10 text-brand-gold"
                              : "text-brand-grey hover:bg-brand-surface-card hover:text-white",
                            isCollapsed ? "lg:justify-center lg:px-0 lg:pl-0" : "pl-11",
                          ].join(" ")
                        }
                      >
                        <FontAwesomeIcon
                          icon={child.icon}
                          className="h-4 w-4 shrink-0"
                          fixedWidth
                        />
                        <span className={isCollapsed ? "lg:hidden" : ""}>{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className={`mb-2 px-3 pt-4 text-[11px] font-semibold uppercase tracking-wider text-brand-grey ${isCollapsed ? "lg:hidden" : ""}`}>
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
                  [
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-all",
                    isActive
                      ? "border border-brand-gold/20 bg-brand-gold/10 text-brand-gold"
                      : "text-brand-grey hover:bg-brand-surface-card hover:text-white",
                    isCollapsed ? "lg:justify-center lg:px-0" : "",
                  ].join(" ")
                }
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className="h-5 w-5 shrink-0"
                  fixedWidth
                />
                <span className={isCollapsed ? "lg:hidden" : ""}>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="shrink-0 border-t border-brand-border p-4">
          <div className={`flex items-center justify-between rounded-xl border border-brand-border bg-brand-surface-card p-2 ${isCollapsed ? "lg:flex-col lg:gap-2 lg:p-2" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-gold bg-neutral-800 text-sm font-bold text-white">
                  AD
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-brand-black bg-emerald-500"></span>
              </div>
              <div className={`overflow-hidden ${isCollapsed ? "lg:hidden" : ""}`}>
                <h4 className="truncate text-sm font-semibold text-white">
                  Admin RSV
                </h4>
                <p className="truncate text-xs text-brand-grey">
                  Super Administrator
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Keluar"
              className="rounded-lg p-1.5 text-brand-grey transition hover:bg-brand-surface hover:text-brand-gold"
            >
              <FontAwesomeIcon icon={faRightFromBracket} className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-brand-black">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-brand-border bg-brand-surface/80 px-4 backdrop-blur-md sm:px-8">
          <div className="flex flex-1 items-center gap-4 max-w-xl">
            <button
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Buka sidebar"
              className="rounded-lg p-2 text-brand-grey transition hover:bg-brand-surface-card hover:text-white lg:hidden"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <button
              onClick={() => setIsCollapsed((v) => !v)}
              title={isCollapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
              aria-label={isCollapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
              className="hidden rounded-lg p-2 text-brand-grey transition hover:bg-brand-surface-card hover:text-white lg:block"
            >
              <FontAwesomeIcon icon={faChevronLeft} className={`h-5 w-5 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`} />
            </button>
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                Panel Administrasi
              </p>
              <h2 className="text-xl font-bold leading-none tracking-tight text-white">
                Management Area
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden flex-col text-right sm:flex">
              <span className="text-sm font-bold text-white">Admin RSV</span>
              <span className="text-xs text-brand-grey">
                admin@rsvhelmet.com
              </span>
            </div>
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setShowNotif((v) => !v)}
                className="relative rounded-full p-2 text-brand-grey transition hover:bg-brand-surface-card hover:text-white"
              >
                <FontAwesomeIcon icon={faBell} className="h-6 w-6" />
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 top-full mt-2 flex w-80 flex-col overflow-hidden rounded-xl border border-brand-border bg-brand-surface-card shadow-xl">
                  <div className="flex items-center justify-between border-b border-brand-border px-4 py-2">
                    <span className="text-xs font-bold text-white">
                      Notifikasi
                    </span>
                    {notifCount > 0 && (
                      <button
                        type="button"
                        onClick={clearNotif}
                        className="text-[10px] text-brand-gold hover:text-brand-gold-light"
                      >
                        Bersihkan
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto" style={{ height: notifHeight }}>
                    {notifList.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-brand-grey">
                        Tidak ada notifikasi
                      </p>
                    ) : (
                      notifList.map((item, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedNotif(item)}
                          className="flex w-full flex-col gap-1 border-b border-brand-border/50 px-4 py-2 text-left text-xs hover:bg-brand-surface/50 active:bg-brand-gold/10"
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="truncate font-semibold text-brand-gold">
                              {item.type}
                            </span>
                            <span className="shrink-0 text-brand-grey">
                              {item.time}
                            </span>
                          </div>
                          <span className="line-clamp-2 text-brand-grey-light">
                            {item.message}
                          </span>
                          {item.data && (
                            <span className="truncate text-[10px] text-brand-grey">
                              {item.data}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  <div
                    onMouseDown={startResize}
                    onTouchStart={startResize}
                    className={`flex h-6 cursor-ns-resize select-none items-center justify-center border-t border-brand-border bg-brand-surface hover:bg-brand-surface-card ${isResizing ? "bg-brand-gold/10" : ""}`}
                    title="Drag untuk ubah tinggi"
                  >
                    <span className="h-1 w-10 rounded-full bg-brand-border" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-gold bg-brand-gold/10 text-sm font-bold text-brand-gold">
              AD
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4 sm:px-8 sm:pt-8 lg:pb-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      {/* Bottom navigation khusus mobile admin */}
      <nav aria-label="Navigasi admin mobile" className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="mx-3 mb-3 rounded-2xl border border-brand-border bg-brand-surface-card/95 shadow-2xl backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
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
                        <span className="-mt-7 grid h-14 w-14 place-items-center rounded-full bg-brand-gold text-brand-black shadow-lg ring-4 ring-brand-surface-card transition active:scale-95">
                          <FontAwesomeIcon icon={centerItem.icon} className="h-6 w-6" fixedWidth />
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-tight ${isActive ? "text-brand-gold" : "text-brand-grey"}`}>{centerItem.label}</span>
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
      {selectedNotif && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onClick={() => setSelectedNotif(null)}>
          <div className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card shadow-2xl" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setSelectedNotif(null)} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-brand-border bg-brand-surface text-brand-grey hover:text-white">×</button>
            <div className="border-b border-brand-border px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">{selectedNotif.type}</p>
              <p className="mt-1 text-sm font-semibold text-white">{selectedNotif.message}</p>
              <p className="mt-1 text-xs text-brand-grey">{selectedNotif.time}</p>
            </div>
            <div className="overflow-auto p-6">
              {selectedNotif.fullData ? (
                <pre className="whitespace-pre-wrap break-words rounded-xl border border-brand-border bg-brand-black p-4 font-mono text-xs text-brand-grey-light">{selectedNotif.fullData}</pre>
              ) : (
                <p className="text-sm text-brand-grey">Tidak ada data tambahan.</p>
              )}
            </div>
            <div className="flex justify-end border-t border-brand-border bg-brand-surface/50 px-6 py-3">
              <button type="button" onClick={() => setSelectedNotif(null)} className="rounded-xl bg-brand-gold px-4 py-2 text-xs font-bold text-brand-black hover:bg-brand-gold-light">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminLayout;
