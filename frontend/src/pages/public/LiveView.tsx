import { useCallback, useEffect, useRef, useState } from "react";
import { getBarang, type Barang } from "../../api/barang";
import { useLiveSocket } from "../../lib/useLiveSocket";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/900.css";

function isToday(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

const pad = (value: number) => String(value).padStart(2, "0");

function formatClock12(clock: Date): { time: string; meridiem: string } {
  const hours24 = clock.getHours();
  return {
    time: `${pad(hours24 % 12 === 0 ? 12 : hours24 % 12)}:${pad(
      clock.getMinutes(),
    )}:${pad(clock.getSeconds())}`,
    meridiem: hours24 >= 12 ? "PM" : "AM",
  };
}

const STATUS_META: Array<{
  status: string;
  label: string;
  accent: string;
  dot: string;
}> = [
  { status: "REGISTER", label: "LABEL DICETAK", accent: "text-sky-400", dot: "bg-sky-400" },
  { status: "FINISHGOOD", label: "FINISH GOOD", accent: "text-emerald-400", dot: "bg-emerald-400" },
  { status: "RETUR", label: "RETUR", accent: "text-amber-400", dot: "bg-amber-400" },
  { status: "SEDANG_REPAIR", label: "SEDANG REPAIR", accent: "text-orange-400", dot: "bg-orange-400" },
  { status: "FINISHGOOD_REPAIR", label: "REPAIR SELESAI", accent: "text-cyan-400", dot: "bg-cyan-400" },
  { status: "DIKIRIM", label: "DIKIRIM", accent: "text-violet-400", dot: "bg-violet-400" },
];

const ACTIVITY_STATUSES = [
  "REGISTER",
  "FINISHGOOD",
  "RETUR",
  "SEDANG_REPAIR",
  "FINISHGOOD_REPAIR",
];

function getLatestByStatus(items: Barang[], status: string): Barang[] {
  return items
    .filter((item) => item.status === status)
    .sort(
      (a, b) =>
        new Date(b.tanggal ?? 0).getTime() - new Date(a.tanggal ?? 0).getTime(),
    )
    .slice(0, 10);
}

function ActivityItem({ item, isNew }: { item: Barang; isNew: boolean }) {
  const waktu = item.tanggal ? new Date(item.tanggal) : null;
  return (
    <li
      className={`border-b border-zinc-800 px-3 py-2 last:border-b-0 ${
        isNew ? "bg-emerald-950/40" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {isNew && (
          <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950">
            BARU
          </span>
        )}
        <span className="truncate font-mono text-sm text-white">
          {item.kodeBarang}
        </span>
      </div>
      <p className="truncate text-xs text-zinc-400">
        {item.variant?.color?.nama ?? "-"} • {item.variant?.size?.nama ?? "-"}
      </p>
      <p className="font-mono text-xs text-zinc-500">
        {waktu ? waktu.toLocaleTimeString("id-ID", { hour12: false }) : "-"}
      </p>
    </li>
  );
}

function LiveView() {
  const [barang, setBarang] = useState<Barang[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const knownIds = useRef<Set<number> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await getBarang();
      setBarang(response.data);
      setUpdatedAt(new Date());
      setError(null);
    } catch {
      setError("Gagal memuat data barang.");
    }
  }, []);

  const isConnected = useLiveSocket(refresh);

  useEffect(() => {
    const initialRefreshId = window.setTimeout(() => void refresh(), 0);
    const intervalId = window.setInterval(() => void refresh(), 30000);
    return () => {
      window.clearTimeout(initialRefreshId);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  useEffect(() => {
    const clockId = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(clockId);
  }, []);

  useEffect(() => {
    const ids = new Set(barang.map((item) => item.id));
    if (knownIds.current === null) {
      knownIds.current = ids;
      return;
    }
    const added = barang.filter((item) => !knownIds.current!.has(item.id));
    knownIds.current = ids;
    if (added.length === 0) return;
    setFreshIds((prev) => new Set([...prev, ...added.map((item) => item.id)]));
    const clearId = window.setTimeout(() => {
      setFreshIds((prev) => {
        const next = new Set(prev);
        for (const item of added) next.delete(item.id);
        return next;
      });
    }, 15000);
    return () => window.clearTimeout(clearId);
  }, [barang]);

  const todayBarang = barang.filter((item) => isToday(item.tanggal));
  const countByStatus = (status: string) =>
    todayBarang.filter((item) => item.status === status).length;
  const { time, meridiem } = formatClock12(clock);

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 px-6 py-8 text-white">
      <header className="flex flex-col items-center gap-2 text-center">
        <div
          className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] ${
            isConnected ? "text-emerald-400" : "text-red-400"
          }`}
        >
          <span
            className={`h-3 w-3 rounded-full ${
              isConnected
                ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]"
                : "bg-red-400"
            }`}
            role="status"
            aria-label={isConnected ? "Koneksi terhubung" : "Koneksi terputus"}
          />
          {isConnected ? "CONNECTED" : "DISCONNECTED"}
        </div>
        <div className="flex items-baseline gap-3">
          <strong className="font-mono text-6xl font-black tracking-tight sm:text-8xl">
            {time}
          </strong>
          <span className="text-lg font-bold tracking-widest text-zinc-400">
            {meridiem}
          </span>
        </div>
        <p className="text-sm uppercase tracking-[0.25em] text-zinc-400">
          {clock.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {STATUS_META.map((meta) => (
          <div
            key={meta.status}
            className="border border-zinc-800 bg-zinc-900 p-4 text-center"
          >
            <span className={`text-xs uppercase tracking-[0.2em] ${meta.accent}`}>
              {meta.label}
            </span>
            <strong className="mt-2 block text-5xl font-black tabular-nums sm:text-6xl">
              {countByStatus(meta.status)}
            </strong>
          </div>
        ))}
      </section>

      <section className="mt-8 flex-1">
        <h2 className="mb-4 text-center text-sm font-bold uppercase tracking-[0.3em] text-zinc-400">
          AKTIVITAS TERBARU
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {ACTIVITY_STATUSES.map((status) => {
            const meta = STATUS_META.find((m) => m.status === status)!;
            const items = getLatestByStatus(todayBarang, status);
            return (
              <div
                key={status}
                className="flex flex-col border border-zinc-800 bg-zinc-900"
              >
                <div className="border-b border-zinc-800 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <h3 className={`text-xs font-bold uppercase tracking-[0.15em] ${meta.accent}`}>
                      {meta.label}
                    </h3>
                  </div>
                </div>
                {items.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-zinc-600">
                    Belum ada aktivitas
                  </p>
                ) : (
                  <ul>
                    {items.map((item) => (
                      <ActivityItem
                        key={item.id}
                        item={item}
                        isNew={freshIds.has(item.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {error && (
        <p className="mt-6 border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      {updatedAt && (
        <p className="mt-6 text-center text-xs uppercase tracking-[0.18em] text-zinc-600">
          Update terakhir {updatedAt.toLocaleTimeString("id-ID")}
        </p>
      )}
    </main>
  );
}

export default LiveView;
