import { useCallback, useMemo, useState } from "react";
import KpiStrip from "../PlanProduction/KpiStrip";
import {
  gabungWip,
  totalMenungguQcUlang,
  totalRejectFinal,
  totalSelesai,
  totalTransit,
  totalWip,
  totalWipByJenis,
  type HasilRow,
  type KeputusanQc,
  type Perpindahan,
  type PosisiWip,
  type Repair,
} from "./data";
import { Empty, FIELD, Panel, Th } from "./ui";

interface DivisiRow {
  divisi: string;
  item: string;
  diproses: number;
  normal: number;
  repair: number;
  reject: number;
  diserahkan: number;
  wip: number | null;
}

export default function RingkasanTab({
  hasil,
  wip,
  transfers,
  repairs,
  keputusanQc,
}: {
  hasil: HasilRow[];
  wip: PosisiWip[];
  transfers: Perpindahan[];
  repairs: Repair[];
  keputusanQc: KeputusanQc[];
}) {
  const [fDari, setFDari] = useState("");
  const [fSampai, setFSampai] = useState("");

  const dalamPeriode = useCallback(
    (tanggal: string) => (!fDari || tanggal >= fDari) && (!fSampai || tanggal <= fSampai),
    [fDari, fSampai],
  );
  const hasilPeriode = useMemo(() => hasil.filter((r) => dalamPeriode(r.tanggal)), [hasil, dalamPeriode]);
  const keputusanPeriode = useMemo(() => keputusanQc.filter((k) => dalamPeriode(k.tanggal)), [keputusanQc, dalamPeriode]);
  const repairPeriode = useMemo(() => repairs.filter((r) => dalamPeriode(r.tanggalPemeriksaan)), [repairs, dalamPeriode]);

  const wipPerDivisi = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of gabungWip(wip)) m.set(r.posisi, (m.get(r.posisi) ?? 0) + r.jumlah);
    return m;
  }, [wip]);

  const kpi = useMemo(() => {
    let normal = 0;
    let repair = 0;
    let rejectProses = 0;
    let prosesTotal = 0;
    for (const r of hasilPeriode) {
      rejectProses += r.reject;
      prosesTotal += r.hasilBaik;
      if (r.jenis === "NORMAL") normal += r.hasilBaik;
      else repair += r.hasilBaik;
    }
    return {
      normal,
      repair,
      rejectProses,
      prosesTotal,
      selesai: totalSelesai(keputusanPeriode),
      rejectFinal: totalRejectFinal(keputusanPeriode, repairPeriode, transfers),
      wipNormal: totalWipByJenis(wip, transfers, "NORMAL"),
      wipRepair: totalWipByJenis(wip, transfers, "REPAIR"),
      wipTotal: totalWip(wip, transfers),
      transit: totalTransit(transfers),
      menungguQcUlang: totalMenungguQcUlang(wip),
    };
  }, [hasilPeriode, keputusanPeriode, repairPeriode, wip, transfers]);

  const rows = useMemo<DivisiRow[]>(() => {
    const map = new Map<string, DivisiRow>();
    for (const r of hasilPeriode) {
      const key = `${r.divisi}|${r.itemKode}`;
      const cur = map.get(key) ?? { divisi: r.divisi, item: `${r.itemKode} · ${r.itemNama}`, diproses: 0, normal: 0, repair: 0, reject: 0, diserahkan: 0, wip: null };
      cur.diproses += r.diproses;
      cur.reject += r.reject;
      cur.diserahkan += r.diserahkan;
      if (r.jenis === "NORMAL") cur.normal += r.hasilBaik;
      else cur.repair += r.hasilBaik;
      map.set(key, cur);
    }
    const out = [...map.values()].sort((a, b) => a.divisi.localeCompare(b.divisi) || a.item.localeCompare(b.item));
    const seen = new Set<string>();
    for (const r of out) {
      if (!seen.has(r.divisi)) {
        seen.add(r.divisi);
        r.wip = wipPerDivisi.get(r.divisi) ?? 0;
      }
    }
    return out;
  }, [hasilPeriode, wipPerDivisi]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({ diproses: a.diproses + r.diproses, normal: a.normal + r.normal, repair: a.repair + r.repair, reject: a.reject + r.reject, diserahkan: a.diserahkan + r.diserahkan }),
        { diproses: 0, normal: 0, repair: 0, reject: 0, diserahkan: 0 },
      ),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
          Dari
          <input type="date" value={fDari} onChange={(e) => setFDari(e.target.value)} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
          Sampai
          <input type="date" value={fSampai} onChange={(e) => setFSampai(e.target.value)} className={FIELD} />
        </label>
        <p className="pb-2.5 text-sm text-[#6B7280]">Periode berlaku untuk hasil proses, hasil selesai, dan reject final. WIP selalu saldo terkini.</p>
      </div>

      <KpiStrip
        items={[
          { label: "Hasil Produksi Selesai", value: kpi.selesai.toLocaleString("id-ID"), tone: "green" },
          { label: "Reject Final", value: kpi.rejectFinal.toLocaleString("id-ID"), tone: "red" },
          { label: "Total WIP Aktif", value: kpi.wipTotal.toLocaleString("id-ID"), tone: "navy" },
          { label: "Unit Transit", value: kpi.transit.toLocaleString("id-ID") },
          { label: "Menunggu QC Ulang", value: kpi.menungguQcUlang.toLocaleString("id-ID") },
          { label: "Hasil Proses (bukan produk akhir)", value: kpi.prosesTotal.toLocaleString("id-ID"), tone: "muted" },
          { label: "WIP Repair", value: kpi.wipRepair.toLocaleString("id-ID") },
        ]}
      />

      <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-[#6B7280]">
        <strong className="text-[#1F2937]">Definisi:</strong> Hasil Produksi Selesai = unit yang lulus QC. Reject Final = reject saat repair + reject keputusan QC. Total WIP Aktif = seluruh saldo posisi fisik + transit, dihitung satu kali. Menunggu QC Ulang dan WIP Repair adalah bagian dari Total WIP, bukan tambahan.
      </p>

      <Panel title={<>Hasil Proses per Divisi <span className="text-xs font-normal text-[#6B7280]">· bukan produk akhir</span></>}>
        {rows.length === 0 ? (
          <Empty>Tidak ada data hasil produksi pada periode ini.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                  <Th>Divisi</Th>
                  <Th>Item Hasil</Th>
                  <Th right>Jumlah Diproses</Th>
                  <Th right>Hasil Proses Normal</Th>
                  <Th right>Hasil Proses Repair</Th>
                  <Th right>Reject Proses</Th>
                  <Th right>Jumlah Diserahkan</Th>
                  <Th right>Total WIP Saat Ini</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.divisi}-${r.item}`} className="border-b border-slate-50 hover:bg-[#F5F7FA]">
                    <td className="px-3 py-2.5 font-medium text-[#1F2937]">{r.divisi}</td>
                    <td className="px-3 py-2.5 text-[#1F2937]">{r.item}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{r.diproses.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-700">{r.normal.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">{r.repair.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#EF4444]">{r.reject.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{r.diserahkan.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#1E3A5F]">{r.wip === null ? "—" : r.wip.toLocaleString("id-ID")}</td>
                  </tr>
                ))}
                <tr className="bg-[#F5F7FA] font-bold">
                  <td colSpan={2} className="px-3 py-2.5 text-[#1E3A5F]">TOTAL</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">{totals.diproses.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{totals.normal.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">{totals.repair.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#EF4444]">{totals.reject.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">{totals.diserahkan.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">{kpi.wipTotal.toLocaleString("id-ID")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-xs text-[#6B7280]">
        Hasil proses divisi adalah output tiap proses, bukan produk selesai. Produk selesai hanya dari keputusan QC. Total WIP di baris TOTAL adalah saldo seluruh posisi aktif (semua divisi + transit), bukan penjumlahan kolom WIP per divisi.
      </p>
    </div>
  );
}
