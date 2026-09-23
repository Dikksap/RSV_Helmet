interface Row { variantId:number; item:string; size:string; target:number; baik:number; reject:number; pct:number; }

export default function RekapTab({ rekapRows, rekapTotals, loadingRekap, loadingOrder }: { rekapRows: Row[]; rekapTotals: { target:number; baik:number; reject:number; pct:number }; loadingRekap:boolean; loadingOrder:boolean }) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="border-b border-slate-100 p-4">
        <h3 className="font-semibold text-[#1E3A5F]">Rekap Realisasi Produksi <span className="font-normal text-xs text-[#6B7280]">· akumulasi semua tanggal</span></h3>
      </div>
      {loadingRekap || loadingOrder ? (<p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat rekap...</p>) : rekapRows.length===0 ? (<p className="p-6 text-center text-[#6B7280]">Belum ada item pada order ini.</p>) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]"><th className="px-3 py-3 font-semibold">Item</th><th className="px-3 py-3 font-semibold">Size</th><th className="px-3 py-3 text-right font-semibold">Target</th><th className="px-3 py-3 text-right font-semibold">Realisasi Baik</th><th className="px-3 py-3 text-right font-semibold">Reject</th><th className="px-3 py-3 text-right font-semibold">% Progress</th><th className="px-3 py-3 font-semibold">Progress bar</th></tr></thead>
            <tbody>
              {rekapRows.map((r)=>(<tr key={r.variantId} className="border-b border-slate-50 hover:bg-[#F5F7FA]"><td className="px-3 py-2.5 font-medium text-[#1F2937]">{r.item}</td><td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">{r.size}</td><td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{r.target.toLocaleString("id-ID")}</td><td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-700">{r.baik.toLocaleString("id-ID")}</td><td className="px-3 py-2.5 text-right tabular-nums text-[#EF4444]">{r.reject.toLocaleString("id-ID")}</td><td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{Number(r.pct.toFixed(1)).toLocaleString("id-ID")}%</td><td className="min-w-32 px-3 py-2.5"><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${r.pct>=100?"bg-emerald-500":"bg-[#00A8E8]"}`} style={{width:`${Math.min(100,r.pct)}%`}}/></div></td></tr>))}
              <tr className="bg-[#F5F7FA] font-bold"><td colSpan={2} className="px-3 py-2.5 text-[#1E3A5F]">TOTAL</td><td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">{rekapTotals.target.toLocaleString("id-ID")}</td><td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{rekapTotals.baik.toLocaleString("id-ID")}</td><td className="px-3 py-2.5 text-right tabular-nums text-[#EF4444]">{rekapTotals.reject.toLocaleString("id-ID")}</td><td className="px-3 py-2.5 text-right tabular-nums text-[#1E3A5F]">{Number(rekapTotals.pct.toFixed(1)).toLocaleString("id-ID")}%</td><td className="px-3 py-2.5"><div className="h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#1E3A5F]" style={{width:`${Math.min(100,rekapTotals.pct)}%`}}/></div></td></tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
