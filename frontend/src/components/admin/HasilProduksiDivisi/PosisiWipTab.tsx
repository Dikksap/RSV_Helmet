import { useMemo, useState } from "react";
import {
  BADGE,
  fmtTanggal,
  gabungWip,
  hariIni,
  lamaMenunggu,
  totalSelesai,
  totalWip,
  type KeputusanQc,
  type Perpindahan,
  type PosisiWip,
} from "./data";
import { CARD, Empty, FIELD, Panel, Th, btnPrimary } from "./ui";

interface Baris {
  key: string;
  item: string;
  posisi: string;
  status: string;
  jenis: "NORMAL" | "REPAIR";
  jumlah: number;
  sejak: string;
  transit: boolean;
}

const badgeWip = (r: Baris) => {
  if (r.transit) return BADGE.TRANSIT;
  if (r.status === "Selisih Transit") return BADGE["Selisih Transit"];
  if (r.jenis === "REPAIR") {
    if (r.status === "Sedang Repair") return BADGE.SEDANG_REPAIR;
    if (r.status === "Menunggu QC") return BADGE.MENUNGGU_QC;
    if (r.status === "Menunggu QC Ulang") return BADGE.MENUNGGU;
    return BADGE.MENUNGGU_REPAIR;
  }
  return BADGE.DITERIMA;
};

export default function PosisiWipTab({
  wip,
  transfers,
  keputusanQc,
  onPutuskan,
}: {
  wip: PosisiWip[];
  transfers: Perpindahan[];
  keputusanQc: KeputusanQc[];
  onPutuskan: (body: { tanggal: string; itemKode: string; jumlah: number; hasil: "SELESAI" | "REJECT"; catatan: string }) => string | null;
}) {
  const baris = useMemo<Baris[]>(() => {
    const posisi: Baris[] = gabungWip(wip).map((r) => ({
      key: `w-${r.id}`,
      item: `${r.itemKode} · ${r.itemNama}`,
      posisi: r.posisi,
      status: r.status,
      jenis: r.jenis,
      jumlah: r.jumlah,
      sejak: r.sejak,
      transit: false,
    }));
    const transit: Baris[] = transfers
      .filter((t) => t.status === "TRANSIT")
      .map((t) => ({
        key: `t-${t.id}`,
        item: `${t.itemKode} · ${t.itemNama}`,
        posisi: `Transit: ${t.asal} → ${t.tujuan}`,
        status: "Dalam Transit",
        jenis: "NORMAL",
        jumlah: t.dikirim,
        sejak: t.tanggal,
        transit: true,
      }));
    return [...posisi, ...transit].sort((a, b) => a.posisi.localeCompare(b.posisi) || a.item.localeCompare(b.item));
  }, [wip, transfers]);

  const perPosisi = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of baris) m.set(r.posisi, (m.get(r.posisi) ?? 0) + r.jumlah);
    return [...m.entries()];
  }, [baris]);

  const antreanQc = useMemo(() => gabungWip(wip).filter((w) => w.posisi === "QC" && w.status === "Menunggu Pemeriksaan"), [wip]);
  const [itemKode, setItemKode] = useState("");
  const [tanggal, setTanggal] = useState(hariIni());
  const [jumlah, setJumlah] = useState("");
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const itemTerpilih = antreanQc.find((w) => w.itemKode === itemKode) ?? antreanQc[0];

  const putuskan = (hasil: "SELESAI" | "REJECT") => {
    setError(null);
    setPesan(null);
    if (!itemTerpilih) return setError("Tidak ada unit di antrean pemeriksaan QC.");
    const n = Math.floor(Number(jumlah));
    if (!Number.isFinite(n) || n <= 0) return setError("Jumlah keputusan QC harus bilangan bulat lebih dari 0.");
    if (tanggal > hariIni()) return setError("Tanggal keputusan tidak boleh melebihi hari ini.");
    const err = onPutuskan({ tanggal, itemKode: itemTerpilih.itemKode, jumlah: n, hasil, catatan: catatan.trim() });
    if (err) return setError(err);
    setPesan(
      `${n.toLocaleString("id-ID")} pcs ${itemTerpilih.itemNama} ${
        hasil === "SELESAI" ? "lulus QC dan dicatat sebagai hasil produksi selesai" : "dinyatakan reject final"
      }.`,
    );
    setJumlah("");
    setCatatan("");
  };

  const total = totalWip(wip, transfers);

  return (
    <div className="space-y-6">
      <section className={`${CARD} p-4`}>
        <h3 className="font-semibold text-[#1E3A5F]">Keputusan QC Akhir</h3>
        <p className="mt-1 text-sm text-[#6B7280]">
          Hanya unit yang lulus QC yang dicatat sebagai hasil produksi selesai dan keluar dari WIP. Reject dikeluarkan dari WIP sebagai reject final. Unit QC ulang hasil repair diputuskan di tab Repair.
        </p>
        {antreanQc.length === 0 ? (
          <p className="mt-3 text-sm text-[#6B7280]">Tidak ada unit yang menunggu pemeriksaan QC.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-3 xl:grid-cols-5">
              <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937] xl:col-span-2">
                Item di posisi QC
                <select value={itemTerpilih?.itemKode ?? ""} onChange={(e) => setItemKode(e.target.value)} className={FIELD}>
                  {antreanQc.map((w) => (
                    <option key={w.itemKode} value={w.itemKode}>{w.itemKode} · {w.itemNama} ({w.jumlah.toLocaleString("id-ID")} pcs)</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
                Tanggal
                <input type="date" max={hariIni()} value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={FIELD} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
                Jumlah
                <input type="number" min={1} max={itemTerpilih?.jumlah} step={1} placeholder="0" value={jumlah} onChange={(e) => setJumlah(e.target.value)} className={FIELD} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937] xl:col-span-2">
                Catatan
                <input type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Opsional" className={FIELD} />
              </label>
              <button type="button" onClick={() => putuskan("SELESAI")} className={btnPrimary}>Lulus QC</button>
              <button
                type="button"
                onClick={() => putuskan("REJECT")}
                className="h-11 rounded-lg bg-[#EF4444] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#DC2626] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EF4444]"
              >
                Reject final
              </button>
            </div>
            {error && <p role="alert" className="mt-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-sm text-[#EF4444]">{error}</p>}
            {pesan && <p role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{pesan}</p>}
          </>
        )}
        <p className="mt-3 text-xs text-[#6B7280]">
          Total hasil produksi selesai tercatat: <span className="font-semibold text-[#1E3A5F]">{totalSelesai(keputusanQc).toLocaleString("id-ID")} pcs</span>
          {keputusanQc[0] ? ` · keputusan terakhir ${fmtTanggal(keputusanQc[0].tanggal)}` : ""}.
        </p>
      </section>

      <Panel title={<>Posisi WIP <span className="text-xs font-normal text-[#6B7280]">· {baris.length} posisi aktif</span></>}>
        {baris.length === 0 ? (
          <Empty>Tidak ada batok dalam aliran produksi.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                  <Th>Item</Th>
                  <Th>Posisi / Divisi Saat Ini</Th>
                  <Th>Status Pengerjaan</Th>
                  <Th>Jenis Pekerjaan</Th>
                  <Th right>Jumlah Fisik</Th>
                  <Th>Lama Menunggu</Th>
                </tr>
              </thead>
              <tbody>
                {baris.map((r) => (
                  <tr key={r.key} className="border-b border-slate-50 hover:bg-[#F5F7FA]">
                    <td className="px-3 py-2.5 text-[#1F2937]">{r.item}</td>
                    <td className="px-3 py-2.5 font-medium text-[#1F2937]">{r.posisi}</td>
                    <td className="px-3 py-2.5"><span className={badgeWip(r)}>{r.status}</span></td>
                    <td className="px-3 py-2.5 text-[#1F2937]">{r.jenis === "NORMAL" ? "Produksi Normal" : "Repair"}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#1E3A5F]">{r.jumlah.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2.5 text-[#6B7280]">{lamaMenunggu(r.sejak)}</td>
                  </tr>
                ))}
                <tr className="bg-[#F5F7FA] font-bold">
                  <td colSpan={4} className="px-3 py-2.5 text-[#1E3A5F]">TOTAL WIP</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">{total.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2.5" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <section className={`${CARD} p-4`}>
        <h3 className="font-semibold text-[#1E3A5F]">Ringkasan per Posisi</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {perPosisi.map(([posisi, jumlah]) => (
            <li key={posisi} className="flex items-center justify-between gap-3 border-b border-slate-50 pb-2">
              <span className="text-[#1F2937]">{posisi}</span>
              <span className="font-semibold tabular-nums text-[#1E3A5F]">{jumlah.toLocaleString("id-ID")}</span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 pt-1">
            <span className="font-semibold text-[#1E3A5F]">Total</span>
            <span className="font-bold tabular-nums text-[#1E3A5F]">{total.toLocaleString("id-ID")}</span>
          </li>
        </ul>
      </section>

      <p className="text-xs text-[#6B7280]">
        Satu batok hanya berada pada satu posisi aktif: saat dikirim, saldo divisi asal dikurangi dan batok muncul sebagai transit sampai diterima divisi tujuan. Unit menunggu QC ulang tetap WIP; unit lulus QC atau reject final keluar dari WIP.
      </p>
    </div>
  );
}
