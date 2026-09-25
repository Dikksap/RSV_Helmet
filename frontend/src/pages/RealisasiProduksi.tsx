import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getProductionOrders, getProductionOrderSummary, getProductionSchedule, getRealisasi, saveRealisasi,
  type ProductionOrderListItem, type ProductionOrderSummary, type ProductionSchedule, type RealisasiRow, type RealisasiStageRow,
} from "../api/productionOrders";
import DashboardTab from "../components/RealisasiProduksi/DashboardTab";
import JadwalTab from "../components/RealisasiProduksi/JadwalTab";
import InputTab from "../components/RealisasiProduksi/InputTab";
import RekapTab from "../components/RealisasiProduksi/RekapTab";
import { STAGE_KEYS, todayKey, shiftDay, hariOf, monthRange, fmtDate, eachDay, statusOf } from "../components/RealisasiProduksi/utils";

type Tab = "dashboard" | "jadwal" | "input" | "rekap";
type Row = { variantId:number; label:string; sub:string; rencana:number; finishgood:number; };

export default function RealisasiProduksi(){
  const [tab,setTab]=useState<Tab>("dashboard");
  const [orders,setOrders]=useState<ProductionOrderListItem[]>([]);
  const [ordersLoaded,setOrdersLoaded]=useState(false);
  const [orderId,setOrderId]=useState<number|null>(null);
  const [tanggal,setTanggal]=useState(todayKey());
  const [awal,setAwal]=useState(()=>shiftDay(todayKey(),-6));
  const [akhir,setAkhir]=useState(todayKey());
  const [orderData,setOrderData]=useState<{ summary:ProductionOrderSummary; schedule:ProductionSchedule }|null>(null);
  const [rows,setRows]=useState<Row[]>([]);
  const [inputs,setInputs]=useState<Record<number,number>>({});
  const [rejectInputs,setRejectInputs]=useState<Record<number,number>>({});
  const [rekapAll,setRekapAll]=useState<RealisasiRow[]>([]);
  const [loadingRekap,setLoadingRekap]=useState(false);
  const [dashRows,setDashRows]=useState<RealisasiRow[]>([]);
  const [dashTahap,setDashTahap]=useState<RealisasiStageRow[]>([]);
  const [dashLoading,setDashLoading]=useState(false);
  const [lastUpdate,setLastUpdate]=useState("");
  const [rencanaTahap,setRencanaTahap]=useState<Record<string,number>>({});
  const [tahapInputs,setTahapInputs]=useState<Record<string,number>>({});
  const [jadwalSaved,setJadwalSaved]=useState<RealisasiRow[]>([]);
  const [jadwalFg,setJadwalFg]=useState<RealisasiRow[]>([]);
  const [jadwalTahap,setJadwalTahap]=useState<RealisasiStageRow[]>([]);
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [loadingOrder,setLoadingOrder]=useState(false);
  const [loading,setLoading]=useState(false);
  const [loadingJadwal,setLoadingJadwal]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);

  useEffect(()=>{ getProductionOrders().then(res=>{ const aktif=res.filter(o=>o.status==="AKTIF"); setOrders(aktif); if(aktif.length>0) setOrderId(p=>p??aktif[0].id); setOrdersLoaded(true); }).catch(e=>{ setError(e instanceof Error?e.message:"Gagal memuat orders."); setOrdersLoaded(true); }); },[]);
  useEffect(()=>{ const o=orders.find(x=>x.id===orderId)??null; if(!o) return; const [a,b]=monthRange(o.periode); setAwal(a); setAkhir(b); },[orderId,orders]);
  useEffect(()=>{ if(orderId===null) return; setLoadingOrder(true); Promise.all([getProductionOrderSummary(orderId),getProductionSchedule(orderId)]).then(([summary,schedule])=>setOrderData({summary,schedule})).catch(e=>setError(e instanceof Error?e.message:"Gagal memuat order.")).finally(()=>setLoadingOrder(false)); },[orderId]);

  const loadInput=useCallback(async()=>{
    if(orderId===null || !orderData) return;
    setLoading(true); setError(null); setNotice(null);
    try{
      const data=await getRealisasi(orderId,tanggal,tanggal);
      const rencana=new Map<number,number>();
      for(const r of orderData.schedule.rows){ if(r.tanggal!==tanggal || r.variantId<=0 || r.jumlah<=0) continue; rencana.set(r.variantId,(rencana.get(r.variantId)??0)+r.jumlah); }
      const head=orderData.schedule.rows.find(r=>r.tanggal===tanggal);
      setRencanaTahap({ buffing:head?.buffing??0, baseCoat:head?.baseCoat??0, decalSolid:head?.decalSolid??0, decalMotif:head?.decalMotif??0, topCoat:head?.topCoat??0, perakitan:head?.perakitan??0, qc:head?.qc??0 });
      const saved=new Map<number,RealisasiRow>(data.realisasi.map((x:RealisasiRow)=>[x.variantId,x]));
      const fg=new Map<number,number>(data.finishgood.map((x:RealisasiRow)=>[x.variantId,x.qty]));
      const savedTahap=new Map((data.tahapan??[]).map(x=>[x.stage,x.qty]));
      const nextTahap:Record<string,number>={}; for(const k of STAGE_KEYS) nextTahap[k]=savedTahap.get(k)??0; setTahapInputs(nextTahap);
      const next:Row[]=[]; const nextInputs:Record<number,number>={}; const nextReject:Record<number,number>={};
      for(const it of orderData.summary.items){
        const vid=it.variantId, rc=rencana.get(vid)??0, sv=saved.get(vid), f=fg.get(vid)??0;
        if(rc===0 && sv===undefined && f===0) continue;
        next.push({ variantId:vid, label:`${it.variant.product.nama} · ${it.variant.style.nama} ${it.variant.color.nama}`, sub:`${it.variant.kodeVariant} · Size ${it.variant.size.nama}`, rencana:rc, finishgood:f });
        nextInputs[vid]=sv?.qty ?? f; nextReject[vid]=sv?.reject ?? 0;
      }
      setRows(next); setInputs(nextInputs); setRejectInputs(nextReject);
    }catch(e){ setError(e instanceof Error?e.message:"Gagal memuat realisasi."); } finally{ setLoading(false); }
  },[orderId,orderData,tanggal]);
  useEffect(()=>{ if(tab==="input") void loadInput(); },[tab,loadInput]);

  const loadJadwal=useCallback(async()=>{
    if(orderId===null || awal>akhir) return;
    setLoadingJadwal(true); setError(null);
    try{ const data=await getRealisasi(orderId,awal,akhir); setJadwalSaved(data.realisasi); setJadwalFg(data.finishgood??[]); setJadwalTahap(data.tahapan??[]); }catch(e){ setError(e instanceof Error?e.message:"Gagal memuat jadwal realisasi."); } finally{ setLoadingJadwal(false); }
  },[orderId,awal,akhir]);
  useEffect(()=>{ if(tab==="jadwal") void loadJadwal(); },[tab,loadJadwal]);

  useEffect(()=>{ if(orderId===null) return; setDashLoading(true); getRealisasi(orderId).then(data=>{ setDashRows(data.realisasi); setDashTahap(data.tahapan??[]); setLastUpdate(new Date().toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})+" WIB"); }).catch(()=>{}).finally(()=>setDashLoading(false)); },[orderId,jadwalSaved,rekapAll]);
  useEffect(()=>{ if(tab!=="rekap" || orderId===null) return; setLoadingRekap(true); setError(null); getRealisasi(orderId).then(data=>setRekapAll(data.realisasi)).catch(e=>setError(e instanceof Error?e.message:"Gagal memuat rekap.")).finally(()=>setLoadingRekap(false)); },[tab,orderId]);

  const rekapRows=useMemo(()=>{
    if(!orderData) return [];
    const agg=new Map<number,{baik:number;reject:number}>();
    for(const x of rekapAll){ const cur=agg.get(x.variantId)??{baik:0,reject:0}; cur.baik+=x.qty; cur.reject+=x.reject??0; agg.set(x.variantId,cur); }
    return orderData.summary.items.map(it=>{ const a=agg.get(it.variantId)??{baik:0,reject:0}; const target=it.qty; const pct=target>0?(a.baik/target)*100:a.baik>0?100:0; return { variantId:it.variantId, item:`${it.variant.product.nama} ${it.variant.style.nama} ${it.variant.color.nama}`, size:it.variant.size.nama, target, baik:a.baik, reject:a.reject, pct }; });
  },[orderData,rekapAll]);
  const rekapTotals=useMemo(()=>{ let target=0,baik=0,reject=0; for(const r of rekapRows){ target+=r.target; baik+=r.baik; reject+=r.reject; } return {target,baik,reject,pct:target>0?(baik/target)*100:0}; },[rekapRows]);

  const jadwalRows=useMemo(()=>{
    if(!orderData) return [];
    const rencana=new Map<string,number>(); const rencanaVar=new Map<string,{variantId:number;label:string;qty:number}>(); const head=new Map<string,typeof orderData.schedule.rows[number]>();
    for(const r of orderData.schedule.rows){ if(r.tanggal<awal||r.tanggal>akhir) continue; if(!head.has(r.tanggal)) head.set(r.tanggal,r); if(r.variantId<=0||r.jumlah<=0) continue; rencana.set(r.tanggal,(rencana.get(r.tanggal)??0)+r.jumlah); const key=`${r.tanggal}:${r.variantId}`; const cur=rencanaVar.get(key); if(cur) cur.qty+=r.jumlah; else rencanaVar.set(key,{variantId:r.variantId,label:`${r.item} · Size ${r.size}`,qty:r.jumlah}); }
    const saved=new Map<string,number>(); const savedVar=new Map<string,number>(); for(const x of jadwalSaved){ saved.set(x.tanggal,(saved.get(x.tanggal)??0)+x.qty); savedVar.set(`${x.tanggal}:${x.variantId}`,x.qty); }
    const savedTahap=new Map<string,number>(); for(const x of jadwalTahap) savedTahap.set(`${x.tanggal}:${x.stage}`,x.qty);
    const fgByDay=new Map<string,{total:number;perVariant:Map<number,number>}>();
    for(const x of jadwalFg){ let e=fgByDay.get(x.tanggal); if(!e){ e={total:0,perVariant:new Map()}; fgByDay.set(x.tanggal,e); } e.total+=x.qty; e.perVariant.set(x.variantId,(e.perVariant.get(x.variantId)??0)+x.qty); }
    const varLabel=new Map<number,string>(); for(const it of orderData.summary.items) varLabel.set(it.variantId,`${it.variant.product.nama} · ${it.variant.style.nama} ${it.variant.color.nama} · Size ${it.variant.size.nama}`);
    return eachDay(awal,akhir).map((t)=>{
      const varMap=new Map<number,{label:string;rencana:number;aktual:number}>();
      for(const [k,v] of rencanaVar) if(k.startsWith(`${t}:`)) varMap.set(v.variantId,{label:varLabel.get(v.variantId)??v.label,rencana:v.qty,aktual:0});
      for(const [k,q] of savedVar) if(k.startsWith(`${t}:`)){ const vid=Number(k.slice(t.length+1)); const cur=varMap.get(vid); if(cur) cur.aktual=q; else varMap.set(vid,{label:varLabel.get(vid)??`Variant #${vid}`,rencana:0,aktual:q}); }
      const fg=fgByDay.get(t); const unfilled=fg?[...fg.perVariant.entries()].filter(([vid,q])=>q>0 && !savedVar.has(`${t}:${vid}`)).map(([variantId,qty])=>({variantId,qty})):[]; const h=head.get(t);
      return { tanggal:t, hari:hariOf(t), jam:head.get(t)?.jam??0, rencana:rencana.get(t)??0, aktual:saved.get(t)??0, fgTotal:fg?.total??0, unfilled, unfilledTotal:unfilled.reduce((n,u)=>n+u.qty,0), items:[...varMap.entries()].map(([variantId,v])=>({variantId,...v})), stages: STAGE_KEYS.map(k=>({key:k,label:(head.get(t) as any)?.[k]!==undefined ? (head.get(t) as any)[k] : 0, rencana:(h as any)?.[k]??0, aktual:savedTahap.get(`${t}:${k}`)??0})) as any };
    });
  },[orderData,jadwalSaved,jadwalFg,jadwalTahap,awal,akhir]);

  const jadwalTotals=useMemo(()=>{ let rencana=0,aktual=0; for(const d of jadwalRows){ rencana+= (d as any).rencana; aktual+= (d as any).aktual; } return {rencana,aktual}; },[jadwalRows]);
  const totals=useMemo(()=>{ let rencana=0,aktual=0; for(const r of rows){ rencana+=r.rencana; aktual+=inputs[r.variantId]??0; } return {rencana,aktual,selisih:aktual-rencana}; },[rows,inputs]);

  const save=async()=>{
    if(orderId===null || tanggal<todayKey()) return;
    setSaving(true); setError(null); setNotice(null);
    try{
      const items=rows.map(r=>({variantId:r.variantId, qty:Math.max(0,Math.floor(inputs[r.variantId]??0)), reject:Math.max(0,Math.floor(rejectInputs[r.variantId]??0))}));
      const tahapan=STAGE_KEYS.map(stage=>({stage, qty:Math.max(0,Math.floor(tahapInputs[stage]??0))}));
      const saved=await saveRealisasi(orderId,tanggal,items,tahapan);
      const map=new Map(saved.items.map(x=>[x.variantId,x]));
      setInputs(p=>{ const n={...p}; for(const r of rows) n[r.variantId]=map.get(r.variantId)?.qty??0; return n; });
      setRejectInputs(p=>{ const n={...p}; for(const r of rows) n[r.variantId]=map.get(r.variantId)?.reject??0; return n; });
      const tmap=new Map(saved.tahapan.map(x=>[x.stage,x.qty]));
      setTahapInputs(p=>{ const n={...p}; for(const k of STAGE_KEYS) n[k]=tmap.get(k)??0; return n; });
      setNotice(`Tersimpan untuk ${fmtDate(tanggal)}.`);
      getRealisasi(orderId).then(d=>{ setDashRows(d.realisasi); setDashTahap(d.tahapan??[]); setLastUpdate(new Date().toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})+" WIB"); }).catch(()=>{});
    }catch(e){ setError(e instanceof Error?e.message:"Gagal menyimpan realisasi."); } finally{ setSaving(false); }
  };
  const gotoInput=(t:string)=>{ setTanggal(t); setTab("input"); };
  const autofill=async(t:string,items:{variantId:number;qty:number}[])=>{
    if(orderId===null||items.length===0) return;
    setSaving(true); setError(null); setNotice(null);
    try{ await saveRealisasi(orderId,t,items); setNotice(`${items.length} variant ${fmtDate(t)} terisi dari finishgood (${items.reduce((n,u)=>n+u.qty,0).toLocaleString("id-ID")} pcs).`); await loadJadwal(); getRealisasi(orderId).then(d=>{ setDashRows(d.realisasi); setDashTahap(d.tahapan??[]); setLastUpdate(new Date().toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})+" WIB"); }).catch(()=>{}); }catch(e){ setError(e instanceof Error?e.message:"Gagal isi otomatis."); } finally{ setSaving(false); }
  };
  const dayStatus=rows.length===0?{text:"Belum ada jadwal hari ini",cls:"bg-slate-100 text-slate-500"}:statusOf(totals.rencana,totals.aktual);
  const today=todayKey(); const locked=tanggal<today;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl"><p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Barang Produksi</p><h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Realisasi Produksi</h1><p className="mt-2 text-base text-[#6B7280]">Jadwal realisasi dari plan produksi dan input hasil harian per item variant.</p></div>
        <label className="flex items-center gap-2 text-sm font-medium text-[#1F2937]">Periode<select value={orderId??""} onChange={(e)=>setOrderId(Number(e.target.value))} disabled={orders.length===0} className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-[15px] focus:outline-2 focus:outline-[#00A8E8] disabled:opacity-40">{orders.map(o=>(<option key={o.id} value={o.id}>{o.nomor} · {o.periode}</option>))}</select></label>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="Tab realisasi produksi">{((["dashboard","jadwal","input","rekap"] as const).map(t=>{ const active=tab===t; return <button key={t} type="button" onClick={()=>setTab(t)} aria-pressed={active} className={`rounded-lg px-4 py-2.5 text-[15px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#00A8E8] ${active?"bg-[#1E3A5F] text-white":"bg-white text-[#6B7280] ring-1 ring-slate-200/70 hover:bg-[#F5F7FA] hover:text-[#1F2937]"}`}>{t==="dashboard"?"Dashboard":t==="jadwal"?"Jadwal Realisasi":t==="input"?"Input Harian":"Rekap"}</button>; }))}</nav>
      {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700">{notice}</p>}
      {ordersLoaded && orders.length===0 && !error && <p role="status" className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-[#6B7280]">Belum ada plan produksi berstatus AKTIF.</p>}
      {tab==="dashboard" && <DashboardTab orderData={orderData} orders={orders} orderId={orderId} dashRows={dashRows} dashTahap={dashTahap} dashLoading={dashLoading} loadingOrder={loadingOrder} lastUpdate={lastUpdate} />}
      {tab==="jadwal" && <JadwalTab jadwalRows={jadwalRows} jadwalTotals={jadwalTotals} awal={awal} akhir={akhir} setAwal={setAwal} setAkhir={setAkhir} loadingOrder={loadingOrder} loadingJadwal={loadingJadwal} expanded={expanded} setExpanded={setExpanded} saving={saving} today={today} statusOf={statusOf} gotoInput={gotoInput} autofill={autofill} />}
      {tab==="rekap" && <RekapTab rekapRows={rekapRows} rekapTotals={rekapTotals} loadingRekap={loadingRekap} loadingOrder={loadingOrder} />}
      {tab==="input" && <InputTab tanggal={tanggal} setTanggal={setTanggal} rows={rows} inputs={inputs} setInputs={setInputs} rejectInputs={rejectInputs} setRejectInputs={setRejectInputs} rencanaTahap={rencanaTahap} tahapInputs={tahapInputs} setTahapInputs={setTahapInputs} totals={totals} dayStatus={dayStatus} loading={loading} saving={saving} locked={locked} statusOf={statusOf} save={save} />}
    </div>
  );
}
