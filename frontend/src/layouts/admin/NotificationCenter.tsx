import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useLiveSocketContext } from "../../lib/LiveSocketContext";
import { NotifDetail, summarizeNotif } from "./notification";
import type { NotifItem } from "./notification";

export function NotificationCenter() {
  const { subscribe } = useLiveSocketContext();

  const [notifCount, setNotifCount] = useState(0);
  const [notifList, setNotifList] = useState<NotifItem[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [liveToasts, setLiveToasts] = useState<
    { id: number; type: string; message: string; leaving?: boolean }[]
  >([]);
  const [selectedNotif, setSelectedNotif] = useState<NotifItem | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifButtonRef = useRef<HTMLButtonElement>(null);
  const recentToastRef = useRef<Map<string, number>>(new Map());
  const idRef = useRef(0);
  const timersRef = useRef<Set<number>>(new Set());

  // need 4s toast + 240ms exit = ~4240. Progress bar in CSS is 4s. Keep JS in sync.
  const TOAST_MS = 4000;
  const EXIT_MS = 240;
  const DEDUP_MS = 3000;

  const dismissToast = (id: number) => {
    setLiveToasts((prev) => {
      if (!prev.some((t) => t.id === id && !t.leaving)) return prev;
      return prev.map((t) => (t.id === id ? { ...t, leaving: true } : t));
    });
    const tid = window.setTimeout(
      () => setLiveToasts((prev) => prev.filter((t) => t.id !== id)),
      EXIT_MS,
    );
    timersRef.current.add(tid);
  };

  useEffect(() => {
    const pushToast = (type: string, message: string) => {
      const key = `${type}::${message}`;
      const now = Date.now();
      // prune expired dedup entries so Map doesn't grow unbounded
      for (const [k, ts] of recentToastRef.current) {
        if (now - ts > DEDUP_MS) recentToastRef.current.delete(k);
      }
      const last = recentToastRef.current.get(key);
      if (last && now - last < DEDUP_MS) return;
      recentToastRef.current.set(key, now);
      const id = ++idRef.current;
      const toast = { id, type, message: message || type };
      setLiveToasts((prev) => [...prev, toast].slice(-5));
      const tid = window.setTimeout(() => dismissToast(id), TOAST_MS);
      timersRef.current.add(tid);
    };

    const unsub = subscribe((payload) => {
      const now = new Date();
      const id = ++idRef.current;
      const full =
        payload.data !== null && payload.data !== undefined
          ? JSON.stringify(payload.data, null, 2)
          : "";
      const notif: NotifItem = {
        id,
        type: payload.type,
        message: payload.message,
        data: summarizeNotif(full),
        fullData: full,
        time: now.toLocaleTimeString("id-ID", {
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
      const now = new Date();
      const id = ++idRef.current;
      setNotifCount((prev) => prev + 1);
      setNotifList((prev) => [
        {
          id,
          type,
          message,
          data: "",
          fullData: "",
          time: now.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
        ...prev.slice(0, 19),
      ]);
    };

    // typed without "as unknown as string" — declare once via global augmentation if preferred;
    // keeping minimal change: still listen on the raw custom event name.
    window.addEventListener(
      "app:toast" as unknown as string,
      onAppToast as EventListener,
    );

    const timers = timersRef.current;
    return () => {
      unsub();
      window.removeEventListener(
        "app:toast" as unknown as string,
        onAppToast as EventListener,
      );
      // clear pending toast timers so we don't setState after unmount
      for (const tid of timers) window.clearTimeout(tid);
      timers.clear();
    };
  }, [subscribe]);

  // click outside -> close dropdown
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

  // Escape closes selected modal; also closes dropdown when open
  useEffect(() => {
    if (!selectedNotif && !showNotif) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedNotif) setSelectedNotif(null);
      else setShowNotif(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNotif, showNotif]);

  const toggleNotif = () => {
    setShowNotif((v) => {
      if (!v) setNotifCount(0);
      return !v;
    });
  };

  const clearNotif = () => {
    setNotifCount(0);
    setNotifList([]);
    setShowNotif(false);
  };

  return (
    <>
      {/* Bell + dropdown (rendered inline in header) */}
      <div className="relative">
        <button
          ref={notifButtonRef}
          type="button"
          onClick={toggleNotif}
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

        {showNotif && (
          <div
            ref={notifRef}
            className="absolute right-0 top-full mt-2 flex w-80 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.10)]"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="text-sm font-semibold text-[#1F2937]">Notifikasi</span>
              {notifList.length > 0 && (
                <button
                  type="button"
                  onClick={clearNotif}
                  className="rounded text-[13px] font-medium text-[#0088C0] transition-colors duration-200 hover:text-[#00A8E8] focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
                >
                  Bersihkan Semua
                </button>
              )}
            </div>
            <div className="max-h-[min(55vh,420px)] overflow-y-auto">
              {notifList.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-8">
                  <FontAwesomeIcon icon={faBell} className="h-8 w-8 text-[#D1D5DB]" />
                  <p className="mt-2 text-xs text-[#6B7280]">Tidak ada notifikasi</p>
                </div>
              ) : (
                notifList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedNotif(item)}
                    className="flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left text-xs transition-colors duration-200 hover:bg-[#F5F7FA]"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="truncate font-semibold text-[#1E3A5F]">{item.type}</span>
                      <span className="shrink-0 text-[10px] text-[#6B7280]">{item.time}</span>
                    </div>
                    <span className="line-clamp-2 text-sm text-[#1F2937]">{item.message}</span>
                    {item.data && (
                      <span className="truncate font-mono text-[10px] text-[#6B7280]">{item.data}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toasts — fixed, outside header flow but rendered here so they don't force <Outlet/> re-render */}
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
                setNotifCount(0);
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
              const isError = /error|gagal|hapus|deleted|bad|retur/i.test(`${t.type} ${t.message}`);
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
                      <p className="line-clamp-2 text-sm font-medium text-[#1F2937]">{t.message}</p>
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

      {/* Detail modal */}
      {selectedNotif && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setSelectedNotif(null)}
        >
          <div
            className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
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
              <p className="text-xs font-semibold uppercase tracking-widest text-[#1E3A5F]">{selectedNotif.type}</p>
              <p className="mt-1 text-sm font-semibold text-[#1F2937]">{selectedNotif.message}</p>
              <p className="mt-1 text-xs text-[#6B7280]">{selectedNotif.time}</p>
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
    </>
  );
}
