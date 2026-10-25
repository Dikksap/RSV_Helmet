import { useEffect, useState, type FormEvent } from "react";
import type { Divisi } from "../../../api/divisi";
import type { Item } from "../../../api/item";
import {
  getRekapHasilProduksiHarian,
  type RekapData,
  type RekapDivisi,
  type RekapItem,
  type RekapTanggal,
} from "../../../api/hasilProduksiHarian";
import KpiStrip from "../PlanProduction/KpiStrip";
import { Empty, FIELD, Panel, Th, miniBtn } from "./ui";
import { angka } from "./utils";

type Grup = "tanggal" | "divisi" | "item";

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

const grupTab: { key: Grup; label: string }[] = [
  { key: "tanggal", label: "Per Tanggal" },
  { key: "divisi", label: "Per Divisi" },
  { key: "item", label: "Per Item" },
];

function Angka({ value }: { value: number }) {
  return <>{angka(value).toLocaleString("id-ID")}</>;
}

function TotalRow({ total, colSpan }: { total: RekapData["total"]; colSpan: number }) {
  const sisa = angka(total.masuk) - angka(total.hasil);
  return (
    <tr className="bg-[#F5F7FA] font-bold">
      <td colSpan={colSpan} className="px-3 py-2.5 text-[#1E3A5F]">
        TOTAL
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-sky-700">
        <Angka value={total.masuk} />
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
        <Angka value={total.hasil} />
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#1E3A5F]">
        <Angka value={sisa} />
      </td>
    </tr>
  );
}

function TabelTanggal({
  rows,
  total,
  tampilkanTotal,
}: {
  rows: RekapTanggal[];
  total: RekapData["total"];
  tampilkanTotal: boolean;
}) {
  if (rows.length === 0) return <Empty>Tidak ada data produksi pada periode ini.</Empty>;

  // Sisa dihitung per grup (tanggal + divisi) = sum(masuk) − sum(hasil)
  // karena sisa adalah hubungan input → output lintas item, bukan per-item.
  const groupSisa = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.tanggal}|${row.divisiId}`;
    const cur = groupSisa.get(key) ?? 0;
    groupSisa.set(key, cur + angka(row.masuk) - angka(row.hasil));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
            <Th>Tanggal</Th>
            <Th>Item</Th>
            <Th right>Masuk</Th>
            <Th right>Hasil</Th>
            <Th right>Sisa</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const sisa = groupSisa.get(`${row.tanggal}|${row.divisiId}`) ?? 0;
            return (
              <tr key={`${row.tanggal}-${row.itemId}`} className="border-b border-slate-50">
                <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">{row.tanggal.split("-").reverse().join("/")}</td>
                <td className="px-3 py-2.5 text-[#1F2937]">
                  <span className="font-mono text-xs text-[#6B7280]">{row.itemKode}</span> — {row.itemNama}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-sky-700"><Angka value={row.masuk} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700"><Angka value={row.hasil} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#1E3A5F]"><Angka value={sisa} /></td>
              </tr>
            );
          })}
          {tampilkanTotal && <TotalRow total={total} colSpan={2} />}
        </tbody>
      </table>
    </div>
  );
}

function TabelDivisi({
  rows,
  total,
  tampilkanTotal,
}: {
  rows: RekapDivisi[];
  total: RekapData["total"];
  tampilkanTotal: boolean;
}) {
  if (rows.length === 0) return <Empty>Tidak ada data produksi pada periode ini.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
            <Th>Divisi</Th>
            <Th>Item</Th>
            <Th>Satuan</Th>
            <Th right>MASUK</Th>
            <Th right>HASIL</Th>
            <Th right>KELUAR</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.divisiId}-${row.itemId}`} className="border-b border-slate-50">
              <td className="px-3 py-2.5 font-medium text-[#1F2937]">{row.divisiNama}</td>
              <td className="px-3 py-2.5 text-[#1F2937]">
                <span className="font-mono text-xs text-[#6B7280]">{row.itemKode}</span> — {row.itemNama}
              </td>
              <td className="px-3 py-2.5 text-[#6B7280]">{row.satuan}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-sky-700"><Angka value={row.masuk} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700"><Angka value={row.hasil} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-red-700"><Angka value={row.keluar} /></td>
            </tr>
          ))}
          {tampilkanTotal && <TotalRow total={total} colSpan={3} />}
        </tbody>
      </table>
    </div>
  );
}

function TabelItem({
  rows,
  total,
  tampilkanTotal,
}: {
  rows: RekapItem[];
  total: RekapData["total"];
  tampilkanTotal: boolean;
}) {
  if (rows.length === 0) return <Empty>Tidak ada data produksi pada periode ini.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
            <Th>Item</Th>
            <Th>Satuan</Th>
            <Th right>MASUK</Th>
            <Th right>HASIL</Th>
            <Th right>KELUAR</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.itemId} className="border-b border-slate-50">
              <td className="px-3 py-2.5 text-[#1F2937]">
                <span className="font-mono text-xs text-[#6B7280]">{row.itemKode}</span> — {row.itemNama}
              </td>
              <td className="px-3 py-2.5 text-[#6B7280]">{row.satuan}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-sky-700"><Angka value={row.masuk} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700"><Angka value={row.hasil} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-red-700"><Angka value={row.keluar} /></td>
            </tr>
          ))}
          {tampilkanTotal && <TotalRow total={total} colSpan={2} />}
        </tbody>
      </table>
    </div>
  );
}

export default function RekapTab({ divisis, items, refreshKey, lockedDivisiId = null }: Props) {
  const terkunci = lockedDivisiId !== null;
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [divisiId, setDivisiId] = useState(terkunci ? String(lockedDivisiId) : "");
  const [itemId, setItemId] = useState("");
  const [applied, setApplied] = useState<Filter>(() => ({
    ...FILTER_AWAL,
    divisiId: terkunci ? String(lockedDivisiId) : "",
  }));
  const [grup, setGrup] = useState<Grup>("tanggal");

  const [data, setData] = useState<RekapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await getRekapHasilProduksiHarian({
          divisiId: lockedDivisiId ?? (applied.divisiId ? Number(applied.divisiId) : undefined),
          itemId: applied.itemId ? Number(applied.itemId) : undefined,
          dari: applied.dari || undefined,
          sampai: applied.sampai || undefined,
        });
        if (cancelled) return;
        setData(result.data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setData(null);
        setError(err instanceof Error ? err.message : "Gagal memuat rekap.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [applied, refreshKey, lockedDivisiId]);

  const terapkan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApplied({
      dari,
      sampai,
      divisiId: lockedDivisiId !== null ? String(lockedDivisiId) : divisiId,
      itemId,
    });
  };

  return (
    <Panel
      title="Rekap Hasil Produksi"
      extra={<span className="text-xs text-[#6B7280]">Filter berlaku untuk semua tabel</span>}
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

      {loading ? (
        <p className="p-6 text-center text-sm text-[#6B7280]">Memuat rekap...</p>
      ) : error ? (
        <p role="alert" className="p-6 text-center text-sm text-[#EF4444]">
          {error}
        </p>
      ) : !data ? (
        <Empty>Belum ada data rekap.</Empty>
      ) : (
        <>
          <p className="px-4 pt-4 text-xs text-[#6B7280]">
            Rekap ini hanya memuat aktivitas produksi MASUK, HASIL, dan KELUAR; saldo WIP tidak dicampur di sini.
            {data.perItem.length > 1 &&
              " Total tidak dijumlahkan lintas item/satuan. Pilih satu item jika ingin melihat total."}
          </p>
          {data.perItem.length <= 1 && (
            <div className="p-4">
              <KpiStrip
                items={[
                  { label: "Total MASUK", value: angka(data.total.masuk).toLocaleString("id-ID"), tone: "navy" },
                  { label: "Total HASIL", value: angka(data.total.hasil).toLocaleString("id-ID"), tone: "green" },
                  {
                    label: "Selisih (hasil − masuk)",
                    value: (angka(data.total.hasil) - angka(data.total.masuk)).toLocaleString("id-ID"),
                    tone: "muted",
                  },
                  { label: "Total KELUAR", value: angka(data.total.keluar).toLocaleString("id-ID"), tone: "red" },
                ]}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {grupTab.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setGrup(tab.key)}
                aria-pressed={grup === tab.key}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  grup === tab.key ? "bg-[#1E3A5F] text-white" : "text-[#6B7280] hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {grup === "tanggal" && (
            <TabelTanggal
              rows={data.perTanggal}
              total={data.total}
              tampilkanTotal={data.perItem.length <= 1}
            />
          )}
          {grup === "divisi" && (
            <TabelDivisi
              rows={data.perDivisi}
              total={data.total}
              tampilkanTotal={data.perItem.length <= 1}
            />
          )}
          {grup === "item" && (
            <TabelItem
              rows={data.perItem}
              total={data.total}
              tampilkanTotal={data.perItem.length <= 1}
            />
          )}
        </>
      )}
    </Panel>
  );
}
