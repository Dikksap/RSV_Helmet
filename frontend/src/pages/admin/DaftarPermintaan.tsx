import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faChevronDown, faTrash, faMagnifyingGlass, faUndo } from "@fortawesome/free-solid-svg-icons";
import {
  listPermintaan,
  setApprovalPermintaan,
  deletePermintaan,
  type ApprovalPermintaan,
  type PermintaanBarangRecord,
} from "../../api/permintaanBarang";

const inputCls = "w-full rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/30";

const approvalBadge = (s: ApprovalPermintaan) =>
  s === "DISETUJUI"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-amber-100 text-amber-800";

const approvalLabel = (s: ApprovalPermintaan) =>
  s === "DISETUJUI" ? "Disetujui" : "Belum disetujui";

const formatTanggal = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

const ringkasIsi = (r: PermintaanBarangRecord) => {
  const pcs = r.items.reduce((n, i) => n + i.jumlah, 0);
  return `${r.items.length} barang · ${pcs.toLocaleString("id-ID")} pcs`;
};

type FilterStatus = "SEMUA" | ApprovalPermintaan;

export default function DaftarPermintaan() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("SEMUA");
  const [rows, setRows] = useState<PermintaanBarangRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 3000); };

  const load = useCallback(async (status: FilterStatus) => {
    setLoading(true);
    try {
      const res = await listPermintaan({
        limit: 100,
        ...(status === "SEMUA" ? {} : { approval: status }),
      });
      setRows(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat daftar permintaan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load("SEMUA"); }, [load]);

  const changeFilter = (status: FilterStatus) => {
    setFilter(status);
    void load(status);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.noPermintaan.toLowerCase().includes(q) ||
      r.namaPeminta.toLowerCase().includes(q) ||
      r.departemen.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const setujui = async (r: PermintaanBarangRecord) => {
    if (!window.confirm(`Setujui permintaan ${r.noPermintaan}? Data terkunci setelah disetujui.`)) return;
    setBusyId(r.id);
    try {
      await setApprovalPermintaan(r.id, "DISETUJUI");
      flash(`Permintaan ${r.noPermintaan} disetujui.`);
      await load(filter);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal menyetujui.");
    } finally {
      setBusyId(null);
    }
  };

  const batalkan = async (r: PermintaanBarangRecord) => {
    if (!window.confirm(`Batalkan persetujuan ${r.noPermintaan}? Data bisa diubah lagi.`)) return;
    setBusyId(r.id);
    try {
      await setApprovalPermintaan(r.id, "BELUM_DISETUJUI");
      flash(`Persetujuan ${r.noPermintaan} dibatalkan.`);
      await load(filter);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal membatalkan.");
    } finally {
      setBusyId(null);
    }
  };

  const hapus = async (r: PermintaanBarangRecord) => {
    if (!window.confirm(`Hapus permintaan ${r.noPermintaan}?`)) return;
    setBusyId(r.id);
    try {
      await deletePermintaan(r.id);
      flash(`Permintaan ${r.noPermintaan} dihapus.`);
      await load(filter);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal hapus.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Warehouse</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Daftar Permintaan</h1>
          <p className="mt-2 text-base text-[#6B7280]">Permintaan barang dari form publik. Setujui untuk mengunci, atau hapus bila belum disetujui.</p>
        </div>
      </header>

      <div aria-live="polite" className="space-y-3">
        {loading && <p className="animate-pulse text-[15px] text-[#6B7280]">Memuat daftar permintaan...</p>}
        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[#1F2937]">{notice}</p>}
      </div>

      {!loading && !error && (
        <main className="space-y-4">
          <section className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="grid gap-4 lg:max-w-2xl lg:grid-cols-2">
              <div>
                <label htmlFor="permintaan-search" className="mb-1 block text-sm font-medium text-[#1F2937]">Cari permintaan</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <input id="permintaan-search" type="search" className={`${inputCls} pl-9`} placeholder="cth: PR-20261006 / Budi / Produksi..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div>
                <label htmlFor="permintaan-filter" className="mb-1 block text-sm font-medium text-[#1F2937]">Status</label>
                <select id="permintaan-filter" className={inputCls} value={filter} onChange={(e) => changeFilter(e.target.value as FilterStatus)}>
                  <option value="SEMUA">Semua</option>
                  <option value="BELUM_DISETUJUI">Belum disetujui</option>
                  <option value="DISETUJUI">Disetujui</option>
                </select>
              </div>
            </div>
            <p className="mt-3 text-[13px] text-[#6B7280]">{filtered.length}/{rows.length} tampil</p>
          </section>

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead className="bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">No. Permintaan</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Tanggal</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Departemen / Peminta</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Isi</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Prioritas</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-8 text-center italic text-[#6B7280]">Belum ada permintaan.</td></tr>
                  ) : filtered.map((r) => {
                    const open = expanded === r.id;
                    const busy = busyId === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr className="text-[15px] hover:bg-[#F5F7FA]">
                          <td className="px-6 py-4">
                            <button type="button" onClick={() => setExpanded(open ? null : r.id)} className="inline-flex items-center gap-1.5 font-mono font-semibold text-[#1E3A5F] hover:underline" aria-expanded={open}>
                              {r.noPermintaan}
                              <FontAwesomeIcon icon={faChevronDown} className={`h-3 w-3 text-[#6B7280] transition-transform ${open ? "rotate-180" : ""}`} />
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-[#6B7280]">{formatTanggal(r.tanggal)}</td>
                          <td className="px-6 py-4 text-[#1F2937]">{r.departemen}<span className="block text-[13px] text-[#6B7280]">{r.namaPeminta}</span></td>
                          <td className="whitespace-nowrap px-6 py-4 tabular-nums text-[#6B7280]">{ringkasIsi(r)}</td>
                          <td className="px-6 py-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.prioritas === "Urgent" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-500"}`}>{r.prioritas}</span></td>
                          <td className="px-6 py-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${approvalBadge(r.approval)}`}>{approvalLabel(r.approval)}</span></td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-1">
                              {r.approval === "BELUM_DISETUJUI" ? (
                                <>
                                  <button type="button" aria-label={`Setujui ${r.noPermintaan}`} title="Setujui" disabled={busy} onClick={() => void setujui(r)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"><FontAwesomeIcon icon={faCheck} className="h-4 w-4" /></button>
                                  <button type="button" aria-label={`Hapus ${r.noPermintaan}`} title="Hapus" disabled={busy} onClick={() => void hapus(r)} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#EF4444]/10 hover:text-[#EF4444] disabled:opacity-40"><FontAwesomeIcon icon={faTrash} className="h-4 w-4" /></button>
                                </>
                              ) : (
                                <button type="button" aria-label={`Batalkan persetujuan ${r.noPermintaan}`} title="Batalkan persetujuan" disabled={busy} onClick={() => void batalkan(r)} className="rounded-lg p-2 text-[#1E3A5F] hover:bg-[#1E3A5F]/5 disabled:opacity-40"><FontAwesomeIcon icon={faUndo} className="h-4 w-4" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-[#F5F7FA]/60">
                            <td colSpan={7} className="px-6 py-4">
                              <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                                <div className="flex gap-2"><dt className="w-36 shrink-0 text-[#6B7280]">Kebutuhan</dt><dd className="text-[#1F2937]">{r.kebutuhanUntuk}</dd></div>
                                <div className="flex gap-2"><dt className="w-36 shrink-0 text-[#6B7280]">Dibutuhkan</dt><dd className="text-[#1F2937]">{formatTanggal(r.tanggalDibutuhkan)}</dd></div>
                                <div className="flex gap-2 sm:col-span-2"><dt className="w-36 shrink-0 text-[#6B7280]">Alasan</dt><dd className="text-[#1F2937]">{r.alasan}</dd></div>
                              </dl>
                              <table className="mt-3 w-full text-left text-sm">
                                <thead className="text-[#6B7280]">
                                  <tr>
                                    <th className="py-1 pr-4 text-xs font-semibold uppercase tracking-wider">Barang</th>
                                    <th className="py-1 pr-4 text-xs font-semibold uppercase tracking-wider">Spesifikasi</th>
                                    <th className="py-1 text-right text-xs font-semibold uppercase tracking-wider">Jumlah</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {r.items.map((it) => (
                                    <tr key={it.id}>
                                      <td className="py-1.5 pr-4 font-medium text-[#1F2937]">{it.nama}</td>
                                      <td className="py-1.5 pr-4 text-[#6B7280]">{it.spesifikasi || "-"}</td>
                                      <td className="py-1.5 text-right tabular-nums text-[#1F2937]">{it.jumlah.toLocaleString("id-ID")} {it.satuan || ""}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
