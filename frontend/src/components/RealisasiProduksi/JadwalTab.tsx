import { Fragment } from "react";
import { REALISASI_STAGE_LABEL } from "../../api/productionOrders";
import { STAGE_KEYS } from "./utils";

interface Props {
  jadwalRows: any[];
  jadwalTotals: { rencana: number; aktual: number };
  awal: string; akhir: string; setAwal: (v:string)=>void; setAkhir:(v:string)=>void;
  loadingOrder:boolean; loadingJadwal:boolean; expanded: Record<string,boolean>; setExpanded: React.Dispatch<React.SetStateAction<Record<string,boolean>>>;
  saving:boolean; today: string;
  statusOf: (r:number,a:number)=>{text:string;cls:string};
  gotoInput:(t:string)=>void; autofill:(t:string, items:any[])=>Promise<void>;
}

export default function JadwalTab({ jadwalRows, jadwalTotals, awal, akhir, setAwal, setAkhir, loadingOrder, loadingJadwal, expanded, setExpanded, saving, today, statusOf, gotoInput, autofill }: Props) {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{ label:"Total rencana", value: jadwalTotals.rencana }, { label:"Total realisasi", value: jadwalTotals.aktual }, { label:"Selisih", value: jadwalTotals.aktual - jadwalTotals.rencana }].map((k)=>(
          <div key={k.label} className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${k.label==="Selisih" && k.value<0 ? "text-[#EF4444]" : "text-[#1E3A5F]"}`}>{k.value.toLocaleString("id-ID")}</p>
          </div>
        ))}
        <div className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Status periode</p>
          <p className="mt-2">{(()=>{ const st=statusOf(jadwalTotals.rencana,jadwalTotals.aktual); return <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${st.cls}`}>{st.text}</span>; })()}</p>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <h3 className="mr-auto font-semibold text-[#1E3A5F]">Jadwal Realisasi <span className="text-xs font-normal text-[#6B7280]">· dari plan produksi</span></h3>
          <label className="flex items-center gap-2 text-sm text-[#6B7280]">Dari<input type="date" value={awal} max={akhir} onChange={(e)=>e.target.value && setAwal(e.target.value)} className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[15px] focus:outline-2 focus:outline-[#00A8E8]" /></label>
          <label className="flex items-center gap-2 text-sm text-[#6B7280]">Sampai<input type="date" value={akhir} min={awal} onChange={(e)=>e.target.value && setAkhir(e.target.value)} className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[15px] focus:outline-2 focus:outline-[#00A8E8]" /></label>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-[#F5F7FA] px-4 py-2.5 text-xs text-[#6B7280]">
          <span>Cara baca: <b className="font-normal text-slate-400">abu</b> = Rencana, <b className="text-[#1E3A5F]">tebal</b> = Realisasi.</span>
          <span className="inline-flex items-center gap-1"><span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">Tercapai</span> aktual = rencana</span>
          <span className="inline-flex items-center gap-1"><span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">Kurang X</span> di bawah rencana</span>
          <span className="inline-flex items-center gap-1"><span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-800">Lebih X</span> di atas rencana</span>
          <span className="inline-flex items-center gap-1"><span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Tanpa rencana</span> di luar jadwal</span>
        </div>
        {loadingOrder || loadingJadwal ? (<p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat jadwal realisasi...</p>) : jadwalRows.length===0 ? (
          <div className="p-10 text-center"><p className="text-[15px] font-medium text-[#1F2937]">Tidak ada tanggal pada rentang ini</p><p className="mt-1 text-sm text-[#6B7280]">Coba ubah filter <b>Dari</b> / <b>Sampai</b> di atas.</p></div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-20">
                <tr className="text-[11px] uppercase tracking-wide text-[#6B7280]">
                  <th rowSpan={2} className="sticky left-0 z-30 border-b border-slate-100 bg-white px-3 py-2 text-left font-semibold">Tanggal</th>
                  <th rowSpan={2} className="border-b border-slate-100 bg-white px-3 py-2 text-left font-semibold">Hari / Jam</th>
                  <th colSpan={STAGE_KEYS.length} className="border-b border-l border-slate-100 bg-[#F5F7FA] px-3 py-1.5 text-center font-semibold text-[#1E3A5F]">Realisasi Tahap</th>
                  <th colSpan={2} className="border-b border-l border-slate-100 bg-[#F5F7FA] px-3 py-1.5 text-center font-semibold text-[#1E3A5F]">Item & Jumlah</th>
                  <th rowSpan={2} className="border-b border-l border-slate-100 bg-white px-3 py-2 text-left font-semibold">Status</th>
                  <th rowSpan={2} className="border-b border-l border-slate-100 bg-white px-3 py-2 text-right font-semibold">Aksi</th>
                </tr>
                <tr className="text-[11px] uppercase tracking-wide text-[#6B7280]">
                  {STAGE_KEYS.map((k)=>(<th key={k} className="whitespace-nowrap border-b border-l border-slate-100 bg-white px-3 py-2 text-right font-semibold">{REALISASI_STAGE_LABEL[k]}<span className="block text-[10px] font-normal normal-case text-slate-400">rencana → realisasi</span></th>))}
                  <th className="border-b border-l border-slate-100 bg-white px-3 py-2 text-left font-semibold">Variant</th>
                  <th className="whitespace-nowrap border-b border-slate-100 bg-white px-3 py-2 text-right font-semibold">Jumlah<span className="block text-[10px] font-normal normal-case text-slate-400">rencana → realisasi</span></th>
                </tr>
              </thead>
              <tbody>
                {jadwalRows.map((d:any)=>{
                  const st=statusOf(d.rencana,d.aktual); const open=!!expanded[d.tanggal];
                  const rowBg=d.unfilledTotal>0 && d.tanggal>=today ? "bg-amber-50/40" : d.rencana>0 && d.aktual<d.rencana && d.tanggal<today ? "bg-red-50/40" : d.rencana>0 && d.aktual>=d.rencana ? "bg-emerald-50/30" : "";
                  const cell=(rencana:number,aktual:number)=>{ const diff=aktual-rencana; return (<div className="text-right leading-tight tabular-nums"><div className="text-[11px] text-slate-400">{rencana.toLocaleString("id-ID")}</div><div className={`font-bold ${rencana===0&&aktual===0?"text-slate-300":aktual===rencana?"text-emerald-700":diff<0?"text-red-600":"text-sky-700"}`}>{aktual.toLocaleString("id-ID")}</div></div>); };
                  return (
                    <Fragment key={d.tanggal}>
                      <tr className={`group border-b border-slate-50 last:border-0 hover:bg-[#F5F7FA] ${rowBg}`}>
                        <td className={`sticky left-0 z-10 whitespace-nowrap border-r border-slate-100 px-3 py-2.5 font-semibold tabular-nums text-[#1E3A5F] ${rowBg||"bg-white"} group-hover:bg-[#F5F7FA]`}>{d.tanggal.split("-").reverse().join("/")}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]"><span className="font-medium text-[#1F2937]">{d.hari}</span>{d.jam>0 && (<span className="ml-1 text-xs text-slate-400">· {d.jam} jam</span>)}</td>
                        {d.stages.map((s:any)=>(<td key={s.key} className="border-l border-slate-100 px-3 py-2.5">{cell(s.rencana,s.aktual)}</td>))}
                        <td className="min-w-[240px] max-w-[420px] border-l border-slate-100 px-3 py-2.5 font-medium text-[#1F2937]">
                          {d.items.length===0 ? (<span className="text-slate-300">—</span>) : (<><ul className="space-y-1">{(open?d.items:d.items.slice(0,3)).map((v:any)=>(<li key={v.variantId} className="flex justify-between gap-2 text-[13px]"><span className="truncate">{v.label}</span><span className="shrink-0 tabular-nums"><span className="text-slate-400">{v.rencana.toLocaleString("id-ID")}</span>{" → "}<b className="text-[#1E3A5F]">{v.aktual.toLocaleString("id-ID")}</b></span></li>))}</ul>{d.items.length>3 && (<button type="button" onClick={()=>setExpanded((p)=>({ ...p, [d.tanggal]: !p[d.tanggal] }))} className="mt-1 text-xs font-semibold text-[#00A8E8] hover:underline">{open ? "Tutup" : `+ ${d.items.length - 3} item lagi`}</button>)}</>)}
                        </td>
                        <td className="border-l border-slate-100 px-3 py-2.5 text-right"><div className="tabular-nums"><span className="text-xs text-slate-400">{d.rencana.toLocaleString("id-ID")}</span><span className="mx-1 text-slate-300">→</span><span className="font-bold text-[#1E3A5F]">{d.aktual.toLocaleString("id-ID")}</span>{d.fgTotal>0 && (<div className="mt-0.5 text-[10px] font-normal text-slate-400">FG {d.fgTotal.toLocaleString("id-ID")}</div>)}</div></td>
                        <td className="whitespace-nowrap border-l border-slate-100 px-3 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.text}</span></td>
                        <td className="whitespace-nowrap border-l border-slate-100 px-3 py-2.5 text-right"><span className="inline-flex flex-col items-end gap-1">{d.tanggal < today ? (<span className="px-3 py-1.5 text-xs font-medium text-slate-400">🔒 Terkunci</span>) : (<button type="button" onClick={()=>gotoInput(d.tanggal)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#0088C0] hover:bg-sky-50">Isi</button>)}{d.unfilledTotal>0 && d.tanggal>=today && (<button type="button" disabled={saving} onClick={()=>void autofill(d.tanggal,d.unfilled)} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-40">+{d.unfilledTotal.toLocaleString("id-ID")} finishgood</button>)}</span></td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-20"><tr className="border-t-2 border-slate-200 bg-[#F5F7FA] text-[#1E3A5F]"><td className="sticky left-0 z-30 bg-[#F5F7FA] px-3 py-3 font-bold" colSpan={2}>TOTAL</td><td colSpan={STAGE_KEYS.length} className="px-3 py-3 text-xs font-normal text-[#6B7280]">Ringkasan tahapan lihat kolom masing-masing</td><td className="border-l border-slate-200 px-3 py-3 text-right text-xs font-normal text-[#6B7280]">total item</td><td className="border-l border-slate-200 px-3 py-3 text-right tabular-nums"><div className="text-xs text-slate-400">{jadwalTotals.rencana.toLocaleString("id-ID")}</div><div className="font-bold">{jadwalTotals.aktual.toLocaleString("id-ID")}</div></td><td className="border-l border-slate-200 px-3 py-3" colSpan={2}>{(()=>{ const st=statusOf(jadwalTotals.rencana,jadwalTotals.aktual); return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.text}</span>; })()}</td></tr></tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
