import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightArrowLeft,
  faChartColumn,
  faClipboardList,
  faClockRotateLeft,
  faRotate,
  faSitemap,
  faTable,
  faUsers,
  faBell,
  faPlus,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { getUser } from "../../api/auth";
import { getDivisiById } from "../../api/divisi";
import { getItems } from "../../api/item";
import { listPermintaan } from "../../api/permintaanBarang";
import {
  getWipHasilProduksiHarian,
  listHasilProduksiHarian,
  type WipRow,
} from "../../api/hasilProduksiHarian";
import CatatanTerbaru from "../../components/admin/HasilProduksiDivisi/CatatanTerbaru";
import { angka, hariIni } from "../../components/admin/HasilProduksiDivisi/utils";
import { useDivisiWorkspace } from "../../layouts/divisi/DivisiContext";
import DivisiGate from "./DivisiGate";

interface Ringkasan {
  transaksiHariIni: number;
  wipItems: WipRow[];
  approvalMenunggu: number;
  jumlahItem: number;
  jumlahKaryawan: number;
}

type Modul = {
  to: string;
  label: string;
  sublabel: string;
  icon: IconDefinition;
  color: string;
};

const MODUL: Modul[] = [
  { to: "/divisi/produksi", label: "Produksi", sublabel: "Input baru", icon: faChartColumn, color: "text-sky-600 bg-sky-50" },
  { to: "/divisi/produksi?tab=riwayat", label: "Riwayat", sublabel: "Log mutasi", icon: faClockRotateLeft, color: "text-indigo-600 bg-indigo-50" },
  { to: "/divisi/produksi?tab=wip", label: "WIP", sublabel: "Saldo stok", icon: faSitemap, color: "text-amber-600 bg-amber-50" },
  { to: "/divisi/transfer-wip", label: "Transfer", sublabel: "Antar divisi", icon: faArrowRightArrowLeft, color: "text-violet-600 bg-violet-50" },
  { to: "/divisi/produksi?tab=rekap", label: "Rekap", sublabel: "Laporan harian", icon: faTable, color: "text-emerald-600 bg-emerald-50" },
  { to: "/divisi/permintaan", label: "Permintaan", sublabel: "Material divisi", icon: faClipboardList, color: "text-teal-600 bg-teal-50" },
  { to: "/divisi/anggota", label: "Anggota", sublabel: "Tim & item", icon: faUsers, color: "text-rose-600 bg-rose-50" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  gudang: "Warehouse",
  produksi: "Produksi",
  qc: "QC",
  user: "Operator",
};

function inisial(nama: string) {
  const bagian = nama.trim().split(/\s+/).filter(Boolean);
  if (bagian.length === 0) return "RS";
  if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
  return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
}

function salam() {
  const jam = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  if (jam < 11) return "Selamat pagi";
  if (jam < 15) return "Selamat siang";
  if (jam < 18) return "Selamat sore";
  return "Selamat malam";
}

function tanggalSekarang() {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
}

function StatCard({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: number;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition ${
        highlight
          ? "border-sky-200 bg-sky-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-extrabold tabular-nums text-[#1E3A5F]">
          {value.toLocaleString("id-ID")}
        </span>
        {unit && <span className="text-[11px] font-medium text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

function IsiRingkasan() {
  const { activeDivisiId, activeDivisiNama } = useDivisiWorkspace();
  const navigate = useNavigate();
  const [data, setData] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeDivisiId) return;
    setLoading(true);
    try {
      const today = hariIni();
      const [produksi, wip, permintaan, items, divisi] = await Promise.all([
        listHasilProduksiHarian({
          divisiId: activeDivisiId,
          dari: today,
          sampai: today,
          limit: 1,
        }),
        getWipHasilProduksiHarian({ divisiId: activeDivisiId }),
        listPermintaan({
          approval: "BELUM_DISETUJUI",
          divisiApproverId: activeDivisiId,
          limit: 100,
        }),
        getItems({ divisiId: activeDivisiId }),
        getDivisiById(activeDivisiId),
      ]);
      setData({
        transaksiHariIni: produksi.meta.total,
        wipItems: wip.data.filter((row) => angka(row.saldoAkhir) > 0),
        approvalMenunggu: permintaan.meta.total,
        jumlahItem: items.length,
        jumlahKaryawan: divisi.karyawan?.length ?? 0,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat ringkasan divisi.");
    } finally {
      setLoading(false);
    }
  }, [activeDivisiId]);

  useEffect(() => {
    void load();
  }, [load]);

  const user = getUser();
  const nama = user?.name ?? "Pengguna";
  const peran = ROLE_LABELS[user?.role ?? ""] ?? (user?.role ?? "Operator");
  const divisi = activeDivisiNama ?? "Divisi";
  const tanggal = tanggalSekarang();

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-3 pb-8">
        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-2 h-6 w-48 rounded bg-slate-200" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 pb-8">
        <section className="rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-sm">
          <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A5F] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
          >
            <FontAwesomeIcon icon={faRotate} className="h-3 w-3" /> Coba lagi
          </button>
        </section>
      </div>
    );
  }

  const transaksi = data?.transaksiHariIni ?? 0;
  const wipItems = data?.wipItems ?? [];
  const approval = data?.approvalMenunggu ?? 0;
  const jumlahItem = data?.jumlahItem ?? 0;
  const jumlahKaryawan = data?.jumlahKaryawan ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-3 pb-10">
      {/* Header Compact Mobile */}
      <header className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1E3A5F] text-xs font-bold text-white shadow-inner">
              {inisial(nama)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold text-[#1E3A5F]">{divisi}</span>
                <span className="inline-flex items-center rounded-full bg-sky-100 px-1.5 py-0.2 text-[10px] font-bold text-sky-800">
                  {peran}
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-500">
                {salam()}, <span className="font-medium text-slate-700">{nama}</span>
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
            {tanggal}
          </span>
        </div>
      </header>

      {/* Alert Approval Menunggu jika ada */}
      {approval > 0 && (
        <Link
          to="/divisi/permintaan"
          className="flex items-center justify-between gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 transition hover:bg-amber-100/70"
        >
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-200/80 text-amber-800">
              <FontAwesomeIcon icon={faBell} className="h-3 w-3" />
            </span>
            <span>
              Ada <strong className="font-bold">{approval} permintaan barang</strong> menunggu persetujuan divisi.
            </span>
          </div>
          <span className="shrink-0 font-bold text-amber-800 hover:underline">Lihat →</span>
        </Link>
      )}

      {/* Grid Statistik Ringkas */}
      <section aria-label="Ringkasan angka" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Transaksi Hari Ini" value={transaksi} highlight={transaksi > 0} />
        <StatCard label="WIP Bersaldo" value={wipItems.length} unit="item" />
        <StatCard label="Item Terdaftar" value={jumlahItem} unit="item" />
        <StatCard label="Karyawan" value={jumlahKaryawan} unit="orang" />
      </section>

      {/* Tombol Aksi Cepat */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/divisi/produksi"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#00A8E8] py-2.5 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#0096D1] active:scale-[0.99]"
        >
          <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
          <span>Input Produksi</span>
        </Link>
        <Link
          to="/divisi/transfer-wip"
          className="flex items-center justify-center gap-2 rounded-xl border border-[#1E3A5F] bg-white py-2.5 px-3 text-xs font-bold text-[#1E3A5F] shadow-sm transition hover:bg-slate-50 active:scale-[0.99]"
        >
          <FontAwesomeIcon icon={faArrowRightArrowLeft} className="h-3.5 w-3.5 text-[#00A8E8]" />
          <span>Transfer WIP</span>
        </Link>
      </div>

      {/* Modul Navigasi Ringkas */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Menu Cepat
          </h2>
          <span className="text-[11px] text-slate-400">Pilih modul</span>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {MODUL.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center rounded-xl p-2 text-center transition hover:bg-slate-50 active:scale-95"
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl text-sm shadow-xs ${item.color}`}
              >
                <FontAwesomeIcon icon={item.icon} />
              </span>
              <span className="mt-1.5 truncate text-[11px] font-semibold text-slate-700">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Ringkasan WIP & Catatan Terbaru */}
      <div className="grid gap-3 lg:grid-cols-[1fr_minmax(0,1.2fr)]">
        {/* WIP Bersaldo Mini */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <h2 className="text-xs font-bold text-[#1E3A5F]">WIP Bersaldo</h2>
            </div>
            <Link
              to="/divisi/produksi?tab=wip"
              className="text-[11px] font-bold text-[#00A8E8] hover:underline"
            >
              Lihat semua →
            </Link>
          </div>
          {wipItems.length === 0 ? (
            <p className="px-4 py-5 text-center text-xs text-slate-400">
              Tidak ada stok WIP tersisa saat ini.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {wipItems.slice(0, 5).map((row) => (
                <li
                  key={`${row.divisiId ?? "tanpa"}:${row.itemId}`}
                  className="flex items-center justify-between gap-2 px-3.5 py-2 text-xs hover:bg-slate-50/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{row.nama}</p>
                    <p className="font-mono text-[10px] text-slate-400">{row.kode}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-bold tabular-nums text-[#1E3A5F]">
                      {angka(row.saldoAkhir).toLocaleString("id-ID")}
                    </span>
                    <span className="ml-1 text-[10px] text-slate-400">{row.unit}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Catatan Terbaru */}
        <CatatanTerbaru
          divisiId={activeDivisiId}
          divisiNama={activeDivisiNama}
          refreshKey={0}
          onLihatSemua={() => navigate("/divisi/produksi?tab=riwayat")}
        />
      </div>
    </div>
  );
}

export default function DivisiHome() {
  return (
    <DivisiGate>
      <IsiRingkasan />
    </DivisiGate>
  );
}
