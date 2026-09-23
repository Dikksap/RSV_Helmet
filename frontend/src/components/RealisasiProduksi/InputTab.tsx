import { REALISASI_STAGE_LABEL } from "../../api/productionOrders";
import { STAGE_KEYS, fmtDate, shiftDay } from "./utils";

interface Row { variantId:number; label:string; sub:string; rencana:number; finishgood:number; }
interface Props {
  tanggal:string; setTanggal:(v:string)=>void;
  rows: Row[];
  inputs: Record<number,number>; setInputs: React.Dispatch<React.SetStateAction<Record<number,number>>>;
  rejectInputs: Record<number,number>; setRejectInputs: React.Dispatch<React.SetStateAction<Record<number,number>>>;
  rencanaTahap: Record<string,number>; tahapInputs: Record<string,number>; setTahapInputs: React.Dispatch<React.SetStateAction<Record<string,number>>>;
  totals: { rencana:number; aktual:number; selisih:number };
  dayStatus: { text:string; cls:string };
  loading:boolean; saving:boolean; locked:boolean;
  statusOf:(r:number,a:number)=>{text:string;cls:string};
  save:()=>Promise<void>;
}

export default function InputTab({ tanggal, setTanggal, rows, inputs, setInputs, rejectInputs, setRejectInputs, rencanaTahap, tahapInputs, setTahapInputs, totals, dayStatus, loading, saving, locked, statusOf, save }: Props) {
  return (
    <>
      {locked && (<p role="status" className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-[#6B7280]">Tanggal {fmtDate(tanggal)} terkunci — data sebelum hari ini tidak bisa diubah. Yang bisa diisi: hari ini sampai akhir plan produksi.</p>)}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={()=>setTanggal(shiftDay(tanggal,-1))} className="rounded-lg bg-white px-3 py-2.5 text-[15px] font-bold text-[#1F2937] ring-1 ring-slate-200/70 hover:bg-[#F5F7FA]">‹</button>
          <input type="date" value={tanggal} onChange={(e)=>e.target.value && setTanggal(e.target.value)} className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-[15px] focus:outline-2 focus:outline-[#00A8E8]" />
          <button type="button" onClick={()=>setTanggal(shiftDay(tanggal,1))} className="rounded-lg bg-white px-3 py-2.5 text-[15px] font-bold text-[#1F2937] ring-1 ring-slate-200/70 hover:bg-[#F5F7FA]">›</button>
        </div>
      </div>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{label:"Rencana hari ini",value:totals.rencana},{label:"Realisasi (input)",value:totals.aktual},{label:"Selisih",value:totals.selisih}].map((k)=>(
          <div key={k.label} className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"><p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">{k.label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-[#1E3A5F]">{k.value.toLocaleString("id-ID")}</p></div>
        ))}
        <div className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"><p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Status hari</p><p className="mt-2"><span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${dayStatus.cls}`}>{dayStatus.text}</span></p></div>
      </section>
      <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="border-b border-slate-100 p-4"><h3 className="font-semibold text-[#1E3A5F]">Realisasi Tahap <span className="font-normal text-xs text-[#6B7280]">· {fmtDate(tanggal)} · ikut tombol Simpan di bawah</span></h3></div>
        {loading ? (<p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat tahapan...</p>) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6">
            {STAGE_KEYS.map((k)=>{
              const rc=rencanaTahap[k]??0, ak=tahapInputs[k]??0, st=statusOf(rc,ak);
              return (
                <div key={k} className="rounded-xl bg-[#F5F7FA] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{REALISASI_STAGE_LABEL[k]}</p>
                  <input type="number" min={0} value={ak} disabled={locked} onChange={(e)=>setTahapInputs((p)=>({ ...p, [k]: Math.max(0, Math.floor(Number(e.target.value)||0)) }))} className="mt-2 w-full rounded-lg border border-[#D1D5DB] bg-white px-2 py-1.5 text-right tabular-nums focus:outline-2 focus:outline-[#00A8E8] disabled:bg-slate-100 disabled:text-slate-400" />
                  <p className="mt-1 text-xs tabular-nums text-[#6B7280]">Rencana {rc.toLocaleString("id-ID")}</p>
                  <p className="mt-1"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.text}</span></p>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <h3 className="font-semibold text-[#1E3A5F]">{fmtDate(tanggal)} <span className="font-normal text-xs text-[#6B7280]">· {rows.length} variant</span></h3>
          <button type="button" onClick={()=>void save()} disabled={saving || rows.length===0 || locked} className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#16294a] active:scale-[0.98] disabled:opacity-40">{saving ? "Menyimpan..." : "Simpan Realisasi"}</button>
        </div>
        <p className="border-b border-slate-100 bg-[#F5F7FA] px-4 py-2 text-xs text-[#6B7280]">Kolom Aktual terisi otomatis dari Finishgood — ubah manual bila perlu, lalu tekan Simpan Realisasi.</p>
        {loading ? (<p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat jadwal & realisasi...</p>) : rows.length===0 ? (<p className="p-6 text-center text-[#6B7280]">Tidak ada jadwal produksi pada tanggal ini.</p>) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]"><th className="px-3 py-3 font-semibold">Item Variant</th><th className="px-3 py-3 text-right font-semibold">Rencana<span className="block text-[10px] font-normal normal-case text-slate-400">jadwal hari ini</span></th><th className="px-3 py-3 text-right font-semibold">Finishgood<span className="block text-[10px] font-normal normal-case text-slate-400">barang tercatat</span></th><th className="px-3 py-3 text-right font-semibold">Aktual<span className="block text-[10px] font-normal normal-case text-slate-400">ketik hasil</span></th><th className="px-3 py-3 text-right font-semibold">Reject<span className="block text-[10px] font-normal normal-case text-slate-400">barang gagal</span></th><th className="px-3 py-3 font-semibold">Status</th></tr></thead>
              <tbody>
                {rows.map((r)=>{
                  const aktual=inputs[r.variantId]??0, st=statusOf(r.rencana,aktual);
                  return (
                    <tr key={r.variantId} className="border-b border-slate-50 last:border-0 hover:bg-[#F5F7FA]">
                      <td className="px-3 py-2.5"><p className="font-medium text-[#1F2937]">{r.label}</p><p className="font-mono text-xs text-[#6B7280]">{r.sub}</p></td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{r.rencana.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#6B7280]">{r.finishgood.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5 text-right"><input type="number" min={0} value={aktual} disabled={locked} onChange={(e)=>setInputs((p)=>({ ...p, [r.variantId]: Math.max(0, Math.floor(Number(e.target.value)||0)) }))} className="w-24 rounded-lg border border-[#D1D5DB] px-2 py-1.5 text-right tabular-nums focus:outline-2 focus:outline-[#00A8E8] disabled:bg-slate-100 disabled:text-slate-400" /></td>
                      <td className="px-3 py-2.5 text-right"><input type="number" min={0} value={rejectInputs[r.variantId]??0} disabled={locked} onChange={(e)=>setRejectInputs((p)=>({ ...p, [r.variantId]: Math.max(0, Math.floor(Number(e.target.value)||0)) }))} className="w-20 rounded-lg border border-[#D1D5DB] px-2 py-1.5 text-right tabular-nums focus:outline-2 focus:outline-[#00A8E8] disabled:bg-slate-100 disabled:text-slate-400" /></td>
                      <td className="whitespace-nowrap px-3 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.text}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
