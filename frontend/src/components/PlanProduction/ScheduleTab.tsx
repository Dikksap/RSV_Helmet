import { useEffect, useMemo, useState } from "react";
import {
  getProductionCapacities,
  getProductionOrderSummary,
  getProductionSchedule,
  saveScheduleAlloc,
  saveScheduleTarget,
  type ProductionCapacity,
  type ScheduleRow,
  type ScheduleStageKey,
} from "../../api/productionOrders";
import { PCS_PER_DUS, fmt, fmtDus, fmtPcsDus, stageKeyOf } from "./utils";
import EditableCell from "./EditableCell";
import KpiStrip from "./KpiStrip";

interface Props {
  orderId: number | null;
}

const STAGE_COLS: { key: ScheduleStageKey; label: string }[] = [
  { key: "buffing", label: "Buffing" },
  { key: "baseCoat", label: "Base Coat" },
  { key: "decalSolid", label: "Decal Solid" },
  { key: "decalMotif", label: "Decal Motif" },
  { key: "topCoat", label: "Top Coat" },
  { key: "perakitan", label: "Perakitan" },
  { key: "qc", label: "QC" },
];

// Header disesuaikan dengan kolom yang BENAR-BENAR dirender di <tbody>
const HEADERS = [
  "Tanggal",
  "Hari",
  "Jam",
  ...STAGE_COLS.map((s) => s.label),
  "Item",
  "Jumlah (pcs · dus)",
  "Status",
] as const;

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function toCsv(rows: ScheduleRow[]): string {
  const csvHeaders = [
    "Tanggal", "Hari", "Size", "Jam",
    "Buffing", "Base Coat", "Decal Solid", "Decal Motif",
    "Top Coat", "Perakitan", "QC",
    "Item", "Jumlah", "Jumlah_Dus",
  ];
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const line = (r: ScheduleRow) =>
    [fmtDate(r.tanggal), r.hari, r.size, r.jam, r.buffing, r.baseCoat, r.decalSolid, r.decalMotif, r.topCoat, r.perakitan, r.qc, r.item, r.jumlah, r.jumlah / PCS_PER_DUS]
      .map(cell)
      .join(",");
  return [csvHeaders.join(","), ...rows.map(line)].join("\n");
}

const STATUS_BADGE: Record<string, string> = {
  Produksi: "bg-[#1E3A5F] text-white",
  Persiapan: "bg-sky-100 text-sky-800",
  Penyesuaian: "bg-violet-100 text-violet-800",
  "QC & Packing": "bg-amber-100 text-amber-800",
  LIBUR: "bg-slate-100 text-slate-500",
  Selesai: "bg-slate-100 text-slate-600",
};

const badgeOf = (status: string) =>
  STATUS_BADGE[status] ?? "bg-slate-100 text-slate-600";

const WHITE_BATOK = new Set(["Nation", "Platinum Grey", "White Glossy"]);

const rowTone = (status: string) => {
  if (status === "LIBUR") return "bg-slate-50";
  if (status === "Penyesuaian") return "bg-violet-50/60";
  if (status === "QC & Packing") return "bg-amber-50/60";
  if (status === "Persiapan") return "bg-sky-50/60";
  return "";
};

export default function ScheduleTab({ orderId }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [meta, setMeta] = useState<{ dialokasikan: number; sisa: number; hariProduksi: number } | null>(null);
  const [targetEdits, setTargetEdits] = useState<Set<string>>(new Set());
  const [allocEdits, setAllocEdits] = useState<Set<string>>(new Set());
  const [orderQty, setOrderQty] = useState<Map<number, { label: string; qty: number; color: string }>>(new Map());
  const [capacities, setCapacities] = useState<ProductionCapacity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showDiff, setShowDiff] = useState(false);
  const [addTanggal, setAddTanggal] = useState<string | null>(null);
  const [addVariant, setAddVariant] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [extTanggal, setExtTanggal] = useState("");
  const [extVariant, setExtVariant] = useState("");
  const [extQty, setExtQty] = useState("");
  const [extBusy, setExtBusy] = useState(false);

  const reload = (silent = false) => {
    if (orderId === null) return;
    if (!silent) setLoading(true);
    Promise.all([
      getProductionSchedule(orderId),
      getProductionOrderSummary(orderId),
      getProductionCapacities(orderId),
    ])
      .then(([res, det, caps]) => {
        setRows(res.rows);
        setMeta(res.meta);
        setTargetEdits(new Set((res.overrides?.targets ?? []).map((e) => `${e.tanggal}|${e.stage}`)));
        setAllocEdits(new Set((res.overrides?.allocs ?? []).map((e) => `${e.tanggal}|${e.variantId}`)));
        setOrderQty(new Map(det.items.map((it) => [
          it.variantId,
          {
            label: `${it.variant.style.nama} ${it.variant.color.nama} ${it.variant.size.nama}`,
            qty: it.qty,
            color: it.variant.color.nama,
          },
        ])));
        setCapacities(caps);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat jadwal."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload(false);
  }, [orderId]);

  // Simpan edit sel: kosong = kembali ke angka auto, angka = override.
  // Terima format id-ID (1.234) dari draft EditableCell.
  const saveCell = async (raw: string, save: (qty: number | null) => Promise<unknown>) => {
    const t = raw.trim().replace(/\./g, "");
    if (t === "") {
      await save(null);
    } else {
      if (!/^\d+$/.test(t)) throw new Error("Harus angka ≥ 0 / kosongkan");
      await save(Number(t));
    }
    reload(true);
  };

  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jadwal-produksi.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Hapus item dari hari itu = qty 0 (baris hilang dari daftar, tetap 0 walau auto berubah).
  const removeAlloc = async (r: ScheduleRow) => {
    if (orderId === null) return;
    if (!window.confirm(`Hapus ${r.item} ${r.size} dari ${fmtDate(r.tanggal)}?`)) return;
    try {
      await saveScheduleAlloc(orderId, { tanggal: r.tanggal, variantId: r.variantId, qty: 0 });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus item");
    } finally {
      reload(true);
    }
  };

  const submitAddAlloc = async (tanggal: string) => {
    if (orderId === null || addBusy) return;
    const variantId = Number(addVariant);
    const qty = Number(addQty);
    if (!variantId) {
      setError("Pilih item dulu");
      return;
    }
    if (!Number.isInteger(qty) || qty < 0) {
      setError("Qty harus angka bulat ≥ 0");
      return;
    }
    setAddBusy(true);
    try {
      await saveScheduleAlloc(orderId, { tanggal, variantId, qty, mode: "add" });
      setAddTanggal(null);
      setAddVariant("");
      setAddQty("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menambah item");
    } finally {
      setAddBusy(false);
      reload(true);
    }
  };

  // Tambah item di tanggal bebas (termasuk tanggal kosong tanpa baris).
  // Backend upsert: tanggal+variant baru = baris baru, yang sudah ada = update qty.
  const submitAddExtra = async () => {
    if (orderId === null || extBusy) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(extTanggal)) {
      setError("Tanggal wajib diisi (YYYY-MM-DD)");
      return;
    }
    const variantId = Number(extVariant);
    const qty = Number(extQty);
    if (!variantId) {
      setError("Pilih item dulu");
      return;
    }
    if (!Number.isInteger(qty) || qty < 0) {
      setError("Qty harus angka bulat ≥ 0");
      return;
    }
    setExtBusy(true);
    try {
      await saveScheduleAlloc(orderId, { tanggal: extTanggal, variantId, qty, mode: "add" });
      setExtTanggal("");
      setExtVariant("");
      setExtQty("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menambah item");
    } finally {
      setExtBusy(false);
      reload(true);
    }
  };

  const kpis = meta
    ? [
        { label: "Hari produksi", value: `${meta.hariProduksi} hari`, tone: "navy" as const },
        { label: "Dialokasikan", value: fmtPcsDus(meta.dialokasikan), tone: "green" as const },
        { label: "Sisa", value: fmtPcsDus(meta.sisa), tone: meta.sisa > 0 ? ("red" as const) : ("muted" as const) },
      ]
    : [];

  const days = useMemo(() => {
    const groups = new Map<string, ScheduleRow[]>();
    for (const r of rows) {
      const g = groups.get(r.tanggal) ?? [];
      g.push(r);
      groups.set(r.tanggal, g);
    }
    return [...groups.entries()].map(([tanggal, items]) => {
      const head = items[0];
      const total = items.reduce((n, r) => n + r.jumlah, 0);
      const status = items.every((r) => r.item === "LIBUR")
        ? "LIBUR"
        : total > 0
          ? "Produksi"
          : head.item.startsWith("Persiapan")
            ? "Persiapan"
            : head.item;
      const list = items.filter((r) => r.jumlah > 0);
      const rincian = list
        .map((r) => `${r.item} ${r.size} ${r.jumlah.toLocaleString("id-ID")} pcs (${fmtDus(r.jumlah)} dus)`)
        .join(" · ");
      return { tanggal, hari: head.hari, jam: head.jam, head, items, list, total, status, rincian };
    });
  }, [rows]);

  // Selisih bebas: alokasi per variant vs qty order (info saja, tanpa penolakan).
  const diffs = useMemo(() => {
    if (orderQty.size === 0) return [];
    const alloc = new Map<number, number>();
    for (const r of rows) {
      if (r.variantId > 0 && r.jumlah > 0) alloc.set(r.variantId, (alloc.get(r.variantId) ?? 0) + r.jumlah);
    }
    return [...orderQty.entries()]
      .map(([variantId, o]) => ({ variantId, label: o.label, order: o.qty, terjadwal: alloc.get(variantId) ?? 0 }))
      .filter((d) => d.terjadwal !== d.order)
      .sort((a, b) => (a.terjadwal - a.order) - (b.terjadwal - b.order));
  }, [rows, orderQty]);

  // Estimasi batok: warna item tertentu = batok putih, sisanya hitam.
  const batok = useMemo(() => {
    let putih = 0;
    let total = 0;
    for (const o of orderQty.values()) {
      total += o.qty;
      if (WHITE_BATOK.has(o.color)) putih += o.qty;
    }
    return { putih, hitam: total - putih, total };
  }, [orderQty]);

  // Total terjadwal per tahap vs acuan totalKapasitas (tab Kapasitas Produksi).
  // Baris lanjutan sudah 0, aman dijumlahkan mentah.
  const stageStats = useMemo(() => {
    const acuan: Record<string, number> = {};
    for (const c of capacities) {
      const k = stageKeyOf(c.stage);
      if (k) acuan[k] = (acuan[k] ?? 0) + c.totalKapasitas;
    }
    const terjadwal: Record<string, number> = {};
    for (const r of rows) {
      for (const s of STAGE_COLS) terjadwal[s.key] = (terjadwal[s.key] ?? 0) + r[s.key];
    }
    return STAGE_COLS.map((s) => {
      const a = acuan[s.key] ?? 0;
      const t = terjadwal[s.key] ?? 0;
      return { key: s.key, label: s.label, acuan: a, terjadwal: t, delta: t - a };
    });
  }, [rows, capacities]);

  return (
    <div className="space-y-4">
      <KpiStrip items={kpis} />
      {orderQty.size > 0 && (
        <section className="rounded-xl bg-white px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-semibold text-[#1E3A5F]">Estimasi Batok</p>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Batok Putih Item</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-[#1E3A5F]">
                {fmt(batok.putih)} <span className="text-sm font-normal text-[#6B7280]">pcs</span>
              </p>
              <p className="text-[11px] text-[#6B7280]">Motif Nation · Solid Platinum Grey · Solid White Glossy</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Batok Hitam (sisanya)</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-[#1F2937]">
                {fmt(batok.hitam)} <span className="text-sm font-normal text-[#6B7280]">pcs</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Total</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-[#1E3A5F]">
                {fmt(batok.total)} <span className="text-sm font-normal text-[#6B7280]">pcs · {fmtDus(batok.total)} dus</span>
              </p>
            </div>
          </div>
        </section>
      )}
      {diffs.length > 0 && (
        <div className="rounded-xl bg-white px-4 py-3 text-sm shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            onClick={() => setShowDiff((v) => !v)}
            className="font-semibold text-[#1E3A5F] hover:underline"
          >
            {showDiff ? "▾" : "▸"} {diffs.length} item selisih vs order (bebas, info saja)
          </button>
          {showDiff && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[13px] text-[#1F2937]">
              {diffs.map((d) => (
                <li key={d.variantId} className="flex justify-between gap-2 tabular-nums">
                  <span className="truncate">{d.label}</span>
                  <span className={d.terjadwal > d.order ? "text-[#EF4444]" : "text-[#6B7280]"}>
                    {d.terjadwal.toLocaleString("id-ID")} / {d.order.toLocaleString("id-ID")} pcs
                    ({d.terjadwal > d.order ? "+" : ""}{(d.terjadwal - d.order).toLocaleString("id-ID")})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <h3 className="font-semibold text-[#1E3A5F]">
            Jadwal Produksi Otomatis{" "}
            <span className="font-normal text-xs text-[#6B7280]">· {days.length} hari kalender</span>
          </h3>
          <button
            type="button"
            onClick={download}
            disabled={rows.length === 0}
            className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#16294a] active:scale-[0.98] disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>

        {loading ? (
          <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Menyusun jadwal...</p>
        ) : error ? (
          <p role="alert" className="p-6 text-center text-[#EF4444]">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-[#6B7280]">Belum ada jadwal untuk periode ini.</p>
        ) : (
          <div>
            <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-[#F5F7FA] px-4 py-2.5 text-xs text-[#6B7280]">
              {["Produksi", "Persiapan", "Penyesuaian", "QC & Packing", "LIBUR", "Selesai"].map((s) => (
                <span key={s} className={`rounded-full px-2.5 py-0.5 font-semibold ${badgeOf(s)}`}>{s}</span>
              ))}
              <span className="ml-auto">
                Klik angka untuk edit · sel kuning = edit manual (kosongkan = kembali auto) · rincian size di Export CSV
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-4 py-3">
              <span className="w-full text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Tambah item di tanggal lain (termasuk tanggal kosong)
              </span>
              <label className="text-xs text-[#6B7280]">
                Tanggal
                <input
                  type="date"
                  value={extTanggal}
                  onChange={(e) => setExtTanggal(e.target.value)}
                  className="mt-0.5 block rounded border border-slate-300 px-2 py-1.5 text-sm text-[#1F2937]"
                />
              </label>
              <label className="min-w-[200px] flex-1 text-xs text-[#6B7280]">
                Item
                <select
                  value={extVariant}
                  onChange={(e) => setExtVariant(e.target.value)}
                  className="mt-0.5 block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-[#1F2937]"
                >
                  <option value="">— Pilih item —</option>
                  {[...orderQty.entries()].map(([vid, o]) => (
                    <option key={vid} value={vid}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[#6B7280]">
                Qty (pcs)
                <input
                  value={extQty}
                  inputMode="numeric"
                  placeholder="0"
                  onChange={(e) => setExtQty(e.target.value)}
                  className="mt-0.5 block w-24 rounded border border-slate-300 px-2 py-1.5 text-right text-sm text-[#1F2937]"
                />
              </label>
              <button
                type="button"
                disabled={extBusy}
                onClick={() => void submitAddExtra()}
                className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {extBusy ? "Menyimpan..." : "+ Tambah"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                    {HEADERS.map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="whitespace-nowrap bg-white px-3 py-3 font-semibold"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr
                      key={d.tanggal}
                      className={`border-b border-slate-50 last:border-0 ${rowTone(d.status)} hover:bg-[#F5F7FA]`}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-[#1E3A5F]">
                        {fmtDate(d.tanggal)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">{d.hari}</td>
                      <td className="px-3 py-2.5 tabular-nums text-[#6B7280]">{d.jam}</td>
                      {STAGE_COLS.map((s) => {
                        const edited = targetEdits.has(`${d.tanggal}|${s.key}`);
                        return (
                          <td
                            key={s.key}
                            title={edited ? "Edit manual — kosongkan untuk kembali auto" : "Klik untuk edit"}
                            className={`px-3 py-2.5 text-right tabular-nums text-[#1F2937] ${edited ? "bg-amber-100" : ""}`}
                          >
                            <EditableCell
                              value={d.head[s.key].toLocaleString("id-ID")}
                              onSave={(raw) => {
                                if (orderId === null) throw new Error("Pilih order dulu");
                                return saveCell(raw, (qty) => saveScheduleTarget(orderId, { tanggal: d.tanggal, stage: s.key, qty }));
                              }}
                            />
                          </td>
                        );
                      })}
                      <td
                        className="min-w-[220px] max-w-[420px] px-3 py-2.5 font-medium text-[#1F2937]"
                        title={d.rincian || d.status}
                      >
                        {d.list.length === 0 ? (
                          "—"
                        ) : (
                          <>
                            <ul className="space-y-1">
                              {(expanded[d.tanggal] ? d.list : d.list.slice(0, 3)).map((r, i) => (
                                <li key={`${r.item}-${r.size}-${i}`} className="flex justify-between gap-2 whitespace-nowrap text-[13px]">
                                  <span className="truncate">{r.item} <span className="text-[#6B7280]">{r.size}</span></span>
                                  <span className="inline-flex shrink-0 items-start gap-1 text-right tabular-nums">
                                    <span className={allocEdits.has(`${r.tanggal}|${r.variantId}`) ? "bg-amber-100" : ""}>
                                      {r.variantId > 0 ? (
                                        <span className="block text-[#1E3A5F]">
                                          <EditableCell
                                            value={r.jumlah.toLocaleString("id-ID")}
                                            onSave={(raw) => {
                                              if (orderId === null) throw new Error("Pilih order dulu");
                                              return saveCell(raw, (qty) => saveScheduleAlloc(orderId, { tanggal: r.tanggal, variantId: r.variantId, qty }));
                                            }}
                                          />
                                          <span> pcs</span>
                                        </span>
                                      ) : (
                                        <span className="block text-[#1E3A5F]">{r.jumlah.toLocaleString("id-ID")} pcs</span>
                                      )}
                                      <span className="block text-[11px] font-normal text-[#6B7280]">{fmtDus(r.jumlah)} dus</span>
                                    </span>
                                    {r.variantId > 0 && (
                                      <button
                                        type="button"
                                        title={`Hapus ${r.item} ${r.size}`}
                                        onClick={() => void removeAlloc(r)}
                                        className="mt-0.5 rounded px-1 text-xs text-[#6B7280] hover:bg-red-50 hover:text-[#EF4444]"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {d.list.length > 3 && (
                              <button
                                type="button"
                                onClick={() => setExpanded((p) => ({ ...p, [d.tanggal]: !p[d.tanggal] }))}
                                className="mt-1 text-xs font-semibold text-[#00A8E8] hover:underline"
                              >
                                {expanded[d.tanggal] ? "Tutup" : `+ ${d.list.length - 3} item lagi`}
                              </button>
                            )}
                            {addTanggal === d.tanggal ? (
                              <span className="mt-1 flex items-center gap-1 whitespace-normal">
                                <select
                                  value={addVariant}
                                  onChange={(e) => setAddVariant(e.target.value)}
                                  className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-1 py-1 text-xs"
                                >
                                  <option value="">— Item —</option>
                                  {[...orderQty.entries()].map(([vid, o]) => (
                                    <option key={vid} value={vid}>{o.label}</option>
                                  ))}
                                </select>
                                <input
                                  value={addQty}
                                  inputMode="numeric"
                                  placeholder="pcs"
                                  onChange={(e) => setAddQty(e.target.value)}
                                  className="w-16 rounded border border-slate-300 px-1 py-1 text-right text-xs"
                                />
                                <button
                                  type="button"
                                  disabled={addBusy}
                                  onClick={() => void submitAddAlloc(d.tanggal)}
                                  className="rounded bg-[#10B981] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAddTanggal(null)}
                                  className="rounded bg-slate-200 px-2 py-1 text-xs text-[#1F2937]"
                                >
                                  ×
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setAddTanggal(d.tanggal);
                                  setAddVariant("");
                                  setAddQty("");
                                }}
                                className="mt-1 text-xs font-semibold text-[#10B981] hover:underline"
                              >
                                + Tambah item
                              </button>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <span className="block font-bold text-[#1E3A5F]">{d.total.toLocaleString("id-ID")} pcs</span>
                        <span className="block text-[11px] font-normal text-[#6B7280]">{fmtDus(d.total)} dus</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeOf(d.status)}`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {capacities.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-[#F5F7FA] text-xs text-[#1F2937]">
                      <td colSpan={3} className="px-3 py-2.5 font-semibold text-[#1E3A5F]">
                        Total · selisih vs kapasitas
                      </td>
                      {stageStats.map((s) => (
                        <td
                          key={s.key}
                          title={`${s.label}: terjadwal ${s.terjadwal.toLocaleString("id-ID")} · kapasitas ${s.acuan.toLocaleString("id-ID")}`}
                          className="px-3 py-2.5 text-right tabular-nums"
                        >
                          <span className="block font-semibold">{s.terjadwal.toLocaleString("id-ID")}</span>
                          <span
                            className={`block text-[11px] font-normal ${
                              s.delta > 0 ? "text-[#EF4444]" : s.delta < 0 ? "text-sky-600" : "text-[#10B981]"
                            }`}
                          >
                            {s.delta > 0 ? "+" : ""}
                            {s.delta.toLocaleString("id-ID")}
                          </span>
                        </td>
                      ))}
                      <td colSpan={3} className="px-3 py-2.5 text-right font-normal text-[#6B7280]">
                        Δ &gt; 0 melebihi kapasitas · Δ &lt; 0 kapasitas menganggur
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}