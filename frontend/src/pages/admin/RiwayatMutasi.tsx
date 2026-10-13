import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import {
  getMutasiList,
  type MutasiRecord,
} from "../../api/mutasi";
import { getGudangList, type Gudang } from "../../api/gudang";
import { inputCls } from "../../components/admin/VariantProduk/constants";

const PAGE_SIZE = 20;

function lokasiLabel(g: { kode: string; name: string } | null) {
  if (!g) return <span className="italic text-slate-400">Di luar gudang</span>;
  return <span className="font-medium text-[#1F2937]">{g.kode} - {g.name}</span>;
}

function formatTanggal(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function RiwayatMutasi() {
  const [kodeBarang, setKodeBarang] = useState("");
  const [gudangId, setGudangId] = useState("");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [applied, setApplied] = useState({ kodeBarang: "", gudangId: "", dari: "", sampai: "" });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MutasiRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [gudang, setGudang] = useState<Gudang[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: typeof applied, p: number) => {
    setLoading(true);
    try {
      const res = await getMutasiList({
        page: p,
        limit: PAGE_SIZE,
        kodeBarang: f.kodeBarang || undefined,
        gudangId: f.gudangId ? Number(f.gudangId) : undefined,
        dari: f.dari || undefined,
        sampai: f.sampai || undefined,
      });
      setRows(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat riwayat mutasi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- muat data saat filter/page berubah
  useEffect(() => { void load(applied, page); }, [load, applied, page]);
  useEffect(() => {
    getGudangList().then(setGudang).catch(() => setGudang([]));
  }, []);

  const cari = () => {
    setPage(1);
    setApplied({ kodeBarang: kodeBarang.trim(), gudangId, dari, sampai });
  };
  const reset = () => {
    setKodeBarang("");
    setGudangId("");
    setDari("");
    setSampai("");
    setPage(1);
    setApplied({ kodeBarang: "", gudangId: "", dari: "", sampai: "" });
  };

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Warehouse</p>
        <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Riwayat Mutasi Gudang</h1>
        <p className="mt-2 text-base text-[#6B7280]">Perpindahan lokasi barang antar gudang. {total.toLocaleString("id-ID")} catatan.</p>
      </header>

      <section className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_170px_170px_auto]">
          <div>
            <label htmlFor="mutasi-kode" className="mb-1 block text-sm font-medium text-[#1F2937]">Kode barang</label>
            <div className="relative">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input id="mutasi-kode" className={`${inputCls} pl-9`} placeholder="cth: BC001-..." value={kodeBarang} onChange={(e) => setKodeBarang(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") cari(); }} />
            </div>
          </div>
          <div>
            <label htmlFor="mutasi-gudang" className="mb-1 block text-sm font-medium text-[#1F2937]">Gudang</label>
            <select id="mutasi-gudang" className={inputCls} value={gudangId} onChange={(e) => setGudangId(e.target.value)}>
              <option value="">Semua gudang</option>
              {gudang.map((g) => <option key={g.id} value={String(g.id)}>{g.kode} - {g.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="mutasi-dari" className="mb-1 block text-sm font-medium text-[#1F2937]">Dari</label>
            <input id="mutasi-dari" type="date" className={inputCls} value={dari} onChange={(e) => setDari(e.target.value)} />
          </div>
          <div>
            <label htmlFor="mutasi-sampai" className="mb-1 block text-sm font-medium text-[#1F2937]">Sampai</label>
            <input id="mutasi-sampai" type="date" className={inputCls} value={sampai} onChange={(e) => setSampai(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <button type="button" onClick={cari} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-5 py-3 text-[15px] font-medium text-white transition hover:bg-[#0088C0]">Cari</button>
            <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-[15px] font-medium text-[#1F2937] hover:bg-[#F5F7FA]">Reset</button>
          </div>
        </div>
      </section>

      {loading && <p className="animate-pulse text-[15px] text-[#6B7280]">Memuat riwayat...</p>}
      {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{error}</p>}

      {!loading && !error && (
        <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-[#F5F7FA] text-[#6B7280]">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Barang</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Asal</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Tujuan</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Oleh</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center italic text-[#6B7280]">Belum ada mutasi.</td></tr>
                ) : rows.map((m) => (
                  <tr key={m.id} className="text-[15px] hover:bg-[#F5F7FA]">
                    <td className="whitespace-nowrap px-6 py-4 text-[#6B7280]">{formatTanggal(m.tanggal)}</td>
                    <td className="px-6 py-4 font-mono text-sm font-semibold text-[#1E3A5F]">{m.barang.kodeBarang}</td>
                    <td className="px-6 py-4 text-[15px]">{lokasiLabel(m.gudangAsal)}</td>
                    <td className="px-6 py-4 text-[15px]">{lokasiLabel(m.gudangTujuan)}</td>
                    <td className="px-6 py-4 text-[#6B7280]">{m.user?.name ?? <span className="italic">—</span>}</td>
                    <td className="max-w-[220px] truncate px-6 py-4 text-[#6B7280]" title={m.keterangan ?? ""}>{m.keterangan || <span className="italic">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-sm text-[#6B7280]">
              <span>Halaman {page} dari {totalPages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[#D1D5DB] px-3 py-1.5 disabled:opacity-40">‹ Prev</button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[#D1D5DB] px-3 py-1.5 disabled:opacity-40">Next ›</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
