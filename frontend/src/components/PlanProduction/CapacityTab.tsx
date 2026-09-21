import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import {
  replaceProductionCapacities,
  updateOrder,
  type ProductionCapacity,
  type ProductionOrderSummary,
} from "../../api/productionOrders";
import { fmt, fmtDate } from "./utils";
import { calcSelesai, demandForStage, requiredDaily } from "./capacityCalc";

interface Props {
  orderId: number;
  detail: ProductionOrderSummary | null;
  capacities: ProductionCapacity[];
  loading: boolean;
  onChanged: () => void;
}

interface Draft {
  id: number;
  stage: string;
  kapW: string;
  kapS: string;
  mulai: string;
  target: string;
  selesai: string;
  hariKerja: string;
  catatan: string;
  dirtySelesai: boolean;
  dirtyHari: boolean;
  totalKapasitas: number;
  urutan: number;
}

const isoDay = (s: string | null) => (s ? s.slice(0, 10) : "");

const inputCls =
  "w-full min-w-[4.5rem] rounded-lg border border-[#D1D5DB] bg-white px-2 py-1.5 text-sm focus:outline-2 focus:outline-[#00A8E8]";

export default function CapacityTab({ orderId, detail, capacities, loading, onChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mulai, setMulai] = useState("");
  const [mulaiBusy, setMulaiBusy] = useState(false);

  const demands = useMemo(() => {
    const items = (detail?.items ?? []).map((i) => ({ qty: i.qty, style: i.variant.style.nama }));
    const total = detail?.totalQty ?? 0;
    return new Map(capacities.map((c) => [c.id, demandForStage(c.stage, items, total)]));
  }, [capacities, detail]);

  // Kebutuhan kap/hari dari demand + window agar tepat waktu.
  const required = useMemo(
    () =>
      new Map(
        capacities.map((c) => [
          c.id,
          c.mulai && c.selesai ? requiredDaily(c.mulai.slice(0, 10), c.selesai.slice(0, 10), demands.get(c.id) ?? 0) : null,
        ]),
      ),
    [capacities, demands],
  );

  const startEdit = () => {
    setDrafts(
      capacities.map((c) => ({
        id: c.id,
        stage: c.stage,
        kapW: String(c.kapasitasWeekday),
        kapS: String(c.kapasitasSabtu),
        mulai: isoDay(c.mulai),
        target: String(demands.get(c.id) ?? 0),
        selesai: isoDay(c.selesai),
        hariKerja: String(c.hariKerja),
        catatan: c.catatan ?? "",
        dirtySelesai: false,
        dirtyHari: false,
        totalKapasitas: c.totalKapasitas,
        urutan: c.urutan,
      })),
    );
    setError(null);
    setEditing(true);
  };

  const patch = (id: number, p: Partial<Draft>) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const next = { ...d, ...p };
        const autoField = p.kapW !== undefined || p.kapS !== undefined || p.mulai !== undefined || p.target !== undefined;
        if (autoField) {
          const calc = calcSelesai({
            mulai: next.mulai,
            kapW: Number(next.kapW),
            kapS: Number(next.kapS),
            target: Number(next.target),
          });
          if (calc) {
            if (!next.dirtySelesai) next.selesai = calc.selesai;
            if (!next.dirtyHari) next.hariKerja = String(calc.hariKerja);
          }
        }
        return next;
      }),
    );
  };

  const save = async () => {
    for (const d of drafts) {
      for (const f of ["kapW", "kapS", "hariKerja"] as const) {
        if (!/^\d+$/.test(d[f]) || Number(d[f]) < 0) {
          setError(`Baris "${d.stage}": ${f} harus angka ≥ 0`);
          return;
        }
      }
      if (!/^\d{4}-\d{2}-\d{2}/.test(d.mulai) || Number.isNaN(new Date(d.mulai).getTime())) {
        setError(`Baris "${d.stage}": mulai tidak valid`);
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}/.test(d.selesai) || Number.isNaN(new Date(d.selesai).getTime())) {
        setError(`Baris "${d.stage}": selesai tidak valid`);
        return;
      }
    }
    setBusy(true);
    try {
      await replaceProductionCapacities(
        orderId,
        drafts.map((d) => ({
          stage: d.stage,
          kapasitasWeekday: Number(d.kapW),
          kapasitasSabtu: Number(d.kapS),
          mulai: d.mulai,
          selesai: d.selesai,
          hariKerja: Number(d.hariKerja),
          // Total selalu ikut demand master (decal ikut style-nya), bukan angka basi.
          totalKapasitas: demands.get(d.id) ?? d.totalKapasitas,
          catatan: d.catatan.trim() || null,
          urutan: d.urutan,
        })),
      );
      setEditing(false);
      setError(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  };

  const currentMulai = detail?.mulaiProduksi ? detail.mulaiProduksi.slice(0, 10) : "";

  useEffect(() => {
    setMulai(currentMulai);
  }, [currentMulai, orderId]);

  const saveMulai = async () => {
    if (mulai && Number.isNaN(new Date(mulai).getTime())) {
      setError("Tanggal mulai produksi tidak valid");
      return;
    }
    setMulaiBusy(true);
    try {
      await updateOrder(orderId, { mulaiProduksi: mulai || null });
      setError(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan tanggal mulai");
    } finally {
      setMulaiBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <h3 className="font-semibold text-[#1E3A5F]">
          Perhitungan Kapasitas Produksi{" "}
          {detail && (
            <span className="font-normal tabular-nums text-[#6B7280]">
              · target {fmt(detail.totalQty)} pcs
            </span>
          )}
        </h3>
        {editing ? (
          <span className="inline-flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-3 py-1.5 text-sm font-medium text-[#1F2937] hover:bg-[#F5F7FA] disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" /> Batal
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5" /> Simpan
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            disabled={capacities.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00A8E8] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#0088C0] disabled:opacity-40"
          >
            <FontAwesomeIcon icon={faPen} className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="border-b border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2 text-sm text-[#EF4444]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-[#F5F7FA] px-4 py-2.5 text-sm">
        <label className="flex items-center gap-2 font-medium text-[#1F2937]">
          Mulai produksi semua item
          <input
            type="date"
            value={mulai}
            onChange={(e) => setMulai(e.target.value)}
            title="Kosong = ikut awal kapasitas"
            className="rounded-lg border border-[#D1D5DB] bg-white px-2 py-1.5"
          />
        </label>
        <button
          type="button"
          disabled={mulaiBusy || mulai === currentMulai}
          onClick={() => void saveMulai()}
          className="rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-40"
        >
          {mulaiBusy ? "Menyimpan..." : "Terapkan"}
        </button>
        <span className="text-xs text-[#6B7280]">
          {currentMulai ? `Aktif: ${currentMulai.slice(8, 10)}/${currentMulai.slice(5, 7)}/${currentMulai.slice(0, 4)}.` : "Belum diset (ikut awal kapasitas)."}
          {" "}Mulai efektif = yang paling akhir antara tanggal ini dan Mulai tiap tahap.
        </span>
      </div>

      {loading ? (
        <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat kapasitas...</p>
      ) : capacities.length === 0 ? (
        <p className="p-6 text-center text-[#6B7280]">Belum ada data kapasitas untuk periode ini.</p>
      ) : editing ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                <th className="px-4 py-3 font-semibold">Tahap</th>
                <th className="px-4 py-3 text-right font-semibold">Kap/hari</th>
                <th className="px-4 py-3 text-right font-semibold">Kap/Sabtu</th>
                <th className="px-4 py-3 font-semibold">Mulai</th>
                <th className="px-4 py-3 text-right font-semibold">Target</th>
                <th className="px-4 py-3 font-semibold">Selesai (auto)</th>
                <th className="px-4 py-3 text-right font-semibold">Hari Kerja (auto)</th>
                <th className="px-4 py-3 font-semibold">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 align-top last:border-0">
                  <td className="px-4 py-2.5 font-medium text-[#1F2937]">{d.stage}</td>
                  <td className="px-4 py-2.5">
                    <input value={d.kapW} inputMode="numeric" onChange={(e) => patch(d.id, { kapW: e.target.value })} className={`${inputCls} text-right`} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input value={d.kapS} inputMode="numeric" onChange={(e) => patch(d.id, { kapS: e.target.value })} className={`${inputCls} text-right`} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="date" value={d.mulai} onChange={(e) => patch(d.id, { mulai: e.target.value })} className={inputCls} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input value={d.target} inputMode="numeric" onChange={(e) => patch(d.id, { target: e.target.value })} className={`${inputCls} text-right`} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="date"
                      value={d.selesai}
                      onChange={(e) => patch(d.id, { selesai: e.target.value, dirtySelesai: true })}
                      className={`${inputCls} ${d.dirtySelesai ? "border-amber-400 bg-amber-50" : "bg-[#F5F7FA]"}`}
                      title={d.dirtySelesai ? "Manual (klik Batal untuk reset)" : "Otomatis"}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      value={d.hariKerja}
                      inputMode="numeric"
                      onChange={(e) => patch(d.id, { hariKerja: e.target.value, dirtyHari: true })}
                      className={`${inputCls} text-right ${d.dirtyHari ? "border-amber-400 bg-amber-50" : "bg-[#F5F7FA]"}`}
                      title={d.dirtyHari ? "Manual (klik Batal untuk reset)" : "Otomatis"}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input value={d.catatan} placeholder="cth 4 rak" onChange={(e) => patch(d.id, { catatan: e.target.value })} className={inputCls} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-[#6B7280]">
            Selesai &amp; Hari Kerja terisi otomatis saat Kap/Mulai/Target diubah. Ketik manual untuk override (kuning).
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                <th className="px-4 py-3 font-semibold">Tahap</th>
                <th className="px-4 py-3 text-right font-semibold">Kap/hari</th>
                <th className="px-4 py-3 text-right font-semibold">Kap/Sabtu</th>
                <th className="px-4 py-3 text-right font-semibold">Butuh/hari</th>
                <th className="px-4 py-3 font-semibold">Mulai</th>
                <th className="px-4 py-3 font-semibold">Selesai</th>
                <th className="px-4 py-3 text-right font-semibold">Hari Kerja</th>
                <th className="px-4 py-3 text-right font-semibold">Total Kapasitas</th>
                <th className="px-4 py-3 font-semibold">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {capacities.map((c) => {
                const need = required.get(c.id);
                const short = need !== null && need !== undefined && c.kapasitasWeekday < need.kapW;
                return (
                  <tr key={c.id} className={`border-b border-slate-50 last:border-0 hover:bg-[#F5F7FA] ${short ? "bg-[#EF4444]/5" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-[#1F2937]">{c.stage}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${short ? "text-[#EF4444]" : "text-[#1F2937]"}`}>{fmt(c.kapasitasWeekday)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#1F2937]">{fmt(c.kapasitasSabtu)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#6B7280]" title="Kebutuhan agar tepat waktu (dari demand + window)">
                    {need ? fmt(need.kapW) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[#1F2937]">{fmtDate(c.mulai)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[#1F2937]">{fmtDate(c.selesai)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#1F2937]">{fmt(c.hariKerja)}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums text-[#1E3A5F]" title="Otomatis dari master data (decal ikut style-nya)">
                    {fmt(demands.get(c.id) ?? c.totalKapasitas)}
                  </td>
                  <td className="px-4 py-2.5 text-[#6B7280]">{c.catatan ?? "—"}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
