import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import {
  getProductionOrderSummary,
  getProductionSchedule,
  type ProductionOrderSummary,
  type ScheduleStageTake,
} from "../../api/productionOrders";
import { WHITE_BATOK } from "../../components/admin/PlanProduction/utils";

const DIVISI = ["Buffing", "Base Coat", "Decal", "Top Coat", "Perakitan", "QC"] as const;

// Stage backend per divisi SPK. Decal = gabungan decalSolid + decalMotif.
const DIVISI_STAGES: Record<string, ScheduleStageTake["stage"][]> = {
  Buffing: ["buffing"],
  "Base Coat": ["baseCoat"],
  Decal: ["decalSolid", "decalMotif"],
  "Top Coat": ["topCoat"],
  Perakitan: ["perakitan"],
  QC: ["qc"],
};

// Divisi cat/shell pakai tabel ringkas: tanpa Size, nama item saja.
const SIMPLIFIED_DIVISI = new Set(["Buffing", "Base Coat", "Decal", "Top Coat"]);

interface SpkRow {
  key: string;
  model: string;
  size: string;
  warna: string;
  target: string;
}

const emptyRow = (key: string): SpkRow => ({
  key,
  model: "",
  size: "",
  warna: "",
  target: "",
});

// Angka polos: buang pemisah/leading zero supaya "0288" tidak nempel.
const digitsOnly = (raw: string) => raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

const fmtTanggal = (iso: string) => {
  if (!iso) return "-";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

const hariOf = (iso: string) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", { weekday: "long" });
};

interface AutoCache {
  rincian: ScheduleStageTake[];
  summary: ProductionOrderSummary | null;
  nomor: string;
  periode: string;
}

// Bangun baris SPK dari rincian jadwal backend untuk satu tanggal + divisi.
// Buffing/Base Coat proses batok → gabung per material (Batok Putih/Hitam),
// bukan per model. Decal/Top Coat gabung per item; Perakitan/QC per variant+size.
const BATOK_DIVISI = new Set(["Buffing", "Base Coat"]);

function buildAutoRows(
  div: string,
  tanggal: string,
  rincian: ScheduleStageTake[],
  summary: ProductionOrderSummary | null,
): SpkRow[] {
  const stages = DIVISI_STAGES[div] ?? [];
  const simple = SIMPLIFIED_DIVISI.has(div);
  const byBatok = BATOK_DIVISI.has(div);
  const sumByVariant = new Map<number, number>();
  const labelByVariant = new Map<number, string>();
  for (const r of rincian) {
    if (r.tanggal !== tanggal || !stages.includes(r.stage)) continue;
    sumByVariant.set(r.variantId, (sumByVariant.get(r.variantId) ?? 0) + r.jumlah);
    if (!labelByVariant.has(r.variantId)) labelByVariant.set(r.variantId, r.item);
  }
  const variantInfo = new Map(
    (summary?.items ?? []).map((it) => [
      it.variantId,
      {
        model: `${it.variant.product.nama} ${it.variant.style.nama}`,
        style: it.variant.style.nama,
        warna: it.variant.color.nama,
        size: it.variant.size.nama,
      },
    ]),
  );
  // Klasifikasi batok: warna master, fallback cocokkan nama warna di label jadwal.
  const batokOf = (variantId: number): "Putih" | "Hitam" => {
    const warna = variantInfo.get(variantId)?.warna;
    if (warna) return WHITE_BATOK.has(warna) ? "Putih" : "Hitam";
    const label = labelByVariant.get(variantId) ?? "";
    return [...WHITE_BATOK].some((w) => label.includes(w)) ? "Putih" : "Hitam";
  };
  // ponytail: gabung per batok / per item / per variant, satu map
  const grouped = new Map<string, SpkRow>();
  let n = 0;
  for (const [variantId, qty] of sumByVariant) {
    if (qty <= 0) continue;
    const info = variantInfo.get(variantId);
    let model: string;
    let warna: string;
    let size: string;
    let key: string;
    if (byBatok) {
      const batok = batokOf(variantId);
      model = `Batok ${batok}`;
      warna = batok;
      size = "";
      key = batok;
    } else if (div === "Decal") {
      // Decal: Nama = Style + Warna (label jadwal sudah "Style Warna").
      const label = labelByVariant.get(variantId) ?? "-";
      const vi = variantInfo.get(variantId);
      model = vi ? `${vi.style} ${vi.warna}` : label;
      warna = "";
      size = "";
      key = model;
    } else {
      model = info?.model ?? labelByVariant.get(variantId) ?? "-";
      warna = info?.warna ?? "";
      size = info?.size ?? "";
      key = simple ? `${model}|${warna}` : `${model}|${warna}|${size}`;
    }
    const prev = grouped.get(key);
    if (prev) {
      prev.target = String(Number(prev.target) + qty);
    } else {
      grouped.set(key, {
        key: `auto-${n++}`,
        model,
        size,
        warna,
        target: String(qty),
      });
    }
  }
  return grouped.size > 0 ? [...grouped.values()] : [emptyRow(`auto-empty-${div}`)];
}

export default function SpkProduksi() {
  const [searchParams] = useSearchParams();
  const autoOrderId = searchParams.get("orderId");
  const autoTanggal = searchParams.get("tanggal");
  const autoDivisiParam = searchParams.get("divisi");
  const isAuto = autoOrderId !== null && autoTanggal !== null;

  const [divisi, setDivisi] = useState<string>(
    autoDivisiParam && (DIVISI as readonly string[]).includes(autoDivisiParam)
      ? autoDivisiParam
      : DIVISI[0],
  );
  const [tanggal, setTanggal] = useState<string>(() => autoTanggal ?? new Date().toISOString().split("T")[0]);
  const [autoCache, setAutoCache] = useState<AutoCache | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [noDok, setNoDok] = useState("SPK-PRD-2026/0001");
  const [revisi, setRevisi] = useState("00");
  const [periode, setPeriode] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [shift, setShift] = useState("Shift 1 (07:00 - 15:00)");
  const [lini, setLini] = useState<string>(DIVISI[0]);
  const [opr, setOpr] = useState("4 Orang");
  const [pic, setPic] = useState("DIKA H.S");
  const [sig1, setSig1] = useState("DIKA H.S");
  const [sig2, setSig2] = useState("AGUS M.");
  const [sig3, setSig3] = useState("HENDRA K.");
  const [rows, setRows] = useState<SpkRow[]>([emptyRow("row-0")]);

  const isSimple = SIMPLIFIED_DIVISI.has(divisi);
  // Buffing/Base Coat proses batok → kolom Warna dihapus (Nama sudah "Batok Putih/Hitam").
  // Decal sama: Nama sudah "Style Warna".
  const isBatok = BATOK_DIVISI.has(divisi);
  const hideWarna = isBatok || divisi === "Decal";

  const paperRef = useRef<HTMLDivElement>(null);

  const printFn = useReactToPrint({
    contentRef: paperRef,
    documentTitle: `SPK_${divisi.replace(/\s+/g, "-")}_${tanggal || "tanpa-tanggal"}`,
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

  // Mode otomatis: tarik rincian jadwal + master order sekali, isi kertas SPK.
  useEffect(() => {
    if (!isAuto || !autoOrderId || !autoTanggal) return;
    const id = Number(autoOrderId);
    if (!Number.isInteger(id)) {
      setAutoError("orderId tidak valid");
      return;
    }
    setAutoLoading(true);
    setAutoError(null);
    Promise.all([
      getProductionSchedule(id),
      getProductionOrderSummary(id).catch(() => null),
    ])
      .then(([sched, summary]) => {
        const cache: AutoCache = {
          rincian: sched.rincian ?? [],
          summary,
          nomor: sched.order.nomor,
          periode: sched.order.periode,
        };
        setAutoCache(cache);
        setTanggal(autoTanggal);
        setOrderNo(sched.order.nomor);
        setPeriode(sched.order.periode);
        const div =
          autoDivisiParam && (DIVISI as readonly string[]).includes(autoDivisiParam)
            ? autoDivisiParam
            : DIVISI[0];
        setDivisi(div);
        setLini(div);
        setRows(buildAutoRows(div, autoTanggal, cache.rincian, cache.summary));
      })
      .catch((e) => setAutoError(e instanceof Error ? e.message : "Gagal memuat jadwal"))
      .finally(() => setAutoLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOrderId, autoTanggal]);

  const changeDivisi = (v: string) => {
    setDivisi(v);
    setLini(v);
    // Mode otomatis: hitung ulang dari cache, bukan reset kosong.
    if (autoCache && isAuto && autoTanggal) {
      setRows(buildAutoRows(v, autoTanggal, autoCache.rincian, autoCache.summary));
    } else {
      setRows([emptyRow(`row-${v}`)]);
    }
  };

  const updateRow = (idx: number, field: keyof SpkRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((p) => (p.length >= 20 ? p : [...p, emptyRow(`row-${Date.now()}`)]));
  };

  const removeLast = () => {
    setRows((p) => (p.length <= 1 ? p : p.slice(0, -1)));
  };

  const totals = useMemo(() => {
    let t = 0;
    for (const r of rows) t += Number(r.target) || 0;
    return t;
  }, [rows]);

  // SPK Decal: pecah solid vs motif dari rincian jadwal (auto mode).
  const decalTotals = useMemo(() => {
    if (divisi !== "Decal" || !autoCache || !autoTanggal) return null;
    let solid = 0;
    let motif = 0;
    for (const r of autoCache.rincian) {
      if (r.tanggal !== autoTanggal) continue;
      if (r.stage === "decalSolid") solid += r.jumlah;
      else if (r.stage === "decalMotif") motif += r.jumlah;
    }
    return { solid, motif };
  }, [divisi, autoCache, autoTanggal]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Barang Produksi</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">SPK Produksi</h1>
          <p className="mt-2 text-base text-[#6B7280]">
            {isAuto
              ? "SPK otomatis dari jadwal produksi — ganti divisi untuk isi ulang target."
              : "Buat Surat Perintah Kerja manual per divisi. Mode offline — belum tersambung backend."}
          </p>
        </div>
        <Link
          to="/admin/plan-production"
          className="rounded-lg bg-white px-4 py-2.5 text-[15px] font-medium text-[#1F2937] ring-1 ring-slate-200/70 transition hover:bg-[#F5F7FA]"
        >
          ← Plan Production
        </Link>
      </header>

      {isAuto && (
        <div
          className={[
            "flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
            autoError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-900",
          ].join(" ")}
        >
          <p>
            {autoLoading
              ? "Memuat target SPK dari jadwal…"
              : autoError
                ? `Gagal memuat otomatis: ${autoError} — isi manual tetap bisa.`
                : `Otomatis dari jadwal · Order ${(autoCache?.nomor ?? orderNo) || autoOrderId} · ${fmtTanggal(autoTanggal ?? "")} · ganti divisi = target dihitung ulang.`}
          </p>
          <Link
            to="/admin/plan-production/jadwal"
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] ring-1 ring-slate-200 hover:bg-slate-50"
          >
            ← Kembali ke Jadwal
          </Link>
        </div>
      )}

      <div className="space-y-4">
        <section className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-[#1E3A5F]">Surat Perintah Kerja — input manual</h3>
            <button
              type="button"
              onClick={() => printFn()}
              className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a]"
            >
              Print / Save PDF
            </button>
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            {isAuto
              ? "Target terisi dari jadwal — koreksi bila perlu → print. Hasil, Reject, dan Keterangan diisi manual di kertas."
              : "Pilih divisi → isi baris target → print. Hasil, Reject, dan Keterangan diisi manual di kertas."}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
            {/* left form */}
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#6B7280]">Divisi</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {DIVISI.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => changeDivisi(d)}
                      aria-pressed={divisi === d}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                        divisi === d
                          ? "bg-[#1E3A5F] text-white"
                          : "bg-white text-[#6B7280] ring-1 ring-slate-200/70 hover:bg-[#F5F7FA] hover:text-[#1F2937]"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-[#6B7280]">Satu SPK untuk satu divisi. Ganti divisi = baris target direset.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-[#6B7280]">
                  No Dok
                  <input
                    value={noDok}
                    onChange={(e) => setNoDok(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-[#6B7280]">
                  Revisi
                  <input
                    value={revisi}
                    onChange={(e) => setRevisi(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-[#6B7280]">
                  Tanggal produksi
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-[#6B7280]">
                  Shift
                  <input
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-[#6B7280]">
                  Periode
                  <input
                    value={periode}
                    onChange={(e) => setPeriode(e.target.value)}
                    placeholder="2026-10"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-[#6B7280]">
                  Order
                  <input
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    placeholder="PO-0001"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-[#6B7280]">
                  Lini / Area
                  <input
                    value={lini}
                    onChange={(e) => setLini(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-[#6B7280]">
                  Jml Operator
                  <input
                    value={opr}
                    onChange={(e) => setOpr(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-[#6B7280]">
                PIC
                <input
                  value={pic}
                  onChange={(e) => setPic(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>

              <div className="rounded bg-slate-50 p-2">
                <p className="mb-2 text-xs font-bold uppercase text-[#1E3A5F]">Target produksi — {rows.length} baris</p>
                <div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1">
                  {rows.map((r, idx) => (
                    <div key={r.key} className="rounded border border-slate-200 bg-white p-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">
                          {idx + 1}
                        </span>
                        <span className="text-[#6B7280]">{divisi}</span>
                      </div>
                      <input
                        value={r.model}
                        onChange={(e) => updateRow(idx, "model", e.target.value)}
                        placeholder={isSimple ? "Nama" : "Model — Style"}
                        className="mb-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      {hideWarna ? null : isSimple ? (
                        <input
                          value={r.warna}
                          onChange={(e) => updateRow(idx, "warna", e.target.value)}
                          placeholder="Warna"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      ) : (
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            value={r.size}
                            onChange={(e) => updateRow(idx, "size", e.target.value)}
                            placeholder="Size"
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                          <input
                            value={r.warna}
                            onChange={(e) => updateRow(idx, "warna", e.target.value)}
                            placeholder="Warna"
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        </div>
                      )}
                      <label className="mt-1 block text-[10px] text-[#6B7280]">
                        Target
                        <input
                          type="text"
                          inputMode="numeric"
                          value={r.target}
                          onChange={(e) => updateRow(idx, "target", digitsOnly(e.target.value))}
                          placeholder="0"
                          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={addRow}
                    disabled={rows.length >= 20}
                    className="flex-1 rounded bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    + Tambah
                  </button>
                  <button
                    type="button"
                    onClick={removeLast}
                    disabled={rows.length <= 1}
                    className="rounded bg-red-600 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Hapus
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-xs font-semibold text-[#6B7280]">
                  Dibuat Oleh
                  <input
                    value={sig1}
                    onChange={(e) => setSig1(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-[#6B7280]">
                  Diketahui (Kepala Regu)
                  <input
                    value={sig2}
                    onChange={(e) => setSig2(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-[#6B7280]">
                  Disetujui (Manager)
                  <input
                    value={sig3}
                    onChange={(e) => setSig3(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
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
                    <p className="text-[7pt] leading-tight">
                      <strong>RSV Manufacture Bandung</strong>
                      <br />
                      Jl. Pasir Panjang No.126, Cilampeni, Kab. Bandung 40921
                      <br />
                      Divisi Produksi Helm
                    </p>
                  </div>
                  <div className="border-l-2 border-black pl-3 text-[7.5pt]">
                    <table>
                      <tbody>
                        <tr>
                          <td className="pr-2 font-bold">No Dok</td>
                          <td>: {noDok || "-"}</td>
                        </tr>
                        <tr>
                          <td className="pr-2 font-bold">Revisi</td>
                          <td>: {revisi || "-"}</td>
                        </tr>
                        <tr>
                          <td className="pr-2 font-bold">Periode</td>
                          <td>: {periode || "-"}</td>
                        </tr>
                        <tr>
                          <td className="pr-2 font-bold">Order</td>
                          <td>: {orderNo || "-"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mb-3 flex gap-4 text-[8.5pt]">
                  <div className="flex-1 space-y-0.5">
                    <div className="flex gap-1">
                      <span className="min-w-[110px] font-bold">Hari / Tanggal</span>
                      <span className="font-bold">:</span>
                      <span className="font-mono font-bold">{`${hariOf(tanggal) ? `${hariOf(tanggal)}, ` : ""}${fmtTanggal(tanggal)}`}</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="min-w-[110px] font-bold">Shift</span>
                      <span className="font-bold">:</span>
                      <span className="font-mono font-bold">{shift || "-"}</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="min-w-[110px] font-bold">Lini / Area</span>
                      <span className="font-bold">:</span>
                      <span className="font-mono font-bold">{lini || "-"}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex gap-1">
                      <span className="min-w-[110px] font-bold">Divisi</span>
                      <span className="font-bold">:</span>
                      <span className="font-mono font-bold uppercase">{divisi}</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="min-w-[110px] font-bold">Jml Operator</span>
                      <span className="font-bold">:</span>
                      <span className="font-mono font-bold">{opr || "-"}</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="min-w-[110px] font-bold">PIC</span>
                      <span className="font-bold">:</span>
                      <span className="font-mono font-bold">{pic || "-"}</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="min-w-[110px] font-bold">Status</span>
                      <span className="font-bold">:</span>
                      <span className="bg-black px-1 text-white">RELEASED</span>
                    </div>
                  </div>
                </div>

                <table className="w-full flex-1 border-2 border-black text-[8pt]" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr className="bg-[#f0f0f0] text-center font-bold uppercase">
                      <th className="border border-black px-1 py-1" style={{ width: "4%" }}>
                        No
                      </th>
                      <th className="border border-black px-1 py-1" style={{ width: hideWarna ? "50%" : isSimple ? "30%" : "24%" }}>
                        {isSimple ? "Nama" : "Model / Tipe Helm"}
                      </th>
                      {!isSimple && (
                        <th className="border border-black px-1 py-1" style={{ width: "8%" }}>
                          Size
                        </th>
                      )}
                      {!hideWarna && (
                        <th className="border border-black px-1 py-1" style={{ width: isSimple ? "20%" : "18%" }}>
                          Warna
                        </th>
                      )}
                      <th className="border border-black px-1 py-1" style={{ width: isSimple ? "10%" : "9%" }}>
                        Target
                      </th>
                      <th className="border border-black px-1 py-1" style={{ width: isSimple ? "10%" : "9%" }}>
                        Hasil (OK)
                      </th>
                      <th className="border border-black px-1 py-1" style={{ width: isSimple ? "10%" : "9%" }}>
                        Reject (NG)
                      </th>
                      <th className="border border-black px-1 py-1" style={{ width: isSimple ? "16%" : "19%" }}>
                        Keterangan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={r.key}>
                        <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
                        <td className={`border border-black px-1 py-1 ${isSimple ? "text-center" : "text-left"}`}>
                          {r.model || "-"}
                        </td>
                        {!isSimple && <td className="border border-black px-1 py-1 text-center">{r.size || "-"}</td>}
                        {!hideWarna && <td className="border border-black px-1 py-1 text-center">{r.warna || "-"}</td>}
                        <td className="border border-black px-1 py-1 text-center">
                          {r.target ? Number(r.target).toLocaleString("id-ID") : ""}
                        </td>
                        <td className="border border-black px-1 py-1 text-center" />
                        <td className="border border-black px-1 py-1 text-center" />
                        <td className="border border-black px-1 py-1 text-center" />
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={hideWarna ? 6 : isSimple ? 7 : 8} className="border border-black px-1 py-4 text-center text-[#6B7280]">
                          Belum ada baris target
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#f0f0f0] font-bold">
                      <td colSpan={hideWarna ? 2 : isSimple ? 3 : 4} className="border border-black px-1 py-1 text-right">
                        TOTAL
                      </td>
                      <td className="border border-black px-1 py-1 text-center">{totals.toLocaleString("id-ID")}</td>
                      <td className="border border-black px-1 py-1 text-center" />
                      <td className="border border-black px-1 py-1 text-center" />
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
                    { role: "Disetujui Oleh,", name: sig3, title: "Manager Produksi" },
                  ].map((s) => (
                    <div key={s.role} className="w-[140px] text-center text-[8pt]">
                      <div className="mb-[35px] font-bold">{s.role}</div>
                      <div className="h-10 border-b border-black"></div>
                      <div className="mt-0.5 font-bold">{s.name}</div>
                      <div className="text-[7pt]">{s.title}</div>
                    </div>
                  ))}
                </div>

                <p className="mt-2 text-center text-[6pt] text-[#6B7280]">
                  SPK {isAuto ? "otomatis" : "manual"} · Divisi {divisi} · {rows.length} baris · total target {totals.toLocaleString("id-ID")} pcs
                </p>
                {decalTotals && (
                  <p className="mt-1 text-center text-[7pt] font-semibold text-[#1E3A5F]">
                    Decal Solid: {decalTotals.solid.toLocaleString("id-ID")} pcs · Decal Motif: {decalTotals.motif.toLocaleString("id-ID")} pcs
                  </p>
                )}
              </div>
              <p className="mt-2 text-center text-xs text-[#6B7280]">Preview live — ubah form kiri otomatis update kertas. Print → Save as PDF.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
