import { useCallback, useState } from "react";
import RingkasanTab from "../../components/admin/HasilProduksiDivisi/RingkasanTab";
import HasilTab from "../../components/admin/HasilProduksiDivisi/HasilTab";
import PerpindahanTab from "../../components/admin/HasilProduksiDivisi/PerpindahanTab";
import RepairTab from "../../components/admin/HasilProduksiDivisi/RepairTab";
import PosisiWipTab from "../../components/admin/HasilProduksiDivisi/PosisiWipTab";
import {
  batalKirim,
  catatKasusRepair,
  kirimBatok,
  putuskanQc,
  terimaBatok,
  ubahRepair,
  type AlurState,
  type PutuskanQcBody,
  type RepairBaru,
} from "../../components/admin/HasilProduksiDivisi/alur";
import {
  HASIL_AWAL,
  KEPUTUSAN_AWAL,
  PERPINDAHAN_AWAL,
  POSISI_AWAL,
  REPAIR_AWAL,
  type HasilRow,
  type StatusQcUlang,
  type StatusRepair,
} from "../../components/admin/HasilProduksiDivisi/data";

type Tab = "ringkasan" | "hasil" | "perpindahan" | "repair" | "wip";

const TABS: { key: Tab; label: string }[] = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "hasil", label: "Hasil Produksi" },
  { key: "perpindahan", label: "Perpindahan" },
  { key: "repair", label: "Repair" },
  { key: "wip", label: "Posisi WIP" },
];

export default function HasilProduksiDivisi() {
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [hasil, setHasil] = useState<HasilRow[]>(HASIL_AWAL);
  const [alur, setAlur] = useState<AlurState>({
    wip: POSISI_AWAL,
    transfers: PERPINDAHAN_AWAL,
    repairs: REPAIR_AWAL,
    keputusanQc: KEPUTUSAN_AWAL,
  });

  const catatHasil = useCallback((row: Omit<HasilRow, "id">) => {
    // Hasil produksi tidak menambah WIP: hanya perpindahan yang memindahkan posisi fisik.
    setHasil((p) => [{ ...row, id: p.reduce((n, r) => Math.max(n, r.id), 0) + 1 }, ...p]);
  }, []);

  const kirim = useCallback(
    (body: { tanggal: string; itemKode: string; itemNama: string; asal: string; tujuan: string; dikirim: number; catatan: string }): string | null => {
      let error: string | null = null;
      setAlur((prev) => {
        const res = kirimBatok(prev, body);
        if (!res.state) {
          error = res.error;
          return prev;
        }
        return res.state;
      });
      return error;
    },
    [],
  );

  const terima = useCallback(
    (id: number, diterima: number): string | null => {
      let error: string | null = null;
      setAlur((prev) => {
        const res = terimaBatok(prev, id, diterima);
        if (!res.state) {
          error = res.error;
          return prev;
        }
        return res.state;
      });
      return error;
    },
    [],
  );

  const batal = useCallback(
    (id: number): string | null => {
      let error: string | null = null;
      setAlur((prev) => {
        const res = batalKirim(prev, id);
        if (!res.state) {
          error = res.error;
          return prev;
        }
        return res.state;
      });
      return error;
    },
    [],
  );

  const catatRepair = useCallback(
    (body: RepairBaru): string | null => {
      let error: string | null = null;
      setAlur((prev) => {
        const res = catatKasusRepair(prev, body);
        if (!res.state) {
          error = res.error;
          return prev;
        }
        return res.state;
      });
      return error;
    },
    [],
  );

  const updateRepair = useCallback(
    (id: number, status: StatusRepair, hasilBaik: number, rejectAkhir: number, statusQcUlang: StatusQcUlang): string | null => {
      let error: string | null = null;
      setAlur((prev) => {
        const res = ubahRepair(prev, id, status, hasilBaik, rejectAkhir, statusQcUlang);
        if (!res.state) {
          error = res.error;
          return prev;
        }
        return res.state;
      });
      return error;
    },
    [],
  );

  const putuskan = useCallback(
    (body: PutuskanQcBody): string | null => {
      let error: string | null = null;
      setAlur((prev) => {
        const res = putuskanQc(prev, body);
        if (!res.state) {
          error = res.error;
          return prev;
        }
        return res.state;
      });
      return error;
    },
    [],
  );

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Barang Produksi</p>
        <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Hasil Produksi per Divisi</h1>
        <p className="mt-2 text-base text-[#6B7280]">
          Monitoring hasil produksi, perpindahan batok antar divisi, repair, dan posisi WIP. Alur dipantau: Buffing → Base Coat → Decal → Top Coat → QC.
        </p>
      </header>

      <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Belum tersambung backend — semua pencatatan hanya berlaku di sesi ini dan tidak mengubah stok/DB.
      </p>

      <nav className="flex flex-wrap gap-2" aria-label="Tab hasil produksi per divisi">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={active}
              className={`rounded-lg px-4 py-2.5 text-[15px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#00A8E8] ${active ? "bg-[#1E3A5F] text-white" : "bg-white text-[#6B7280] ring-1 ring-slate-200/70 hover:bg-[#F5F7FA] hover:text-[#1F2937]"}`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "ringkasan" && (
        <RingkasanTab hasil={hasil} wip={alur.wip} transfers={alur.transfers} repairs={alur.repairs} keputusanQc={alur.keputusanQc} />
      )}
      {tab === "hasil" && <HasilTab rows={hasil} onCatat={catatHasil} />}
      {tab === "perpindahan" && <PerpindahanTab rows={alur.transfers} onKirim={kirim} onTerima={terima} onBatal={batal} />}
      {tab === "repair" && <RepairTab rows={alur.repairs} onCatat={catatRepair} onUpdate={updateRepair} />}
      {tab === "wip" && <PosisiWipTab wip={alur.wip} transfers={alur.transfers} keputusanQc={alur.keputusanQc} onPutuskan={putuskan} />}
    </div>
  );
}
