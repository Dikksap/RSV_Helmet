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
} from "../../../api/productionOrders";

import {
  PCS_PER_DUS,
  fmt,
  fmtDus,
  fmtPcsDus,
  stageKeyOf,
} from "./utils";

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

const HEADERS = [
  "Tanggal",
  "Hari",
  "Jam",
  ...STAGE_COLS.map((s) => s.label),
  "Item",
  "Jumlah",
  "Status",
  "Aksi",
] as const;

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function toCsv(rows: ScheduleRow[]): string {
  const csvHeaders = [
    "Tanggal",
    "Hari",
    "Size",
    "Jam",
    "Buffing",
    "Base Coat",
    "Decal Solid",
    "Decal Motif",
    "Top Coat",
    "Perakitan",
    "QC",
    "Item",
    "Jumlah",
    "Jumlah_Dus",
  ];

  const cell = (v: string | number) => {
    const s = String(v);

    return /[",\n]/.test(s)
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const line = (r: ScheduleRow) =>
    [
      fmtDate(r.tanggal),
      r.hari,
      r.size,
      r.jam,
      r.buffing,
      r.baseCoat,
      r.decalSolid,
      r.decalMotif,
      r.topCoat,
      r.perakitan,
      r.qc,
      r.item,
      r.jumlah,
      r.jumlah / PCS_PER_DUS,
    ]
      .map(cell)
      .join(",");

  return [
    csvHeaders.join(","),
    ...rows.map(line),
  ].join("\n");
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

const WHITE_BATOK = new Set([
  "Nation",
  "Platinum Grey",
  "White Glossy",
]);

const rowTone = (status: string) => {
  if (status === "LIBUR") return "bg-slate-50";
  if (status === "Penyesuaian") return "bg-violet-50/60";
  if (status === "QC & Packing") return "bg-amber-50/60";
  if (status === "Persiapan") return "bg-sky-50/60";

  return "";
};

export default function ScheduleTab({ orderId }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);

  const [meta, setMeta] = useState<{
    dialokasikan: number;
    sisa: number;
    hariProduksi: number;
  } | null>(null);

  const [targetEdits, setTargetEdits] = useState<Set<string>>(
    new Set(),
  );

  const [allocEdits, setAllocEdits] = useState<Set<string>>(
    new Set(),
  );

  const [orderQty, setOrderQty] = useState<
    Map<number, { label: string; qty: number; color: string }>
  >(new Map());

  const [capacities, setCapacities] = useState<
    ProductionCapacity[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<
    Record<string, boolean>
  >({});

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

    if (!silent) {
      setLoading(true);
    }

    Promise.all([
      getProductionSchedule(orderId),
      getProductionOrderSummary(orderId),
      getProductionCapacities(orderId),
    ])
      .then(([res, det, caps]) => {
        setRows(res.rows);
        setMeta(res.meta);

        setTargetEdits(
          new Set(
            (res.overrides?.targets ?? []).map(
              (e) => `${e.tanggal}|${e.stage}`,
            ),
          ),
        );

        setAllocEdits(
          new Set(
            (res.overrides?.allocs ?? []).map(
              (e) => `${e.tanggal}|${e.variantId}`,
            ),
          ),
        );

        setOrderQty(
          new Map(
            det.items.map((it) => [
              it.variantId,
              {
                label: `${it.variant.style.nama} ${it.variant.color.nama} ${it.variant.size.nama}`,
                qty: it.qty,
                color: it.variant.color.nama,
              },
            ]),
          ),
        );

        setCapacities(caps);
        setError(null);
      })
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Gagal memuat jadwal.",
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload(false);
  }, [orderId]);

  const saveCell = async (
    raw: string,
    save: (qty: number | null) => Promise<unknown>,
  ) => {
    const t = raw.trim().replace(/\./g, "");

    if (t === "") {
      await save(null);
    } else {
      if (!/^\d+$/.test(t)) {
        throw new Error("Harus angka ≥ 0 / kosongkan");
      }

      await save(Number(t));
    }

    reload(true);
  };

  const download = () => {
    const blob = new Blob(
      [toCsv(rows)],
      { type: "text/csv;charset=utf-8" },
    );

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jadwal-produksi.csv";
    a.click();

    URL.revokeObjectURL(a.href);
  };

  const removeAlloc = async (r: ScheduleRow) => {
    if (orderId === null) return;

    if (
      !window.confirm(
        `Hapus ${r.item} ${r.size} dari ${fmtDate(r.tanggal)}?`,
      )
    ) {
      return;
    }

    try {
      await saveScheduleAlloc(orderId, {
        tanggal: r.tanggal,
        variantId: r.variantId,
        qty: 0,
      });

      setError(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Gagal menghapus item",
      );
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
      await saveScheduleAlloc(orderId, {
        tanggal,
        variantId,
        qty,
        mode: "add",
      });

      setAddTanggal(null);
      setAddVariant("");
      setAddQty("");
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Gagal menambah item",
      );
    } finally {
      setAddBusy(false);
      reload(true);
    }
  };

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
      await saveScheduleAlloc(orderId, {
        tanggal: extTanggal,
        variantId,
        qty,
        mode: "add",
      });

      setExtTanggal("");
      setExtVariant("");
      setExtQty("");
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Gagal menambah item",
      );
    } finally {
      setExtBusy(false);
      reload(true);
    }
  };

  const kpis = meta
    ? [
        {
          label: "Hari produksi",
          value: `${meta.hariProduksi} hari`,
          tone: "navy" as const,
        },
        {
          label: "Dialokasikan",
          value: fmtPcsDus(meta.dialokasikan),
          tone: "green" as const,
        },
        {
          label: "Sisa",
          value: fmtPcsDus(meta.sisa),
          tone:
            meta.sisa > 0
              ? ("red" as const)
              : ("muted" as const),
        },
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

      const total = items.reduce(
        (n, r) => n + r.jumlah,
        0,
      );

      const status = items.every(
        (r) => r.item === "LIBUR",
      )
        ? "LIBUR"
        : total > 0
          ? "Produksi"
          : head.item.startsWith("Persiapan")
            ? "Persiapan"
            : head.item;

      const list = items.filter(
        (r) => r.jumlah > 0,
      );

      const rincian = list
        .map(
          (r) =>
            `${r.item} ${r.size} ${r.jumlah.toLocaleString(
              "id-ID",
            )} pcs (${fmtDus(r.jumlah)} dus)`,
        )
        .join(" · ");

      return {
        tanggal,
        hari: head.hari,
        jam: head.jam,
        head,
        items,
        list,
        total,
        status,
        rincian,
      };
    });
  }, [rows]);

  const diffs = useMemo(() => {
    if (orderQty.size === 0) return [];

    const alloc = new Map<number, number>();

    for (const r of rows) {
      if (r.variantId > 0 && r.jumlah > 0) {
        alloc.set(
          r.variantId,
          (alloc.get(r.variantId) ?? 0) + r.jumlah,
        );
      }
    }

    return [...orderQty.entries()]
      .map(([variantId, o]) => ({
        variantId,
        label: o.label,
        order: o.qty,
        terjadwal: alloc.get(variantId) ?? 0,
      }))
      .filter((d) => d.terjadwal !== d.order)
      .sort(
        (a, b) =>
          a.terjadwal -
          a.order -
          (b.terjadwal - b.order),
      );
  }, [rows, orderQty]);

  const batok = useMemo(() => {
    let putih = 0;
    let total = 0;

    for (const o of orderQty.values()) {
      total += o.qty;

      if (WHITE_BATOK.has(o.color)) {
        putih += o.qty;
      }
    }

    return {
      putih,
      hitam: total - putih,
      total,
    };
  }, [orderQty]);

  const stageStats = useMemo(() => {
    const acuan: Record<string, number> = {};

    for (const c of capacities) {
      const k = stageKeyOf(c.stage);

      if (k) {
        acuan[k] =
          (acuan[k] ?? 0) + c.totalKapasitas;
      }
    }

    const terjadwal: Record<string, number> = {};

    for (const r of rows) {
      for (const s of STAGE_COLS) {
        terjadwal[s.key] =
          (terjadwal[s.key] ?? 0) + r[s.key];
      }
    }

    return STAGE_COLS.map((s) => {
      const a = acuan[s.key] ?? 0;
      const t = terjadwal[s.key] ?? 0;

      return {
        key: s.key,
        label: s.label,
        acuan: a,
        terjadwal: t,
        delta: t - a,
      };
    });
  }, [rows, capacities]);

  return (
    <div className="space-y-4">
      {/* =====================================================
          KPI
      ====================================================== */}
      <KpiStrip items={kpis} />

      {/* =====================================================
          ESTIMASI BATOK
      ====================================================== */}
      {orderQty.size > 0 && (
        <section className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_14px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/70">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                ◉
              </span>

              <div>
                <h3 className="text-sm font-bold text-[#1E3A5F]">
                  Estimasi Kebutuhan Batok
                </h3>

                <p className="text-xs text-slate-400">
                  Berdasarkan warna item pada Production Order
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Batok Putih
              </p>

              <p className="mt-1 text-2xl font-bold tabular-nums text-[#1E3A5F]">
                {fmt(batok.putih)}
                <span className="ml-1 text-sm font-normal text-slate-400">
                  pcs
                </span>
              </p>

              <p className="mt-1 text-[11px] text-slate-400">
                Nation · Platinum Grey · White Glossy
              </p>
            </div>

            <div className="px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Batok Hitam
              </p>

              <p className="mt-1 text-2xl font-bold tabular-nums text-[#1F2937]">
                {fmt(batok.hitam)}
                <span className="ml-1 text-sm font-normal text-slate-400">
                  pcs
                </span>
              </p>

              <p className="mt-1 text-[11px] text-slate-400">
                Item selain kategori batok putih
              </p>
            </div>

            <div className="bg-slate-50/60 px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Total Batok
              </p>

              <p className="mt-1 text-2xl font-bold tabular-nums text-[#00A8E8]">
                {fmt(batok.total)}
                <span className="ml-1 text-sm font-normal text-slate-400">
                  pcs
                </span>
              </p>

              <p className="mt-1 text-[11px] text-slate-500">
                {fmtDus(batok.total)} dus
              </p>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          DIFFERENCE
      ====================================================== */}
      {diffs.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60">
          <button
            type="button"
            onClick={() => setShowDiff((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-xs text-amber-700">
                !
              </span>

              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {diffs.length} item memiliki selisih
                </p>

                <p className="text-xs text-amber-700">
                  Perbandingan jumlah order dan jumlah terjadwal
                </p>
              </div>
            </div>

            <span className="text-sm text-amber-700">
              {showDiff ? "▲" : "▼"}
            </span>
          </button>

          {showDiff && (
            <div className="border-t border-amber-200 px-4 py-3">
              <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                {diffs.map((d) => (
                  <li
                    key={d.variantId}
                    className="flex items-center justify-between gap-4 rounded-lg bg-white/70 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate font-medium text-slate-700">
                      {d.label}
                    </span>

                    <span
                      className={
                        d.terjadwal > d.order
                          ? "shrink-0 font-semibold text-red-500"
                          : "shrink-0 text-slate-500"
                      }
                    >
                      {d.terjadwal.toLocaleString("id-ID")} /{" "}
                      {d.order.toLocaleString("id-ID")} pcs
                      {" "}
                      (
                      {d.terjadwal > d.order
                        ? "+"
                        : ""}
                      {(
                        d.terjadwal - d.order
                      ).toLocaleString("id-ID")}
                      )
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* =====================================================
          MAIN SCHEDULE
      ====================================================== */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_16px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/70">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] font-bold text-[#1E3A5F]">
                Jadwal Produksi
              </h3>

              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                OTOMATIS
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-400">
              {days.length} hari kalender · Klik angka untuk melakukan
              penyesuaian
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={rows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              title="Print"
            >
              <span className="text-base leading-none">🖨</span>
              Print
            </button>

            <button
              type="button"
              onClick={download}
              disabled={rows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#16294a] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-base leading-none">↓</span>
              Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        ) : error ? (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
              📅
            </div>

            <h4 className="font-semibold text-[#1E3A5F]">
              Belum ada jadwal
            </h4>

            <p className="mt-1 text-sm text-slate-500">
              Belum ada jadwal produksi untuk periode ini.
            </p>
          </div>
        ) : (
          <>
            {/* Status legend */}
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  "Produksi",
                  "Persiapan",
                  "Penyesuaian",
                  "QC & Packing",
                  "LIBUR",
                  "Selesai",
                ].map((s) => (
                  <span
                    key={s}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${badgeOf(
                      s,
                    )}`}
                  >
                    {s}
                  </span>
                ))}
              </div>

              <p className="text-[11px] text-slate-400">
                Kuning = edit manual · Kosongkan nilai untuk kembali ke
                perhitungan otomatis
              </p>
            </div>

            {/* Add extra */}
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="mb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[#1E3A5F]">
                  Tambah Alokasi
                </p>

                <p className="text-[11px] text-slate-400">
                  Tambahkan item ke tanggal tertentu, termasuk tanggal yang
                  belum memiliki baris.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_minmax(200px,1fr)_110px_auto]">
                <input
                  type="date"
                  value={extTanggal}
                  onChange={(e) =>
                    setExtTanggal(e.target.value)
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/10"
                />

                <select
                  value={extVariant}
                  onChange={(e) =>
                    setExtVariant(e.target.value)
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/10"
                >
                  <option value="">
                    — Pilih item —
                  </option>

                  {[...orderQty.entries()].map(
                    ([vid, o]) => (
                      <option key={vid} value={vid}>
                        {o.label}
                      </option>
                    ),
                  )}
                </select>

                <input
                  value={extQty}
                  inputMode="numeric"
                  placeholder="Qty pcs"
                  onChange={(e) =>
                    setExtQty(e.target.value)
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-right text-sm text-slate-700 outline-none transition focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/10"
                />

                <button
                  type="button"
                  disabled={extBusy}
                  onClick={() => void submitAddExtra()}
                  className="rounded-xl bg-[#10B981] px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  {extBusy ? "Menyimpan..." : "+ Tambah"}
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full min-w-[1280px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/95">
                    {HEADERS.map((h, index) => (
                      <th
                        key={h}
                        scope="col"
                        className={[
                          "sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 px-3 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 backdrop-blur-sm",
                          index <= 2
                            ? "text-left"
                            : "text-right",
                        ].join(" ")}
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
                      className={[
                        "border-b border-slate-100 transition-colors last:border-0",
                        rowTone(d.status),
                        "hover:bg-slate-50/80",
                      ].join(" ")}
                    >
                      {/* Tanggal */}
                      <td className="sticky left-0 z-[5] whitespace-nowrap border-r border-slate-100 bg-white px-3 py-3 font-semibold tabular-nums text-[#1E3A5F] shadow-[2px_0_4px_-4px_rgba(15,23,42,0.25)]">
                        {fmtDate(d.tanggal)}
                      </td>

                      {/* Hari */}
                      <td className="sticky left-[86px] z-[5] whitespace-nowrap border-r border-slate-100 bg-white px-3 py-3 text-slate-500 shadow-[2px_0_4px_-4px_rgba(15,23,42,0.18)]">
                        {d.hari}
                      </td>

                      {/* Jam */}
                      <td className="sticky left-[170px] z-[5] whitespace-nowrap border-r border-slate-100 bg-white px-3 py-3 tabular-nums text-slate-500 shadow-[2px_0_4px_-4px_rgba(15,23,42,0.18)]">
                        {d.jam}
                      </td>

                      {/* Stages */}
                      {STAGE_COLS.map((s) => {
                        const edited = targetEdits.has(
                          `${d.tanggal}|${s.key}`,
                        );

                        return (
                          <td
                            key={s.key}
                            title={
                              edited
                                ? "Edit manual — kosongkan untuk kembali auto"
                                : "Klik untuk edit"
                            }
                            className={[
                              "border-b border-slate-100 px-3 py-2.5 text-right tabular-nums",
                              edited
                                ? "bg-amber-100 text-amber-900"
                                : "text-slate-700",
                            ].join(" ")}
                          >
                            <EditableCell
                              value={d.head[
                                s.key
                              ].toLocaleString("id-ID")}
                              onSave={(raw) => {
                                if (orderId === null) {
                                  throw new Error(
                                    "Pilih order dulu",
                                  );
                                }

                                return saveCell(
                                  raw,
                                  (qty) =>
                                    saveScheduleTarget(
                                      orderId,
                                      {
                                        tanggal: d.tanggal,
                                        stage: s.key,
                                        qty,
                                      },
                                    ),
                                );
                              }}
                            />
                          </td>
                        );
                      })}

                      {/* Item */}
                      <td
                        className="min-w-[280px] max-w-[430px] border-b border-slate-100 px-3 py-2.5 align-top"
                        title={d.rincian || d.status}
                      >
                        {d.list.length === 0 ? (
                          <span className="text-slate-400">
                            —
                          </span>
                        ) : (
                          <>
                            <ul className="space-y-1.5">
                              {(expanded[d.tanggal]
                                ? d.list
                                : d.list.slice(0, 3)
                              ).map((r, i) => (
                                <li
                                  key={`${r.item}-${r.size}-${i}`}
                                  className="flex items-start justify-between gap-3"
                                >
                                  <span className="min-w-0 truncate text-[12px] font-medium text-slate-700">
                                    {r.item}{" "}
                                    <span className="font-normal text-slate-400">
                                      {r.size}
                                    </span>
                                  </span>

                                  <span className="inline-flex shrink-0 items-start gap-1 text-right tabular-nums">
                                    <span>
                                      {r.variantId > 0 ? (
                                        <span
                                          className={[
                                            "block rounded px-1 text-[12px] font-semibold text-[#1E3A5F]",
                                            allocEdits.has(
                                              `${r.tanggal}|${r.variantId}`,
                                            )
                                              ? "bg-amber-100"
                                              : "",
                                          ].join(" ")}
                                        >
                                          <EditableCell
                                            value={r.jumlah.toLocaleString(
                                              "id-ID",
                                            )}
                                            onSave={(
                                              raw,
                                            ) => {
                                              if (
                                                orderId ===
                                                null
                                              ) {
                                                throw new Error(
                                                  "Pilih order dulu",
                                                );
                                              }

                                              return saveCell(
                                                raw,
                                                (qty) =>
                                                  saveScheduleAlloc(
                                                    orderId,
                                                    {
                                                      tanggal:
                                                        r.tanggal,
                                                      variantId:
                                                        r.variantId,
                                                      qty,
                                                    },
                                                  ),
                                              );
                                            }}
                                          />

                                          {/* <span>
                                            {" "}
                                            pcs
                                          </span> */}
                                        </span>
                                      ) : (
                                        <span className="block text-[12px] font-semibold text-[#1E3A5F]">
                                          {r.jumlah.toLocaleString(
                                            "id-ID",
                                          )}{" "}
                                          pcs
                                        </span>
                                      )}

                                      <span className="block text-[10px] text-slate-400">
                                        {fmtDus(r.jumlah)}{" "}
                                        dus
                                      </span>
                                    </span>

                                    {r.variantId > 0 && (
                                      <button
                                        type="button"
                                        title={`Hapus ${r.item} ${r.size}`}
                                        onClick={() =>
                                          void removeAlloc(
                                            r,
                                          )
                                        }
                                        className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md text-slate-300 transition hover:bg-red-50 hover:text-red-500"
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
                                onClick={() =>
                                  setExpanded(
                                    (p) => ({
                                      ...p,
                                      [d.tanggal]:
                                        !p[d.tanggal],
                                    }),
                                  )
                                }
                                className="mt-2 text-[11px] font-bold text-[#00A8E8] hover:underline"
                              >
                                {expanded[d.tanggal]
                                  ? "Tutup rincian"
                                  : `+ ${
                                      d.list.length - 3
                                    } item lagi`}
                              </button>
                            )}

                            {/* Add item to current day */}
                            {addTanggal ===
                            d.tanggal ? (
                              <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 p-1.5">
                                <select
                                  value={addVariant}
                                  onChange={(e) =>
                                    setAddVariant(
                                      e.target.value,
                                    )
                                  }
                                  className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px]"
                                >
                                  <option value="">
                                    — Item —
                                  </option>

                                  {[
                                    ...orderQty.entries(),
                                  ].map(([vid, o]) => (
                                    <option
                                      key={vid}
                                      value={vid}
                                    >
                                      {o.label}
                                    </option>
                                  ))}
                                </select>

                                <input
                                  value={addQty}
                                  inputMode="numeric"
                                  placeholder="pcs"
                                  onChange={(e) =>
                                    setAddQty(
                                      e.target.value,
                                    )
                                  }
                                  className="w-16 rounded-md border border-slate-200 px-1.5 py-1 text-right text-[11px]"
                                />

                                <button
                                  type="button"
                                  disabled={addBusy}
                                  onClick={() =>
                                    void submitAddAlloc(
                                      d.tanggal,
                                    )
                                  }
                                  className="rounded-md bg-[#10B981] px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                                >
                                  OK
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setAddTanggal(
                                      null,
                                    )
                                  }
                                  className="rounded-md bg-white px-2 py-1 text-[11px] text-slate-500"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setAddTanggal(
                                    d.tanggal,
                                  );
                                  setAddVariant("");
                                  setAddQty("");
                                }}
                                className="mt-2 text-[11px] font-bold text-emerald-600 hover:underline"
                              >
                                + Item
                              </button>
                            )}
                          </>
                        )}
                      </td>

                      {/* Jumlah */}
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2.5 text-right tabular-nums">
                        <span className="block font-bold text-[#1E3A5F]">
                          {d.total.toLocaleString(
                            "id-ID",
                          )}{" "}
                        
                        </span>

                        <span className="mt-0.5 block text-[10px] text-slate-400">
                          {fmtDus(d.total)} dus
                        </span>
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${badgeOf(
                            d.status,
                          )}`}
                        >
                          {d.status}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2.5">
                        <button
                          type="button"
                          title="Cetak SPK"
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#1E3A5F]/15 bg-white px-3 py-1.5 text-[11px] font-bold text-[#1E3A5F] shadow-sm transition hover:border-[#1E3A5F]/30 hover:bg-slate-50 active:scale-[0.98]"
                        >
                          <span className="text-sm leading-none">🖨</span>
                          SPK
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer */}
                {capacities.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td
                        colSpan={3}
                        className="border-t border-slate-200 px-3 py-3"
                      >
                        <p className="text-xs font-bold text-[#1E3A5F]">
                          Total Terjadwal
                        </p>

                        <p className="text-[10px] text-slate-400">
                          Selisih terhadap kapasitas
                        </p>
                      </td>

                      {stageStats.map((s) => (
                        <td
                          key={s.key}
                          title={`${s.label}: terjadwal ${s.terjadwal.toLocaleString(
                            "id-ID",
                          )} · kapasitas ${s.acuan.toLocaleString(
                            "id-ID",
                          )}`}
                          className="border-t border-slate-200 px-3 py-3 text-right tabular-nums"
                        >
                          <span className="block text-xs font-bold text-slate-700">
                            {s.terjadwal.toLocaleString(
                              "id-ID",
                            )}
                          </span>

                          <span
                            className={[
                              "mt-0.5 block text-[10px] font-semibold",
                              s.delta > 0
                                ? "text-red-500"
                                : s.delta < 0
                                  ? "text-sky-600"
                                  : "text-emerald-600",
                            ].join(" ")}
                          >
                            {s.delta > 0 ? "+" : ""}
                            {s.delta.toLocaleString(
                              "id-ID",
                            )}
                          </span>
                        </td>
                      ))}

                      <td
                        colSpan={3}
                        className="px-3 py-3 text-right text-[10px] leading-relaxed text-slate-400"
                      >
                        <span className="text-red-500">
                          Δ &gt; 0
                        </span>{" "}
                        melebihi kapasitas ·{" "}
                        <span className="text-sky-600">
                          Δ &lt; 0
                        </span>{" "}
                        kapasitas menganggur
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
