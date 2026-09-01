import { useCallback, useEffect, useState } from "react";
import { getBarang, type Barang } from "../api/barang";
import { useLiveSocket } from "../lib/useLiveSocket";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/900.css";

function isToday(dateString: string): boolean {
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

function LiveView() {
  const [barang, setBarang] = useState<Barang[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [clock, setClock] = useState(() => new Date());

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

  const todayBarang = barang.filter((item) => isToday(item.tanggal));
  const finishGoodCount = todayBarang.filter(
    (item) => item.status === "FINISHGOOD",
  ).length;
  const { time, meridiem } = formatClock12(clock);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 py-10 text-white">
      <span
        className={`mb-8 h-3 w-3 rounded-full ${isConnected ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" : "bg-red-400"}`}
        role="status"
        aria-label={isConnected ? "Koneksi terhubung" : "Koneksi terputus"}
      />
      <div className="flex items-baseline gap-3">
        <strong className="font-mono text-7xl font-black tracking-tight sm:text-9xl">
          {time}
        </strong>
        <span className="text-lg font-bold tracking-widest text-zinc-400">
          {meridiem}
        </span>
      </div>
      <p className="mt-3 text-sm uppercase tracking-[0.25em] text-zinc-400">
        {clock.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      <div className="mt-16 grid w-full max-w-2xl grid-cols-2 gap-4">
        <div className="border border-zinc-800 bg-zinc-900 p-5 text-center sm:p-8">
          <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Total Barang Hari Ini
          </span>
          <strong className="mt-3 block text-5xl font-black tabular-nums sm:text-7xl">
            {todayBarang.length}
          </strong>
        </div>
        <div className="border border-zinc-800 bg-zinc-900 p-5 text-center sm:p-8">
          <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Finish Good Hari Ini
          </span>
          <strong className="mt-3 block text-5xl font-black tabular-nums sm:text-7xl">
            {finishGoodCount}
          </strong>
        </div>
      </div>

      {error && (
        <p className="mt-8 border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      {updatedAt && (
        <p className="mt-10 text-xs uppercase tracking-[0.18em] text-zinc-600">
          Update terakhir {updatedAt.toLocaleTimeString("id-ID")}
        </p>
      )}
    </main>
  );
}

export default LiveView;
