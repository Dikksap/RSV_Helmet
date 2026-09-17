import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronDown,
  faBell,
  faBars,
  faXmark,
  faArrowRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { clearAuth, getToken, isAdmin, logout } from "../api/auth";
import { useLiveSocketContext } from "../lib/LiveSocketContext";
import {
  NAV_MAIN,
  BARANG_PRODUKSI,
  NAV_MANAGEMENT,
  ADMIN_MOBILE_NAV,
  AdminMobileNavLink,
} from "./admin/navigation";
import { NotifDetail, summarizeNotif } from "./admin/notification";
import type { NotifItem } from "./admin/notification";
import logoUrl from "../assets/logo.png";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#00A8E8]",
    isActive
      ? "bg-[#1E3A5F]/5 text-[#1E3A5F]"
      : "text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
  ].join(" ");

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [barangProduksiOpen, setBarangProduksiOpen] = useState(
    () =>
      location.pathname.startsWith("/admin/barang") ||
      location.pathname.startsWith("/admin/barang/statistik") ||
      location.pathname.startsWith("/admin/plan-production"),
  );
  const [notifCount, setNotifCount] = useState(0);
  const [notifList, setNotifList] = useState<NotifItem[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [liveToasts, setLiveToasts] = useState<
    { id: number; type: string; message: string; leaving?: boolean }[]
  >([]);
  const [notifHeight, setNotifHeight] = useState(208);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef<number>(0);
  const resizeStartH = useRef<number>(208);
  const [selectedNotif, setSelectedNotif] = useState<NotifItem | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifButtonRef = useRef<HTMLButtonElement>(null);
  const recentToastRef = useRef<Map<string, number>>(new Map());

  const { subscribe } = useLiveSocketContext();

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/login", { replace: true });
      return;
    }
  }, [navigate]);

  const dismissToast = (id: number) => {
    setLiveToasts((prev) => {
      if (!prev.some((t) => t.id === id && !t.leaving)) return prev;
      return prev.map((t) => (t.id === id ? { ...t, leaving: true } : t));
    });
    window.setTimeout(
      () => setLiveToasts((prev) => prev.filter((t) => t.id !== id)),
      240,
    );
  };

  useEffect(() => {
    const pushToast = (type: string, message: string) => {
      const key = `${type}::${message}`;
      const now = Date.now();
      const last = recentToastRef.current.get(key);
      if (last && now - last < 3000) return;
      recentToastRef.current.set(key, now);
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const toast = { id, type, message: message || type };
      setLiveToasts((prev) => [...prev, toast].slice(-5));
      window.setTimeout(() => dismissToast(id), 4000);
    };
    const unsub = subscribe((payload) => {
      const full =
        payload.data !== null && payload.data !== undefined
          ? JSON.stringify(payload.data, null, 2)
          : "";
      const notif = {
        type: payload.type,
        message: payload.message,
        data: summarizeNotif(full),
        fullData: full,
        time: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
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
      setNotifList((prev) => [
        {
          type,
          message,
          data: "",
          fullData: "",
          time: new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
        ...prev.slice(0, 19),
      ]);
    };
    window.addEventListener(
      "app:toast" as unknown as string,
      onAppToast as EventListener,
    );
    return () => {
      unsub();
      window.removeEventListener(
        "app:toast" as unknown as string,
        onAppToast as EventListener,
      );
    };
  }, [subscribe]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        notifRef.current &&
        !notifRef.current.contains(e.target as Node) &&
        notifButtonRef.current &&
        !notifButtonRef.current.contains(e.target as Node)
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
    const y =
      "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
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

  const closeSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="app-admin flex min-h-screen w-full bg-[#F5F7FA] font-sans text-[#1F2937] antialiased">
      {/* Toast Notifications */}
      {liveToasts.length > 0 && (
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,380px)] flex-col gap-2 sm:bottom-6 sm:right-6"
          role="region"
          aria-label="Notifikasi"
        >
          {liveToasts.length > 3 && (
            <button
              type="button"
              onClick={() => {
                setLiveToasts([]);
                setShowNotif(true);
              }}
              className="live-toast-enter pointer-events-auto self-end rounded-full border border-[#D1D5DB] bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-[#1E3A5F] shadow-xl backdrop-blur transition-colors duration-200 hover:border-[#00A8E8]"
            >
              +{liveToasts.length - 3} lainnya — lihat semua
            </button>
          )}
          {[...liveToasts]
            .slice(-3)
            .reverse()
            .map((t) => {
              const isError = /error|gagal|hapus|deleted|bad|retur/i.test(
                `${t.type} ${t.message}`,
              );
              return (
                <div
                  key={t.id}
                  role="status"
                  className={`pointer-events-auto relative w-full overflow-hidden rounded-xl border bg-white/95 px-4 py-3 text-sm shadow-2xl backdrop-blur transition-all duration-200 ${
                    t.leaving ? "live-toast-exit" : "live-toast-enter"
                  } ${isError ? "border-[#EF4444]/30" : "border-slate-200"}`}
                >
                  <div className="flex w-full items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${
                        isError ? "bg-[#EF4444]" : "bg-[#10B981]"
                      }`}
                    >
                      {isError ? "!" : "✓"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[11px] font-semibold uppercase tracking-wide ${
                          isError ? "text-[#EF4444]" : "text-[#6B7280]"
                        }`}
                      >
                        {t.type}
                      </p>
                      <p className="line-clamp-2 text-sm font-medium text-[#1F2937]">
                        {t.message}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Tutup notifikasi"
                      onClick={() => dismissToast(t.id)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F5F7FA] text-[#6B7280] transition-colors duration-200 hover:bg-slate-200 hover:text-[#1F2937]"
                    >
                      <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
                    </button>
                  </div>
                  {!t.leaving && (
                    <span
                      className={`live-toast-progress absolute bottom-0 left-0 h-0.5 ${
                        isError ? "bg-[#EF4444]" : "bg-[#10B981]"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 transform flex-col border-r border-slate-200 bg-white transition-all duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "lg:w-20" : ""}`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Sidebar Header */}
          <div
            className={`flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-6 md:h-[72px] ${
              isCollapsed ? "lg:justify-center lg:px-0" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="RSV Logo"
                className="h-10 w-10 rounded-xl object-contain"
              />
              <div className={isCollapsed ? "lg:hidden" : ""}>
                <h1 className="text-lg font-bold tracking-wide text-[#1E3A5F]">
                  RSV<span className="text-[#00A8E8]">.ADMIN</span>
                </h1>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#6B7280]">
                  Management System
                </p>
              </div>
            </div>
            <button
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
                isCollapsed ? "lg:hidden" : ""
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
                  [navLinkClass({ isActive }), isCollapsed ? "lg:justify-center lg:px-0" : ""].join(" ")
                }
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className="h-5 w-5 shrink-0"
                  fixedWidth
                />
                <span className={isCollapsed ? "lg:hidden" : ""}>
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
                } ${isCollapsed ? "lg:justify-center lg:px-0" : ""}`}
              >
                <FontAwesomeIcon
                  icon={BARANG_PRODUKSI.icon}
                  className="h-5 w-5 shrink-0"
                  fixedWidth
                />
                <span
                  className={`flex-1 text-left ${isCollapsed ? "lg:hidden" : ""}`}
                >
                  {BARANG_PRODUKSI.label}
                </span>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`h-4 w-4 transition-transform duration-200 ${
                    barangProduksiOpen ? "rotate-180" : ""
                  } ${isCollapsed ? "lg:hidden" : ""}`}
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
                            isCollapsed
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
                        <span className={isCollapsed ? "lg:hidden" : ""}>
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
                isCollapsed ? "lg:hidden" : ""
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
                  [navLinkClass({ isActive }), isCollapsed ? "lg:justify-center lg:px-0" : ""].join(" ")
                }
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className="h-5 w-5 shrink-0"
                  fixedWidth
                />
                <span className={isCollapsed ? "lg:hidden" : ""}>
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
              isCollapsed ? "lg:flex-col lg:gap-2 lg:p-2" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1E3A5F] text-sm font-bold text-white">
                  AD
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#10B981]"></span>
              </div>
              <div
                className={`overflow-hidden ${isCollapsed ? "lg:hidden" : ""}`}
              >
                <h4 className="truncate text-sm font-semibold text-[#1F2937]">
                  Admin RSV
                </h4>
                <p className="truncate text-xs text-[#6B7280]">
                  Super Administrator
                </p>
              </div>
            </div>
            <button
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
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Buka sidebar"
              className="rounded-lg p-2 text-[#6B7280] transition-colors duration-200 hover:bg-[#F5F7FA] hover:text-[#1E3A5F] lg:hidden"
            >
              <FontAwesomeIcon icon={faBars} className="h-6 w-6" />
            </button>
            <button
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
              <span className="text-sm font-semibold text-[#1F2937]">Admin RSV</span>
              <span className="text-xs text-[#6B7280]">
                admin@rsvhelmet.com
              </span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                ref={notifButtonRef}
                type="button"
                onClick={() => setShowNotif((v) => !v)}
                className="relative rounded-lg p-2 text-[#6B7280] transition-colors duration-200 hover:bg-[#F5F7FA] hover:text-[#1E3A5F] focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
                aria-label="Notifikasi"
                aria-expanded={showNotif}
              >
                <FontAwesomeIcon icon={faBell} className="h-6 w-6" />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white ring-2 ring-white">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotif && (
                <div
                  ref={notifRef}
                  className="absolute right-0 top-full mt-2 flex w-80 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.10)]"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <span className="text-sm font-semibold text-[#1F2937]">
                      Notifikasi
                    </span>
                    {notifCount > 0 && (
                      <button
                        type="button"
                        onClick={clearNotif}
                        className="rounded text-[13px] font-medium text-[#0088C0] transition-colors duration-200 hover:text-[#00A8E8] focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
                      >
                        Bersihkan Semua
                      </button>
                    )}
                  </div>
                  <div
                    className="overflow-y-auto"
                    style={{ height: notifHeight }}
                  >
                    {notifList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-4 py-8">
                        <FontAwesomeIcon
                          icon={faBell}
                          className="h-8 w-8 text-[#D1D5DB]"
                        />
                        <p className="mt-2 text-xs text-[#6B7280]">
                          Tidak ada notifikasi
                        </p>
                      </div>
                    ) : (
                      notifList.map((item, i) => {
                        const preview =
                          summarizeNotif(item.fullData) || item.data;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedNotif(item)}
                            className="flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left text-xs transition-colors duration-200 hover:bg-[#F5F7FA]"
                          >
                            <div className="flex w-full items-center justify-between">
                              <span className="truncate font-semibold text-[#1E3A5F]">
                                {item.type}
                              </span>
                              <span className="shrink-0 text-[10px] text-[#6B7280]">
                                {item.time}
                              </span>
                            </div>
                            <span className="line-clamp-2 text-sm text-[#1F2937]">
                              {item.message}
                            </span>
                            {preview && (
                              <span className="truncate font-mono text-[10px] text-[#6B7280]">
                                {preview}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div
                    onMouseDown={startResize}
                    onTouchStart={startResize}
                    className={`flex h-6 cursor-ns-resize select-none items-center justify-center border-t border-slate-200 bg-white transition-colors duration-200 ${
                      isResizing
                        ? "bg-[#00A8E8]/10"
                        : "hover:bg-[#F5F7FA]"
                    }`}
                    title="Drag untuk ubah tinggi"
                  >
                    <span className="h-1 w-10 rounded-full bg-slate-300" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E3A5F] text-sm font-bold text-white">
              AD
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

      {/* Notification Detail Modal */}
      {selectedNotif && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setSelectedNotif(null)}
        >
          <div
            className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedNotif(null)}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-[#6B7280] transition-colors duration-200 hover:bg-[#F5F7FA] hover:text-[#1F2937]"
              aria-label="Tutup"
            >
              <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
            </button>
            <div className="border-b border-slate-200 px-6 py-4 pr-12">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#1E3A5F]">
                {selectedNotif.type}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1F2937]">
                {selectedNotif.message}
              </p>
              <p className="mt-1 text-xs text-[#6B7280]">
                {selectedNotif.time}
              </p>
            </div>
            <div className="overflow-auto p-6">
              <NotifDetail fullData={selectedNotif.fullData} />
            </div>
            <div className="flex justify-end border-t border-slate-200 bg-[#F5F7FA] px-6 py-3">
              <button
                type="button"
                onClick={() => setSelectedNotif(null)}
                className="rounded-lg bg-[#00A8E8] px-4 py-2 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#0088C0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminLayout;
