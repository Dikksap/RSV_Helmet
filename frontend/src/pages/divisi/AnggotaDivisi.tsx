import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faMagnifyingGlass,
  faRotate,
  faUserGroup,
  faBoxesStacked,
} from "@fortawesome/free-solid-svg-icons";
import { getDivisiById, type Divisi } from "../../api/divisi";
import { getItems, type Item } from "../../api/item";
import { TD, TH, btnPrimary } from "../../components/admin/HasilProduksiDivisi/ui";
import { useDivisiWorkspace } from "../../layouts/divisi/DivisiContext";
import DivisiGate from "./DivisiGate";

function StatusItem({ aktif }: { aktif: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
        aktif ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${aktif ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {aktif ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function IsiAnggota() {
  const { activeDivisiId, activeDivisiNama } = useDivisiWorkspace();
  const [divisi, setDivisi] = useState<Divisi | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabAktif, setTabAktif] = useState<"karyawan" | "item">("karyawan");
  const [cari, setCari] = useState("");

  const load = useCallback(async () => {
    if (!activeDivisiId) return;
    setLoading(true);
    try {
      const [divisiData, itemData] = await Promise.all([
        getDivisiById(activeDivisiId),
        getItems({ divisiId: activeDivisiId }),
      ]);
      setDivisi(divisiData);
      setItems(itemData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat anggota dan item divisi.");
    } finally {
      setLoading(false);
    }
  }, [activeDivisiId]);

  useEffect(() => {
    void load();
  }, [load]);

  const karyawan = divisi?.karyawan ?? [];

  const karyawanTersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return karyawan;
    return karyawan.filter(
      (k) =>
        k.nama.toLowerCase().includes(q) ||
        (k.jabatan && k.jabatan.toLowerCase().includes(q)),
    );
  }, [karyawan, cari]);

  const itemTersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.nama.toLowerCase().includes(q) ||
        it.kode.toLowerCase().includes(q) ||
        (it.jenis && it.jenis.toLowerCase().includes(q)),
    );
  }, [items, cari]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-3 pb-8">
        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-2 h-6 w-48 rounded bg-slate-200" />
        </div>
        <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
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
            className={`${btnPrimary} mt-3 text-xs`}
          >
            <FontAwesomeIcon icon={faRotate} /> Coba lagi
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-3 pb-10">
      {/* Header Mobile Compact */}
      <header className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link
              to="/divisi/home"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 lg:hidden"
              aria-label="Kembali ke Ringkasan"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="h-3.5 w-3.5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-[#1E3A5F] sm:text-base">
                  Anggota & Item
                </h1>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {activeDivisiNama ?? "Divisi"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {karyawan.length} karyawan · {items.length} item terdaftar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50"
            title="Muat ulang"
          >
            <FontAwesomeIcon icon={faRotate} className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* Segmented Control / Tabs & Search */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTabAktif("karyawan")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
              tabAktif === "karyawan"
                ? "bg-white text-[#1E3A5F] shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FontAwesomeIcon icon={faUserGroup} className="h-3 w-3" />
            <span>Karyawan ({karyawan.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAktif("item")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
              tabAktif === "item"
                ? "bg-white text-[#1E3A5F] shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FontAwesomeIcon icon={faBoxesStacked} className="h-3 w-3" />
            <span>Item Divisi ({items.length})</span>
          </button>
        </div>

        {/* Input Pencarian Ringkas */}
        <div className="relative">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={
              tabAktif === "karyawan"
                ? "Cari nama atau jabatan..."
                : "Cari nama, kode, atau jenis item..."
            }
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 shadow-xs focus:border-[#00A8E8] focus:outline-none"
          />
        </div>
      </div>

      {/* Konten Tab Karyawan */}
      {tabAktif === "karyawan" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {karyawanTersaring.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">
              {cari ? "Tidak ada karyawan yang cocok dengan pencarian." : "Belum ada karyawan di divisi ini."}
            </p>
          ) : (
            <>
              {/* Tampilan Mobile Card List */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {karyawanTersaring.map((row) => (
                  <li key={row.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] font-bold text-[#1E3A5F]">
                      {row.nama.trim().slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[#1F2937]">{row.nama}</p>
                      <p className="truncate text-[11px] text-slate-400">{row.jabatan || "Karyawan"}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Tampilan Desktop Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className={TH}>Nama</th>
                      <th className={TH}>Jabatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {karyawanTersaring.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className={`${TD} font-semibold text-slate-800`}>{row.nama}</td>
                        <td className={`${TD} text-xs text-slate-500`}>{row.jabatan || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* Konten Tab Item */}
      {tabAktif === "item" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {itemTersaring.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">
              {cari ? "Tidak ada item yang cocok dengan pencarian." : "Belum ada item untuk divisi ini."}
            </p>
          ) : (
            <>
              {/* Tampilan Mobile List */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {itemTersaring.map((row) => (
                  <li key={row.id} className="px-3.5 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-400">{row.kode}</span>
                          {row.jenis && (
                            <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-bold text-slate-600">
                              {row.jenis}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs font-bold text-[#1F2937]">
                          {row.nama}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Satuan: <span className="font-medium text-slate-600">{row.unit}</span>
                        </p>
                      </div>
                      <StatusItem aktif={row.isActive} />
                    </div>
                  </li>
                ))}
              </ul>

              {/* Tampilan Desktop Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className={TH}>Kode</th>
                      <th className={TH}>Nama</th>
                      <th className={TH}>Jenis</th>
                      <th className={TH}>Satuan</th>
                      <th className={TH}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemTersaring.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className={`${TD} font-mono text-xs text-slate-500`}>{row.kode}</td>
                        <td className={`${TD} font-semibold text-slate-800`}>{row.nama}</td>
                        <td className={`${TD} text-xs text-slate-500`}>{row.jenis ?? "—"}</td>
                        <td className={`${TD} text-xs text-slate-500`}>{row.unit}</td>
                        <td className={TD}>
                          <StatusItem aktif={row.isActive} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

export default function AnggotaDivisi() {
  return (
    <DivisiGate>
      <IsiAnggota />
    </DivisiGate>
  );
}
