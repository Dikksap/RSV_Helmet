import { useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import {
  getProductionOrderSummary,
  getProductionSchedule,
  type ProductionOrderSummary,
  type ScheduleRow,
} from "../../api/productionOrders";

// ponytail: satu kertas A4 per tanggal, tarik rows jadwal otomatis — tanpa html2pdf CDN baru
interface Props {
  orderId: number | null;
}

interface SpkRow {
  key: string;
  model: string;
  size: string;
  warna: string;
  target: number;
  hasil: string;
  reject: string;
  ket: string;
  variantId: number;
}

const fmtTanggal = (iso: string) => {
  if (!iso) return "-";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

const fmtShort = (iso: string) => {
  const [y, m, d] = iso.split("-");
  if (!y) return iso;
  return `${d}/${m}/${y}`;
};

export default function SpkTab({ orderId }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [meta, setMeta] = useState<{ prepDays: string[]; qcDays: string[] } | null>(null);
  const [detail, setDetail] = useState<ProductionOrderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form header
  const [shift, setShift] = useState("Shift 1 (07:00 - 15:00)");
  const [lini, setLini] = useState("BUFFING 4");
  const [opr, setOpr] = useState("4 Orang");
  const [pic, setPic] = useState("DIKA H.S");
  const [sig1, setSig1] = useState("DIKA H.S");
  const [sig2, setSig2] = useState("AGUS M.");
  const [sig3, setSig3] = useState("HENDRA K.");
  const [noDok] = useState("SPK-PRD-2025/0147");
  const [revisi] = useState("02");

  const [selectedTanggal, setSelectedTanggal] = useState<string>("");
  const [editable, setEditable] = useState<SpkRow[]>([]);

  const paperRef = useRef<HTMLDivElement>(null);

  const printFn = useReactToPrint({
    contentRef: paperRef,
    documentTitle: `SPK_${selectedTanggal || "all"}_${new Date().toISOString().split("T")[0]}`,
    pageStyle: `
      @page { size: A4 portrait; margin: 0; }
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
        body * { visibility: hidden !important; }
        #spk-paper, #spk-paper * { visibility: visible !important; }
        #spk-paper { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; box-shadow: none !important; }
      }
    `,
  });

  useEffect(() => {
    if (orderId === null) return;
    setLoading(true);
    Promise.all([getProductionSchedule(orderId), getProductionOrderSummary(orderId)])
      .then(([sch, det]) => {
        setRows(sch.rows);
        setMeta({ prepDays: (sch.meta as any).prepDays ?? [], qcDays: (sch.meta as any).qcDays ?? [] });
        setDetail(det);
        setError(null);
        // default tanggal: hari produksi pertama dengan jumlah>0
        const prodDates = [...new Set(sch.rows.filter((r) => r.jumlah > 0).map((r) => r.tanggal))].sort();
        const first = prodDates[0] ?? sch.rows[0]?.tanggal ?? "";
        setSelectedTanggal(first);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat jadwal SPK."))
      .finally(() => setLoading(false));
  }, [orderId]);

  const variantMap = useMemo(() => {
    const m = new Map<number, { style: string; color: string; product: string; size: string }>();
    if (!detail) return m;
    for (const it of detail.items) {
      m.set(it.variantId, {
        style: it.variant.style.nama,
        color: it.variant.color.nama,
        product: it.variant.product.nama,
        size: it.variant.size.nama,
      });
    }
    return m;
  }, [detail]);

  const tanggalOptions = useMemo(() => {
    const groups = new Map<string, { hari: string; total: number; count: number }>();
    for (const r of rows) {
      const g = groups.get(r.tanggal) ?? { hari: r.hari, total: 0, count: 0 };
      g.total += r.jumlah;
      g.count += 1;
      groups.set(r.tanggal, g);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  // when tanggal changes, rebuild editable from schedule
  useEffect(() => {
    if (!selectedTanggal) {
      setEditable([]);
      return;
    }
    const filtered = rows.filter((r) => r.tanggal === selectedTanggal && r.jumlah > 0);
    if (filtered.length === 0) {
      // hari tanpa produksi: satu baris kosong editable
      setEditable([{ key: `empty-${selectedTanggal}`, model: "", size: "", warna: "", target: 0, hasil: "", reject: "", ket: "", variantId: 0 }]);
      return;
    }
    const mapped: SpkRow[] = filtered.map((r, idx) => {
      const v = variantMap.get(r.variantId);
      const warna = v?.color ?? r.item.split(" ").slice(1).join(" ") ?? r.item;
      const model = v ? `${v.product} — ${v.style}` : r.item;
      return {
        key: `${r.variantId}-${r.size}-${idx}`,
        model,
        size: r.size,
        warna,
        target: r.jumlah,
        hasil: "",
        reject: "",
        ket: "",
        variantId: r.variantId,
      };
    });
    setEditable(mapped);
  }, [selectedTanggal, rows, variantMap]);

  const totals = useMemo(() => {
    let t = 0, h = 0, rej = 0;
    for (const r of editable) {
      t += Number(r.target) || 0;
      h += Number(r.hasil) || 0;
      rej += Number(r.reject) || 0;
    }
    return { t, h, rej };
  }, [editable]);

  const updateRow = (idx: number, field: keyof SpkRow, value: string) => {
    setEditable((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: field === "target" ? Number(value) || 0 : value } : r)));
  };

  const addRow = () => {
    if (editable.length >= 10) return;
    setEditable((p) => [...p, { key: `manual-${Date.now()}`, model: "", size: "", warna: "", target: 0, hasil: "", reject: "", ket: "", variantId: 0 }]);
  };
  const removeLast = () => {
    if (editable.length <= 1) return;
    setEditable((p) => p.slice(0, -1));
  };

  const currentHari = useMemo(() => rows.find((r) => r.tanggal === selectedTanggal)?.hari ?? "", [rows, selectedTanggal]);

  if (orderId === null) return <p className="rounded-xl bg-white p-6 text-center text-[#6B7280]">Pilih order dulu untuk cetak SPK.</p>;
  if (loading) return <p className="animate-pulse p-6 text-[#6B7280]">Menyiapkan SPK dari jadwal...</p>;
  if (error) return <p role="alert" className="p-6 text-center text-[#EF4444]">{error}</p>;

  return (
    <div className="space-y-4">
      {/* controls */}
      <section className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-[#1E3A5F]">Surat Perintah Kerja — sinkron jadwal produksi</h3>
          <div className="flex gap-2">
            <button type="button" onClick={() => printFn()} className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a]">Print / Save PDF</button>
          </div>
        </div>
        <p className="mt-1 text-xs text-[#6B7280]">Pilih tanggal → Target otomatis dari <span className="font-mono">GET /production-orders/:id/schedule</span> (kolom Jumlah). Hasil/Reject isi manual atau dari Realisasi.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          {/* left form */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-[#6B7280]">Tanggal produksi</label>
              <select value={selectedTanggal} onChange={(e) => setSelectedTanggal(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                {tanggalOptions.map(([tgl, info]) => (
                  <option key={tgl} value={tgl}>{fmtShort(tgl)} — {info.hari} · {info.total.toLocaleString("id-ID")} pcs {info.total===0 ? "(tanpa produksi)" : ""}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[#6B7280]">{tanggalOptions.length} hari kalender · {rows.filter(r=>r.jumlah>0).length} baris produksi</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-[#6B7280]">Shift
                <input value={shift} onChange={(e)=>setShift(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-semibold text-[#6B7280]">Lini
                <input value={lini} onChange={(e)=>setLini(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-[#6B7280]">Jml Operator
                <input value={opr} onChange={(e)=>setOpr(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-semibold text-[#6B7280]">PIC
                <input value={pic} onChange={(e)=>setPic(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </label>
            </div>

            <div className="rounded bg-slate-50 p-2">
              <p className="mb-2 text-xs font-bold uppercase text-[#1E3A5F]">Target produksi — {editable.length} baris</p>
              <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
                {editable.map((r, idx) => (
                  <div key={r.key} className="rounded border border-slate-200 bg-white p-2">
                    <div className="mb-1 flex items-center justify-between text-xs"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">{idx+1}</span><span className="text-[#6B7280]">#{r.variantId || "-"}</span></div>
                    <input value={r.model} onChange={(e)=>updateRow(idx,"model",e.target.value)} placeholder="Model — Style" className="mb-1 w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                    <div className="grid grid-cols-2 gap-1">
                      <input value={r.size} onChange={(e)=>updateRow(idx,"size",e.target.value)} placeholder="Size" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                      <input value={r.warna} onChange={(e)=>updateRow(idx,"warna",e.target.value)} placeholder="Warna" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                    </div>
                    <div className="mt-1 grid grid-cols-3 gap-1">
                      <label className="text-[10px] text-[#6B7280]">Target<input type="number" value={r.target} onChange={(e)=>updateRow(idx,"target",e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 px-1 py-1 text-xs" /></label>
                      <label className="text-[10px] text-[#6B7280]">Hasil<input type="number" value={r.hasil} onChange={(e)=>updateRow(idx,"hasil",e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 px-1 py-1 text-xs" /></label>
                      <label className="text-[10px] text-[#6B7280]">Reject<input type="number" value={r.reject} onChange={(e)=>updateRow(idx,"reject",e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 px-1 py-1 text-xs" /></label>
                    </div>
                    <input value={r.ket} onChange={(e)=>updateRow(idx,"ket",e.target.value)} placeholder="Keterangan" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={addRow} disabled={editable.length>=10} className="flex-1 rounded bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-40">+ Tambah</button>
                <button type="button" onClick={removeLast} disabled={editable.length<=1} className="rounded bg-red-600 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Hapus</button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <label className="text-xs font-semibold text-[#6B7280]">Dibuat Oleh<input value={sig1} onChange={(e)=>setSig1(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
              <label className="text-xs font-semibold text-[#6B7280]">Diketahui (Kepala Regu)<input value={sig2} onChange={(e)=>setSig2(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
              <label className="text-xs font-semibold text-[#6B7280]">Disetujui (Manager)<input value={sig3} onChange={(e)=>setSig3(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
            </div>
          </div>

          {/* preview */}
          <div className="overflow-auto bg-[#e5e7eb] p-4">
            <div
              id="spk-paper"
              ref={paperRef}
              className="mx-auto flex min-h-[297mm] w-[210mm] flex-col bg-white p-[12mm_15mm] font-[Arial,Helvetica,sans-serif] text-[9pt] shadow-[0_10px_25px_rgba(0,0,0,0.15)]"
            >
              <div className="mb-3 flex items-center justify-between border-2 border-black p-2.5">
                <div className="border-r-2 border-black pr-3 text-center text-[22pt] font-black leading-none">RSV</div>
                <div className="flex-1 px-3">
                  <h1 className="text-[12pt] font-bold uppercase leading-none">Surat Perintah Kerja (SPK)</h1>
                  <p className="text-[7pt] leading-tight"><strong>PT. RSV MANUFACTURE</strong><br />Jl. Pasir Panjang No.126, Cilampeni, Kab. Bandung 40921<br />Divisi Produksi Helm</p>
                </div>
                <div className="border-l-2 border-black pl-3 text-[7.5pt]">
                  <table><tbody>
                    <tr><td className="pr-2 font-bold">No Dok</td><td>: {noDok}</td></tr>
                    <tr><td className="pr-2 font-bold">Revisi</td><td>: {revisi}</td></tr>
                    <tr><td className="pr-2 font-bold">Periode</td><td>: {detail?.periode ?? "-"}</td></tr>
                    <tr><td className="pr-2 font-bold">Order</td><td>: {detail?.nomor ?? "-"}</td></tr>
                  </tbody></table>
                </div>
              </div>

              <div className="mb-3 flex gap-4 text-[8.5pt]">
                <div className="flex-1 space-y-0.5">
                  <div className="flex gap-1"><span className="min-w-[110px] font-bold">Hari / Tanggal</span><span className="font-bold">:</span><span className="font-mono font-bold">{currentHari ? `${currentHari}, ${fmtTanggal(selectedTanggal)}` : fmtTanggal(selectedTanggal)}</span></div>
                  <div className="flex gap-1"><span className="min-w-[110px] font-bold">Shift</span><span className="font-bold">:</span><span className="font-mono font-bold">{shift}</span></div>
                  <div className="flex gap-1"><span className="min-w-[110px] font-bold">Lini / Area</span><span className="font-bold">:</span><span className="font-mono font-bold">{lini}</span></div>
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex gap-1"><span className="min-w-[110px] font-bold">Jml Operator</span><span className="font-bold">:</span><span className="font-mono font-bold">{opr}</span></div>
                  <div className="flex gap-1"><span className="min-w-[110px] font-bold">PIC</span><span className="font-bold">:</span><span className="font-mono font-bold">{pic}</span></div>
                  <div className="flex gap-1"><span className="min-w-[110px] font-bold">Status</span><span className="font-bold">:</span><span className="bg-black px-1 text-white">RELEASED</span></div>
                </div>
              </div>

              <table className="w-full flex-1 border-2 border-black text-[8pt]" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="bg-[#f0f0f0] text-center font-bold uppercase">
                    <th className="border border-black px-1 py-1" style={{ width: "4%" }}>No</th>
                    <th className="border border-black px-1 py-1" style={{ width: "24%" }}>Model / Tipe Helm</th>
                    <th className="border border-black px-1 py-1" style={{ width: "8%" }}>Size</th>
                    <th className="border border-black px-1 py-1" style={{ width: "18%" }}>Warna</th>
                    <th className="border border-black px-1 py-1" style={{ width: "9%" }}>Target</th>
                    <th className="border border-black px-1 py-1" style={{ width: "9%" }}>Hasil (OK)</th>
                    <th className="border border-black px-1 py-1" style={{ width: "9%" }}>Reject (NG)</th>
                    <th className="border border-black px-1 py-1" style={{ width: "19%" }}>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {editable.map((r, idx) => (
                    <tr key={r.key}>
                      <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
                      <td className="border border-black px-1 py-1 text-left">{r.model || "-"}</td>
                      <td className="border border-black px-1 py-1 text-center">{r.size || "-"}</td>
                      <td className="border border-black px-1 py-1 text-center">{r.warna || "-"}</td>
                      <td className="border border-black px-1 py-1 text-center">{r.target ? r.target.toLocaleString("id-ID") : ""}</td>
                      <td className="border border-black px-1 py-1 text-center">{r.hasil || ""}</td>
                      <td className="border border-black px-1 py-1 text-center">{r.reject || ""}</td>
                      <td className="border border-black px-1 py-1 text-center">{r.ket || ""}</td>
                    </tr>
                  ))}
                  {editable.length === 0 && (
                    <tr><td colSpan={8} className="border border-black px-1 py-4 text-center text-[#6B7280]">Tidak ada target untuk tanggal ini (LIBUR / Persiapan / Penyesuaian)</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#f0f0f0] font-bold">
                    <td colSpan={4} className="border border-black px-1 py-1 text-right">TOTAL</td>
                    <td className="border border-black px-1 py-1 text-center">{totals.t.toLocaleString("id-ID")}</td>
                    <td className="border border-black px-1 py-1 text-center">{totals.h ? totals.h.toLocaleString("id-ID") : "0"}</td>
                    <td className="border border-black px-1 py-1 text-center">{totals.rej ? totals.rej.toLocaleString("id-ID") : "0"}</td>
                    <td className="border border-black px-1 py-1"></td>
                  </tr>
                </tfoot>
              </table>

              <div className="my-2.5 border border-black p-2 text-[7.5pt]">
                <h4 className="mb-1 font-bold underline">Instruksi Kerja & Standar Operasional</h4>
                <ul className="m-0 list-disc pl-4">
                  <li>Wajib gunakan APD lengkap (masker, sarung tangan, safety shoes, kacamata pelindung)</li>
                  <li>QC mandiri per 20 unit pada shell, visor, dan EPS</li>
                  <li>Lapor Supervisor jika ada malfungsi mesin atau cacat material berulang</li>
                  <li>Isi formulir dengan hasil aktual, serahkan ke Admin di akhir shift</li>
                  <li>Terapkan 5R (Ringkas, Rapi, Resik, Rawat, Rajin) sebelum serah terima shift</li>
                </ul>
              </div>

              <div className="mt-3 flex justify-around">
                {[
                  { role: "Dibuat Oleh,", name: sig1, title: "Supervisor Produksi" },
                  { role: "Diketahui Oleh,", name: sig2, title: "Kepala Regu" },
                  { role: "Diserujui Oleh,", name: sig3, title: "Manager Produksi" },
                ].map((s) => (
                  <div key={s.role} className="w-[140px] text-center text-[8pt]">
                    <div className="mb-[35px] font-bold">{s.role}</div>
                    <div className="h-10 border-b border-black"></div>
                    <div className="mt-0.5 font-bold">{s.name}</div>
                    <div className="text-[7pt]">{s.title}</div>
                  </div>
                ))}
              </div>

              {meta && (
                <p className="mt-2 text-center text-[6pt] text-[#6B7280]">Sinkron jadwal · {rows.length} rows · {detail?.totalQty.toLocaleString("id-ID")} pcs order · prep:{meta.prepDays.length} qc:{meta.qcDays.length}</p>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-[#6B7280]">Preview live — ubah form kiri otomatis update kertas. Print → Save as PDF.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
