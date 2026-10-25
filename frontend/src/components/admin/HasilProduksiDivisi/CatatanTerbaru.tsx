import { useEffect, useState } from "react";
import {
  listHasilProduksiHarian,
  type HasilProduksiRecord,
} from "../../../api/hasilProduksiHarian";
import { Empty, Panel, miniBtn } from "./ui";
import { angka, formatTanggal, ringkasItems } from "./utils";

interface Props {
  divisiId: number | null;
  divisiNama: string | null;
  refreshKey: number;
  onLihatSemua: () => void;
}

export default function CatatanTerbaru({ divisiId, divisiNama, refreshKey, onLihatSemua }: Props) {
  const [rows, setRows] = useState<HasilProduksiRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!divisiId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await listHasilProduksiHarian({ divisiId, page: 1, limit: 5 });
        if (cancelled) return;
        setRows(result.data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setRows([]);
        setError(err instanceof Error ? err.message : "Gagal memuat catatan terbaru.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [divisiId, refreshKey]);

  return (
    <Panel
      title={
        <>
          Catatan terbaru
          {divisiNama ? <span className="font-normal text-[#6B7280]"> — {divisiNama}</span> : null}
        </>
      }
      extra={
        <button type="button" onClick={onLihatSemua} className={miniBtn}>
          Lihat semua
        </button>
      }
    >
      {loading ? (
        <p className="p-6 text-center text-sm text-[#6B7280]">Memuat catatan...</p>
      ) : error ? (
        <p role="alert" className="p-6 text-center text-sm text-[#EF4444]">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <Empty>Belum ada catatan untuk divisi ini.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const ringkasan = ringkasItems(row.items);
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
                <span className="font-mono text-xs font-semibold text-[#1E3A5F]">{row.nomor}</span>
                <span className="text-[#6B7280]">{formatTanggal(row.tanggalProduksi)}</span>
                <span className="inline-flex items-center gap-1 text-xs text-[#6B7280]">
                  {row.items.length} baris
                </span>
                <span className="ml-auto flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                    Input {angka(ringkasan.masuk).toLocaleString("id-ID")}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Hasil {angka(ringkasan.hasil).toLocaleString("id-ID")}
                  </span>
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                    Keluar {angka(ringkasan.keluar).toLocaleString("id-ID")}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
