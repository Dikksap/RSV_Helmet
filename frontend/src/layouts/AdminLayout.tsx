import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxesStacked,
  faChartPie,
  faChevronDown,
  faGaugeHigh,
  faGear,
  faRightFromBracket,
  faTags,
  faBell,
  faDatabase,
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

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [barangProduksiOpen, setBarangProduksiOpen] = useState(
    () =>
      location.pathname.startsWith("/admin/barang") ||
      location.pathname.startsWith("/admin/barang/statistik"),
  );
  const [notifCount, setNotifCount] = useState(0);
  const [notifList, setNotifList] = useState<
    { type: string; message: string; data: string; time: string }[]
  >([]);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { subscribe } = useLiveSocketContext();

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/login", { replace: true });
      return;
    }
  }, [navigate]);

  useEffect(() => {
    return subscribe((payload) => {
      const notif = {
        type: payload.type,
        message: payload.message,
        data:
          payload.data !== null && payload.data !== undefined
            ? JSON.stringify(payload.data).slice(0, 120)
            : "",
        time: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };
      setNotifCount((prev) => prev + 1);
      setNotifList((prev) => [notif, ...prev.slice(0, 19)]);
    });
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
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        ></div>
      )}

      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-64 transform flex-col justify-between border-r border-brand-border bg-brand-surface transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="flex h-20 items-center justify-between border-b border-brand-border px-6">
            <div className="flex items-center gap-3">
              <img
                src="/rsv_logo.png"
                alt="RSV"
                className="h-10 w-10 rounded-xl object-contain"
              />
              <div>
                <h1 className="text-lg font-bold tracking-wide text-white">
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

          <nav className="space-y-1 p-4">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-grey">
              Menu Utama
            </p>

            {NAV_MAIN.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-all",
                    isActive
                      ? "border border-brand-gold/20 bg-brand-gold/10 text-brand-gold"
                      : "text-brand-grey hover:bg-brand-surface-card hover:text-white",
                  ].join(" ")
                }
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className="h-5 w-5"
                  fixedWidth
                />
                <span>{item.label}</span>
              </NavLink>
            ))}

            <div>
              <button
                type="button"
                onClick={() => setBarangProduksiOpen((o) => !o)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-all ${
                  barangProduksiOpen
                    ? "border border-brand-gold/20 bg-brand-gold/10 text-brand-gold"
                    : "text-brand-grey hover:bg-brand-surface-card hover:text-white"
                }`}
              >
                <FontAwesomeIcon
                  icon={BARANG_PRODUKSI.icon}
                  className="h-5 w-5"
                  fixedWidth
                />
                <span className="flex-1 text-left">
                  {BARANG_PRODUKSI.label}
                </span>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`h-4 w-4 transition-transform duration-300 ${
                    barangProduksiOpen ? "rotate-180" : ""
                  }`}
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
                        className={({ isActive }) =>
                          [
                            "flex items-center gap-3 rounded-lg py-2 pl-11 pr-3 text-sm font-medium transition-all",
                            isActive
                              ? "border border-brand-gold/20 bg-brand-gold/10 text-brand-gold"
                              : "text-brand-grey hover:bg-brand-surface-card hover:text-white",
                          ].join(" ")
                        }
                      >
                        <FontAwesomeIcon
                          icon={child.icon}
                          className="h-4 w-4"
                          fixedWidth
                        />
                        <span>{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="mb-2 px-3 pt-4 text-[11px] font-semibold uppercase tracking-wider text-brand-grey">
              Manajemen
            </p>

            {NAV_MANAGEMENT.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-all",
                    isActive
                      ? "border border-brand-gold/20 bg-brand-gold/10 text-brand-gold"
                      : "text-brand-grey hover:bg-brand-surface-card hover:text-white",
                  ].join(" ")
                }
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className="h-5 w-5"
                  fixedWidth
                />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="border-t border-brand-border p-4">
          <div className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-surface-card p-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-gold bg-neutral-800 text-sm font-bold text-white">
                  AD
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-brand-black bg-emerald-500"></span>
              </div>
              <div className="overflow-hidden">
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
              className="p-1 text-brand-grey transition hover:text-brand-gold"
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
                <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-brand-border bg-brand-surface-card shadow-xl">
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
                  <div className="max-h-48 overflow-y-auto">
                    {notifList.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-brand-grey">
                        Tidak ada notifikasi
                      </p>
                    ) : (
                      notifList.map((item, i) => (
                        <div
                          key={i}
                          className="flex flex-col gap-1 border-b border-brand-border/50 px-4 py-2 text-xs hover:bg-brand-surface/50"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-brand-gold font-semibold">
                              {item.type}
                            </span>
                            <span className="text-brand-grey">
                              {item.time}
                            </span>
                          </div>
                          <span className="text-brand-grey-light">
                            {item.message}
                          </span>
                          {item.data && (
                            <span className="truncate text-[10px] text-brand-grey">
                              {item.data}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-gold bg-brand-gold/10 text-sm font-bold text-brand-gold">
              AD
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
