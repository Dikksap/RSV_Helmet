import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateRight,
  faPen,
  faPlus,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import {
  createGudang,
  deleteGudang,
  getGudangList,
  updateGudang,
  type Gudang as GudangMaster,
} from "../../api/gudang";
import { getStokGudang, type StokGudang } from "../../api/produksiHarian";

const buttonCls =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function namaGudang(lokasi: StokGudang["location"]) {
  return lokasi.gudang?.name ?? lokasi.name;
}

export default function Lokasi() {
  const [gudang, setGudang] = useState<StokGudang[]>([]);
  const [daftarGudang, setDaftarGudang] = useState<GudangMaster[]>([]);
  const [gudangTerpilih, setGudangTerpilih] = useState<number | null>(null);
  const [cariItem, setCariItem] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kelolaError, setKelolaError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formGudang, setFormGudang] = useState<{
    editing: GudangMaster | null;
    kode: string;
    name: string;
    isActive: boolean;
    busy: boolean;
  } | null>(null);

  const muatLokasi = useCallback(async (refresh = false, pilihGudangId?: number) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [rows, masterRows] = await Promise.all([getStokGudang(), getGudangList()]);
      setGudang(rows);
      setDaftarGudang(masterRows);
      setGudangTerpilih((current) =>
        pilihGudangId !== undefined && rows.some((row) => row.location.gudang?.id === pilihGudangId)
          ? rows.find((row) => row.location.gudang?.id === pilihGudangId)?.location.id ?? null
          : current !== null && rows.some((row) => row.location.id === current)
          ? current
          : rows[0]?.location.id ?? null,
      );
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal memuat lokasi gudang.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void muatLokasi();
  }, [muatLokasi]);

  const gudangAktif = gudang.find((row) => row.location.id === gudangTerpilih);
  const itemsTerfilter = useMemo(() => {
    const term = cariItem.trim().toLocaleLowerCase();
    return (gudangAktif?.items ?? []).filter((item) =>
      !term || `${item.kode} ${item.nama} ${item.jenis ?? ""}`.toLocaleLowerCase().includes(term),
    );
  }, [cariItem, gudangAktif]);

  const simpanGudang = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formGudang) return;
    const kode = formGudang.kode.trim().toUpperCase();
    const name = formGudang.name.trim();
    if (!kode || !name) {
      setKelolaError("Kode dan nama gudang wajib diisi.");
      return;
    }
    setFormGudang((current) => current && { ...current, busy: true });
    setKelolaError(null);
    try {
      const gudangTersimpan = formGudang.editing
        ? await updateGudang(formGudang.editing.id, { kode, name, isActive: formGudang.isActive })
        : await createGudang({ kode, name, isActive: formGudang.isActive });
      setFormGudang(null);
      setNotice(formGudang.editing ? "Gudang berhasil diperbarui." : "Gudang berhasil ditambahkan.");
      await muatLokasi(true, gudangTersimpan.id);
    } catch (reason) {
      setKelolaError(reason instanceof Error ? reason.message : "Gagal menyimpan data gudang.");
      setFormGudang((current) => current && { ...current, busy: false });
    }
  };

  const ubahStatusGudang = async (row: GudangMaster) => {
    if (row.isActive && !window.confirm(
      `Nonaktifkan gudang "${row.name}"? Gudang tidak lagi tersedia untuk transaksi baru, tetapi stok dan riwayat tetap disimpan.`,
    )) return;
    setKelolaError(null);
    try {
      if (row.isActive) {
        await deleteGudang(row.id);
        setNotice("Gudang dinonaktifkan. Saldo dan riwayatnya tetap tersimpan.");
      } else {
        await updateGudang(row.id, { isActive: true });
        setNotice("Gudang diaktifkan kembali.");
      }
      await muatLokasi(true, row.id);
    } catch (reason) {
      setKelolaError(reason instanceof Error ? reason.message : "Gagal mengubah status gudang.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Warehouse</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">
            Stok Item per Gudang
          </h1>
          <p className="mt-2 text-base text-[#6B7280]">
            Pilih gudang untuk melihat item dan saldo aktual di lokasi tersebut. Data saldo ini juga digunakan pada pilihan lokasi di proses produksi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFormGudang({ editing: null, kode: "", name: "", isActive: true, busy: false })}
            className={buttonCls}
          >
            <FontAwesomeIcon icon={faPlus} />
            Tambah gudang
          </button>
          <button
            type="button"
            onClick={() => void muatLokasi(true)}
            disabled={loading || refreshing}
            className={buttonCls}
          >
            <FontAwesomeIcon icon={faArrowRotateRight} spin={refreshing} />
            {refreshing ? "Memuat..." : "Muat ulang"}
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Gagal mengambil lokasi gudang: {error}
        </p>
      )}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {kelolaError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{kelolaError}</p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-extrabold text-[#1E3A5F]">Lokasi gudang aktif</h2>
            <p className="mt-1 text-xs text-slate-500">{gudang.length} gudang</p>
          </div>
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Memuat daftar gudang...</p>
        ) : gudang.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FontAwesomeIcon icon={faWarehouse} className="text-2xl text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Belum ada lokasi gudang aktif</p>
            <p className="mt-1 text-xs text-slate-500">
              Lokasi akan tampil di sini setelah gudang dipetakan sebagai lokasi inventory dan diaktifkan. Pastikan gudang sudah dipetakan pada menu Ledger Lokasi.
            </p>
          </div>
        ) : (
          <>
          <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2">
            {gudang.map((row) => {
              const terpilih = gudangTerpilih === row.location.id;
              return (
                <button
                  key={row.location.id}
                  type="button"
                  onClick={() => setGudangTerpilih(row.location.id)}
                  aria-pressed={terpilih}
                  className={`flex min-h-20 items-center gap-3 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    terpilih
                      ? "border-sky-600 bg-sky-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-sky-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    terpilih ? "bg-sky-700 text-white" : "bg-sky-50 text-sky-700"
                  }`}>
                    <FontAwesomeIcon icon={faWarehouse} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-slate-800">{namaGudang(row.location)}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {row.location.code} · {row.items.length} item bersaldo
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    terpilih ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                    {terpilih ? "Dipilih" : "Pilih"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Gudang</th>
                  <th className="px-5 py-3">Kode Lokasi</th>
                  <th className="px-5 py-3 text-right">Jenis item</th>
                  <th className="px-5 py-3 text-right">Item bersaldo</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gudang.map((row) => (
                  <tr
                    key={row.location.id}
                    className={gudangTerpilih === row.location.id ? "bg-sky-50" : "hover:bg-slate-50"}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                          <FontAwesomeIcon icon={faWarehouse} />
                        </span>
                        <span className="font-bold text-slate-700">
                          {namaGudang(row.location)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-slate-600">{row.location.code}</td>
                    <td className="px-5 py-4 text-right text-sm text-slate-600">
                      {new Set(row.items.map((item) => item.jenis).filter(Boolean)).size}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-slate-700">{row.items.length}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setGudangTerpilih(row.location.id)}
                        aria-pressed={gudangTerpilih === row.location.id}
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${
                          gudangTerpilih === row.location.id
                            ? "bg-sky-700 text-white"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {gudangTerpilih === row.location.id ? "Sedang dilihat" : "Lihat item"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      {gudangAktif && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-[#1E3A5F]">
                Item di {namaGudang(gudangAktif.location)}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Saldo per lokasi · {gudangAktif.items.length} item bersaldo
              </p>
            </div>
            <input
              type="search"
              value={cariItem}
              onChange={(event) => setCariItem(event.target.value)}
              placeholder="Cari kode, nama, atau jenis..."
              aria-label="Cari item di gudang"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:max-w-xs"
            />
          </div>
          {itemsTerfilter.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              {gudangAktif.items.length === 0
                ? "Belum ada item dengan saldo di gudang ini."
                : "Item tidak ditemukan."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Kode item</th>
                    <th className="px-5 py-3">Nama item</th>
                    <th className="px-5 py-3">Jenis</th>
                    <th className="px-5 py-3 text-right">Saldo</th>
                    <th className="px-5 py-3">Status master</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsTerfilter.map((item) => (
                    <tr key={item.itemId}>
                      <td className="px-5 py-3 font-mono text-sm text-slate-600">{item.kode}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-slate-700">{item.nama}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{item.jenis ?? "Tanpa jenis"}</td>
                      <td className="px-5 py-3 text-right text-sm font-extrabold tabular-nums text-[#1E3A5F]">
                        {item.quantity.toLocaleString("id-ID", { maximumFractionDigits: 6 })} {item.unit}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {item.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-extrabold text-[#1E3A5F]">Kelola master gudang</h2>
          <p className="mt-1 text-xs text-slate-500">
            Gudang baru otomatis dibuatkan sebagai lokasi inventory. Menonaktifkan gudang mempertahankan saldo serta riwayat mutasinya.
          </p>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Memuat master gudang...</p>
        ) : daftarGudang.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Belum ada data gudang.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Kode</th>
                  <th className="px-5 py-3">Nama gudang</th>
                  <th className="px-5 py-3">Barang master</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daftarGudang.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-sm text-slate-600">{row.kode}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-700">{row.name}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{row._count?.barang ?? 0}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {row.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setFormGudang({
                            editing: row,
                            kode: row.kode,
                            name: row.name,
                            isActive: row.isActive,
                            busy: false,
                          })}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <FontAwesomeIcon icon={faPen} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void ubahStatusGudang(row)}
                          className={`rounded-lg px-3 py-2 text-xs font-bold ${
                            row.isActive
                              ? "border border-red-200 text-red-700 hover:bg-red-50"
                              : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {row.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formGudang && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={(event) => void simpanGudang(event)}
            className="w-full max-w-lg space-y-5 rounded-2xl bg-white p-6 shadow-xl"
            aria-labelledby="gudang-form-title"
          >
            <div>
              <h2 id="gudang-form-title" className="text-xl font-bold text-[#1E3A5F]">
                {formGudang.editing ? "Edit gudang" : "Tambah gudang"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">Data ini digunakan sebagai master dan lokasi gudang inventory.</p>
            </div>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Kode gudang
              <input
                autoFocus
                required
                maxLength={50}
                value={formGudang.kode}
                onChange={(event) => setFormGudang((current) => current && { ...current, kode: event.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Nama gudang
              <input
                required
                maxLength={191}
                value={formGudang.name}
                onChange={(event) => setFormGudang((current) => current && { ...current, name: event.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={formGudang.isActive}
                onChange={(event) => setFormGudang((current) => current && { ...current, isActive: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-sky-600"
              />
              Gudang aktif
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setFormGudang(null)}
                disabled={formGudang.busy}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={formGudang.busy}
                className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {formGudang.busy ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
