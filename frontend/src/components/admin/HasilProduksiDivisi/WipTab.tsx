import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Divisi } from "../../../api/divisi";
import type { Item } from "../../../api/item";
import {
  getWipHasilProduksiHarian,
  getWipLedgerHarian,
  type WipLedgerHarianRow,
  type WipLedgerHarianTotal,
  type WipRow,
} from "../../../api/hasilProduksiHarian";
import { Empty, FIELD, Panel, Th, miniBtn } from "./ui";
import { angka, tampilkanBarisWip } from "./utils";

interface Props {
  divisis: Divisi[];
  items: Item[];
  refreshKey: number;
  lockedDivisiId?: number | null;
}

interface Filter {
  dari: string;
  sampai: string;
  divisiId: string;
  itemId: string;
}

const FILTER_AWAL: Filter = { dari: "", sampai: "", divisiId: "", itemId: "" };

export default function WipTab({ divisis, items, refreshKey, lockedDivisiId = null }: Props) {
  const terkunci = lockedDivisiId !== null;
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [divisiId, setDivisiId] = useState(terkunci ? String(lockedDivisiId) : "");
  const [itemId, setItemId] = useState("");
  const [applied, setApplied] = useState<Filter>(() => ({
    ...FILTER_AWAL,
    divisiId: terkunci ? String(lockedDivisiId) : "",
  }));

  const [rows, setRows] = useState<WipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"ringkas" | "harian">("ringkas");
  const [dailyRows, setDailyRows] = useState<WipLedgerHarianRow[]>([]);
  const [dailyTotal, setDailyTotal] = useState<WipLedgerHarianTotal | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await getWipHasilProduksiHarian({
          divisiId: lockedDivisiId ?? (applied.divisiId ? Number(applied.divisiId) : undefined),
          itemId: applied.itemId ? Number(applied.itemId) : undefined,
          dari: applied.dari || undefined,
          sampai: applied.sampai || undefined,
        });
        if (cancelled) return;
        setRows(result.data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setRows([]);
        setError(err instanceof Error ? err.message : "Gagal memuat WIP.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [applied, refreshKey, lockedDivisiId]);

  useEffect(() => {
    if (mode !== "harian") return;
    let cancelled = false;

    const load = async () => {
      setDailyLoading(true);
      try {
        const result = await getWipLedgerHarian({
          divisiId: lockedDivisiId ?? (applied.divisiId ? Number(applied.divisiId) : undefined),
          itemId: applied.itemId ? Number(applied.itemId) : undefined,
          dari: applied.dari || undefined,
          sampai: applied.sampai || undefined,
        });
        if (cancelled) return;
        setDailyRows(result.data);
        setDailyTotal(result.total);
        setDailyError(null);
      } catch (err) {
        if (cancelled) return;
        setDailyRows([]);
        setDailyTotal(null);
        setDailyError(err instanceof Error ? err.message : "Gagal memuat rekap harian WIP.");
      } finally {
        if (!cancelled) setDailyLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [mode, applied, refreshKey, lockedDivisiId]);

  const terapkan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApplied({
      dari,
      sampai,
      divisiId: lockedDivisiId !== null ? String(lockedDivisiId) : divisiId,
      itemId,
    });
  };

  const filterItemId = applied.itemId ? Number(applied.itemId) : null;
  const visibleRows = rows.filter((row) => tampilkanBarisWip(row, filterItemId));
  const itemTunggal =
    filterItemId !== null || new Set(visibleRows.map((row) => row.itemId)).size === 1;

  const total = visibleRows.reduce(
    (acc, row) => ({
      saldoAwal: acc.saldoAwal + angka(row.saldoAwal),
      masuk: acc.masuk + angka(row.masuk),
      keluar: acc.keluar + angka(row.keluar),
      saldoAkhir: acc.saldoAkhir + angka(row.saldoAkhir),
    }),
    { saldoAwal: 0, masuk: 0, keluar: 0, saldoAkhir: 0 },
  );

  return (
    <Panel
      title="Posisi WIP per Item"
      extra={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#6B7280]">WIP divisi, bukan stok gudang</span>
          {terkunci && (
            <Link to="/divisi/transfer-wip" className={`${miniBtn} inline-flex items-center`}>
              Transfer WIP
            </Link>
          )}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(["ringkas", "harian"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition ${
                  mode === value ? "bg-white text-[#1E3A5F] shadow-sm" : "text-[#6B7280]"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <form onSubmit={terapkan} className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
        <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
          Dari
          <input type="date" value={dari} onChange={(event) => setDari(event.target.value)} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
          Sampai
          <input type="date" value={sampai} onChange={(event) => setSampai(event.target.value)} className={FIELD} />
        </label>
        {terkunci ? (
          <p className="rounded-lg bg-[#E6F6FD] px-3 py-2.5 text-sm font-semibold text-[#0077A8]">
            {divisis.find((divisi) => divisi.id === lockedDivisiId)?.nama ?? "Divisi aktif"}
          </p>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Divisi
            <select value={divisiId} onChange={(event) => setDivisiId(event.target.value)} className={FIELD}>
              <option value="">Semua divisi</option>
              {divisis.map((divisi) => (
                <option key={divisi.id} value={divisi.id}>
                  {divisi.nama}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937] xl:col-span-2">
          Item
          <select value={itemId} onChange={(event) => setItemId(event.target.value)} className={FIELD}>
            <option value="">Semua item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.kode} — {item.nama}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`${miniBtn} h-[46px] px-4`}>
          Terapkan
        </button>
      </form>

      {mode === "ringkas" ? (
        loading ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">Memuat WIP...</p>
        ) : error ? (
          <p role="alert" className="p-6 text-center text-sm text-[#EF4444]">
            {error}
          </p>
        ) : visibleRows.length === 0 ? (
          <Empty>Tidak ada saldo WIP pada filter ini.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                  <Th>Item</Th>
                  <Th>Divisi</Th>
                  <Th right>Saldo Awal</Th>
                  <Th right>Masuk</Th>
                  <Th right>Keluar</Th>
                  <Th right>Saldo Akhir</Th>
                  <Th>Satuan</Th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={`${row.divisiId ?? "tanpa"}:${row.itemId}`} className="border-b border-slate-50 hover:bg-[#F5F7FA]">
                    <td className="px-3 py-2.5 text-[#1F2937]">
                      <span className="font-mono text-xs text-[#6B7280]">{row.kode}</span> - {row.nama}
                    </td>
                    <td className="px-3 py-2.5 text-[#6B7280]">{row.divisiNama ?? "-"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#6B7280]">
                      {angka(row.saldoAwal).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                      {angka(row.masuk).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-red-700">
                      {angka(row.keluar).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#1E3A5F]">
                      {angka(row.saldoAkhir).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-[#6B7280]">{row.unit}</td>
                  </tr>
                ))}
                {itemTunggal && (
                  <tr className="bg-[#F5F7FA] font-bold">
                    <td colSpan={2} className="px-3 py-2.5 text-[#1E3A5F]">
                      TOTAL
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">
                      {total.saldoAwal.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                      {total.masuk.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-red-700">
                      {total.keluar.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">
                      {total.saldoAkhir.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      ) : dailyLoading ? (
        <p className="p-6 text-center text-sm text-[#6B7280]">Memuat rekap harian WIP...</p>
      ) : dailyError ? (
        <p role="alert" className="p-6 text-center text-sm text-[#EF4444]">
          {dailyError}
        </p>
      ) : dailyRows.length === 0 ? (
        <Empty>Tidak ada mutasi WIP pada periode ini.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                <Th>Tanggal</Th>
                <Th>Item</Th>
                <Th>Divisi</Th>
                <Th right>Stok Awal</Th>
                <Th right>Masuk</Th>
                <Th right>Keluar Produksi</Th>
                <Th right>Keluar Transfer</Th>
                <Th right>Keluar Lain</Th>
                <Th right>Sisa</Th>
                <Th>Satuan</Th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((row) => (
                <tr
                  key={`${row.tanggal}:${row.divisiId}:${row.itemId}`}
                  className="border-b border-slate-50 hover:bg-[#F5F7FA]"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[#1F2937]">
                    {row.tanggal}
                  </td>
                  <td className="px-3 py-2.5 text-[#1F2937]">
                    <span className="font-mono text-xs text-[#6B7280]">{row.kode}</span> - {row.nama}
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7280]">{row.divisiNama}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#6B7280]">
                    {angka(row.stokAwal).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                    {angka(row.masuk).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-700">
                    {angka(row.keluarProduksi).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-700">
                    {angka(row.keluarTransfer).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-700">
                    {angka(row.keluarLain).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#1E3A5F]">
                    {angka(row.sisa).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7280]">{row.unit}</td>
                </tr>
              ))}
              {dailyTotal && (
                <tr className="bg-[#F5F7FA] font-bold">
                  <td colSpan={3} className="px-3 py-2.5 text-[#1E3A5F]">
                    TOTAL {dailyTotal.kode} - {dailyTotal.nama}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">
                    {dailyTotal.stokAwal.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                    {dailyTotal.masuk.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-700">
                    {dailyTotal.keluarProduksi.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-700">
                    {dailyTotal.keluarTransfer.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-700">
                    {dailyTotal.keluarLain.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">
                    {dailyTotal.sisa.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7280]">{dailyTotal.unit}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-slate-100 px-4 py-3 text-xs text-[#6B7280]">
        {mode === "ringkas"
          ? "WIP adalah material yang sudah masuk divisi, bukan stok gudang. Saldo akhir = saldo awal periode + masuk - keluar; mutasi keluar termasuk konsumsi produksi. Angka mengikuti halaman Pemakaian Material. Baris tanpa saldo atau mutasi hanya muncul jika item dipilih eksplisit."
          : "Rekap harian dihitung dari pemakaian material, konsumsi produksi, dan transfer WIP. Keluar transfer mengikuti tanggal approval. Tanggal kosong berarti bulan berjalan sampai hari ini. Sisa menjadi stok awal hari berikutnya; total hanya ditampilkan saat satu item dipilih."}
      </p>
    </Panel>
  );
}
