import { useMemo, useState, type FormEvent } from "react";
import {
  DIVISI,
  ITEM_DIVISI,
  JENIS_LABEL,
  SHIFT,
  fmtTanggal,
  hariIni,
  itemOf,
  type HasilRow,
  type JenisPekerjaan,
} from "./data";
import { CARD, Empty, FIELD, Panel, Th, btnPrimary } from "./ui";

type Baru = Omit<HasilRow, "id">;

export default function HasilTab({ rows, onCatat }: { rows: HasilRow[]; onCatat: (row: Baru) => void }) {
  const [tanggal, setTanggal] = useState(hariIni());
  const [shift, setShift] = useState(SHIFT[0]);
  const [divisi, setDivisi] = useState(DIVISI[0]);
  const [itemKode, setItemKode] = useState(ITEM_DIVISI[DIVISI[0]][0].kode);
  const [jenis, setJenis] = useState<JenisPekerjaan>("NORMAL");
  const [diproses, setDiproses] = useState("");
  const [hasilBaik, setHasilBaik] = useState("");
  const [reject, setReject] = useState("");
  const [diserahkan, setDiserahkan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const [fDivisi, setFDivisi] = useState("SEMUA");
  const [fJenis, setFJenis] = useState<"SEMUA" | JenisPekerjaan>("SEMUA");
  const [fDari, setFDari] = useState("");
  const [fSampai, setFSampai] = useState("");

  const gantiDivisi = (d: string) => {
    setDivisi(d);
    setItemKode((ITEM_DIVISI[d] ?? [])[0]?.kode ?? "");
  };

  const catat = (e: FormEvent) => {
    e.preventDefault();
    setPesan(null);
    setError(null);
    const item = itemOf(divisi, itemKode);
    const nProses = Math.floor(Number(diproses));
    const nBaik = Math.floor(Number(hasilBaik));
    const nReject = Math.floor(Number(reject || 0));
    const nSerah = Math.floor(Number(diserahkan === "" ? hasilBaik : diserahkan));
    if (!item) return setError("Pilih item hasil produksi.");
    if (!Number.isFinite(nProses) || nProses <= 0) return setError("Jumlah diproses harus bilangan bulat lebih dari 0.");
    if (!Number.isFinite(nBaik) || nBaik < 0 || !Number.isFinite(nReject) || nReject < 0) return setError("Hasil baik dan reject tidak boleh negatif.");
    if (nBaik + nReject > nProses) return setError("Hasil baik + reject tidak boleh melebihi jumlah diproses.");
    if (!Number.isFinite(nSerah) || nSerah < 0 || nSerah > nBaik) return setError("Jumlah diserahkan tidak boleh melebihi hasil baik.");
    if (tanggal > hariIni()) return setError("Tanggal tidak boleh melebihi hari ini.");
    onCatat({ tanggal, shift, divisi, itemKode: item.kode, itemNama: item.nama, unit: item.unit, jenis, diproses: nProses, hasilBaik: nBaik, reject: nReject, diserahkan: nSerah, catatan: catatan.trim() });
    setPesan(`Tercatat: ${item.nama} · ${JENIS_LABEL[jenis]} · baik ${nBaik.toLocaleString("id-ID")}, reject ${nReject.toLocaleString("id-ID")}.`);
    setDiproses("");
    setHasilBaik("");
    setReject("");
    setDiserahkan("");
    setCatatan("");
  };

  const rowsFilter = useMemo(
    () =>
      rows
        .filter((r) => fDivisi === "SEMUA" || r.divisi === fDivisi)
        .filter((r) => fJenis === "SEMUA" || r.jenis === fJenis)
        .filter((r) => !fDari || r.tanggal >= fDari)
        .filter((r) => !fSampai || r.tanggal <= fSampai),
    [rows, fDivisi, fJenis, fDari, fSampai],
  );

  const totals = useMemo(
    () =>
      rowsFilter.reduce(
        (a, r) => ({ diproses: a.diproses + r.diproses, baik: a.baik + r.hasilBaik, reject: a.reject + r.reject, serah: a.serah + r.diserahkan }),
        { diproses: 0, baik: 0, reject: 0, serah: 0 },
      ),
    [rowsFilter],
  );

  return (
    <div className="space-y-6">
      <section className={`${CARD} p-4`}>
        <h3 className="font-semibold text-[#1E3A5F]">Catat Hasil Produksi</h3>
        <p className="mt-1 text-sm text-[#6B7280]">Satu baris = satu laporan divisi. Hasil repair dicatat terpisah dari produksi normal dan tidak menambah jumlah unit fisik. Hasil divisi bukan produk akhir: produk selesai hanya dihitung setelah lulus QC.</p>
        <form onSubmit={catat} className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Tanggal
            <input type="date" max={hariIni()} value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Shift
            <select value={shift} onChange={(e) => setShift(e.target.value)} className={FIELD}>
              {SHIFT.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Divisi
            <select value={divisi} onChange={(e) => gantiDivisi(e.target.value)} className={FIELD}>
              {DIVISI.map((d) => (<option key={d} value={d}>{d}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937] xl:col-span-2">
            Item hasil
            <select value={itemKode} onChange={(e) => setItemKode(e.target.value)} className={FIELD}>
              {(ITEM_DIVISI[divisi] ?? []).map((i) => (<option key={i.kode} value={i.kode}>{i.kode} · {i.nama}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Jenis pekerjaan
            <select value={jenis} onChange={(e) => setJenis(e.target.value as JenisPekerjaan)} className={FIELD}>
              <option value="NORMAL">Produksi Normal</option>
              <option value="REPAIR">Repair</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Jumlah diproses
            <input type="number" min={1} step={1} placeholder="0" value={diproses} onChange={(e) => setDiproses(e.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Hasil baik
            <input type="number" min={0} step={1} placeholder="0" value={hasilBaik} onChange={(e) => setHasilBaik(e.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Reject
            <input type="number" min={0} step={1} placeholder="0" value={reject} onChange={(e) => setReject(e.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Jumlah diserahkan
            <input type="number" min={0} step={1} placeholder="= hasil baik" value={diserahkan} onChange={(e) => setDiserahkan(e.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937] xl:col-span-2">
            Catatan
            <input type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Opsional" className={FIELD} />
          </label>
          <button type="submit" className={btnPrimary}>Catat hasil</button>
        </form>
        {error && <p role="alert" className="mt-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-sm text-[#EF4444]">{error}</p>}
        {pesan && <p role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{pesan}</p>}
      </section>

      <Panel
        title={<>Riwayat Hasil Produksi <span className="text-xs font-normal text-[#6B7280]">· {rowsFilter.length} baris</span></>}
        extra={
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
              Divisi
              <select value={fDivisi} onChange={(e) => setFDivisi(e.target.value)} className={FIELD}>
                <option value="SEMUA">Semua</option>
                {DIVISI.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
              Jenis
              <select value={fJenis} onChange={(e) => setFJenis(e.target.value as "SEMUA" | JenisPekerjaan)} className={FIELD}>
                <option value="SEMUA">Semua</option>
                <option value="NORMAL">Produksi Normal</option>
                <option value="REPAIR">Repair</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
              Dari
              <input type="date" value={fDari} onChange={(e) => setFDari(e.target.value)} className={FIELD} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
              Sampai
              <input type="date" value={fSampai} onChange={(e) => setFSampai(e.target.value)} className={FIELD} />
            </label>
          </div>
        }
      >
        {rowsFilter.length === 0 ? (
          <Empty>Tidak ada laporan pada filter ini.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                  <Th>Tanggal</Th>
                  <Th>Shift</Th>
                  <Th>Divisi</Th>
                  <Th>Item Hasil</Th>
                  <Th>Jenis Pekerjaan</Th>
                  <Th right>Jumlah Diproses</Th>
                  <Th right>Hasil Baik</Th>
                  <Th right>Reject</Th>
                  <Th right>Jumlah Diserahkan</Th>
                  <Th>Catatan</Th>
                </tr>
              </thead>
              <tbody>
                {rowsFilter.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-[#F5F7FA]">
                    <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">{fmtTanggal(r.tanggal)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">{r.shift}</td>
                    <td className="px-3 py-2.5 font-medium text-[#1F2937]">{r.divisi}</td>
                    <td className="px-3 py-2.5 text-[#1F2937]"><span className="font-mono text-xs text-[#6B7280]">{r.itemKode}</span> · {r.itemNama}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${r.jenis === "NORMAL" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>
                        {JENIS_LABEL[r.jenis]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{r.diproses.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-700">{r.hasilBaik.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#EF4444]">{r.reject.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{r.diserahkan.toLocaleString("id-ID")} <span className="text-xs font-normal text-[#6B7280]">{r.unit}</span></td>
                    <td className="px-3 py-2.5 text-[#6B7280]">{r.catatan || "—"}</td>
                  </tr>
                ))}
                <tr className="bg-[#F5F7FA] font-bold">
                  <td colSpan={5} className="px-3 py-2.5 text-[#1E3A5F]">TOTAL</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">{totals.diproses.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{totals.baik.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#EF4444]">{totals.reject.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">{totals.serah.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2.5" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
