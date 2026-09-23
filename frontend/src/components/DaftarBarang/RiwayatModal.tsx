import { useEffect, useState } from "react";
import { getRiwayatBarang, type RiwayatBarangResponse } from "../../api/barang";
import { StatusBadge } from "./StatusBadge";

type Props = { barangId: number; kodeBarang: string; onClose: () => void };

export function RiwayatModal({ barangId, kodeBarang, onClose }: Props) {
  const [data, setData] = useState<RiwayatBarangResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getRiwayatBarang(barangId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat riwayat"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [barangId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0F1C2E]/60 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onClick={onClose}>
      <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-slate-200 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_4px_20px_rgba(0,0,0,0.12)] sm:max-w-lg sm:rounded-xl" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <button type="button" onClick={onClose} aria-label="Tutup" className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]">✕</button>
        <p className="text-xs font-bold uppercase tracking-widest text-[#00A8E8]">Riwayat Barang</p>
        <h2 className="mt-1 font-mono text-sm font-bold text-[#1E3A5F]">{kodeBarang}</h2>
        {data && <p className="mt-1 text-xs text-[#6B7280]">{data.summary.total} entri • Status saat ini: {data.summary.currentStatus}</p>}

        <div className="mt-4">
          {loading && <p className="py-8 text-center text-sm text-[#6B7280]">Memuat riwayat...</p>}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#EF4444]">{error}</div>}
          {!loading && !error && data && (
            data.data.length === 0 ? <p className="py-8 text-center text-sm text-[#6B7280]">Belum ada riwayat.</p> :
            <ol className="relative border-l border-slate-200 pl-6">
              {data.data.map((r) => (
                <li key={r.id} className="mb-4 last:mb-0">
                  <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#00A8E8] shadow" aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} />
                    <span className="text-xs tabular-nums text-[#6B7280]">{new Date(r.tanggal).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {r.keterangan && <p className="mt-1 text-sm text-[#1F2937]">{r.keterangan}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-6 text-sm font-medium text-[#1F2937] hover:bg-[#F5F7FA]">Tutup</button>
        </div>
      </div>
    </div>
  );
}
