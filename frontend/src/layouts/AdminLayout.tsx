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

type NotifItem = {
  type: string;
  message: string;
  data: string;
  fullData: string;
  time: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function nestedName(v: unknown): string | null {
  return isRecord(v) ? str(v.nama) : null;
}

function tryParseJson(raw: string): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function formatTanggal(iso: unknown): string | null {
  if (typeof iso !== "string" || !iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function batchLabel(batch: unknown): string | null {
  if (!isRecord(batch)) return null;
  if (typeof batch.nomorBatch === "number")
    return `BC${String(batch.nomorBatch).padStart(3, "0")}`;
  return str(batch.nomorBatch) ?? str(batch.kodeBatch);
}

// Ringkasan satu baris untuk daftar notifikasi (ganti slice JSON mentah).
function summarizeNotif(fullData: string): string {
  const data = tryParseJson(fullData);
  if (!isRecord(data)) return "";
  const kode = str(data.kodeBarang);
  if (kode) {
    const status = str(data.status);
    return status ? `${kode} • ${status}` : kode;
  }
  if (typeof data.totalDibuat === "number" && Array.isArray(data.batches)) {
    return `${data.totalDibuat} barang • ${data.batches.length} batch`;
  }
  const kv = str(data.kodeVariant);
  if (kv) return kv;
  const nama = str(data.nama);
  if (nama) return nama;
  if (typeof data.id === "number") return `ID ${data.id}`;
  return "";
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-border/50 py-2 last:border-0">
      <span className="shrink-0 text-xs text-brand-grey">{label}</span>
      <span
        className={`text-right text-xs font-semibold text-white ${mono ? "break-all font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function NotifDetail({ fullData }: { fullData: string }) {
  const data = tryParseJson(fullData);
  if (!isRecord(data)) {
    return <p className="text-sm text-brand-grey">Tidak ada data tambahan.</p>;
  }

  // Barang: created / updated / status_updated
  const kodeBarang = str(data.kodeBarang);
  if (kodeBarang) {
    const v = isRecord(data.variant) ? data.variant : null;
    const parts = [
      v && isRecord(v.product) ? str(v.product.nama) : null,
      v ? nestedName(v.style) : null,
      v ? nestedName(v.color) : null,
      v ? nestedName(v.size) : null,
    ].filter((x): x is string => x !== null);
    const varian =
      parts.length > 0 ? parts.join(" / ") : (str(data.kodeVariant) ?? "-");
    return (
      <div className="rounded-xl border border-brand-border bg-brand-black px-4 py-2">
        <DetailRow label="Kode Barang" value={kodeBarang} mono />
        <DetailRow label="Status" value={str(data.status) ?? "-"} />
        <DetailRow label="Varian" value={varian} />
        <DetailRow label="Batch" value={batchLabel(data.batch) ?? "No Batch"} mono />
        <DetailRow label="Tanggal" value={formatTanggal(data.tanggal) ?? "-"} />
        <DetailRow
          label="Diperbarui"
          value={formatTanggal(data.updatedAt) ?? "-"}
        />
      </div>
    );
  }

  // Hasil generate: { totalDibuat, batches: [{ kodeBatch, jumlah, barang }] }
  if (typeof data.totalDibuat === "number" && Array.isArray(data.batches)) {
    const batches = (data.batches as unknown[]).filter(isRecord);
    const contoh = batches
      .flatMap((b) => (Array.isArray(b.barang) ? b.barang : []))
      .filter(isRecord)
      .map((b) => str(b.kodeBarang))
      .filter((x): x is string => x !== null)
      .slice(0, 3);
    return (
      <div className="rounded-xl border border-brand-border bg-brand-black px-4 py-2">
        <DetailRow label="Total Dibuat" value={String(data.totalDibuat)} />
        {batches.map((b, i) => (
          <DetailRow
            key={i}
            label={`Batch ${str(b.kodeBatch) ?? `#${i + 1}`}`}
            value={`${typeof b.jumlah === "number" ? b.jumlah : "?"} barang`}
          />
        ))}
        {contoh.length > 0 && (
          <DetailRow label="Contoh Kode" value={contoh.join(", ")} mono />
        )}
      </div>
    );
  }

  // Variant: { kodeVariant } atau id style/color/size
  const kodeVariant = str(data.kodeVariant);
  if (
    kodeVariant ||
    (typeof data.styleId === "number" && typeof data.colorId === "number")
  ) {
    const varian = [nestedName(data.style), nestedName(data.color), nestedName(data.size)]
      .filter((x): x is string => x !== null)
      .join(" / ");
    return (
      <div className="rounded-xl border border-brand-border bg-brand-black px-4 py-2">
        <DetailRow
          label="Kode Variant"
          value={kodeVariant ?? `Variant #${typeof data.id === "number" ? data.id : "-"}`}
          mono
        />
        {varian && <DetailRow label="Varian" value={varian} />}
        {typeof data.id === "number" && (
          <DetailRow label="ID" value={String(data.id)} />
        )}
      </div>
    );
  }

  // Product: { nama, prefix }
  if (str(data.nama) && str(data.prefix)) {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-black px-4 py-2">
        <DetailRow label="Nama" value={str(data.nama) ?? "-"} />
        <DetailRow label="Prefix" value={str(data.prefix) ?? "-"} mono />
        {typeof data.id === "number" && (
          <DetailRow label="ID" value={String(data.id)} />
        )}
      </div>
    );
  }

  // Deleted / fallback ID saja
  if (typeof data.id === "number" && Object.keys(data).length === 1) {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-black px-4 py-2">
        <DetailRow label="ID" value={String(data.id)} />
      </div>
    );
  }

  // Bentuk tak dikenal: tampilkan JSON rapi sebagai fallback terakhir.
  return (
    <pre className="whitespace-pre-wrap break-words rounded-xl border border-brand-border bg-brand-black p-4 font-mono text-xs text-brand-grey-light">
      {fullData}
    </pre>
  );
}

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
  const [notifList, setNotifList] = useState<NotifItem[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [liveToasts, setLiveToasts] = useState<{ id: number; type: string; message: string; leaving?: boolean }[]>([]);
  const [notifHeight, setNotifHeight] = useState(208);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef<number>(0);
  const resizeStartH = useRef<number>(208);
  const [selectedNotif, setSelectedNotif] = useState<NotifItem | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { subscribe } = useLiveSocketContext();

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/login", { replace: true });
      return;
    }
  }, [navigate]);

  // Animasi keluar dulu, baru hapus dari DOM
  const dismissToast = (id: number) => {
    setLiveToasts((prev) => {
      if (!prev.some((t) => t.id === id && !t.leaving)) return prev;
      return prev.map((t) => (t.id === id ? { ...t, leaving: true } : t));
    });
    window.setTimeout(() => setLiveToasts((prev) => prev.filter((t) => t.id !== id)), 240);
  };

  useEffect(() => {
    const pushToast = (type: string, message: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const toast = { id, type, message: message || type };
      setLiveToasts((prev) => [...prev, toast].slice(-5));
      window.setTimeout(() => dismissToast(id), 4000);
    };
    const unsub = subscribe((payload) => {
      const full = payload.data !== null && payload.data !== undefined ? JSON.stringify(payload.data, null, 2) : "";
      const notif = {
        type: payload.type,
        message: payload.message,
        data: summarizeNotif(full),
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
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2 sm:bottom-6 sm:right-6"
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
              className="live-toast-enter pointer-events-auto self-end rounded-full border border-brand-gold/30 bg-brand-surface-card/95 px-3 py-1.5 text-[11px] font-bold text-brand-gold shadow-xl backdrop-blur transition hover:border-brand-gold"
            >
              +{liveToasts.length - 3} lainnya — lihat semua
            </button>
          )}
          {[...liveToasts].slice(-3).reverse().map((t) => {
            const isError = /error|gagal|hapus|deleted|bad|retur/i.test(`${t.type} ${t.message}`);
            return (
              <div
                key={t.id}
                role="status"
                className={`pointer-events-auto relative w-full overflow-hidden rounded-2xl border bg-brand-surface-card/95 px-4 py-3 text-sm shadow-2xl backdrop-blur ${t.leaving ? "live-toast-exit" : "live-toast-enter"} ${isError ? "border-rose-500/30" : "border-brand-gold/30"}`}
              >
                <div className="flex w-full items-start gap-3">
                  <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${isError ? "bg-rose-500 text-white" : "bg-brand-gold text-brand-black"}`}>
                    {isError ? "!" : "✓"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[11px] font-bold uppercase tracking-wide ${isError ? "text-rose-400" : "text-brand-gold"}`}>{t.type}</p>
                    <p className="line-clamp-2 text-sm font-medium text-white">{t.message}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Tutup notifikasi"
                    onClick={() => dismissToast(t.id)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                  >
                    ×
                  </button>
                </div>
                {!t.leaving && (
                  <span className={`live-toast-progress absolute bottom-0 left-0 h-0.5 ${isError ? "bg-rose-500" : "bg-brand-gold"}`} aria-hidden="true" />
                )}
              </div>
            );
          })}
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
                      notifList.map((item, i) => {
                        const preview = summarizeNotif(item.fullData) || item.data;
                        return (
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
                          {preview && (
                            <span className="truncate font-mono text-[10px] text-brand-grey">
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
              <NotifDetail fullData={selectedNotif.fullData} />
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
