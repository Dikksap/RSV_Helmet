import { useEffect, useState, type FormEvent } from "react";
import type { Divisi } from "../../../api/divisi";
import {
  getHasilProduksiHarian,
  listHasilProduksiHarian,
  type HasilProduksiItemRecord,
  type HasilProduksiRecord,
  type TipeHasilProduksiItem,
} from "../../../api/hasilProduksiHarian";
import { Badge, Empty, FIELD, Panel, Th, miniBtn } from "./ui";
import { angka, formatTanggal, ringkasItems } from "./utils";

const LIMIT = 20;

const BADGE_TIPE: Record<TipeHasilProduksiItem, string> = {
  HASIL: "bg-emerald-100 text-emerald-800",
  KELUAR: "bg-red-100 text-red-700",
  MASUK: "bg-slate-100 text-slate-600",
};

interface Props {
  divisis: Divisi[];
  refreshKey: number;
  lockedDivisiId?: number | null;
}

interface Filter {
  dari: string;
  sampai: string;
  divisiId: string;
  q: string;
}

const FILTER_AWAL: Filter = { dari: "", sampai: "", divisiId: "", q: "" };

function ringkasTipe(items: HasilProduksiRecord["items"]) {
  return ringkasItems(items);
}

function TabelDetail({
  judul,
  items,
}: {
  judul: string;
  items: HasilProduksiItemRecord[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-bold text-[#1E3A5F]">{judul}</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
              <Th>Item</Th>
              <Th right>Jumlah</Th>
              <Th>Keterangan</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-50">
                <td className="px-3 py-2.5 text-[#1F2937]">
                  <span className="font-mono text-xs text-[#6B7280]">{item.item.kode}</span> — {item.item.nama}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-[#1F2937]">
                  {angka(item.jumlah).toLocaleString("id-ID")} {item.item.unit}
                </td>
                <td className="px-3 py-2.5 text-[#6B7280]">{item.keterangan || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelWipKonsumsi({ items }: { items: HasilProduksiItemRecord[] }) {
  const rows = items.flatMap((item) =>
    (item.pemakaian ?? []).map((pakai) => ({ id: pakai.id, item, pakai })),
  );
  if (rows.length === 0) return null;

  return (
    <div className="mt-5">
      <h4 className="mb-2 text-sm font-bold text-[#1E3A5F]">Konsumsi WIP</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
              <Th>Item WIP</Th>
              <Th>Divisi WIP</Th>
              <Th>Tanggal Masuk WIP</Th>
              <Th right>Jumlah</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, item, pakai }) => (
              <tr key={id} className="border-b border-slate-50">
                <td className="px-3 py-2.5 text-[#1F2937]">
                  <span className="font-mono text-xs text-[#6B7280]">{item.item.kode}</span> — {item.item.nama}
                </td>
                <td className="px-3 py-2.5 text-[#6B7280]">
                  {pakai.pemakaianMaterialItem.pemakaian.divisi.nama}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">
                  {formatTanggal(pakai.pemakaianMaterialItem.pemakaian.tanggal)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-[#1F2937]">
                  {angka(pakai.jumlah).toLocaleString("id-ID")} {item.item.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelWipMasuk({ items }: { items: HasilProduksiItemRecord[] }) {
  const rows = items.flatMap((item) =>
    item.tipe === "HASIL" && item.wipMasuk ? [{ id: item.id, item, wip: item.wipMasuk }] : [],
  );
  if (rows.length === 0) return null;

  return (
    <div className="mt-5">
      <h4 className="mb-2 text-sm font-bold text-[#1E3A5F]">Hasil WIP</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
              <Th>Item</Th>
              <Th>Divisi WIP</Th>
              <Th>Dokumen WIP</Th>
              <Th>Tanggal</Th>
              <Th right>Jumlah Masuk</Th>
              <Th right>Sisa Saat Ini</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, item, wip }) => (
              <tr key={id} className="border-b border-slate-50">
                <td className="px-3 py-2.5 text-[#1F2937]">
                  <span className="font-mono text-xs text-[#6B7280]">{item.item.kode}</span> - {item.item.nama}
                </td>
                <td className="px-3 py-2.5 text-[#6B7280]">{wip.pemakaian.divisi.nama}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-[#6B7280]">
                  {wip.pemakaian.nomor}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">
                  {formatTanggal(wip.pemakaian.tanggal)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-[#1F2937]">
                  {angka(wip.jumlahDiterima).toLocaleString("id-ID")} {wip.satuan ?? item.item.unit}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-[#1F2937]">
                  {angka(wip.jumlahSisa).toLocaleString("id-ID")} {wip.satuan ?? item.item.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelMutasi({ items }: { items: HasilProduksiItemRecord[] }) {
  const rows = items.filter((item) => item.stokMutasi);
  return (
    <div className="mt-5">
      <h4 className="mb-2 text-sm font-bold text-[#1E3A5F]">Mutasi Stok Gudang Terkait</h4>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-[#F5F7FA] px-3 py-2 text-sm text-[#6B7280]">
          Tidak ada mutasi stok gudang baru dari transaksi ini. Hasil SM dicatat sebagai WIP divisi; baris MASUK
          mengikuti pengurangan stok yang sudah dilakukan saat approval/pemakaian.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                <Th>Item</Th>
                <Th>Tipe Produksi</Th>
                <Th>Mutasi</Th>
                <Th right>Jumlah</Th>
                <Th>Tanggal</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-b border-slate-50">
                  <td className="px-3 py-2.5 text-[#1F2937]">
                    <span className="font-mono text-xs text-[#6B7280]">{item.item.kode}</span> — {item.item.nama}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={BADGE_TIPE[item.tipe]}>{item.tipe}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7280]">{item.stokMutasi?.tipe}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-[#1F2937]">
                    {angka(item.stokMutasi?.jumlah ?? 0).toLocaleString("id-ID")} {item.item.unit}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">
                    {item.stokMutasi ? formatTanggal(item.stokMutasi.tanggal) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RiwayatTab({ divisis, refreshKey, lockedDivisiId = null }: Props) {
  const terkunci = lockedDivisiId !== null;
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [divisiId, setDivisiId] = useState(terkunci ? String(lockedDivisiId) : "");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState<Filter>(() => ({
    ...FILTER_AWAL,
    divisiId: terkunci ? String(lockedDivisiId) : "",
  }));
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<HasilProduksiRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<HasilProduksiRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await listHasilProduksiHarian({
          page,
          limit: LIMIT,
          divisiId: lockedDivisiId ?? (applied.divisiId ? Number(applied.divisiId) : undefined),
          dari: applied.dari || undefined,
          sampai: applied.sampai || undefined,
          q: applied.q || undefined,
        });
        if (cancelled) return;
        setRows(result.data);
        setMeta(result.meta);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setRows([]);
        setError(err instanceof Error ? err.message : "Gagal memuat riwayat hasil produksi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [applied, page, refreshKey, lockedDivisiId]);

  useEffect(() => {
    if (!detailOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailOpen]);

  const terapkan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApplied({
      dari,
      sampai,
      divisiId: lockedDivisiId !== null ? String(lockedDivisiId) : divisiId,
      q: q.trim(),
    });
    setPage(1);
  };

  const bukaDetail = async (id: number) => {
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setDetail(await getHasilProduksiHarian(id));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Gagal memuat detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Riwayat Hasil Produksi"
        extra={<span className="text-xs text-[#6B7280]">{meta.total.toLocaleString("id-ID")} transaksi</span>}
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
            Nomor
            <input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Cari nomor HP-..."
              className={FIELD}
            />
          </label>
          <button type="submit" className={`${miniBtn} h-[46px] px-4`}>
            Terapkan
          </button>
        </form>

        {loading ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">Memuat riwayat...</p>
        ) : error ? (
          <p role="alert" className="p-6 text-center text-sm text-[#EF4444]">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <Empty>Tidak ada transaksi pada filter ini.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                  <Th>Nomor</Th>
                  <Th>Tanggal</Th>
                  <Th>Divisi</Th>
                  <Th right>Baris</Th>
                  <Th right>Input</Th>
                  <Th right>Hasil</Th>
                  <Th right>Keluar</Th>
                  <Th>Keterangan</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const ringkasan = ringkasTipe(row.items);
                  return (
                    <tr key={row.id} className="border-b border-slate-50 hover:bg-[#F5F7FA]">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-[#1E3A5F]">
                        {row.nomor}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">
                        {formatTanggal(row.tanggalProduksi)}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-[#1F2937]">{row.divisi.nama}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{row.items.length}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-sky-700">
                        {ringkasan.masuk.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-700">
                        {ringkasan.hasil.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-red-700">
                        {ringkasan.keluar.toLocaleString("id-ID")}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2.5 text-[#6B7280]" title={row.keterangan ?? undefined}>
                        {row.keterangan || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <button type="button" onClick={() => void bukaDetail(row.id)} className={miniBtn}>
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm">
          <span className="text-[#6B7280]">
            Halaman {meta.page} dari {meta.totalPages} · {meta.total.toLocaleString("id-ID")} transaksi
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
              className={miniBtn}
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
              disabled={page >= meta.totalPages || loading}
              className={miniBtn}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </Panel>

      {detailOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0F1C2E]/50 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Detail hasil produksi"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#1E3A5F]">Detail Produksi Harian</h3>
                {detail && (
                  <p className="mt-1 text-sm text-[#6B7280]">
                    {detail.nomor} · {formatTanggal(detail.tanggalProduksi)} · {detail.divisi.nama}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setDetailOpen(false)} className={miniBtn}>
                Tutup
              </button>
            </div>

            {detailLoading ? (
              <p className="p-6 text-center text-sm text-[#6B7280]">Memuat detail...</p>
            ) : detailError ? (
              <p role="alert" className="p-6 text-center text-sm text-[#EF4444]">
                {detailError}
              </p>
            ) : detail ? (
              <>
                {detail.keterangan && (
                  <p className="mt-4 rounded-lg bg-[#F5F7FA] px-3 py-2 text-sm text-[#1F2937]">{detail.keterangan}</p>
                )}
                {(() => {
                  const ringkasan = ringkasTipe(detail.items);
                  const input = detail.items.filter((item) => item.tipe === "MASUK");
                  const hasil = detail.items.filter((item) => item.tipe === "HASIL");
                  const keluar = detail.items.filter((item) => item.tipe === "KELUAR");
                  const wip = input.flatMap((item) => item.pemakaian ?? []);
                  const totalWip = wip.reduce((total, pakai) => total + angka(pakai.jumlah), 0);
                  return (
                    <>
                      <div className="mt-4 flex flex-wrap gap-2 text-sm">
                        <span className="rounded-full bg-sky-50 px-3 py-1.5 font-semibold text-sky-700">
                          MASUK {ringkasan.masuk.toLocaleString("id-ID")}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                          HASIL {ringkasan.hasil.toLocaleString("id-ID")}
                        </span>
                        <span className="rounded-full bg-red-50 px-3 py-1.5 font-semibold text-red-700">
                          KELUAR {ringkasan.keluar.toLocaleString("id-ID")}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
                          Selisih {(ringkasan.hasil - ringkasan.masuk).toLocaleString("id-ID")}
                        </span>
                        {wip.length > 0 && (
                          <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
                            WIP dikonsumsi {totalWip.toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>
                      <TabelDetail judul="Item Input" items={input} />
                      <TabelDetail judul="Item Hasil Produksi" items={hasil} />
                      <TabelDetail judul="Penyesuaian Stok (KELUAR)" items={keluar} />
                      <TabelWipKonsumsi items={input} />
                      <TabelWipMasuk items={hasil} />
                      <TabelMutasi items={detail.items} />
                    </>
                  );
                })()}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
