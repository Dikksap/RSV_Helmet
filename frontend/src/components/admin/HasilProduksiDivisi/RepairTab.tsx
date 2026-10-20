import { useMemo, useState, type FormEvent } from "react";
import {
  BADGE,
  DIVISI_PROSES,
  JENIS_CACAT_SARAN,
  SEMUA_ITEM,
  STATUS_QC_ULANG_LABEL,
  STATUS_REPAIR_LABEL,
  TRANSISI_REPAIR,
  fmtTanggal,
  hariIni,
  type Repair,
  type StatusQcUlang,
  type StatusRepair,
  type SumberRepair,
} from "./data";
import type { RepairBaru } from "./alur";
import { CARD, Empty, FIELD, Panel, Th, btnPrimary, miniBtn } from "./ui";

const QC_ULANG_URUT: StatusQcUlang[] = ["MENUNGGU", "LULUS", "REJECT"];

type DraftRepair = { status: StatusRepair; baik: string; reject: string; qcUlang: StatusQcUlang };

// Default aksi = transisi sah berikutnya, supaya tombol Simpan tidak mengirim status lama yang tidak ada di pilihan.
const awalDraft = (r: Repair): DraftRepair => ({
  status: r.status === "SELESAI" ? "SELESAI" : TRANSISI_REPAIR[r.status][0],
  baik: String(r.hasilBaik),
  reject: String(r.rejectAkhir),
  qcUlang: r.statusQcUlang,
});

export default function RepairTab({
  rows,
  onCatat,
  onUpdate,
}: {
  rows: Repair[];
  onCatat: (body: RepairBaru) => string | null;
  onUpdate: (id: number, status: StatusRepair, hasilBaik: number, rejectAkhir: number, statusQcUlang: StatusQcUlang) => string | null;
}) {
  const [tanggalPemeriksaan, setTanggalPemeriksaan] = useState(hariIni());
  const [sumber, setSumber] = useState<SumberRepair>("QC");
  const [posisiAsal, setPosisiAsal] = useState(DIVISI_PROSES[1]);
  const [itemKode, setItemKode] = useState(SEMUA_ITEM[0].kode);
  const [jenisCacat, setJenisCacat] = useState("");
  const [divisiPenyebab, setDivisiPenyebab] = useState(DIVISI_PROSES[0]);
  const [jumlah, setJumlah] = useState("");
  const [prosesDiulang, setProsesDiulang] = useState(DIVISI_PROSES[0]);
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  // Untuk repair internal, divisi penyebab dan proses diulang locked sama posisi asal.
  const penyebabTampil = sumber === "INTERNAL" ? posisiAsal : divisiPenyebab;
  const ulangTampil = sumber === "INTERNAL" ? posisiAsal : prosesDiulang;

  const [draft, setDraft] = useState<Record<number, DraftRepair>>({});

  const ubahPenyebab = (d: string) => {
    setDivisiPenyebab(d);
    setProsesDiulang(d);
  };

  const ubahSumber = (s: SumberRepair) => {
    setSumber(s);
    if (s === "INTERNAL") ubahPenyebab(posisiAsal);
  };

  const ubahPosisiAsal = (d: string) => {
    setPosisiAsal(d);
    ubahPenyebab(d);
  };

  const catat = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPesan(null);
    const item = SEMUA_ITEM.find((i) => i.kode === itemKode);
    const n = Math.floor(Number(jumlah));
    if (!item) return setError("Pilih item yang diperiksa.");
    if (!jenisCacat.trim()) return setError("Jenis cacat wajib diisi dari hasil pemeriksaan.");
    const penyebab = sumber === "INTERNAL" ? posisiAsal : divisiPenyebab;
    const ulang = sumber === "INTERNAL" ? posisiAsal : prosesDiulang;
    if (!DIVISI_PROSES.includes(penyebab)) return setError("Divisi penyebab harus salah satu dari Buffing, Base Coat, Decal, atau Top Coat.");
    if (!Number.isFinite(n) || n <= 0) return setError("Jumlah masuk repair harus bilangan bulat lebih dari 0.");
    if (tanggalPemeriksaan > hariIni()) return setError("Tanggal pemeriksaan tidak boleh melebihi hari ini.");
    const err = onCatat({
      tanggalPemeriksaan,
      itemKode: item.kode,
      itemNama: item.nama,
      jenisCacat: jenisCacat.trim(),
      divisiPenyebab: penyebab,
      sumber,
      posisiAsal: sumber === "QC" ? "QC" : posisiAsal,
      jumlah: n,
      prosesDiulang: ulang,
      catatan: catatan.trim(),
    });
    if (err) return setError(err);
    setPesan(
      `Kasus repair ${item.nama} ${n.toLocaleString("id-ID")} pcs dicatat dari ${sumber === "QC" ? "QC akhir" : `internal ${posisiAsal}`}. Penyebab: ${divisiPenyebab} · proses diulang: ${prosesDiulang}. Batok tetap dihitung WIP selama repair.`,
    );
    setJumlah("");
    setJenisCacat("");
    setCatatan("");
  };

  const simpan = (r: Repair) => {
    setError(null);
    setPesan(null);
    const d = draft[r.id] ?? awalDraft(r);
    const prosesPertama = d.status === "SELESAI" && r.status !== "SELESAI";
    const baik = prosesPertama ? Math.floor(Number(d.baik || 0)) : r.hasilBaik;
    const reject = prosesPertama ? Math.floor(Number(d.reject || 0)) : r.rejectAkhir;
    if (!Number.isFinite(baik) || baik < 0 || !Number.isFinite(reject) || reject < 0) {
      return setError("Hasil repair baik dan reject akhir tidak boleh negatif.");
    }
    if (baik + reject > r.jumlah) {
      return setError("Hasil repair baik + reject akhir tidak boleh melebihi jumlah masuk repair.");
    }
    const qcUlang = r.status === "SELESAI" ? (QC_ULANG_URUT.includes(d.qcUlang) ? d.qcUlang : r.statusQcUlang) : r.statusQcUlang;
    const err = onUpdate(r.id, d.status, baik, reject, qcUlang);
    if (err) return setError(err);
    setPesan(`${r.nomor}: ${STATUS_REPAIR_LABEL[d.status]} · ${STATUS_QC_ULANG_LABEL[qcUlang]} disimpan.`);
    setDraft((p) => ({ ...p, [r.id]: { ...d, baik: String(baik), reject: String(reject) } }));
  };

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          masuk: a.masuk + r.jumlah,
          baik: a.baik + r.hasilBaik,
          reject: a.reject + r.rejectAkhir,
          aktif:
            a.aktif +
            (r.statusQcUlang === "LULUS" || r.statusQcUlang === "REJECT"
              ? 0
              : r.status === "SELESAI"
                ? r.hasilBaik
                : r.jumlah),
        }),
        { masuk: 0, baik: 0, reject: 0, aktif: 0 },
      ),
    [rows],
  );

  return (
    <div className="space-y-6">
      <section className={`${CARD} p-4`}>
        <h3 className="font-semibold text-[#1E3A5F]">Pemeriksaan QC &amp; Kasus Repair</h3>
        <p className="mt-1 text-sm text-[#6B7280]">
          QC akhir memeriksa hasil setelah Top Coat dan menetapkan divisi penyebab — bukan berdasarkan posisi batok saat ini. Divisi juga bisa mencatat repair internal untuk unit cacat selama prosesnya. Unit repair tetap WIP dan tidak dicatat sebagai produksi normal.
        </p>
        <form onSubmit={catat} className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Tanggal pemeriksaan QC
            <input type="date" max={hariIni()} value={tanggalPemeriksaan} onChange={(e) => setTanggalPemeriksaan(e.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Sumber repair
            <select value={sumber} onChange={(e) => ubahSumber(e.target.value as SumberRepair)} className={FIELD}>
              <option value="QC">QC akhir (setelah Top Coat)</option>
              <option value="INTERNAL">Internal divisi</option>
            </select>
          </label>
          {sumber === "INTERNAL" && (
            <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
              Divisi asal repair
              <select value={posisiAsal} onChange={(e) => ubahPosisiAsal(e.target.value)} className={FIELD}>
                {DIVISI_PROSES.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937] xl:col-span-2">
            Item / batch
            <select value={itemKode} onChange={(e) => setItemKode(e.target.value)} className={FIELD}>
              {SEMUA_ITEM.map((i) => (<option key={i.kode} value={i.kode}>{i.kode} · {i.nama}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937] xl:col-span-2">
            Jenis cacat
            <input
              type="text"
              list="jenis-cacat-saran"
              value={jenisCacat}
              onChange={(e) => setJenisCacat(e.target.value)}
              placeholder="cth: Cat belang"
              className={FIELD}
            />
            <datalist id="jenis-cacat-saran">
              {JENIS_CACAT_SARAN.map((j) => (<option key={j} value={j} />))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Jumlah masuk repair
            <input type="number" min={1} step={1} placeholder="0" value={jumlah} onChange={(e) => setJumlah(e.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Divisi penyebab cacat
            <select
              value={penyebabTampil}
              onChange={sumber === "INTERNAL" ? undefined : (e) => ubahPenyebab(e.target.value)}
              disabled={sumber === "INTERNAL"}
              className={FIELD}
            >
              {DIVISI_PROSES.map((d) => (<option key={d} value={d}>{d}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
            Proses yang harus diulang
            <select
              value={ulangTampil}
              onChange={sumber === "INTERNAL" ? undefined : (e) => setProsesDiulang(e.target.value)}
              disabled={sumber === "INTERNAL"}
              className={FIELD}
            >
              {DIVISI_PROSES.map((d) => (<option key={d} value={d}>{d}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937] xl:col-span-2">
            Catatan pemeriksaan
            <input type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Opsional" className={FIELD} />
          </label>
          <button type="submit" className={btnPrimary}>Catat repair</button>
        </form>
        {error && <p role="alert" className="mt-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-sm text-[#EF4444]">{error}</p>}
        {pesan && <p role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{pesan}</p>}
      </section>

      <Panel title={<>Kasus Repair <span className="text-xs font-normal text-[#6B7280]">· {rows.length} kasus</span></>}>
        {rows.length === 0 ? (
          <Empty>Belum ada kasus repair dari QC.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                  <Th>Nomor</Th>
                  <Th>Tgl Pemeriksaan QC</Th>
                  <Th>Item / Batch</Th>
                  <Th>Sumber</Th>
                  <Th>Jenis Cacat</Th>
                  <Th>Divisi Penyebab</Th>
                  <Th right>Masuk Repair</Th>
                  <Th>Proses Diulang</Th>
                  <Th right>Hasil Repair Baik</Th>
                  <Th right>Reject Akhir</Th>
                  <Th>Status Repair</Th>
                  <Th>Status QC Ulang</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = draft[r.id] ?? awalDraft(r);
                  const prosesPertama = d.status === "SELESAI" && r.status !== "SELESAI";
                  const putusQc = r.status === "SELESAI" && r.sumber === "QC" && r.hasilBaik > 0 && r.statusQcUlang !== "LULUS" && r.statusQcUlang !== "REJECT";
                  return (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-[#F5F7FA]">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-[#1E3A5F]">{r.nomor}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">{fmtTanggal(r.tanggalPemeriksaan)}</td>
                      <td className="px-3 py-2.5 text-[#1F2937]"><span className="font-mono text-xs text-[#6B7280]">{r.itemKode}</span> · {r.itemNama}</td>
                      <td className="px-3 py-2.5 text-[#1F2937]">{r.sumber === "QC" ? "QC akhir" : `Internal ${r.posisiAsal}`}</td>
                      <td className="px-3 py-2.5 text-[#1F2937]">{r.jenisCacat}</td>
                      <td className="px-3 py-2.5 font-medium text-[#1F2937]">{r.divisiPenyebab}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{r.jumlah.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5 text-[#1F2937]">{r.prosesDiulang}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{r.hasilBaik.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#EF4444]">{r.rejectAkhir.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5"><span className={BADGE[r.status]}>{STATUS_REPAIR_LABEL[r.status]}</span></td>
                      <td className="px-3 py-2.5"><span className={BADGE[r.statusQcUlang]}>{STATUS_QC_ULANG_LABEL[r.statusQcUlang]}</span></td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={d.status}
                            onChange={(e) => setDraft((p) => ({ ...p, [r.id]: { ...d, status: e.target.value as StatusRepair } }))}
                            className="h-9 rounded-lg border border-[#D1D5DB] px-2 text-sm focus:outline-2 focus:outline-[#00A8E8]"
                          >
                            {TRANSISI_REPAIR[r.status].map((s) => (<option key={s} value={s}>{STATUS_REPAIR_LABEL[s]}</option>))}
                          </select>
                          {prosesPertama && (
                            <>
                              <input
                                type="number" min={0} max={r.jumlah} step={1} placeholder="baik"
                                value={d.baik}
                                onChange={(e) => setDraft((p) => ({ ...p, [r.id]: { ...d, baik: e.target.value } }))}
                                className="h-9 w-20 rounded-lg border border-[#D1D5DB] px-2 text-sm focus:outline-2 focus:outline-[#00A8E8]"
                              />
                              <input
                                type="number" min={0} max={r.jumlah} step={1} placeholder="reject"
                                value={d.reject}
                                onChange={(e) => setDraft((p) => ({ ...p, [r.id]: { ...d, reject: e.target.value } }))}
                                className="h-9 w-20 rounded-lg border border-[#D1D5DB] px-2 text-sm focus:outline-2 focus:outline-[#00A8E8]"
                              />
                            </>
                          )}
                          {putusQc && (
                            <select
                              value={QC_ULANG_URUT.includes(d.qcUlang) ? d.qcUlang : "MENUNGGU"}
                              onChange={(e) => setDraft((p) => ({ ...p, [r.id]: { ...d, qcUlang: e.target.value as StatusQcUlang } }))}
                              className="h-9 rounded-lg border border-[#D1D5DB] px-2 text-sm focus:outline-2 focus:outline-[#00A8E8]"
                            >
                              {QC_ULANG_URUT.map((s) => (<option key={s} value={s}>{STATUS_QC_ULANG_LABEL[s]}</option>))}
                            </select>
                          )}
                          <button type="button" onClick={() => simpan(r)} className={miniBtn}>Simpan</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-[#F5F7FA] font-bold">
                  <td colSpan={6} className="px-3 py-2.5 text-[#1E3A5F]">TOTAL</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">{totals.masuk.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2.5 text-xs font-normal text-[#6B7280]">Masih WIP: {totals.aktif.toLocaleString("id-ID")} pcs</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{totals.baik.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#EF4444]">{totals.reject.toLocaleString("id-ID")}</td>
                  <td colSpan={3} className="px-3 py-2.5" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-xs text-[#6B7280]">
        Alur QC: Menunggu Repair → Sedang Repair → Menunggu QC → Selesai → menunggu QC ulang → Lulus / Reject. Saat Selesai, hasil baik + reject akhir harus sama dengan jumlah masuk repair agar tidak ada unit menggantung. Alur internal: unit kembali ke antrean divisi asal setelah selesai dan tidak langsung dianggap produk selesai. Hasil repair tidak dicatat sebagai produksi normal baru.
      </p>
    </div>
  );
}
