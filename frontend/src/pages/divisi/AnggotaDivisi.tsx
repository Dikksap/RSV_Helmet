import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate, faUsers } from "@fortawesome/free-solid-svg-icons";
import { getDivisiById, type Divisi } from "../../api/divisi";
import { getItems, type Item } from "../../api/item";
import DivisiPageHeader from "../../components/divisi/DivisiPageHeader";
import { useDivisiWorkspace } from "../../layouts/divisi/DivisiContext";
import DivisiGate from "./DivisiGate";

const TH = "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]";
const TD = "px-4 py-3 text-sm text-[#1F2937]";

function IsiAnggota() {
  const { activeDivisiId, activeDivisiNama } = useDivisiWorkspace();
  const [divisi, setDivisi] = useState<Divisi | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat anggota divisi
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="rounded-xl bg-white p-6 text-center text-sm text-[#6B7280] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        Memuat anggota dan item divisi...
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-red-200 bg-white p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162C48]"
        >
          <FontAwesomeIcon icon={faRotate} /> Coba lagi
        </button>
      </section>
    );
  }

  const karyawan = divisi?.karyawan ?? [];
  const itemAktif = items.filter((row) => row.isActive).length;

  return (
    <div className="space-y-5">
      <DivisiPageHeader
        icon={faUsers}
        title="Anggota & Item"
        description={`Data karyawan dan item untuk divisi ${activeDivisiNama ?? "aktif"}.`}
        divisiNama={activeDivisiNama ?? "Divisi"}
        actions={
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
              <span className="font-bold text-[#1E3A5F]">{karyawan.length}</span> karyawan
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
              <span className="font-bold text-[#1E3A5F]">{items.length}</span> item
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              <span className="font-bold">{itemAktif}</span> item aktif
            </span>
          </div>
        }
      />

      <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <FontAwesomeIcon icon={faUsers} className="h-4 w-4 text-[#0077A8]" />
          <h2 className="text-sm font-bold text-[#1E3A5F]">Karyawan</h2>
          <span className="ml-auto text-xs text-[#6B7280]">{karyawan.length} orang</span>
        </div>
        {karyawan.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">Belum ada karyawan di divisi ini.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {karyawan.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-50 text-xs font-bold text-[#0077A8]">
                    {row.nama.trim().slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1F2937]">{row.nama}</p>
                    <p className="truncate text-xs text-slate-500">{row.jabatan || "—"}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[520px] text-left">
                <thead className="bg-[#F5F7FA]">
                  <tr>
                    <th className={TH}>Nama</th>
                    <th className={TH}>Jabatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {karyawan.map((row) => (
                    <tr key={row.id}>
                      <td className={`${TD} font-medium`}>{row.nama}</td>
                      <td className={TD}>{row.jabatan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-[#1E3A5F]">Item Divisi</h2>
          <span className="ml-auto text-xs text-[#6B7280]">{items.length} item</span>
        </div>
        {items.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">Belum ada item untuk divisi ini.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {items.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-slate-500">{row.kode}</p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-[#1F2937]">{row.nama}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.jenis ?? "—"} · {row.unit}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[680px] text-left">
                <thead className="bg-[#F5F7FA]">
                  <tr>
                    <th className={TH}>Kode</th>
                    <th className={TH}>Nama</th>
                    <th className={TH}>Jenis</th>
                    <th className={TH}>Satuan</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td className={`${TD} font-mono text-xs text-[#6B7280]`}>{row.kode}</td>
                      <td className={`${TD} font-medium`}>{row.nama}</td>
                      <td className={TD}>{row.jenis ?? "—"}</td>
                      <td className={TD}>{row.unit}</td>
                      <td className={TD}>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            row.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {row.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
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
