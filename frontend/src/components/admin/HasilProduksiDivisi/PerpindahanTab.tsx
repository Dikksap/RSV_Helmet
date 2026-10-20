import { useMemo, useState, type FormEvent } from "react";
import {
  BADGE,
  DIVISI,
  ITEM_DIVISI,
  STATUS_PINDAH_LABEL,
  fmtTanggal,
  hariIni,
  itemOf,
  type Perpindahan,
} from "./data";
import { CARD, Empty, FIELD, Panel, Th, btnPrimary, miniBtn } from "./ui";

type Baru = { tanggal: string; itemKode: string; itemNama: string; asal: string; tujuan: string; dikirim: number; catatan: string };

export default function PerpindahanTab({
  rows,
  onKirim,
  onTerima,
  onBatal,
}: {
  rows: Perpindahan[];
  onKirim: (body: Baru) => string | null;
  onTerima: (id: number, diterima: number) => string | null;
  onBatal: (id: number) => string | null;
}) {
  const [tanggal, setTanggal] = useState(hariIni());
  const [divisi, setDivisi] = useState(DIVISI[0]);
  const [itemKode, setItemKode] = useState(ITEM_DIVISI[DIVISI[0]][0].kode);
  const [tujuan, setTujuan] = useState(DIVISI[1]);
  const [dikirim, setDikirim] = useState("");
  const [catatan, setCatatan] = useState("");
  const [terima, setTerima] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [fStatus, setFStatus] = useState("SEMUA");

  const gantiDivisi = (d: string) => {
    setDivisi(d);
    setItemKode((ITEM_DIVISI[d] ?? [])[0]?.kode ?? "");
  };

  const kirim = (e: FormEvent) => {
    e.preventDefault();
    setPesan(null);
    setError(null);
    const item = itemOf(divisi, itemKode);
    const jumlah = Math.floor(Number(dikirim));
    if (!item) return setError("Pilih item yang dikirim.");
    if (divisi === tujuan) return setError("Divisi asal dan tujuan tidak boleh sama.");
    if (!Number.isFinite(jumlah) || jumlah <= 0) return setError("Jumlah dikirim harus bilangan bulat lebih dari 0.");
    if (tanggal > hariIni()) return setError("Tanggal tidak boleh melebihi hari ini.");
    const err = onKirim({ tanggal, itemKode: item.kode, itemNama: item.nama, asal: divisi, tujuan, dikirim: jumlah, catatan: catatan.trim() });
    if (err) return setError(err);
    setPesan(`Pengiriman ${item.nama} ${jumlah.toLocaleString("id-ID")} pcs ${divisi} → ${tujuan} dicatat sebagai transit (dihitung sekali sebagai WIP).`);
    setDikirim("");
    setCatatan("");
  };

  const terimaRow = (r: Perpindahan) => {
    setPesan(null);
    setError(null);
    const jumlah = Math.floor(Number(terima[r.id]));
    if (!Number.isFinite(jumlah) || jumlah <= 0) return setError(`Jumlah diterima ${r.nomor} harus bilangan bulat lebih dari 0.`);
    if (jumlah > r.dikirim) return setError(`Jumlah diterima ${r.nomor} tidak boleh melebihi jumlah dikirim (${r.dikirim}).`);
    const err = onTerima(r.id, jumlah);
    if (err) return setError(err);
    setPesan(`Penerimaan ${r.nomor}: ${jumlah.toLocaleString("id-ID")} pcs${jumlah < r.dikirim ? `, selisih ${(r.dikirim - jumlah).toLocaleString("id-ID")} pcs` : ""}.`);
    setTerima((p) => ({ ...p, [r.id]: "" }));
  };

  const batalRow = (r: Perpindahan) => {
    setPesan(null);
    setError(null);
    const err = onBatal(r.id);
    if (err) return setError(err);
    setPesan(`Pengiriman ${r.nomor} dibatalkan; ${r.dikirim.toLocaleString("id-ID")} pcs kembali ke posisi ${r.asal}.`);
  };

  const rowsFilter = useMemo(() => rows.filter((r) => fStatus === "SEMUA" || r.status === fStatus), [rows, fStatus]);

  return (
    <div className="space-y-6">
      <section className={`${CARD} p-4`}>
        <h3 className="font-semibold text-[#1E3A5F]">Kirim Batok Antar Divisi</h3>
        <p className="mt-1 text-sm text-[#6B7280]">Saldo divisi asal berkurang saat kirim; selama transit batok tidak dihitung di divisi asal maupun tujuan, lalu masuk ke antrean tujuan setelah diterima.</p>
        <form onSubmit={kirim} className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Tanggal
            <input type="date" max={hariIni()} value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Divisi asal
            <select value={divisi} onChange={(e) => gantiDivisi(e.target.value)} className={FIELD}>
              {DIVISI.map((d) => (<option key={d} value={d}>{d}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937] xl:col-span-2">
            Item / batch
            <select value={itemKode} onChange={(e) => setItemKode(e.target.value)} className={FIELD}>
              {(ITEM_DIVISI[divisi] ?? []).map((i) => (<option key={i.kode} value={i.kode}>{i.kode} · {i.nama}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Divisi tujuan
            <select value={tujuan} onChange={(e) => setTujuan(e.target.value)} className={FIELD}>
              {DIVISI.map((d) => (<option key={d} value={d}>{d}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Jumlah dikirim
            <input type="number" min={1} step={1} placeholder="0" value={dikirim} onChange={(e) => setDikirim(e.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937] xl:col-span-4">
            Catatan
            <input type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Opsional" className={FIELD} />
          </label>
          <button type="submit" className={btnPrimary}>Kirim</button>
        </form>
        {error && <p role="alert" className="mt-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-sm text-[#EF4444]">{error}</p>}
        {pesan && <p role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{pesan}</p>}
      </section>

      <Panel
        title={<>Riwayat Perpindahan <span className="text-xs font-normal text-[#6B7280]">· {rowsFilter.length} transaksi</span></>}
        extra={
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Status
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={FIELD}>
              <option value="SEMUA">Semua</option>
              {(["TRANSIT", "DITERIMA", "SELISIH", "BATAL"] as const).map((s) => (<option key={s} value={s}>{STATUS_PINDAH_LABEL[s]}</option>))}
            </select>
          </label>
        }
      >
        {rowsFilter.length === 0 ? (
          <Empty>Tidak ada transaksi pada filter ini.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                  <Th>Nomor</Th>
                  <Th>Tanggal</Th>
                  <Th>Item / Batch</Th>
                  <Th>Asal</Th>
                  <Th>Tujuan</Th>
                  <Th right>Dikirim</Th>
                  <Th right>Diterima</Th>
                  <Th right>Selisih</Th>
                  <Th>Status</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {rowsFilter.map((r) => {
                  const selisih = r.diterima === null ? null : r.dikirim - r.diterima;
                  return (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-[#F5F7FA]">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-[#1E3A5F]">{r.nomor}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">{fmtTanggal(r.tanggal)}</td>
                      <td className="px-3 py-2.5 text-[#1F2937]"><span className="font-mono text-xs text-[#6B7280]">{r.itemKode}</span> · {r.itemNama}</td>
                      <td className="px-3 py-2.5 text-[#1F2937]">{r.asal}</td>
                      <td className="px-3 py-2.5 text-[#1F2937]">{r.tujuan}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{r.dikirim.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{r.diterima === null ? "—" : r.diterima.toLocaleString("id-ID")}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${selisih ? "font-semibold text-[#EF4444]" : "text-[#6B7280]"}`}>{selisih === null ? "—" : selisih.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5"><span className={BADGE[r.status]}>{STATUS_PINDAH_LABEL[r.status]}</span></td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {r.status === "TRANSIT" ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={r.dikirim}
                              step={1}
                              placeholder="terima"
                              value={terima[r.id] ?? ""}
                              onChange={(e) => setTerima((p) => ({ ...p, [r.id]: e.target.value }))}
                              className="h-9 w-24 rounded-lg border border-[#D1D5DB] px-2 text-sm focus:outline-2 focus:outline-[#00A8E8]"
                            />
                            <button type="button" onClick={() => terimaRow(r)} className={miniBtn}>Terima</button>
                            <button type="button" onClick={() => batalRow(r)} className={miniBtn}>Batal</button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#6B7280]">{r.catatan || "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-xs text-[#6B7280]">
        Pembatalan tidak menghapus riwayat: transaksi ditandai dibatalkan dan saldo dikoreksi. Jumlah diterima tidak boleh melebihi jumlah dikirim; selisih ditampilkan untuk ditindaklanjuti.
      </p>
    </div>
  );
}
