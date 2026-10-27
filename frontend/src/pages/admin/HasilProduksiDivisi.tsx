import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { faChartColumn } from "@fortawesome/free-solid-svg-icons";
import { getDivisi, type Divisi } from "../../api/divisi";
import { getItems, type Item } from "../../api/item";
import {
  getWipHasilProduksiHarian,
  type WipRow,
} from "../../api/hasilProduksiHarian";
import FormHasilProduksi from "../../components/admin/HasilProduksiDivisi/FormHasilProduksi";
import CatatanTerbaru from "../../components/admin/HasilProduksiDivisi/CatatanTerbaru";
import DivisiPageHeader from "../../components/divisi/DivisiPageHeader";
import RiwayatTab from "../../components/admin/HasilProduksiDivisi/RiwayatTab";
import RekapTab from "../../components/admin/HasilProduksiDivisi/RekapTab";
import WipTab from "../../components/admin/HasilProduksiDivisi/WipTab";

const LAST_DIVISI_KEY = "rsv_hp_divisi";

type Tab = "input" | "riwayat" | "wip" | "rekap";

const TABS: { key: Tab; label: string }[] = [
  { key: "input", label: "Input Produksi" },
  { key: "riwayat", label: "Riwayat Produksi" },
  { key: "wip", label: "WIP" },
  { key: "rekap", label: "Rekap" },
];

function tabDariParam(value: string | null): Tab {
  return TABS.some((item) => item.key === value) ? (value as Tab) : "input";
}

interface Props {
  lockedDivisiId?: number | null;
}

export default function HasilProduksiDivisi({ lockedDivisiId = null }: Props) {
  const [divisis, setDivisis] = useState<Divisi[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [wipRows, setWipRows] = useState<WipRow[]>([]);
  const [wipLoading, setWipLoading] = useState(false);
  const [wipError, setWipError] = useState<string | null>(null);
  const [divisiId, setDivisiId] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabDariParam(searchParams.get("tab"));
  const pilihTab = (next: Tab) => {
    setSearchParams(next === "input" ? {} : { tab: next }, { replace: true });
  };
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMaster = useCallback(async () => {
    setLoading(true);
    try {
      const [divisiData, itemData] = await Promise.all([getDivisi(), getItems()]);
      setDivisis(divisiData);
      setItems(itemData);
      if (lockedDivisiId && !divisiData.some((divisi) => divisi.id === lockedDivisiId)) {
        setError("Divisi aktif tidak ditemukan. Hubungi admin.");
        setDivisiId(null);
        return;
      }
      setDivisiId((current) => {
        if (lockedDivisiId) return lockedDivisiId;
        if (current && divisiData.some((divisi) => divisi.id === current)) return current;
        const terakhir = Number(localStorage.getItem(LAST_DIVISI_KEY));
        return divisiData.find((divisi) => divisi.id === terakhir)?.id ?? divisiData[0]?.id ?? null;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat divisi dan item.");
    } finally {
      setLoading(false);
    }
  }, [lockedDivisiId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat data master sekali
    void loadMaster();
  }, [loadMaster]);

  useEffect(() => {
    if (!divisiId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- status muat sebelum request WIP
    setWipLoading(true);
    void getWipHasilProduksiHarian({ divisiId })
      .then((result) => {
        if (cancelled) return;
        setWipRows(result.data);
        setWipError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setWipRows([]);
        setWipError(err instanceof Error ? err.message : "Gagal memuat WIP divisi.");
      })
      .finally(() => {
        if (!cancelled) setWipLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [divisiId, refreshKey]);

  const gantiDivisi = (id: number) => {
    if (lockedDivisiId) return;
    setDivisiId(id);
    setWipRows([]);
    setWipError(null);
    localStorage.setItem(LAST_DIVISI_KEY, String(id));
  };

  const setelahSimpan = () => {
    setRefreshKey((current) => current + 1);
  };

  const divisiNama = divisis.find((divisi) => divisi.id === divisiId)?.nama ?? null;

  return (
    <div className="space-y-5">
      {lockedDivisiId != null ? (
        <DivisiPageHeader
          icon={faChartColumn}
          title="Produksi Harian"
          description={`Catat input dan hasil produksi divisi ${divisiNama ?? "aktif"}, lalu pantau riwayat, rekap, dan posisi WIP.`}
          divisiNama={divisiNama ?? "Divisi"}
        />
      ) : (
        <header className="max-w-3xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Barang Produksi</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">
            Hasil Produksi Harian
          </h1>
          <p className="mt-2 text-base text-[#6B7280]">
            Catat input dan hasil produksi per divisi, lalu pantau riwayat, rekap, dan posisi WIP.
          </p>
        </header>
      )}

      {loading ? (
        <section className="rounded-xl border border-[#D1D5DB] bg-white p-6 text-center text-sm text-[#6B7280] shadow-sm">
          Memuat divisi dan item...
        </section>
      ) : error ? (
        <section className="rounded-xl border border-[#EF4444]/30 bg-white p-6 text-center shadow-sm">
          <p role="alert" className="text-sm text-[#EF4444]">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void loadMaster()}
            className="mt-3 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162C48]"
          >
            Coba lagi
          </button>
        </section>
      ) : (
        <>
          <nav aria-label="Tampilan hasil produksi" className="overflow-x-auto border-b border-[#D1D5DB]">
            <div className="flex gap-1">
              {TABS.map((item) => {
                const aktif = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => pilihTab(item.key)}
                    aria-pressed={aktif}
                    className={`-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8] ${
                      aktif
                        ? "border-[#00A8E8] text-[#1E3A5F]"
                        : "border-transparent text-[#6B7280] hover:text-[#1F2937]"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {tab === "input" && (
            <>
              <FormHasilProduksi
                divisis={divisis}
                items={items}
                divisiId={divisiId}
                kunciDivisi={Boolean(lockedDivisiId)}
                wipRows={wipRows}
                wipLoading={wipLoading}
                wipError={wipError}
                onRetryWip={() => setRefreshKey((current) => current + 1)}
                onDivisiChange={gantiDivisi}
                onSaved={setelahSimpan}
                onLihatRiwayat={() => pilihTab("riwayat")}
              />
              <CatatanTerbaru
                divisiId={divisiId}
                divisiNama={divisiNama}
                refreshKey={refreshKey}
                onLihatSemua={() => pilihTab("riwayat")}
              />
            </>
          )}
          {tab === "riwayat" && (
            <RiwayatTab divisis={divisis} refreshKey={refreshKey} lockedDivisiId={lockedDivisiId} />
          )}
          {tab === "wip" && (
            <WipTab
              divisis={divisis}
              items={items}
              refreshKey={refreshKey}
              lockedDivisiId={lockedDivisiId}
            />
          )}
          {tab === "rekap" && (
            <RekapTab
              divisis={divisis}
              items={items}
              refreshKey={refreshKey}
              lockedDivisiId={lockedDivisiId}
            />
          )}
        </>
      )}
    </div>
  );
}
