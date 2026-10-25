import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightArrowLeft,
  faChartColumn,
  faClipboardCheck,
  faClipboardList,
  faClockRotateLeft,
  faRotate,
  faSitemap,
  faTable,
  faUsers,
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
  icon: IconDefinition;
  warna: string;
};

const MODUL: Modul[] = [
  {
    to: "/divisi/produksi",
    label: "Produksi",
    icon: faChartColumn,
    warna: "bg-teal-500 shadow-teal-500/20",
  },
  {
    to: "/divisi/produksi?tab=riwayat",
    label: "Riwayat",
    icon: faClockRotateLeft,
    warna: "bg-blue-500 shadow-blue-500/20",
  },
  {
    to: "/divisi/produksi?tab=wip",
    label: "WIP",
    icon: faSitemap,
    warna: "bg-rose-500 shadow-rose-500/20",
  },
  {
    to: "/divisi/transfer-wip",
    label: "Transfer WIP",
    icon: faArrowRightArrowLeft,
    warna: "bg-cyan-600 shadow-cyan-600/20",
  },
  {
    to: "/divisi/produksi?tab=rekap",
    label: "Rekap",
    icon: faTable,
    warna: "bg-fuchsia-500 shadow-fuchsia-500/20",
  },
  {
    to: "/divisi/permintaan",
    label: "Permintaan",
    icon: faClipboardList,
    warna: "bg-purple-600 shadow-purple-600/20",
  },
  {
    to: "/divisi/anggota",
    label: "Anggota",
    icon: faUsers,
    warna: "bg-orange-400 shadow-orange-400/20",
  },
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

function Header({
  nama,
  peran,
  divisi,
  tanggal,
}: {
  nama: string;
  peran: string;
  divisi: string;
  tanggal: string;
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1E3A5F] text-sm font-bold text-white ring-2 ring-white shadow-sm">
          {inisial(nama)}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{salam()},</p>
          <h1 className="truncate text-base font-bold text-[#1E3A5F] sm:text-lg">{nama}</h1>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {peran} · {divisi}
          </p>
        </div>
      </div>
      <span className="hidden shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm sm:inline-flex">
        {tanggal}
      </span>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-2.5 text-center shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-[#1E3A5F]">
        {value.toLocaleString("id-ID")}
      </p>
    </div>
  );
}

function ModulTile({ item }: { item: Modul }) {
  return (
    <Link
      to={item.to}
      className="group flex flex-col items-center gap-1.5 rounded-lg text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]"
    >
      <span
        className={`grid h-12 w-12 place-items-center rounded-2xl text-white shadow-md transition group-active:scale-95 ${item.warna}`}
      >
        <FontAwesomeIcon icon={item.icon} className="h-5 w-5" />
      </span>
      <span className="text-[11px] font-medium leading-tight text-slate-600">{item.label}</span>
    </Link>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat ringkasan divisi
    void load();
  }, [load]);

  const user = getUser();
  const nama = user?.name ?? "Pengguna";
  const peran = ROLE_LABELS[user?.role ?? ""] ?? (user?.role ?? "Operator");
  const divisi = activeDivisiNama ?? "Divisi";
  const tanggal = tanggalSekarang();
  const header = <Header nama={nama} peran={peran} divisi={divisi} tanggal={tanggal} />;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5">
        {header}
        <section className="rounded-xl bg-white p-6 text-center text-sm text-[#6B7280] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          Memuat ringkasan divisi...
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5">
        {header}
        <section className="rounded-xl border border-red-200 bg-white p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <p role="alert" className="text-sm text-[#B91C1C]">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162C48]"
          >
            <FontAwesomeIcon icon={faRotate} /> Coba lagi
          </button>
        </section>
      </div>
    );
  }

  const transaksi = data?.transaksiHariIni ?? 0;
  const jumlahWip = data?.wipItems.length ?? 0;
  const approval = data?.approvalMenunggu ?? 0;
  const jumlahItem = data?.jumlahItem ?? 0;
  const jumlahKaryawan = data?.jumlahKaryawan ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      {header}

      <section className="overflow-hidden rounded-2xl border-2 border-[#BAE6FD] bg-[#F0F9FF] shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#0077A8] to-[#00A8E8] px-4 py-2.5 text-xs font-semibold text-white">
          <span className="flex min-w-0 items-center gap-2">
            <FontAwesomeIcon icon={faChartColumn} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Aktivitas Produksi · {tanggal}</span>
          </span>
          <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Hari ini
          </span>
        </div>

        <div className="p-4">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
            {divisi}
          </p>

          <div className="my-2.5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-3xl font-extrabold tracking-tight tabular-nums text-[#1E3A5F]">
              {transaksi.toLocaleString("id-ID")}
            </span>
            <span className="text-xs font-semibold text-slate-500">transaksi</span>
            {approval > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                <FontAwesomeIcon icon={faClipboardCheck} className="h-3 w-3" /> {approval} approval
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                Tidak ada approval
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="WIP aktif" value={jumlahWip} />
            <Stat label="Item" value={jumlahItem} />
            <Stat label="Karyawan" value={jumlahKaryawan} />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link
              to="/divisi/produksi"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00A8E8] px-3 py-2.5 text-xs font-bold text-white shadow-sm shadow-sky-500/20 transition hover:bg-[#0088C0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]"
            >
              <FontAwesomeIcon icon={faChartColumn} /> Input Produksi
            </Link>
            <Link
              to="/divisi/produksi?tab=wip"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-[#1E3A5F] ring-1 ring-sky-200 transition hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]"
            >
              <FontAwesomeIcon icon={faSitemap} /> Lihat WIP
            </Link>
          </div>

          <p className="mt-2 text-center text-[10px] text-slate-500">
            Ringkasan dihitung dari data produksi dan material divisi.
          </p>
        </div>
      </section>

      <section aria-label="Modul divisi" className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#1E3A5F]">Modul</h2>
          <span className="text-[10px] font-medium text-slate-400">Akses cepat</span>
        </div>
        <div className="grid grid-cols-3 gap-y-4 sm:grid-cols-6">
          {MODUL.map((item) => (
            <ModulTile key={item.to} item={item} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <CatatanTerbaru
          divisiId={activeDivisiId}
          divisiNama={activeDivisiNama}
          refreshKey={0}
          onLihatSemua={() => navigate("/divisi/produksi?tab=riwayat")}
        />

        <section className="self-start overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-[#1E3A5F]">WIP bersaldo</h2>
            <Link to="/divisi/produksi?tab=wip" className="text-xs font-semibold text-[#0077A8] hover:underline">
              Lihat WIP
            </Link>
          </div>
          {(data?.wipItems.length ?? 0) === 0 ? (
            <p className="p-5 text-center text-sm text-[#6B7280]">Belum ada saldo WIP.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data?.wipItems.slice(0, 5).map((row) => (
                <li
                  key={`${row.divisiId ?? "tanpa"}:${row.itemId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#1F2937]">{row.nama}</p>
                    <p className="font-mono text-xs text-[#6B7280]">{row.kode}</p>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums text-[#1E3A5F]">
                    {angka(row.saldoAkhir).toLocaleString("id-ID")} {row.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
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
