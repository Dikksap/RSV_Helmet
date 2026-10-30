import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  getBarangGroups,
  updateBarangGroup,
  type BarangGroup,
} from "../../api/barangGroup";
import { compareDus, DUS_CAPACITY } from "../../lib/dus";
import { useStatusOptions } from "../../lib/useStatusOptions";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50";
const BTN = `inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const BTN_GHOST = `${BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const MINI = `rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${FOCUS}`;

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const lower = (s: string) => s.trim().toLowerCase();

function toast(message: string, type: "success" | "error" = "success") {
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { type, message } }));
}

// Tanggal dus dibuat (createdAt) sebagai dasar pengelompokan arsip.
const dayKey = (g: BarangGroup) => {
  const d = new Date(g.createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

type DayGroup = { key: string; label: string; groups: BarangGroup[] };

function ArsipStokProduksi() {
  const base = useLocation().pathname.startsWith("/gudang") ? "/gudang" : "/admin";
  const { options: statusOptions } = useStatusOptions();
  const [allGroups, setAllGroups] = useState<BarangGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const refresh = useCallback(
    () =>
      getBarangGroups()
        .then(setAllGroups)
        .catch((e) => setError(errMsg(e, "Gagal memuat arsip dus")))
        .finally(() => setIsLoading(false)),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const arsip = useMemo(() => allGroups.filter((g) => g.isArsip), [allGroups]);
  const active = useMemo(() => allGroups.filter((g) => !g.isArsip), [allGroups]);
  const activeNames = useMemo(() => new Set(active.map((g) => lower(g.nama))), [active]);

  const byDay = useMemo((): DayGroup[] => {
    const map = new Map<string, DayGroup>();
    for (const g of arsip) {
      const key = dayKey(g);
      const cur = map.get(key);
      if (cur) cur.groups.push(g);
      else map.set(key, { key, label: formatDate(g.createdAt), groups: [g] });
    }
    return [...map.values()];
  }, [arsip]);

  const selectedGroups = useMemo(() => arsip.filter((g) => selected.has(g.id)), [arsip, selected]);
  const totalBarang = arsip.reduce((a, g) => a + g._count.barang, 0);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const restore = async (targets: BarangGroup[]) => {
    let busyId: number | null = null;
    if (targets.length === 1) {
      busyId = targets[0].id;
      setRestoringId(busyId);
    } else {
      setBulkBusy(true);
    }
    let ok = 0;
    let firstError = "";
    for (const g of targets) {
      try {
        await updateBarangGroup(g.id, { isArsip: false });
        ok++;
      } catch (e) {
        firstError ||= errMsg(e, "Gagal");
      }
    }
    if (busyId !== null) setRestoringId(null);
    else setBulkBusy(false);
    setSelected(new Set());
    await refresh();
    if (ok === targets.length) toast(`${ok} dus dipulihkan`);
    else toast(`${ok} dipulihkan, ${targets.length - ok} gagal. ${firstError}`, "error");
  };

  const restoreOne = (g: BarangGroup) => {
    const clash = activeNames.has(lower(g.nama));
    const clashNote = clash ? `\n\nSudah ada dus aktif bernama "${g.nama}".` : "";
    if (window.confirm(`Pulihkan "${g.nama}"?${clashNote}`)) void restore([g]);
  };

  const restoreSelected = async () => {
    const clashes = selectedGroups.filter((g) => activeNames.has(lower(g.nama))).map((g) => g.nama);
    const clashNote = clashes.length > 0 ? `\n\n${clashes.length} dus punya nama sama dengan dus aktif: ${clashes.join(", ")}.` : "";
    if (window.confirm(`Pulihkan ${selectedGroups.length} dus yang dipilih?${clashNote}`)) await restore(selectedGroups);
  };

  const statusBadge = (kode: string) => {
    const warna = statusOptions.find((o) => o.value === kode)?.warna;
    return (
      <span
        className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${warna ? "text-white" : "bg-slate-100 text-slate-600"}`}
        style={warna ? { backgroundColor: warna } : undefined}
      >
        {statusOptions.find((o) => o.value === kode)?.label ?? kode}
      </span>
    );
  };

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={`${base}/stok-produksi`} className={`text-xs font-semibold uppercase tracking-[0.1em] text-[#0088C0] hover:underline ${FOCUS}`}>
            ‹ Stok Produksi
          </Link>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Arsip Stok Produksi</h2>
          <p className="mt-1 text-sm text-slate-500">Dus arsip dikelompokkan per tanggal dus dibuat.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Dus diarsip", value: arsip.length },
          { label: "Barang di dalam", value: totalBarang },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-[#EF4444]">
          {error}
          <button type="button" onClick={() => void refresh()} className={BTN_GHOST} disabled={bulkBusy}>
            Coba lagi
          </button>
        </div>
      ) : isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
      ) : arsip.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 py-14 text-center">
          <p className="font-semibold text-slate-700">Arsip kosong</p>
          <p className="mt-1 text-sm text-slate-500">Dus yang diarsip akan muncul di sini.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {byDay.map((d) => (
            <section key={d.key} aria-label={d.label}>
              <h3 className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                <span>{d.label}</span>
                <span className="text-[11px] normal-case tracking-normal text-slate-400">
                  {d.groups.length} dus · {d.groups.reduce((s, g) => s + g._count.barang, 0)} barang
                </span>
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {[...d.groups].sort(compareDus).map((g) => (
                  <li key={g.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(g.id)}
                      onChange={() => toggle(g.id)}
                      aria-label={`Pilih arsip ${g.nama}`}
                      className="h-4 w-4 shrink-0 accent-[#1E3A5F]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-700">{g.nama}</p>
                      <p className="text-[11px] text-slate-400">
                        {g._count.barang}/{DUS_CAPACITY} barang · dibuat {formatDate(g.createdAt)}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-1">
                        {g.barang?.slice(0, 4).map((b) => <span key={b.id}>{statusBadge(b.status)}</span>)}
                      </p>
                    </div>
                    <button type="button" disabled={restoringId === g.id} onClick={() => restoreOne(g)} className={`${MINI} text-emerald-700 hover:bg-emerald-50`}>
                      {restoringId === g.id ? "…" : "Pulihkan"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {selectedGroups.length > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur">
          <span className="text-sm text-slate-600">{selectedGroups.length} dipilih</span>
          <button type="button" onClick={() => setSelected(new Set())} className={`${BTN_GHOST} h-9`} disabled={bulkBusy}>
            Batal
          </button>
          <button type="button" onClick={() => void restoreSelected()} disabled={bulkBusy} className={`${BTN} h-9 bg-[#10B981] text-white hover:bg-[#059669]`}>
            {bulkBusy ? "Memulihkan…" : "Pulihkan yang dipilih"}
          </button>
        </div>
      )}
    </div>
  );
}

export default ArsipStokProduksi;
