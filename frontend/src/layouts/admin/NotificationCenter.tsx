import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faXmark } from "@fortawesome/free-solid-svg-icons";

import { useLiveSocketContext } from "../../lib/LiveSocketContext";

import {
  clearNotifications,
  fetchNotifications,
  type StoredNotif,
} from "../../api/notification";

import { NotifDetail, summarizeNotif } from "./notification";
import type { NotifItem } from "./notification";

const MAX_LIST = 20;

const TOAST_MS = 4000;
const EXIT_MS = 240;
const DEDUP_MS = 3000;
const MAX_TOASTS = 5;
const MAX_VISIBLE_TOASTS = 3;

function formatTime(dateValue: string | number | Date): string {
  const date = new Date(dateValue);

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function toItem(s: StoredNotif): NotifItem {
  const full =
    s.data !== null && s.data !== undefined
      ? JSON.stringify(s.data, null, 2)
      : "";

  return {
    id: s.id,
    type: s.type,
    message: s.message,
    data: summarizeNotif(full),
    fullData: full,
    time: formatTime(s.ts),
  };
}

function prependNotif(
  prev: NotifItem[],
  item: NotifItem,
): NotifItem[] {
  if (prev.some((n) => n.id === item.id)) {
    return prev;
  }

  return [item, ...prev].slice(0, MAX_LIST);
}

function isErrorNotification(type: string, message: string): boolean {
  return (
    type === "error" ||
    (type !== "success" &&
      /error|gagal|hapus|deleted|bad|retur/i.test(
        `${type} ${message}`,
      ))
  );
}

type LiveToast = {
  id: number;
  type: string;
  message: string;
  leaving?: boolean;
};

export function NotificationCenter() {
  const { subscribe } = useLiveSocketContext();

  const [notifCount, setNotifCount] = useState(0);
  const [notifList, setNotifList] = useState<NotifItem[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [liveToasts, setLiveToasts] = useState<LiveToast[]>([]);
  const [selectedNotif, setSelectedNotif] =
    useState<NotifItem | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);
  const notifButtonRef = useRef<HTMLButtonElement>(null);

  const recentToastRef = useRef<Map<string, number>>(new Map());
  const recentIdsRef = useRef<Map<number, number>>(new Map());
  const idRef = useRef(0);

  /**
   * Semua timer toast disimpan di sini supaya:
   * - tidak ada setState setelah component unmount
   * - timer lama bisa dibersihkan
   * - tidak terjadi timer yang menumpuk
   */
  const timersRef = useRef<Map<number, number>>(new Map());

  /**
   * Hapus timer tertentu dari registry.
   */
  const clearToastTimer = (id: number) => {
    const timerId = timersRef.current.get(id);

    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      timersRef.current.delete(id);
    }
  };

  /**
   * Hapus toast secara permanen.
   */
  const removeToast = (id: number) => {
    clearToastTimer(id);

    setLiveToasts((prev) =>
      prev.filter((toast) => toast.id !== id),
    );
  };

  /**
   * Jalankan animasi keluar terlebih dahulu,
   * kemudian hapus toast setelah EXIT_MS.
   */
  const dismissToast = (id: number) => {
    setLiveToasts((prev) => {
      const toast = prev.find((item) => item.id === id);

      if (!toast || toast.leaving) {
        return prev;
      }

      return prev.map((item) =>
        item.id === id
          ? { ...item, leaving: true }
          : item,
      );
    });

    clearToastTimer(id);

    const timerId = window.setTimeout(() => {
      removeToast(id);
    }, EXIT_MS);

    timersRef.current.set(id, timerId);
  };

  useEffect(() => {
    const pushToast = (
      type: string,
      message: string,
    ) => {
      const normalizedType = type || "info";
      const normalizedMessage =
        message || normalizedType;

      const key = `${normalizedType}::${normalizedMessage}`;
      const now = Date.now();

      /**
       * Bersihkan entry dedup yang sudah kedaluwarsa.
       */
      for (const [keyValue, timestamp] of recentToastRef.current) {
        if (now - timestamp > DEDUP_MS) {
          recentToastRef.current.delete(keyValue);
        }
      }

      /**
       * Jangan tampilkan toast yang sama dalam
       * waktu DEDUP_MS.
       */
      const lastShown =
        recentToastRef.current.get(key);

      if (
        lastShown !== undefined &&
        now - lastShown < DEDUP_MS
      ) {
        return;
      }

      recentToastRef.current.set(key, now);

      const id = ++idRef.current;

      const toast: LiveToast = {
        id,
        type: normalizedType,
        message: normalizedMessage,
      };

      setLiveToasts((prev) => {
        /**
         * Jika sudah mencapai batas, hapus toast
         * paling lama dari tampilan.
         */
        const next = [...prev, toast];

        if (next.length <= MAX_TOASTS) {
          return next;
        }

        const removed = next.slice(
          0,
          next.length - MAX_TOASTS,
        );

        for (const oldToast of removed) {
          clearToastTimer(oldToast.id);
        }

        return next.slice(-MAX_TOASTS);
      });

      /**
       * Toast otomatis keluar setelah 4 detik.
       */
      const timerId = window.setTimeout(() => {
        dismissToast(id);
      }, TOAST_MS);

      timersRef.current.set(id, timerId);
    };

    const unsub = subscribe((payload) => {
      const now = new Date();

      /**
       * ID dari server diprioritaskan.
       * Jika tidak ada ID, gunakan ID negatif agar
       * tidak bentrok dengan ID database.
       */
      const id =
        payload.id !== null &&
        payload.id !== undefined
          ? payload.id
          : -(++idRef.current);

      // Skip event server yang sama diterima dua kali (koneksi dobel /
      // emit ganda) — dedup by id, bukan hanya by type+message toast.
      if (typeof id === "number" && id > 0) {
        const nowMs = Date.now();
        for (const [seenId, ts] of recentIdsRef.current) {
          if (nowMs - ts > DEDUP_MS) recentIdsRef.current.delete(seenId);
        }
        const seenAt = recentIdsRef.current.get(id);
        if (seenAt !== undefined && nowMs - seenAt < DEDUP_MS) return;
        recentIdsRef.current.set(id, nowMs);
      }

      const full =
        payload.data !== null &&
        payload.data !== undefined
          ? JSON.stringify(payload.data, null, 2)
          : "";

      const notif: NotifItem = {
        id,
        type: payload.type,
        message: payload.message,
        data: summarizeNotif(full),
        fullData: full,
        time: formatTime(now),
      };

      /**
       * Event live masuk ke list.
       */
      setNotifList((prev) =>
        prependNotif(prev, notif),
      );

      /**
       * Badge hanya bertambah untuk event live.
       */
      setNotifCount((prev) => prev + 1);

      /**
       * Tampilkan toast.
       */
      pushToast(
        payload.type,
        payload.message || payload.type,
      );
    });

    /**
     * Custom event dari aplikasi.
     *
     * Contoh:
     * window.dispatchEvent(
     *   new CustomEvent("app:toast", {
     *     detail: {
     *       type: "success",
     *       message: "Data berhasil disimpan",
     *     },
     *   }),
     * );
     */
    const onAppToast = (event: Event) => {
      const customEvent =
        event as CustomEvent<{
          type?: string;
          message?: string;
        }>;

      const type =
        customEvent.detail?.type || "info";

      const message =
        customEvent.detail?.message || "";

      if (!message) {
        return;
      }

      pushToast(type, message);

      const now = new Date();

      /**
       * Custom toast tidak berasal dari database,
       * jadi gunakan ID negatif.
       */
      const id = -(++idRef.current);

      const notif: NotifItem = {
        id,
        type,
        message,
        data: "",
        fullData: "",
        time: formatTime(now),
      };

      setNotifCount((prev) => prev + 1);

      setNotifList((prev) =>
        prependNotif(prev, notif),
      );
    };

    window.addEventListener(
      "app:toast",
      onAppToast as EventListener,
    );

    return () => {
      unsub();

      window.removeEventListener(
        "app:toast",
        onAppToast as EventListener,
      );

      /**
       * Bersihkan semua timer toast.
       */
      for (const timerId of timersRef.current.values()) {
        window.clearTimeout(timerId);
      }

      timersRef.current.clear();

      /**
       * Bersihkan cache dedup.
       */
        recentToastRef.current.clear();
        recentIdsRef.current.clear();
      };
  }, [subscribe]);

  /**
   * Ambil history notification dari backend.
   *
   * History tidak menaikkan badge karena badge
   * hanya menghitung notification baru selama sesi.
   */
  useEffect(() => {
    let cancelled = false;

    fetchNotifications()
      .then((items) => {
        if (cancelled) {
          return;
        }

        const history = items.map(toItem);

        setNotifList((prev) => {
          let next = prev;

          /**
           * Masukkan dari belakang agar urutan
           * terbaru tetap berada di atas.
           */
          for (
            let i = history.length - 1;
            i >= 0;
            i--
          ) {
            next = prependNotif(
              next,
              history[i],
            );
          }

          return next;
        });
      })
      .catch(() => {
        /**
         * Backend mati tidak boleh membuat
         * notification center crash.
         *
         * Live socket tetap bisa menerima event.
         */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Click outside dropdown -> tutup dropdown.
   */
  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent,
    ) => {
      const target = event.target as Node;

      if (
        notifRef.current &&
        !notifRef.current.contains(target) &&
        notifButtonRef.current &&
        !notifButtonRef.current.contains(target)
      ) {
        setShowNotif(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  /**
   * Escape:
   * 1. Tutup modal jika sedang terbuka.
   * 2. Jika tidak ada modal, tutup dropdown.
   */
  useEffect(() => {
    if (!selectedNotif && !showNotif) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key !== "Escape") {
        return;
      }

      if (selectedNotif) {
        setSelectedNotif(null);
      } else {
        setShowNotif(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [selectedNotif, showNotif]);

  /**
   * Toggle dropdown.
   *
   * Ketika dropdown dibuka, badge dianggap sudah
   * dilihat sehingga di-reset menjadi 0.
   */
  const toggleNotif = () => {
    setShowNotif((current) => {
      const next = !current;

      if (next) {
        setNotifCount(0);
      }

      return next;
    });
  };

  /**
   * Bersihkan seluruh history notification.
   */
  const clearNotif = () => {
    setNotifCount(0);
    setNotifList([]);
    setShowNotif(false);

    void clearNotifications().catch(() => {
      /**
       * UI sudah dibersihkan.
       * Jika backend gagal, tidak perlu membuat UI crash.
       */
    });
  };

  /**
   * Hapus seluruh toast aktif.
   */
  const clearAllToasts = () => {
    for (const id of timersRef.current.keys()) {
      clearToastTimer(id);
    }

    setLiveToasts([]);
  };

  return (
    <>
      {/* =====================================================
          BELL + DROPDOWN
      ====================================================== */}

      <div className="relative">
        <button
          ref={notifButtonRef}
          type="button"
          onClick={toggleNotif}
          className="relative rounded-lg p-2 text-[#6B7280] transition-colors duration-200 hover:bg-[#F5F7FA] hover:text-[#1E3A5F] focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
          aria-label="Notifikasi"
          aria-expanded={showNotif}
        >
          <FontAwesomeIcon
            icon={faBell}
            className="h-6 w-6"
          />

          {notifCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white ring-2 ring-white">
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </button>

        {showNotif && (
          <div
            ref={notifRef}
            className="absolute right-0 top-full z-[60] mt-2 flex w-80 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.10)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="text-sm font-semibold text-[#1F2937]">
                Notifikasi
              </span>

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

            {/* Notification list */}
            <div className="max-h-[min(55vh,420px)] overflow-y-auto">
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
                notifList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setSelectedNotif(item)
                    }
                    className="flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left text-xs transition-colors duration-200 hover:bg-[#F5F7FA]"
                  >
                    <div className="flex w-full items-center justify-between gap-3">
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

                    {item.data && (
                      <span className="truncate font-mono text-[10px] text-[#6B7280]">
                        {item.data}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Portal ke body: header memakai backdrop-blur sehingga menjadi
          containing block bagi descendant fixed — toast harus di luar header. */}
      {createPortal(
        <>
      {/* =====================================================
          LIVE TOAST
      ====================================================== */}

      {liveToasts.length > 0 && (
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,380px)] flex-col gap-2 sm:bottom-6 sm:right-6"
          role="region"
          aria-label="Notifikasi"
        >
          {/* More notification button */}
          {liveToasts.length > MAX_VISIBLE_TOASTS && (
            <button
              type="button"
              onClick={() => {
                clearAllToasts();
                setShowNotif(true);
                setNotifCount(0);
              }}
              className="live-toast-enter pointer-events-auto self-end rounded-full border border-[#D1D5DB] bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-[#1E3A5F] shadow-xl backdrop-blur transition-colors duration-200 hover:border-[#00A8E8]"
            >
              +{liveToasts.length - MAX_VISIBLE_TOASTS} lainnya
              {" — "}lihat semua
            </button>
          )}

          {[...liveToasts]
            .slice(-MAX_VISIBLE_TOASTS)
            .reverse()
            .map((toast) => {
              const isError =
                isErrorNotification(
                  toast.type,
                  toast.message,
                );

              return (
                <div
                  key={toast.id}
                  role="status"
                  className={`pointer-events-auto relative w-full overflow-hidden rounded-xl border bg-white/95 px-4 py-3 text-sm shadow-2xl backdrop-blur transition-all duration-200 ${
                    toast.leaving
                      ? "live-toast-exit"
                      : "live-toast-enter"
                  } ${
                    isError
                      ? "border-[#EF4444]/30"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex w-full items-start gap-3">
                    {/* Status icon */}
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${
                        isError
                          ? "bg-[#EF4444]"
                          : "bg-[#10B981]"
                      }`}
                    >
                      {isError ? "!" : "✓"}
                    </span>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[11px] font-semibold uppercase tracking-wide ${
                          isError
                            ? "text-[#EF4444]"
                            : "text-[#6B7280]"
                        }`}
                      >
                        {toast.type}
                      </p>

                      <p className="line-clamp-2 text-sm font-medium text-[#1F2937]">
                        {toast.message}
                      </p>
                    </div>

                    {/* Close */}
                    <button
                      type="button"
                      aria-label="Tutup notifikasi"
                      onClick={() =>
                        dismissToast(toast.id)
                      }
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F5F7FA] text-[#6B7280] transition-colors duration-200 hover:bg-slate-200 hover:text-[#1F2937]"
                    >
                      <FontAwesomeIcon
                        icon={faXmark}
                        className="h-4 w-4"
                      />
                    </button>
                  </div>

                  {/* Progress */}
                  {!toast.leaving && (
                    <span
                      className={`live-toast-progress absolute bottom-0 left-0 h-0.5 ${
                        isError
                          ? "bg-[#EF4444]"
                          : "bg-[#10B981]"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* =====================================================
          DETAIL MODAL
      ====================================================== */}

      {selectedNotif && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setSelectedNotif(null)}
        >
          <div
            className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Detail notifikasi"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* Close */}
            <button
              type="button"
              onClick={() =>
                setSelectedNotif(null)
              }
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-[#6B7280] transition-colors duration-200 hover:bg-[#F5F7FA] hover:text-[#1F2937]"
              aria-label="Tutup"
            >
              <FontAwesomeIcon
                icon={faXmark}
                className="h-4 w-4"
              />
            </button>

            {/* Header */}
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

            {/* Detail */}
            <div className="overflow-auto p-6">
              <NotifDetail
                fullData={selectedNotif.fullData}
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-slate-200 bg-[#F5F7FA] px-6 py-3">
              <button
                type="button"
                onClick={() =>
                  setSelectedNotif(null)
                }
                className="rounded-lg bg-[#00A8E8] px-4 py-2 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#0088C0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
        </>,
        document.body,
      )}
    </>
  );
}
