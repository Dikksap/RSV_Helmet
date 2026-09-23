import { useMemo } from "react";
import { Doughnut, Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler, BarElement } from "chart.js";
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler, BarElement);
import type { ProductionOrderSummary, ProductionSchedule, RealisasiRow, RealisasiStageRow } from "../../api/productionOrders";
import { STAGE_KEYS } from "./utils";

interface Props {
  orderData: { summary: ProductionOrderSummary; schedule: ProductionSchedule } | null;
  orders: { id: number; periode: string; label?: string | null; nomor?: string }[];
  orderId: number | null;
  dashRows: RealisasiRow[];
  dashTahap: RealisasiStageRow[];
  dashLoading: boolean;
  loadingOrder: boolean;
  lastUpdate: string;
}

const DIVISI_DEFS: { label: string; key: string; rakDenom: number | null }[] = [
  { label: "Buffing", key: "persiapan", rakDenom: 72 },
  { label: "Base Coat", key: "persiapan", rakDenom: 72 },
  { label: "Decal Solid", key: "decalSolid", rakDenom: null },
  { label: "Decal Motif", key: "decalMotif", rakDenom: null },
  { label: "Top Coat", key: "topCoat", rakDenom: 72 },
  { label: "Poles", key: "perakitan", rakDenom: 72 },
  { label: "QC & Packing", key: "qc", rakDenom: 72 },
];

export default function DashboardTab({ orderData, orders, orderId, dashRows, dashTahap, dashLoading, loadingOrder, lastUpdate }: Props) {
  const kpi = useMemo(() => {
    const target = orderData?.summary.totalQty ?? 0;
    let realisasi = 0, reject = 0;
    const days = new Set<string>();
    for (const r of dashRows) { realisasi += r.qty; reject += r.reject ?? 0; if (r.qty > 0 || (r.reject ?? 0) > 0) days.add(r.tanggal); }
    const totalHasil = realisasi + reject;
    const yieldRate = totalHasil > 0 ? (realisasi / totalHasil) * 100 : 0;
    const progress = target > 0 ? (realisasi / target) * 100 : 0;
    const sisa = Math.max(0, target - realisasi);
    const hariProduksi = days.size;
    let status = "BERJALAN", statusCls = "bg-sky-100 text-sky-800 border-sky-200";
    if (orderData?.summary.status === "BATAL") { status = "BATAL"; statusCls = "bg-slate-100 text-slate-600 border-slate-200"; }
    else if (progress >= 100) { status = "SELESAI"; statusCls = "bg-emerald-100 text-emerald-800 border-emerald-200"; }
    else if (realisasi === 0) { status = "BELUM MULAI"; statusCls = "bg-amber-100 text-amber-800 border-amber-200"; }
    return { target, realisasi, reject, yieldRate, progress, sisa, hariProduksi, status, statusCls };
  }, [orderData, dashRows]);

  const detailProgress = useMemo(() => {
    if (!orderData) return { rows: [] as { item: string; target: number; realisasi: number; reject: number; sisa: number; progress: number; yieldRate: number; status: string }[], totals: { target:0, realisasi:0, reject:0, sisa:0, progress:0, yieldRate:0 } };
    const agg = new Map<number, { baik: number; reject: number }>();
    for (const r of dashRows) { const cur = agg.get(r.variantId) ?? { baik: 0, reject: 0 }; cur.baik += r.qty; cur.reject += r.reject ?? 0; agg.set(r.variantId, cur); }
    const byLabel = new Map<string, { target: number; realisasi: number; reject: number }>();
    for (const it of orderData.summary.items) {
      const label = `${it.variant.style.nama} ${it.variant.color.nama}`;
      const cur = byLabel.get(label) ?? { target: 0, realisasi: 0, reject: 0 };
      cur.target += it.qty; const a = agg.get(it.variantId); if (a) { cur.realisasi += a.baik; cur.reject += a.reject; } byLabel.set(label, cur);
    }
    const rows = [...byLabel.entries()].map(([item, v]) => {
      const sisa = Math.max(0, v.target - v.realisasi);
      const progress = v.target > 0 ? (v.realisasi / v.target) * 100 : 0;
      const yieldRate = (v.realisasi + v.reject) > 0 ? (v.realisasi / (v.realisasi + v.reject)) * 100 : 0;
      let status = "🔄 JALAN"; if (progress >= 100) status = "✅ SELESAI"; else if (v.realisasi === 0 && v.reject === 0) status = "⏸ BELUM";
      return { item, target: v.target, realisasi: v.realisasi, reject: v.reject, sisa, progress, yieldRate, status };
    }).sort((a,b)=> b.target - a.target);
    const totals = rows.reduce((acc,r)=>({ target:acc.target+r.target, realisasi:acc.realisasi+r.realisasi, reject:acc.reject+r.reject, sisa:acc.sisa+r.sisa, progress:0, yieldRate:0 }), { target:0, realisasi:0, reject:0, sisa:0, progress:0, yieldRate:0 });
    totals.progress = totals.target>0 ? (totals.realisasi/totals.target)*100 : 0;
    totals.yieldRate = (totals.realisasi+totals.reject)>0 ? (totals.realisasi/(totals.realisasi+totals.reject))*100 : 0;
    return { rows, totals };
  }, [orderData, dashRows]);

  const divisiProgress = useMemo(() => {
    if (!orderData) return [] as { divisi: string; targetHari: number; rak: string; hariSelesai: number; totalHari: number; progress: number; status: string }[];
    const rencanaByDayStage = new Map<string, Map<string, number>>();
    for (const r of orderData.schedule.rows) { if (!rencanaByDayStage.has(r.tanggal)) rencanaByDayStage.set(r.tanggal, new Map()); const m = rencanaByDayStage.get(r.tanggal)!; for (const k of STAGE_KEYS) m.set(k, (r as any)[k] ?? 0); }
    const aktualByDayStage = new Map<string, Map<string, number>>();
    for (const t of dashTahap) { if (!aktualByDayStage.has(t.tanggal)) aktualByDayStage.set(t.tanggal, new Map()); aktualByDayStage.get(t.tanggal)!.set(t.stage, t.qty); }
    const mode = (vals: number[]) => { if (vals.length===0) return 0; const freq = new Map<number,number>(); for (const v of vals) freq.set(v,(freq.get(v)??0)+1); return [...freq.entries()].sort((a,b)=> b[1]-a[1] || b[0]-a[0])[0][0]; };
    return DIVISI_DEFS.map((d) => {
      const vals: number[] = []; let totalHari=0, hariSelesai=0;
      for (const [tgl, mp] of rencanaByDayStage) { const rencana = mp.get(d.key) ?? 0; if (rencana<=0) continue; totalHari+=1; vals.push(rencana); const aktual = aktualByDayStage.get(tgl)?.get(d.key) ?? 0; if (aktual >= rencana) hariSelesai+=1; }
      const targetHari = mode(vals);
      const rak = d.rakDenom ? (targetHari>0 ? `${Math.round(targetHari/d.rakDenom)} rak` : "-") : "-";
      const progress = totalHari>0 ? (hariSelesai/totalHari)*100 : 0;
      const status = progress>=100 ? "✅ SELESAI" : progress>0 ? "🔄 JALAN" : totalHari===0 ? "—" : "⏸ BELUM";
      return { divisi: d.label, targetHari, rak, hariSelesai, totalHari, progress, status };
    });
  }, [orderData, dashTahap]);

  const trendHarian = useMemo(() => {
    if (!orderData) return [] as { tanggal: string; baik: number; reject: number; total: number }[];
    const agg = new Map<string, { baik: number; reject: number }>();
    for (const r of dashRows) { const cur = agg.get(r.tanggal) ?? { baik: 0, reject: 0 }; cur.baik += r.qty; cur.reject += r.reject ?? 0; agg.set(r.tanggal, cur); }
    const allDates = [...new Set(orderData.schedule.rows.map(r=>r.tanggal))].sort();
    const targetLen = Math.max(allDates.length, agg.size, 8);
    const out: { tanggal: string; baik: number; reject: number; total: number }[] = [];
    for (let i=0;i<targetLen;i++){ const t=allDates[i]; if(!t){ out.push({tanggal:"",baik:0,reject:0,total:0}); continue; } const v=agg.get(t) ?? {baik:0,reject:0}; out.push({tanggal:t,baik:v.baik,reject:v.reject,total:v.baik+v.reject}); }
    const lastIdx = (()=>{ let idx=out.findLastIndex(x=>x.baik>0||x.reject>0); return idx<0?2:Math.min(out.length-1, idx+3); })();
    return out.slice(0,lastIdx+1);
  }, [orderData, dashRows]);

  const progressMingguan = useMemo(() => {
    if (!orderData) return [] as { minggu: string; target: number; realisasi: number; reject: number }[];
    const targetByDay = new Map<string, number>();
    for (const r of orderData.schedule.rows){ if(r.jumlah<=0) continue; targetByDay.set(r.tanggal,(targetByDay.get(r.tanggal)??0)+r.jumlah); }
    const realByDay = new Map<string,{baik:number;reject:number}>();
    for (const r of dashRows){ const cur=realByDay.get(r.tanggal) ?? {baik:0,reject:0}; cur.baik+=r.qty; cur.reject+=r.reject??0; realByDay.set(r.tanggal,cur); }
    const allDates=[...new Set([...targetByDay.keys(),...realByDay.keys()])].sort();
    if(allDates.length===0) return [];
    const first=new Date(`${allDates[0]}T00:00:00`);
    const weekOf=(tgl:string)=>{ const d=new Date(`${tgl}T00:00:00`); const diff=Math.floor((d.getTime()-first.getTime())/86400000); return Math.floor(diff/7)+1; };
    const maxWeek=Math.max(...allDates.map(weekOf),8);
    const byWeek=new Map<number,{target:number;realisasi:number;reject:number}>();
    for(let w=1;w<=maxWeek;w++) byWeek.set(w,{target:0,realisasi:0,reject:0});
    for(const [tgl,v] of targetByDay){ const w=weekOf(tgl); byWeek.get(w)!.target+=v; }
    for(const [tgl,v] of realByDay){ const w=weekOf(tgl); const cur=byWeek.get(w)!; cur.realisasi+=v.baik; cur.reject+=v.reject; }
    return [...byWeek.entries()].map(([w,v])=>({minggu:`Week ${w}`,...v}));
  }, [orderData, dashRows]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#1E3A5F] px-4 py-3 text-white">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
          <span>📊</span> Dashboard Produksi
          <span className="hidden sm:inline font-normal opacity-80">|</span>
          <span className="font-mono text-xs font-semibold opacity-90">{orderData ? `${orderData.summary.label ?? orderData.summary.nomor} · ${orderData.summary.periode.toUpperCase()}` : (orders.find(o=>o.id===orderId)?.periode?.toUpperCase() ?? "—")} </span>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px]">v1.2</span>
        </h2>
        <span className="text-xs opacity-80">🔄 Last Update: {dashLoading ? "memuat..." : (lastUpdate || "—")}</span>
      </div>
      {loadingOrder || dashLoading ? (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 animate-pulse">{Array.from({length:8}).map((_,i)=><div key={i} className="h-20 rounded-xl bg-slate-100"/>)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          {[
            { icon:"🎯", label:"TARGET", value: kpi.target.toLocaleString("id-ID"), sub:"pcs", tone:"text-[#1E3A5F]" },
            { icon:"✅", label:"REALISASI", value: kpi.realisasi.toLocaleString("id-ID"), sub:"pcs", tone:"text-emerald-700" },
            { icon:"❌", label:"REJECT", value: kpi.reject.toLocaleString("id-ID"), sub:"pcs", tone:"text-[#EF4444]" },
            { icon:"📈", label:"YIELD RATE", value: `${kpi.yieldRate.toFixed(1).replace(".",",")}%`, sub: kpi.reject+kpi.realisasi>0 ? `${kpi.realisasi}/${kpi.realisasi+kpi.reject}` : "—", tone:"text-emerald-700" },
            { icon:"🚀", label:"PROGRESS", value: `${kpi.progress.toFixed(1).replace(".",",")}%`, sub: `${kpi.realisasi.toLocaleString("id-ID")} / ${kpi.target.toLocaleString("id-ID")}`, tone:"text-sky-700" },
            { icon:"📦", label:"SISA PRODUKSI", value: kpi.sisa.toLocaleString("id-ID"), sub:"pcs", tone:"text-amber-700" },
            { icon:"🏁", label:"STATUS", value: kpi.status, sub: orderData?.summary.status ?? "—", tone:"text-[#1E3A5F]", badge: kpi.statusCls },
            { icon:"📅", label:"HARI PRODUKSI", value: `${kpi.hariProduksi}`, sub:"hari", tone:"text-[#1E3A5F]" },
          ].map((c)=>(
            <div key={c.label} className={`rounded-xl border bg-white p-3 shadow-sm ${c.badge ? c.badge+" border" : "border-slate-200"}`}>
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]"><span>{c.icon}</span>{c.label}</p>
              <p className={`mt-1 text-xl font-black tabular-nums ${c.tone} ${c.label==="STATUS" ? "text-sm" : ""}`}>{c.value}</p>
              <p className="text-xs text-[#6B7280]">{c.sub}</p>
              {c.label==="PROGRESS" && (<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#00A8E8]" style={{width:`${Math.min(100, kpi.progress)}%`}}/></div>)}
              {c.label==="YIELD RATE" && (<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{width:`${Math.min(100, kpi.yieldRate)}%`}}/></div>)}
            </div>
          ))}
        </div>
      )}
      {/* 📋 DETAIL */}
      <div className="border-t border-slate-100">
        <div className="flex items-center justify-between bg-[#F5F7FA] px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#1E3A5F]">📋 Detail Progress Per Item</h3>
          <span className="text-xs text-[#6B7280]">{detailProgress.rows.length} item</span>
        </div>
        {loadingOrder || dashLoading ? (<p className="animate-pulse p-4 text-sm text-[#6B7280]">Memuat detail...</p>) : detailProgress.rows.length===0 ? (<p className="p-4 text-center text-sm text-[#6B7280]">Belum ada item.</p>) : (
          <>
            <div className="p-4"><div className="h-72"><Bar data={{ labels: detailProgress.rows.map(r=>r.item), datasets: [{ label:"Target", data: detailProgress.rows.map(r=>r.target), backgroundColor:"#e2e8f0", borderRadius:4, barThickness:18 }, { label:"Realisasi", data: detailProgress.rows.map(r=>r.realisasi), backgroundColor:"#0ea5e9", borderRadius:4, barThickness:18 }] }} options={{ responsive:true, maintainAspectRatio:false, interaction:{mode:"index" as const,intersect:false}, plugins:{legend:{position:"bottom" as const, labels:{boxWidth:12,font:{size:11}}}}, scales:{ x:{grid:{display:false},ticks:{font:{size:10},maxRotation:30}}, y:{beginAtZero:true,grid:{color:"#f1f5f9"},ticks:{callback:(v:any)=>Number(v).toLocaleString("id-ID"),font:{size:11}}} } }} /></div><p className="mt-2 text-center text-xs text-[#6B7280]">Abu = Target, Biru = Realisasi</p></div>
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead><tr className="border-y border-slate-100 bg-white text-xs uppercase tracking-wide text-[#6B7280]"><th className="px-3 py-2.5 font-semibold">Item</th><th className="px-3 py-2.5 text-right font-semibold">Target</th><th className="px-3 py-2.5 text-right font-semibold">Realisasi</th><th className="px-3 py-2.5 text-right font-semibold">Reject</th><th className="px-3 py-2.5 text-right font-semibold">Sisa</th><th className="px-3 py-2.5 text-right font-semibold">Progress</th><th className="px-3 py-2.5 font-semibold">Status</th><th className="px-3 py-2.5 text-right font-semibold">Yield</th></tr></thead>
                <tbody>
                  {detailProgress.rows.map((r)=>(<tr key={r.item} className="border-b border-slate-50 hover:bg-[#F5F7FA]"><td className="px-3 py-2 font-medium text-[#1F2937]">{r.item}</td><td className="px-3 py-2 text-right tabular-nums">{r.target.toLocaleString("id-ID")}</td><td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-700">{r.realisasi.toLocaleString("id-ID")}</td><td className="px-3 py-2 text-right tabular-nums text-[#EF4444]">{r.reject.toLocaleString("id-ID")}</td><td className="px-3 py-2 text-right tabular-nums text-amber-700">{r.sisa.toLocaleString("id-ID")}</td><td className="px-3 py-2 text-right tabular-nums"><span className="inline-flex items-center gap-1">{r.progress.toFixed(1).replace(".",",")}%<span className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><span className="block h-full bg-[#00A8E8]" style={{width:`${Math.min(100,r.progress)}%`}}/></span></span></td><td className="px-3 py-2 text-xs font-semibold">{r.status}</td><td className="px-3 py-2 text-right tabular-nums">{r.yieldRate.toFixed(1).replace(".",",")}%</td></tr>))}
                  <tr className="bg-[#1E3A5F] font-bold text-white"><td className="px-3 py-2">TOTAL</td><td className="px-3 py-2 text-right tabular-nums">{detailProgress.totals.target.toLocaleString("id-ID")}</td><td className="px-3 py-2 text-right tabular-nums">{detailProgress.totals.realisasi.toLocaleString("id-ID")}</td><td className="px-3 py-2 text-right tabular-nums">{detailProgress.totals.reject.toLocaleString("id-ID")}</td><td className="px-3 py-2 text-right tabular-nums">{detailProgress.totals.sisa.toLocaleString("id-ID")}</td><td className="px-3 py-2 text-right tabular-nums">{detailProgress.totals.progress.toFixed(1).replace(".",",")}%</td><td className="px-3 py-2 text-xs">🔄 JALAN</td><td className="px-3 py-2 text-right tabular-nums">{detailProgress.totals.yieldRate.toFixed(1).replace(".",",")}%</td></tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {/* 🏭 DIVISI */}
      <div className="border-t border-slate-100">
        <div className="flex items-center justify-between bg-[#F5F7FA] px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#1E3A5F]">🏭 Progress Per Divisi</h3>
          <span className="text-xs text-[#6B7280]">{divisiProgress.length} divisi</span>
        </div>
        {loadingOrder || dashLoading ? (<p className="animate-pulse p-4 text-sm text-[#6B7280]">Memuat divisi...</p>) : (
          <>
            <div className="p-4"><div className="h-64"><Bar data={{ labels: divisiProgress.map(r=>r.divisi), datasets: [{ label:"% Progress", data: divisiProgress.map(r=> Number(r.progress.toFixed(1))), backgroundColor: divisiProgress.map(r=> r.progress>=100 ? "#10b981" : r.progress>0 ? "#0ea5e9" : "#e2e8f0"), borderRadius:6, barThickness:22 }] }} options={{ indexAxis:"y" as const, responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{max:100,grid:{color:"#f1f5f9"},ticks:{callback:(v:any)=>`${v}%`,font:{size:11}}}, y:{grid:{display:false},ticks:{font:{size:11}}} } }} /></div></div>
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead><tr className="border-y border-slate-100 bg-white text-xs uppercase tracking-wide text-[#6B7280]"><th className="px-3 py-2.5 font-semibold">Divisi</th><th className="px-3 py-2.5 text-right font-semibold">Target/Hari</th><th className="px-3 py-2.5 text-right font-semibold">Target/Hari (RAK)</th><th className="px-3 py-2.5 text-right font-semibold">Hari Selesai</th><th className="px-3 py-2.5 text-right font-semibold">Total Hari</th><th className="px-3 py-2.5 text-right font-semibold">% Progress</th><th className="px-3 py-2.5 font-semibold">Status</th></tr></thead>
                <tbody>{divisiProgress.map((r)=>(<tr key={r.divisi} className="border-b border-slate-50 hover:bg-[#F5F7FA]"><td className="px-3 py-2 font-medium text-[#1F2937]">{r.divisi}</td><td className="px-3 py-2 text-right tabular-nums">{r.targetHari? r.targetHari.toLocaleString("id-ID"):"-"}</td><td className="px-3 py-2 text-right tabular-nums text-[#6B7280]">{r.rak}</td><td className="px-3 py-2 text-right tabular-nums">{r.hariSelesai}</td><td className="px-3 py-2 text-right tabular-nums">{r.totalHari}</td><td className="px-3 py-2 text-right tabular-nums">{r.progress.toFixed(1).replace(".",",")}%</td><td className="px-3 py-2 text-xs font-semibold">{r.status}</td></tr>))}</tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {/* 📈 TREND */}
      <div className="border-t border-slate-100">
        <div className="flex items-center justify-between bg-[#F5F7FA] px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#1E3A5F]">📈 Data Trend Harian</h3>
          <span className="text-xs text-[#6B7280]">{trendHarian.filter(x=>x.tanggal).length} hari</span>
        </div>
        {loadingOrder || dashLoading ? (<p className="animate-pulse p-4 text-sm text-[#6B7280]">Memuat trend...</p>) : trendHarian.length===0 ? (<p className="p-4 text-center text-sm text-[#6B7280]">Belum ada data trend.</p>) : (
          <div className="p-4"><div className="h-64"><Line data={{ labels: trendHarian.map(r=> r.tanggal ? `${r.tanggal.split("-")[2]}-${["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][Number(r.tanggal.split("-")[1])-1]}` : "—"), datasets: [{label:"Baik",data:trendHarian.map(r=>r.baik),borderColor:"#10b981",backgroundColor:"rgba(16,185,129,0.15)",fill:true,tension:0.35,pointRadius:3},{label:"Reject",data:trendHarian.map(r=>r.reject),borderColor:"#ef4444",backgroundColor:"rgba(239,68,68,0.12)",fill:true,tension:0.35,pointRadius:3},{label:"Total",data:trendHarian.map(r=>r.total),borderColor:"#1e3a5f",fill:false,tension:0.35,pointRadius:2,borderDash:[4,3]}] }} options={{ responsive:true, maintainAspectRatio:false, interaction:{mode:"index" as const,intersect:false}, plugins:{legend:{position:"bottom" as const}}, scales:{ x:{grid:{display:false}}, y:{beginAtZero:true} } }} /></div></div>
        )}
      </div>
      {/* 📊 MINGGUAN */}
      <div className="border-t border-slate-100">
        <div className="flex items-center justify-between bg-[#F5F7FA] px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#1E3A5F]">📊 Progress Mingguan</h3>
          <span className="text-xs text-[#6B7280]">{progressMingguan.length} minggu</span>
        </div>
        {loadingOrder || dashLoading ? (<p className="animate-pulse p-4 text-sm text-[#6B7280]">Memuat mingguan...</p>) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-y border-slate-100 bg-white text-xs uppercase tracking-wide text-[#6B7280]"><th className="px-3 py-2.5 font-semibold">Minggu</th><th className="px-3 py-2.5 text-right font-semibold">Target</th><th className="px-3 py-2.5 text-right font-semibold">Realisasi</th><th className="px-3 py-2.5 text-right font-semibold">Reject</th></tr></thead><tbody>{progressMingguan.map((r)=>(<tr key={r.minggu} className="border-b border-slate-50 hover:bg-[#F5F7FA]"><td className="px-3 py-2 font-medium text-[#1F2937]">{r.minggu}</td><td className="px-3 py-2 text-right tabular-nums">{r.target.toLocaleString("id-ID")}</td><td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-700">{r.realisasi.toLocaleString("id-ID")}</td><td className="px-3 py-2 text-right tabular-nums text-[#EF4444]">{r.reject.toLocaleString("id-ID")}</td></tr>))}</tbody></table></div>
        )}
      </div>
      {/* 🍩 DONUT */}
      <div className="grid grid-cols-1 gap-4 border-t border-slate-100 bg-[#F5F7FA] p-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[#1E3A5F]">🍩 Data Donut — Selesai vs Sisa</h4>
          <div className="flex items-center gap-4"><div className="h-36 w-36 shrink-0"><Doughnut data={{ labels:["Selesai","Sisa"], datasets:[{ data:[kpi.realisasi,kpi.sisa], backgroundColor:["#10b981","#e2e8f0"], borderWidth:0 }] }} options={{ cutout:"65%", plugins:{legend:{display:false}}, maintainAspectRatio:false }} /></div><table className="w-full text-sm"><thead><tr className="text-xs uppercase text-[#6B7280]"><th className="py-1 text-left">Kategori</th><th className="py-1 text-right">Jumlah</th></tr></thead><tbody><tr className="border-t border-slate-100"><td className="py-1.5 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500"/>Selesai</td><td className="py-1.5 text-right font-bold tabular-nums">{kpi.realisasi.toLocaleString("id-ID")}</td></tr><tr className="border-t border-slate-100"><td className="py-1.5 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-300"/>Sisa</td><td className="py-1.5 text-right tabular-nums">{kpi.sisa.toLocaleString("id-ID")}</td></tr></tbody></table></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[#1E3A5F]">🥧 Data Kualitas — Baik vs Reject</h4>
          <div className="flex items-center gap-4"><div className="h-36 w-36 shrink-0"><Doughnut data={{ labels:["Baik","Reject"], datasets:[{ data:[kpi.realisasi,kpi.reject], backgroundColor:["#0ea5e9","#ef4444"], borderWidth:0 }] }} options={{ cutout:"65%", plugins:{legend:{display:false}}, maintainAspectRatio:false }} /></div><table className="w-full text-sm"><thead><tr className="text-xs uppercase text-[#6B7280]"><th className="py-1 text-left">Kategori</th><th className="py-1 text-right">Jumlah</th></tr></thead><tbody><tr className="border-t border-slate-100"><td className="py-1.5 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-500"/>Baik</td><td className="py-1.5 text-right font-bold tabular-nums text-sky-700">{kpi.realisasi.toLocaleString("id-ID")}</td></tr><tr className="border-t border-slate-100"><td className="py-1.5 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500"/>Reject</td><td className="py-1.5 text-right tabular-nums text-[#EF4444]">{kpi.reject.toLocaleString("id-ID")}</td></tr></tbody></table></div>
        </div>
      </div>
    </section>
  );
}
