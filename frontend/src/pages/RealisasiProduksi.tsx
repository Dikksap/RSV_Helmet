import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  getProductionOrders,
  getProductionOrderSummary,
  getProductionSchedule,
  getRealisasi,
  saveRealisasi,
  REALISASI_STAGE_LABEL,
  type ProductionOrderListItem,
  type ProductionOrderSummary,
  type ProductionSchedule,
  type RealisasiRow,
  type RealisasiStageRow,
} from "../api/productionOrders";

const STAGE_KEYS = Object.keys(REALISASI_STAGE_LABEL);
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

type Tab = "jadwal" | "input" | "rekap";

function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(y, m - 1, d);
  t.setDate(t.getDate() + delta);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function hariOf(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return HARI[new Date(y, m - 1, d).getDay()];
}

function monthRange(periode: string | null): [string, string] {
  const m = /^(\d{4})-(\d{2})/.exec(periode ?? "");
  const y = m ? Number(m[1]) : new Date().getFullYear();
  const mo = m ? Number(m[2]) : new Date().getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(y, mo, 0).getDate();
  return [`${y}-${pad(mo)}-01`, `${y}-${pad(mo)}-${pad(last)}`];
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function eachDay(awal: string, akhir: string): string[] {
  const out: string[] = [];
  let t = awal;
  for (let n = 0; n < 93 && t <= akhir; n++) {
    out.push(t);
    t = shiftDay(t, 1);
  }
  return out;
}

type Row = {
  variantId: number;
  label: string;
  sub: string;
  rencana: number;
  finishgood: number;
};

export default function RealisasiProduksi() {
  const [tab, setTab] = useState<Tab>("jadwal");
  const [orders, setOrders] = useState<ProductionOrderListItem[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState(todayKey());
  const [awal, setAwal] = useState(() => shiftDay(todayKey(), -6));
  const [akhir, setAkhir] = useState(todayKey());
  const [orderData, setOrderData] = useState<{ summary: ProductionOrderSummary; schedule: ProductionSchedule } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [inputs, setInputs] = useState<Record<number, number>>({});
  const [rejectInputs, setRejectInputs] = useState<Record<number, number>>({});
  const [rekapAll, setRekapAll] = useState<RealisasiRow[]>([]);
  const [loadingRekap, setLoadingRekap] = useState(false);
  const [rencanaTahap, setRencanaTahap] = useState<Record<string, number>>({});
  const [tahapInputs, setTahapInputs] = useState<Record<string, number>>({});
  const [jadwalSaved, setJadwalSaved] = useState<RealisasiRow[]>([]);
  const [jadwalFg, setJadwalFg] = useState<RealisasiRow[]>([]);
  const [jadwalTahap, setJadwalTahap] = useState<RealisasiStageRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingJadwal, setLoadingJadwal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    getProductionOrders()
      .then((res) => {
        const aktif = res.filter((o) => o.status === "AKTIF");
        setOrders(aktif);
        if (aktif.length > 0) setOrderId((p) => p ?? aktif[0].id);
        setOrdersLoaded(true);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Gagal memuat orders.");
        setOrdersLoaded(true);
      });
  }, []);

  useEffect(() => {
    const o = orders.find((x) => x.id === orderId) ?? null;
    if (!o) return;
    const [a, b] = monthRange(o.periode);
    setAwal(a);
    setAkhir(b);
  }, [orderId, orders]);

  useEffect(() => {
    if (orderId === null) return;
    setLoadingOrder(true);
    Promise.all([getProductionOrderSummary(orderId), getProductionSchedule(orderId)])
      .then(([summary, schedule]) => setOrderData({ summary, schedule }))
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat order."))
      .finally(() => setLoadingOrder(false));
  }, [orderId]);

  const loadInput = useCallback(async () => {
    if (orderId === null || !orderData) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = await getRealisasi(orderId, tanggal, tanggal);
      const rencana = new Map<number, number>();
      for (const r of orderData.schedule.rows) {
        if (r.tanggal !== tanggal || r.variantId <= 0 || r.jumlah <= 0) continue;
        rencana.set(r.variantId, (rencana.get(r.variantId) ?? 0) + r.jumlah);
      }
      const head = orderData.schedule.rows.find((r) => r.tanggal === tanggal);
      setRencanaTahap({
        persiapan: head?.persiapan ?? 0,
        decalSolid: head?.decalSolid ?? 0,
        decalMotif: head?.decalMotif ?? 0,
        topCoat: head?.topCoat ?? 0,
        perakitan: head?.perakitan ?? 0,
        qc: head?.qc ?? 0,
      });
      const saved = new Map<number, RealisasiRow>(data.realisasi.map((x: RealisasiRow) => [x.variantId, x]));
      const fg = new Map<number, number>(data.finishgood.map((x: RealisasiRow) => [x.variantId, x.qty]));
      const savedTahap = new Map((data.tahapan ?? []).map((x) => [x.stage, x.qty]));
      const nextTahap: Record<string, number> = {};
      for (const k of STAGE_KEYS) nextTahap[k] = savedTahap.get(k) ?? 0;
      setTahapInputs(nextTahap);
      const next: Row[] = [];
      const nextInputs: Record<number, number> = {};
      const nextReject: Record<number, number> = {};
      for (const it of orderData.summary.items) {
        const vid = it.variantId;
        const rc = rencana.get(vid) ?? 0;
        const sv = saved.get(vid);
        const f = fg.get(vid) ?? 0;
        if (rc === 0 && sv === undefined && f === 0) continue;
        next.push({
          variantId: vid,
          label: `${it.variant.product.nama} · ${it.variant.style.nama} ${it.variant.color.nama}`,
          sub: `${it.variant.kodeVariant} · Size ${it.variant.size.nama}`,
          rencana: rc,
          finishgood: f,
        });
        nextInputs[vid] = sv?.qty ?? f;
        nextReject[vid] = sv?.reject ?? 0;
      }
      setRows(next);
      setInputs(nextInputs);
      setRejectInputs(nextReject);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat realisasi.");
    } finally {
      setLoading(false);
    }
  }, [orderId, orderData, tanggal]);

  useEffect(() => {
    if (tab === "input") void loadInput();
  }, [tab, loadInput]);

  const loadJadwal = useCallback(async () => {
    if (orderId === null || awal > akhir) return;
    setLoadingJadwal(true);
    setError(null);
    try {
      const data = await getRealisasi(orderId, awal, akhir);
      setJadwalSaved(data.realisasi);
      setJadwalFg(data.finishgood ?? []);
      setJadwalTahap(data.tahapan ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat jadwal realisasi.");
    } finally {
      setLoadingJadwal(false);
    }
  }, [orderId, awal, akhir]);

  useEffect(() => {
    if (tab === "jadwal") void loadJadwal();
  }, [tab, loadJadwal]);

  useEffect(() => {
    if (tab !== "rekap" || orderId === null) return;
    setLoadingRekap(true);
    setError(null);
    getRealisasi(orderId)
      .then((data) => setRekapAll(data.realisasi))
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat rekap."))
      .finally(() => setLoadingRekap(false));
  }, [tab, orderId]);

  const rekapRows = useMemo(() => {
    if (!orderData) return [];
    const agg = new Map<number, { baik: number; reject: number }>();
    for (const x of rekapAll) {
      const cur = agg.get(x.variantId) ?? { baik: 0, reject: 0 };
      cur.baik += x.qty;
      cur.reject += x.reject ?? 0;
      agg.set(x.variantId, cur);
    }
    return orderData.summary.items.map((it) => {
      const a = agg.get(it.variantId) ?? { baik: 0, reject: 0 };
      const target = it.qty;
      const pct = target > 0 ? (a.baik / target) * 100 : a.baik > 0 ? 100 : 0;
      return {
        variantId: it.variantId,
        item: `${it.variant.product.nama} ${it.variant.style.nama} ${it.variant.color.nama}`,
        size: it.variant.size.nama,
        target,
        baik: a.baik,
        reject: a.reject,
        pct,
      };
    });
  }, [orderData, rekapAll]);

  const rekapTotals = useMemo(() => {
    let target = 0;
    let baik = 0;
    let reject = 0;
    for (const r of rekapRows) {
      target += r.target;
      baik += r.baik;
      reject += r.reject;
    }
    return { target, baik, reject, pct: target > 0 ? (baik / target) * 100 : 0 };
  }, [rekapRows]);

  const jadwalRows = useMemo(() => {
    if (!orderData) return [];
    const rencana = new Map<string, number>();
    const rencanaVar = new Map<string, { variantId: number; label: string; qty: number }>();
    const head = new Map<string, (typeof orderData.schedule.rows)[number]>();
    for (const r of orderData.schedule.rows) {
      if (r.tanggal < awal || r.tanggal > akhir) continue;
      if (!head.has(r.tanggal)) head.set(r.tanggal, r);
      if (r.variantId <= 0 || r.jumlah <= 0) continue;
      rencana.set(r.tanggal, (rencana.get(r.tanggal) ?? 0) + r.jumlah);
      const key = `${r.tanggal}:${r.variantId}`;
      const cur = rencanaVar.get(key);
      if (cur) cur.qty += r.jumlah;
      else rencanaVar.set(key, { variantId: r.variantId, label: `${r.item} · Size ${r.size}`, qty: r.jumlah });
    }
    const saved = new Map<string, number>();
    const savedVar = new Map<string, number>();
    for (const x of jadwalSaved) {
      saved.set(x.tanggal, (saved.get(x.tanggal) ?? 0) + x.qty);
      savedVar.set(`${x.tanggal}:${x.variantId}`, x.qty);
    }
    const savedTahap = new Map<string, number>();
    for (const x of jadwalTahap) savedTahap.set(`${x.tanggal}:${x.stage}`, x.qty);
    const fgByDay = new Map<string, { total: number; perVariant: Map<number, number> }>();
    for (const x of jadwalFg) {
      let e = fgByDay.get(x.tanggal);
      if (!e) {
        e = { total: 0, perVariant: new Map() };
        fgByDay.set(x.tanggal, e);
      }
      e.total += x.qty;
      e.perVariant.set(x.variantId, (e.perVariant.get(x.variantId) ?? 0) + x.qty);
    }
    const varLabel = new Map<number, string>();
    for (const it of orderData.summary.items) {
      varLabel.set(
        it.variantId,
        `${it.variant.product.nama} · ${it.variant.style.nama} ${it.variant.color.nama} · Size ${it.variant.size.nama}`,
      );
    }
    return eachDay(awal, akhir).map((t) => {
      const h = head.get(t);
      const varMap = new Map<number, { label: string; rencana: number; aktual: number }>();
      for (const [k, v] of rencanaVar) {
        if (k.startsWith(`${t}:`))
          varMap.set(v.variantId, { label: varLabel.get(v.variantId) ?? v.label, rencana: v.qty, aktual: 0 });
      }
      for (const [k, q] of savedVar) {
        if (!k.startsWith(`${t}:`)) continue;
        const vid = Number(k.slice(t.length + 1));
        const cur = varMap.get(vid);
        if (cur) cur.aktual = q;
        else varMap.set(vid, { label: varLabel.get(vid) ?? `Variant #${vid}`, rencana: 0, aktual: q });
      }
      const fg = fgByDay.get(t);
      const unfilled = fg
        ? [...fg.perVariant.entries()]
            .filter(([vid, q]) => q > 0 && !savedVar.has(`${t}:${vid}`))
            .map(([variantId, qty]) => ({ variantId, qty }))
        : [];
      return {
        tanggal: t,
        hari: hariOf(t),
        jam: head.get(t)?.jam ?? 0,
        rencana: rencana.get(t) ?? 0,
        aktual: saved.get(t) ?? 0,
        fgTotal: fg?.total ?? 0,
        unfilled,
        unfilledTotal: unfilled.reduce((n, u) => n + u.qty, 0),
        items: [...varMap.entries()].map(([variantId, v]) => ({ variantId, ...v })),
        stages: STAGE_KEYS.map((k) => ({
          key: k,
          label: REALISASI_STAGE_LABEL[k],
          rencana: (h?.[k as "persiapan"] as number | undefined) ?? 0,
          aktual: savedTahap.get(`${t}:${k}`) ?? 0,
        })),
      };
    });
  }, [orderData, jadwalSaved, jadwalFg, jadwalTahap, awal, akhir]);

  const jadwalTotals = useMemo(() => {
    let rencana = 0;
    let aktual = 0;
    for (const d of jadwalRows) {
      rencana += d.rencana;
      aktual += d.aktual;
    }
    return { rencana, aktual };
  }, [jadwalRows]);

  const totals = useMemo(() => {
    let rencana = 0;
    let aktual = 0;
    for (const r of rows) {
      rencana += r.rencana;
      aktual += inputs[r.variantId] ?? 0;
    }
    return { rencana, aktual, selisih: aktual - rencana };
  }, [rows, inputs]);

  const save = async () => {
    if (orderId === null || tanggal < todayKey()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const items = rows.map((r) => ({
        variantId: r.variantId,
        qty: Math.max(0, Math.floor(inputs[r.variantId] ?? 0)),
        reject: Math.max(0, Math.floor(rejectInputs[r.variantId] ?? 0)),
      }));
      const tahapan = STAGE_KEYS.map((stage) => ({ stage, qty: Math.max(0, Math.floor(tahapInputs[stage] ?? 0)) }));
      const saved = await saveRealisasi(orderId, tanggal, items, tahapan);
      const map = new Map(saved.items.map((x) => [x.variantId, x]));
      setInputs((p) => {
        const n = { ...p };
        for (const r of rows) n[r.variantId] = map.get(r.variantId)?.qty ?? 0;
        return n;
      });
      setRejectInputs((p) => {
        const n = { ...p };
        for (const r of rows) n[r.variantId] = map.get(r.variantId)?.reject ?? 0;
        return n;
      });
      const tmap = new Map(saved.tahapan.map((x) => [x.stage, x.qty]));
      setTahapInputs((p) => {
        const n = { ...p };
        for (const k of STAGE_KEYS) n[k] = tmap.get(k) ?? 0;
        return n;
      });
      setNotice(`Tersimpan untuk ${fmtDate(tanggal)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan realisasi.");
    } finally {
      setSaving(false);
    }
  };

  const statusOf = (rencana: number, aktual: number) => {
    if (rencana === 0 && aktual === 0) return { text: "—", cls: "bg-slate-100 text-slate-500" };
    if (aktual === rencana) return { text: "Tercapai", cls: "bg-emerald-100 text-emerald-800" };
    if (aktual < rencana)
      return { text: `Kurang ${(rencana - aktual).toLocaleString("id-ID")}`, cls: "bg-red-100 text-red-700" };
    return { text: `Lebih ${(aktual - rencana).toLocaleString("id-ID")}`, cls: "bg-sky-100 text-sky-800" };
  };

  const gotoInput = (t: string) => {
    setTanggal(t);
    setTab("input");
  };

  const autofill = async (t: string, items: { variantId: number; qty: number }[]) => {
    if (orderId === null || items.length === 0) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveRealisasi(orderId, t, items);
      setNotice(`${items.length} variant ${fmtDate(t)} terisi dari finishgood (${items.reduce((n, u) => n + u.qty, 0).toLocaleString("id-ID")} pcs). Yang sudah ada input tak diubah.`);
      await loadJadwal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal isi otomatis.");
    } finally {
      setSaving(false);
    }
  };

  const dayStatus =
    rows.length === 0
      ? { text: "Belum ada jadwal hari ini", cls: "bg-slate-100 text-slate-500" }
      : statusOf(totals.rencana, totals.aktual);

  const today = todayKey();
  const locked = tanggal < today;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">
            Barang Produksi
          </p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">
            Realisasi Produksi
          </h1>
          <p className="mt-2 text-base text-[#6B7280]">
            Jadwal realisasi dari plan produksi dan input hasil harian per item variant.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-[#1F2937]">
          Periode
          <select
            value={orderId ?? ""}
            onChange={(e) => setOrderId(Number(e.target.value))}
            disabled={orders.length === 0}
            className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-[15px] focus:outline-2 focus:outline-[#00A8E8] disabled:opacity-40"
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nomor} · {o.periode}
              </option>
            ))}
          </select>
        </label>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Tab realisasi produksi">
        {([
          { key: "jadwal", label: "Jadwal Realisasi" },
          { key: "input", label: "Input Harian" },
          { key: "rekap", label: "Rekap" },
        ] as const).map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={active}
              className={`rounded-lg px-4 py-2.5 text-[15px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#00A8E8] ${
                active
                  ? "bg-[#1E3A5F] text-white"
                  : "bg-white text-[#6B7280] ring-1 ring-slate-200/70 hover:bg-[#F5F7FA] hover:text-[#1F2937]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {error && (
        <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700">
          {notice}
        </p>
      )}

      {ordersLoaded && orders.length === 0 && !error && (
        <p role="status" className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-[#6B7280]">
          Belum ada plan produksi berstatus AKTIF.
        </p>
      )}

    {tab === "jadwal" && (
  <>
    {/* Ringkasan */}
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: "Total rencana", value: jadwalTotals.rencana },
        { label: "Total realisasi", value: jadwalTotals.aktual },
        { label: "Selisih", value: jadwalTotals.aktual - jadwalTotals.rencana },
      ].map((k) => (
        <div
          key={k.label}
          className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
            {k.label}
          </p>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${
              k.label === "Selisih" && k.value < 0
                ? "text-[#EF4444]"
                : "text-[#1E3A5F]"
            }`}
          >
            {k.value.toLocaleString("id-ID")}
          </p>
        </div>
      ))}
      <div className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
          Status periode
        </p>
        <p className="mt-2">
          {(() => {
            const st = statusOf(jadwalTotals.rencana, jadwalTotals.aktual);
            return (
              <span
                className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${st.cls}`}
              >
                {st.text}
              </span>
            );
          })()}
        </p>
      </div>
    </section>

    {/* Tabel jadwal */}
    <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
        <h3 className="mr-auto font-semibold text-[#1E3A5F]">
          Jadwal Realisasi{" "}
          <span className="text-xs font-normal text-[#6B7280]">
            · dari plan produksi
          </span>
        </h3>
        <label className="flex items-center gap-2 text-sm text-[#6B7280]">
          Dari
          <input
            type="date"
            value={awal}
            max={akhir}
            onChange={(e) => e.target.value && setAwal(e.target.value)}
            className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[15px] focus:outline-2 focus:outline-[#00A8E8]"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[#6B7280]">
          Sampai
          <input
            type="date"
            value={akhir}
            min={awal}
            onChange={(e) => e.target.value && setAkhir(e.target.value)}
            className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[15px] focus:outline-2 focus:outline-[#00A8E8]"
          />
        </label>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-[#F5F7FA] px-4 py-2.5 text-xs text-[#6B7280]">
        <span>
          Cara baca: <b className="font-normal text-slate-400">abu</b> = Rencana,{" "}
          <b className="text-[#1E3A5F]">tebal</b> = Realisasi.
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
            Tercapai
          </span>
          aktual = rencana
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">
            Kurang X
          </span>
          di bawah rencana
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-800">
            Lebih X
          </span>
          di atas rencana
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
            Tanpa rencana
          </span>
          di luar jadwal
        </span>
      </div>

      {loadingOrder || loadingJadwal ? (
        <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">
          Memuat jadwal realisasi...
        </p>
      ) : jadwalRows.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-[15px] font-medium text-[#1F2937]">
            Tidak ada tanggal pada rentang ini
          </p>
          <p className="mt-1 text-sm text-[#6B7280]">
            Coba ubah filter <b>Dari</b> / <b>Sampai</b> di atas.
          </p>
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-20">
              {/* Baris 1: grup kolom */}
              <tr className="text-[11px] uppercase tracking-wide text-[#6B7280]">
                <th
                  scope="col"
                  rowSpan={2}
                  className="sticky left-0 z-30 border-b border-slate-100 bg-white px-3 py-2 text-left font-semibold"
                >
                  Tanggal
                </th>
                <th
                  scope="col"
                  rowSpan={2}
                  className="border-b border-slate-100 bg-white px-3 py-2 text-left font-semibold"
                >
                  Hari / Jam
                </th>
                <th
                  scope="col"
                  colSpan={STAGE_KEYS.length}
                  className="border-b border-l border-slate-100 bg-[#F5F7FA] px-3 py-1.5 text-center font-semibold text-[#1E3A5F]"
                >
                  Realisasi Tahap
                </th>
                <th
                  scope="col"
                  colSpan={2}
                  className="border-b border-l border-slate-100 bg-[#F5F7FA] px-3 py-1.5 text-center font-semibold text-[#1E3A5F]"
                >
                  Item & Jumlah
                </th>
                <th
                  scope="col"
                  rowSpan={2}
                  className="border-b border-l border-slate-100 bg-white px-3 py-2 text-left font-semibold"
                >
                  Status
                </th>
                <th
                  scope="col"
                  rowSpan={2}
                  className="border-b border-l border-slate-100 bg-white px-3 py-2 text-right font-semibold"
                >
                  Aksi
                </th>
              </tr>
              {/* Baris 2: sub-header */}
              <tr className="text-[11px] uppercase tracking-wide text-[#6B7280]">
                {STAGE_KEYS.map((k) => (
                  <th
                    key={k}
                    scope="col"
                    className="whitespace-nowrap border-b border-l border-slate-100 bg-white px-3 py-2 text-right font-semibold"
                  >
                    {REALISASI_STAGE_LABEL[k]}
                    <span className="block text-[10px] font-normal normal-case text-slate-400">
                      rencana → realisasi
                    </span>
                  </th>
                ))}
                <th
                  scope="col"
                  className="border-b border-l border-slate-100 bg-white px-3 py-2 text-left font-semibold"
                >
                  Variant
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap border-b border-slate-100 bg-white px-3 py-2 text-right font-semibold"
                >
                  Jumlah
                  <span className="block text-[10px] font-normal normal-case text-slate-400">
                    rencana → realisasi
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {jadwalRows.map((d) => {
                const st = statusOf(d.rencana, d.aktual);
                const open = !!expanded[d.tanggal];
                const rowBg =
                  d.unfilledTotal > 0 && d.tanggal >= today
                    ? "bg-amber-50/40"
                    : d.rencana > 0 && d.aktual < d.rencana && d.tanggal < today
                    ? "bg-red-50/40"
                    : d.rencana > 0 && d.aktual >= d.rencana
                    ? "bg-emerald-50/30"
                    : "";
                const cell = (rencana: number, aktual: number) => {
                  const diff = aktual - rencana;
                  return (
                    <div className="text-right leading-tight tabular-nums">
                      <div className="text-[11px] text-slate-400">
                        {rencana.toLocaleString("id-ID")}
                      </div>
                      <div
                        className={`font-bold ${
                          rencana === 0 && aktual === 0
                            ? "text-slate-300"
                            : aktual === rencana
                            ? "text-emerald-700"
                            : diff < 0
                            ? "text-red-600"
                            : "text-sky-700"
                        }`}
                      >
                        {aktual.toLocaleString("id-ID")}
                      </div>
                    </div>
                  );
                };
                return (
                  <Fragment key={d.tanggal}>
                    <tr
                      className={`group border-b border-slate-50 last:border-0 hover:bg-[#F5F7FA] ${rowBg}`}
                    >
                      <td
                        className={`sticky left-0 z-10 whitespace-nowrap border-r border-slate-100 px-3 py-2.5 font-semibold tabular-nums text-[#1E3A5F] ${
                          rowBg || "bg-white"
                        } group-hover:bg-[#F5F7FA]`}
                      >
                        {fmtDate(d.tanggal)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">
                        <span className="font-medium text-[#1F2937]">
                          {d.hari}
                        </span>
                        {d.jam > 0 && (
                          <span className="ml-1 text-xs text-slate-400">
                            · {d.jam} jam
                          </span>
                        )}
                      </td>
                      {d.stages.map((s) => (
                        <td
                          key={s.key}
                          className="border-l border-slate-100 px-3 py-2.5"
                        >
                          {cell(s.rencana, s.aktual)}
                        </td>
                      ))}
                      <td className="min-w-[240px] max-w-[420px] border-l border-slate-100 px-3 py-2.5 font-medium text-[#1F2937]">
                        {d.items.length === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <>
                            <ul className="space-y-1">
                              {(open ? d.items : d.items.slice(0, 3)).map(
                                (v) => (
                                  <li
                                    key={v.variantId}
                                    className="flex justify-between gap-2 text-[13px]"
                                    title={`Rencana ${v.rencana.toLocaleString(
                                      "id-ID"
                                    )}, realisasi ${v.aktual.toLocaleString(
                                      "id-ID"
                                    )}`}
                                  >
                                    <span className="truncate">{v.label}</span>
                                    <span className="shrink-0 tabular-nums">
                                      <span className="text-slate-400">
                                        {v.rencana.toLocaleString("id-ID")}
                                      </span>
                                      {" → "}
                                      <b className="text-[#1E3A5F]">
                                        {v.aktual.toLocaleString("id-ID")}
                                      </b>
                                    </span>
                                  </li>
                                )
                              )}
                            </ul>
                            {d.items.length > 3 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpanded((p) => ({
                                    ...p,
                                    [d.tanggal]: !p[d.tanggal],
                                  }))
                                }
                                className="mt-1 text-xs font-semibold text-[#00A8E8] hover:underline"
                              >
                                {open
                                  ? "Tutup"
                                  : `+ ${d.items.length - 3} item lagi`}
                              </button>
                            )}
                          </>
                        )}
                      </td>
                      <td className="border-l border-slate-100 px-3 py-2.5 text-right">
                        <div className="tabular-nums">
                          <span className="text-xs text-slate-400">
                            {d.rencana.toLocaleString("id-ID")}
                          </span>
                          <span className="mx-1 text-slate-300">→</span>
                          <span className="font-bold text-[#1E3A5F]">
                            {d.aktual.toLocaleString("id-ID")}
                          </span>
                          {d.fgTotal > 0 && (
                            <div className="mt-0.5 text-[10px] font-normal text-slate-400">
                              FG {d.fgTotal.toLocaleString("id-ID")}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap border-l border-slate-100 px-3 py-2.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}
                        >
                          {st.text}
                        </span>
                      </td>
                      <td className="whitespace-nowrap border-l border-slate-100 px-3 py-2.5 text-right">
                        <span className="inline-flex flex-col items-end gap-1">
                          {d.tanggal < today ? (
                            <span className="px-3 py-1.5 text-xs font-medium text-slate-400">
                              🔒 Terkunci
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => gotoInput(d.tanggal)}
                              className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#0088C0] hover:bg-sky-50"
                            >
                              Isi
                            </button>
                          )}
                          {d.unfilledTotal > 0 && d.tanggal >= today && (
                            <button
                              type="button"
                              disabled={saving}
                              title={`${d.unfilled.length} variant finishgood belum diinput`}
                              onClick={() =>
                                void autofill(d.tanggal, d.unfilled)
                              }
                              className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-40"
                            >
                              +{d.unfilledTotal.toLocaleString("id-ID")}{" "}
                              finishgood
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="border-t-2 border-slate-200 bg-[#F5F7FA] text-[#1E3A5F]">
                <td
                  className="sticky left-0 z-30 bg-[#F5F7FA] px-3 py-3 font-bold"
                  colSpan={2}
                >
                  TOTAL
                </td>
                <td
                  colSpan={STAGE_KEYS.length}
                  className="px-3 py-3 text-xs font-normal text-[#6B7280]"
                >
                  Ringkasan tahapan lihat kolom masing-masing
                </td>
                <td className="border-l border-slate-200 px-3 py-3 text-right text-xs font-normal text-[#6B7280]">
                  total item
                </td>
                <td className="border-l border-slate-200 px-3 py-3 text-right tabular-nums">
                  <div className="text-xs text-slate-400">
                    {jadwalTotals.rencana.toLocaleString("id-ID")}
                  </div>
                  <div className="font-bold">
                    {jadwalTotals.aktual.toLocaleString("id-ID")}
                  </div>
                </td>
                <td
                  className="border-l border-slate-200 px-3 py-3"
                  colSpan={2}
                >
                  {(() => {
                    const st = statusOf(
                      jadwalTotals.rencana,
                      jadwalTotals.aktual
                    );
                    return (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}
                      >
                        {st.text}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  </>
)}

      {tab === "rekap" && (
        <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="border-b border-slate-100 p-4">
            <h3 className="font-semibold text-[#1E3A5F]">
              Rekap Realisasi Produksi{" "}
              <span className="font-normal text-xs text-[#6B7280]">· akumulasi semua tanggal</span>
            </h3>
          </div>
          {loadingRekap || loadingOrder ? (
            <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat rekap...</p>
          ) : rekapRows.length === 0 ? (
            <p className="p-6 text-center text-[#6B7280]">Belum ada item pada order ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                    <th scope="col" className="px-3 py-3 font-semibold">Item</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Size</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Target</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Realisasi Baik</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Reject</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">% Progress</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Progress bar</th>
                  </tr>
                </thead>
                <tbody>
                  {rekapRows.map((r) => (
                    <tr key={r.variantId} className="border-b border-slate-50 hover:bg-[#F5F7FA]">
                      <td className="px-3 py-2.5 font-medium text-[#1F2937]">{r.item}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">{r.size}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">
                        {r.target.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-700">
                        {r.baik.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#EF4444]">
                        {r.reject.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">
                        {Number(r.pct.toFixed(1)).toLocaleString("id-ID")}%
                      </td>
                      <td className="min-w-32 px-3 py-2.5">
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${r.pct >= 100 ? "bg-emerald-500" : "bg-[#00A8E8]"}`}
                            style={{ width: `${Math.min(100, r.pct)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#F5F7FA] font-bold">
                    <td colSpan={2} className="px-3 py-2.5 text-[#1E3A5F]">TOTAL</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">
                      {rekapTotals.target.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                      {rekapTotals.baik.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#EF4444]">
                      {rekapTotals.reject.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">
                      {Number(rekapTotals.pct.toFixed(1)).toLocaleString("id-ID")}%
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-[#1E3A5F]"
                          style={{ width: `${Math.min(100, rekapTotals.pct)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "input" && (
        <>
          {locked && (
            <p role="status" className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-[#6B7280]">
              Tanggal {fmtDate(tanggal)} terkunci — data sebelum hari ini tidak bisa diubah. Yang bisa diisi: hari ini sampai akhir plan produksi.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTanggal((t) => shiftDay(t, -1))}
                aria-label="Hari sebelumnya"
                className="rounded-lg bg-white px-3 py-2.5 text-[15px] font-bold text-[#1F2937] ring-1 ring-slate-200/70 hover:bg-[#F5F7FA]"
              >
                ‹
              </button>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => e.target.value && setTanggal(e.target.value)}
                className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-[15px] focus:outline-2 focus:outline-[#00A8E8]"
              />
              <button
                type="button"
                onClick={() => setTanggal((t) => shiftDay(t, 1))}
                aria-label="Hari berikutnya"
                className="rounded-lg bg-white px-3 py-2.5 text-[15px] font-bold text-[#1F2937] ring-1 ring-slate-200/70 hover:bg-[#F5F7FA]"
              >
                ›
              </button>
            </div>
          </div>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Rencana hari ini", value: totals.rencana },
              { label: "Realisasi (input)", value: totals.aktual },
              { label: "Selisih", value: totals.selisih },
            ].map((k) => (
              <div key={k.label} className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">{k.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[#1E3A5F]">
                  {k.value.toLocaleString("id-ID")}
                </p>
              </div>
            ))}
            <div className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Status hari</p>
              <p className="mt-2">
                <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${dayStatus.cls}`}>
                  {dayStatus.text}
                </span>
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="border-b border-slate-100 p-4">
              <h3 className="font-semibold text-[#1E3A5F]">
                Realisasi Tahap <span className="font-normal text-xs text-[#6B7280]">· {fmtDate(tanggal)} · ikut tombol Simpan di bawah</span>
              </h3>
            </div>
            {loading ? (
              <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat tahapan...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6">
                {STAGE_KEYS.map((k) => {
                  const rc = rencanaTahap[k] ?? 0;
                  const ak = tahapInputs[k] ?? 0;
                  const st = statusOf(rc, ak);
                  return (
                    <div key={k} className="rounded-xl bg-[#F5F7FA] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                        {REALISASI_STAGE_LABEL[k]}
                      </p>
                      <input
                        type="number"
                        min={0}
                        value={ak}
                        disabled={locked}
                        onChange={(e) =>
                          setTahapInputs((p) => ({ ...p, [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))
                        }
                        className="mt-2 w-full rounded-lg border border-[#D1D5DB] bg-white px-2 py-1.5 text-right tabular-nums focus:outline-2 focus:outline-[#00A8E8] disabled:bg-slate-100 disabled:text-slate-400"
                      />
                      <p className="mt-1 text-xs tabular-nums text-[#6B7280]">
                        Rencana {rc.toLocaleString("id-ID")}
                      </p>
                      <p className="mt-1">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>
                          {st.text}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <h3 className="font-semibold text-[#1E3A5F]">
                {fmtDate(tanggal)} <span className="font-normal text-xs text-[#6B7280]">· {rows.length} variant</span>
              </h3>              <button                type="button"
                onClick={() => void save()}
                    disabled={saving || rows.length === 0 || locked}
                className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#16294a] active:scale-[0.98] disabled:opacity-40"
              >
                {saving ? "Menyimpan..." : "Simpan Realisasi"}
              </button>
            </div>
            <p className="border-b border-slate-100 bg-[#F5F7FA] px-4 py-2 text-xs text-[#6B7280]">
              Kolom Aktual terisi otomatis dari Finishgood — ubah manual bila perlu, lalu tekan Simpan Realisasi.
            </p>
            {loading ? (
              <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat jadwal & realisasi...</p>
            ) : rows.length === 0 ? (
              <p className="p-6 text-center text-[#6B7280]">Tidak ada jadwal produksi pada tanggal ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                      <th scope="col" className="px-3 py-3 font-semibold">Item Variant</th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">Rencana<span className="block text-[10px] font-normal normal-case text-slate-400">jadwal hari ini</span></th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">Finishgood<span className="block text-[10px] font-normal normal-case text-slate-400">barang tercatat</span></th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">Aktual<span className="block text-[10px] font-normal normal-case text-slate-400">ketik hasil</span></th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">Reject<span className="block text-[10px] font-normal normal-case text-slate-400">barang gagal</span></th>
                      <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const aktual = inputs[r.variantId] ?? 0;
                      const st = statusOf(r.rencana, aktual);
                      return (
                        <tr key={r.variantId} className="border-b border-slate-50 last:border-0 hover:bg-[#F5F7FA]">
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-[#1F2937]">{r.label}</p>
                            <p className="font-mono text-xs text-[#6B7280]">{r.sub}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">
                            {r.rencana.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-[#6B7280]" title="Barang FINISHGOOD bertanggal hari ini">
                            {r.finishgood.toLocaleString("id-ID")}
                          </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          min={0}
                          value={aktual}
                          disabled={locked}
                          onChange={(e) =>
                            setInputs((p) => ({ ...p, [r.variantId]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))
                          }
                          className="w-24 rounded-lg border border-[#D1D5DB] px-2 py-1.5 text-right tabular-nums focus:outline-2 focus:outline-[#00A8E8] disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          min={0}
                          value={rejectInputs[r.variantId] ?? 0}
                          disabled={locked}
                          onChange={(e) =>
                            setRejectInputs((p) => ({ ...p, [r.variantId]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))
                          }
                          className="w-20 rounded-lg border border-[#D1D5DB] px-2 py-1.5 text-right tabular-nums focus:outline-2 focus:outline-[#00A8E8] disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
                              {st.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
