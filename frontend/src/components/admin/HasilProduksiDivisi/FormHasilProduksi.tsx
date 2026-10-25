import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Divisi } from "../../../api/divisi";
import type { Item } from "../../../api/item";
import {
  createHasilProduksiHarian,
  getWipHasilProduksiHarian,
  HasilProduksiApiError,
  type HasilProduksiRecord,
  type WipRow,
} from "../../../api/hasilProduksiHarian";
import { CARD, FIELD, btnPrimary, miniBtn } from "./ui";
import {
  adaError,
  angka,
  barisBaru,
  barisKosong,
  formatWip,
  hariIni,
  hitungKekuranganWip,
  kelompokkanItem,
  ringkasForm,
  totalPerItem,
  validasiInputProduksi,
  type BarisError,
  type BarisForm,
  type FormErrors,
} from "./utils";

interface Props {
  divisis: Divisi[];
  items: Item[];
  divisiId: number | null;
  kunciDivisi?: boolean;
  wipRows: WipRow[];
  wipLoading: boolean;
  wipError: string | null;
  onRetryWip: () => void;
  onDivisiChange: (id: number) => void;
  onSaved: (record: HasilProduksiRecord) => void;
  onLihatRiwayat: () => void;
}

interface OpsiBaris {
  id: number;
  kode: string;
  nama: string;
  unit: string;
}

interface DaftarBarisProps {
  judul: string;
  deskripsi: string;
  rows: BarisForm[];
  errors: Record<string, BarisError>;
  opsi: OpsiBaris[];
  wipSaldo?: Record<number, number>;
  bolehTambah: boolean;
  catatanTerbuka: Record<string, boolean>;
  onTambah: () => void;
  onUbah: (key: string, patch: Partial<BarisForm>) => void;
  onHapus: (key: string) => void;
  onBukaCatatan: (key: string) => void;
}

interface SuksesProduksi {
  nomor: string;
  itemInput: string | null;
  unitInput: string | null;
  wipAkhir: number | null;
  hasil: { nama: string; jumlah: number; unit: string }[];
}

function DaftarBaris({
  judul,
  deskripsi,
  rows,
  errors,
  opsi,
  wipSaldo,
  bolehTambah,
  catatanTerbuka,
  onTambah,
  onUbah,
  onHapus,
  onBukaCatatan,
}: DaftarBarisProps) {
  const totalMasuk = wipSaldo ? totalPerItem(rows) : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-[#F9FAFC] p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#1E3A5F]">{judul}</h3>
          <p className="mt-1 text-xs text-[#6B7280]">{deskripsi}</p>
        </div>
        {bolehTambah && (
          <button type="button" onClick={onTambah} className={miniBtn}>
            + Tambah baris
          </button>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-sm text-[#6B7280]">
            Belum ada baris. Klik “Tambah baris” untuk mulai.
          </p>
        ) : (
          rows.map((row, index) => {
            const rowError = errors[row.key];
            const item = opsi.find((data) => data.id === Number(row.itemId));
            const catatanTampil = catatanTerbuka[row.key] || Boolean(row.keterangan);
            const wipTersedia = item && wipSaldo ? wipSaldo[item.id] ?? 0 : null;
            const masukItem = item && totalMasuk ? totalMasuk.get(item.id) ?? 0 : null;
            const wipKurang =
              wipTersedia !== null && masukItem !== null && masukItem > wipTersedia;

            return (
              <div key={row.key} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_130px_auto] lg:items-end">
                  <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-[#1F2937]">
                    Item
                    <select
                      value={row.itemId}
                      onChange={(event) => onUbah(row.key, { itemId: event.target.value })}
                      className={`${FIELD} w-full`}
                      aria-label={`Item ${judul} baris ${index + 1}`}
                    >
                      <option value="">Pilih item...</option>
                      {opsi.map((data) => (
                        <option key={data.id} value={data.id}>
                          {data.kode} — {data.nama} ({data.unit})
                        </option>
                      ))}
                    </select>
                    {item && (
                      <span className="text-xs font-normal text-[#6B7280]">
                        Satuan: {item.unit}
                        {wipTersedia !== null && masukItem !== null ? (
                          <>
                            {" · WIP tersedia: "}
                            {formatWip(wipTersedia, item.unit)}
                            {" · MASUK: "}
                            {formatWip(masukItem, item.unit)}
                            <span className={wipKurang ? " font-semibold text-amber-700" : " font-semibold text-emerald-700"}>
                              {wipKurang
                                ? ` · Kurang ${formatWip(masukItem - wipTersedia, item.unit)}`
                                : " · Cukup"}
                            </span>
                          </>
                        ) : null}
                      </span>
                    )}
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-medium text-[#1F2937]">
                    Jumlah
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={row.jumlah}
                      onChange={(event) => onUbah(row.key, { jumlah: event.target.value })}
                      placeholder="0"
                      className={`${FIELD} w-full text-right tabular-nums`}
                      aria-label={`Jumlah ${judul} baris ${index + 1}`}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => onHapus(row.key)}
                    className="h-[46px] rounded-lg px-3 text-sm font-semibold text-[#EF4444] ring-1 ring-red-200 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-[#EF4444]"
                    aria-label={`Hapus baris ${index + 1}`}
                  >
                    Hapus
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {catatanTampil ? (
                    <input
                      type="text"
                      value={row.keterangan}
                      onChange={(event) => onUbah(row.key, { keterangan: event.target.value })}
                      placeholder="Catatan baris (opsional)"
                      className={`${FIELD} w-full max-w-md text-sm`}
                      aria-label={`Catatan baris ${index + 1}`}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onBukaCatatan(row.key)}
                      className="text-xs font-semibold text-[#00A8E8] hover:underline"
                    >
                      + Catatan
                    </button>
                  )}
                  {rowError?.itemId && (
                    <p role="alert" className="text-xs font-medium text-[#EF4444]">
                      {rowError.itemId}
                    </p>
                  )}
                  {rowError?.jumlah && (
                    <p role="alert" className="text-xs font-medium text-[#EF4444]">
                      {rowError.jumlah}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        {opsi.length === 0 && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Belum ada pilihan item untuk divisi ini. Lengkapi WIP/material atau master item terlebih dahulu.
          </p>
        )}
      </div>
    </section>
  );
}

export default function FormHasilProduksi({
  divisis,
  items,
  divisiId,
  kunciDivisi = false,
  wipRows,
  wipLoading,
  wipError,
  onRetryWip,
  onDivisiChange,
  onSaved,
  onLihatRiwayat,
}: Props) {
  const [inputRows, setInputRows] = useState<BarisForm[]>(() => [barisBaru()]);
  const [hasilRows, setHasilRows] = useState<BarisForm[]>(() => [barisBaru()]);
  const [tanggal, setTanggal] = useState(hariIni);
  const [keterangan, setKeterangan] = useState("");
  const [catatanTerbuka, setCatatanTerbuka] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<FormErrors>({ input: {}, hasil: {} });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuksesProduksi | null>(null);
  const [wipKurang, setWipKurang] = useState<HasilProduksiApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [konfirmasi, setKonfirmasi] = useState(false);

  const ringkasan = useMemo(() => ringkasForm(inputRows, hasilRows), [inputRows, hasilRows]);
  const wipSaldo = useMemo(
    () => Object.fromEntries(wipRows.map((row) => [row.itemId, angka(row.saldoAkhir)])),
    [wipRows],
  );
  const kurang = useMemo(() => hitungKekuranganWip(inputRows, wipSaldo), [inputRows, wipSaldo]);
  const divisiNama = divisis.find((divisi) => divisi.id === divisiId)?.nama ?? null;
  const opsiInput = useMemo<OpsiBaris[]>(
    () => wipRows.map((row) => ({ id: row.itemId, kode: row.kode, nama: row.nama, unit: row.unit })),
    [wipRows],
  );
  const opsiHasil = useMemo<OpsiBaris[]>(
    () =>
      kelompokkanItem(
        items.filter((item) => item.isActive),
        divisiId,
      ).utama.map((item) => ({
        id: item.id,
        kode: item.kode,
        nama: item.nama,
        unit: item.unit,
      })),
    [items, divisiId],
  );
  const namaItem = (itemId: number) =>
    wipRows.find((row) => row.itemId === itemId)?.nama ??
    items.find((item) => item.id === itemId)?.nama ??
    `Item ${itemId}`;

  const gantiDivisi = (id: number) => {
    if (id === divisiId) return;
    const adaIsian =
      inputRows.some((row) => row.itemId || row.jumlah || row.keterangan) ||
      hasilRows.some((row) => row.itemId || row.jumlah || row.keterangan);
    if (adaIsian && !window.confirm("Ganti divisi akan mengosongkan baris yang belum disimpan. Lanjut?")) {
      return;
    }
    onDivisiChange(id);
    setInputRows([barisBaru()]);
    setHasilRows([barisBaru()]);
    setCatatanTerbuka({});
    setErrors({ input: {}, hasil: {} });
    setError(null);
    setWipKurang(null);
    setSuccess(null);
  };

  const ubahBaris = (jenis: "input" | "hasil", key: string, patch: Partial<BarisForm>) => {
    const setter = jenis === "input" ? setInputRows : setHasilRows;
    setter((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setErrors((prev) => ({ ...prev, umum: undefined, [jenis]: {} }));
    setError(null);
    setWipKurang(null);
    setSuccess(null);
  };

  const tambahBaris = (jenis: "input" | "hasil", itemId?: number) => {
    const row = { ...barisBaru(), ...(itemId ? { itemId: String(itemId) } : {}) };
    const setter = jenis === "input" ? setInputRows : setHasilRows;
    setter((prev) => [...prev, row]);
    setErrors((prev) => ({ ...prev, umum: undefined, [jenis]: {} }));
    setError(null);
    setWipKurang(null);
    setSuccess(null);
  };

  const hapusBaris = (jenis: "input" | "hasil", key: string) => {
    const setter = jenis === "input" ? setInputRows : setHasilRows;
    setter((prev) => prev.filter((row) => row.key !== key));
    setCatatanTerbuka((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setErrors((prev) => ({ ...prev, umum: undefined, [jenis]: {} }));
    setError(null);
    setWipKurang(null);
    setSuccess(null);
  };

  const bukaCatatan = (key: string) => {
    setCatatanTerbuka((prev) => ({ ...prev, [key]: true }));
  };

  const cekForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;
    setError(null);
    setSuccess(null);
    setWipKurang(null);

    const nextErrors = validasiInputProduksi(divisiId, inputRows, hasilRows);
    setErrors(nextErrors);
    if (adaError(nextErrors) || !divisiId) return;
    if (wipLoading) {
      setError("WIP divisi masih dimuat. Tunggu sebentar lalu coba lagi.");
      return;
    }
    if (wipError) {
      setError(`WIP divisi gagal dimuat: ${wipError}`);
      return;
    }
    setKonfirmasi(true);
  };

  const simpan = async () => {
    if (savingRef.current || !divisiId) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setWipKurang(null);
    try {
      const record = await createHasilProduksiHarian({
        divisiId,
        ...(tanggal ? { tanggalProduksi: tanggal } : {}),
        keterangan: keterangan.trim() || null,
        items: [
          ...inputRows
            .filter((row) => !barisKosong(row))
            .map((row) => ({
              itemId: Number(row.itemId),
              tipe: "MASUK" as const,
              jumlah: Number(row.jumlah),
              keterangan: row.keterangan.trim() || null,
            })),
          ...hasilRows
            .filter((row) => !barisKosong(row))
            .map((row) => ({
              itemId: Number(row.itemId),
              tipe: "HASIL" as const,
              jumlah: Number(row.jumlah),
              keterangan: row.keterangan.trim() || null,
            })),
        ],
      });

      const inputDetail = record.items.find((item) => item.tipe === "MASUK") ?? null;
      let wipAkhir: number | null = null;
      if (inputDetail) {
        try {
          const wip = await getWipHasilProduksiHarian({
            divisiId: record.divisiId,
            itemId: inputDetail.itemId,
            sampai: record.tanggalProduksi,
          });
          wipAkhir = wip.data[0] ? angka(wip.data[0].saldoAkhir) : 0;
        } catch {
          wipAkhir = null;
        }
      }

      setSuccess({
        nomor: record.nomor,
        itemInput: inputDetail?.item.nama ?? null,
        unitInput: inputDetail?.item.unit ?? null,
        wipAkhir,
        hasil: record.items
          .filter((item) => item.tipe === "HASIL")
          .map((item) => ({
            nama: item.item.nama,
            jumlah: angka(item.jumlah),
            unit: item.item.unit,
          })),
      });
      setKonfirmasi(false);
      setInputRows([barisBaru()]);
      setHasilRows([barisBaru()]);
      setCatatanTerbuka({});
      setKeterangan("");
      setErrors({ input: {}, hasil: {} });
      onSaved(record);
    } catch (err) {
      setKonfirmasi(false);
      if (err instanceof HasilProduksiApiError && err.kode === "WIP_KURANG") {
        setWipKurang(err);
      } else {
        setError(err instanceof Error ? err.message : "Gagal menyimpan hasil produksi.");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const ringkasBaris = (rows: BarisForm[], opsi: OpsiBaris[]) =>
    rows
      .filter((row) => !barisKosong(row))
      .map((row) => {
        const item = opsi.find((data) => data.id === Number(row.itemId));
        return {
          key: row.key,
          nama: item?.nama ?? "Item belum dipilih",
          jumlah: Number(row.jumlah),
          unit: item?.unit ?? "",
        };
      });

  return (
    <section className={`${CARD} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1E3A5F]">Input Produksi Harian</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#6B7280]">
            Catat material yang diproses dan hasil produksi pada hari itu. Nomor transaksi dibuat otomatis oleh backend.
          </p>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
          Input per divisi
        </span>
      </div>

      <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-800">
        Input produksi memakai WIP divisi. Stok input sudah dikurangi saat approval/pemakaian, jadi simpan produksi tidak
        membuat pengurangan stok kedua.
      </p>

      <form onSubmit={cekForm} className="mt-5 space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-[#1F2937]">1. Divisi</legend>
          {kunciDivisi ? (
            <p className="inline-flex rounded-lg bg-[#E6F6FD] px-3 py-2 text-sm font-semibold text-[#0077A8]">
              {divisiNama ?? "Divisi aktif"}
            </p>
          ) : divisis.length === 0 ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Belum ada divisi. Tambahkan divisi terlebih dahulu di menu Kelola Divisi.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {divisis.map((divisi) => {
                const aktif = divisi.id === divisiId;
                return (
                  <button
                    key={divisi.id}
                    type="button"
                    onClick={() => gantiDivisi(divisi.id)}
                    aria-pressed={aktif}
                    className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8] ${
                      aktif
                        ? "bg-[#1E3A5F] text-white shadow-sm"
                        : "bg-white text-[#1F2937] ring-1 ring-slate-200 hover:bg-[#F5F7FA]"
                    }`}
                  >
                    {divisi.nama}
                  </button>
                );
              })}
            </div>
          )}
          {errors.divisi && (
            <p role="alert" className="mt-2 text-sm text-[#EF4444]">
              {errors.divisi}
            </p>
          )}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <label className="flex flex-col gap-1 text-sm font-semibold text-[#1F2937]">
            Tanggal produksi
            <input
              type="date"
              value={tanggal}
              onChange={(event) => setTanggal(event.target.value)}
              className={`${FIELD} w-full`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-[#1F2937]">
            Keterangan header
            <input
              type="text"
              value={keterangan}
              onChange={(event) => setKeterangan(event.target.value)}
              placeholder="Opsional"
              className={`${FIELD} w-full`}
            />
          </label>
        </div>

        {wipLoading && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Memuat WIP divisi {divisiNama ?? ""}...
          </p>
        )}
        {wipError && (
          <div role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-sm text-[#EF4444]">
            <p>Gagal memuat WIP divisi: {wipError}</p>
            <button type="button" onClick={onRetryWip} className={`${miniBtn} mt-2`}>
              Muat ulang WIP
            </button>
          </div>
        )}

        <DaftarBaris
          judul="2. Item Input"
          deskripsi="Pilih satu material dari WIP divisi ini. Baris ini hanya mencatat aktivitas; tidak membuat mutasi KELUAR baru."
          rows={inputRows}
          errors={errors.input}
          opsi={opsiInput}
          wipSaldo={wipSaldo}
          bolehTambah={inputRows.length === 0}
          catatanTerbuka={catatanTerbuka}
          onTambah={() => tambahBaris("input")}
          onUbah={(key, patch) => ubahBaris("input", key, patch)}
          onHapus={(key) => hapusBaris("input", key)}
          onBukaCatatan={bukaCatatan}
        />

        {kurang.length > 0 && (
          <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p className="font-semibold">WIP kurang untuk input ini:</p>
            <ul className="mt-1 list-inside list-disc text-xs">
              {kurang.map((row) => (
                <li key={row.itemId}>
                  {namaItem(row.itemId)}: butuh {row.jumlah.toLocaleString("id-ID")}, WIP{" "}
                  {row.wip.toLocaleString("id-ID")}, kurang {row.kekurangan.toLocaleString("id-ID")}.
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs">
              Sistem akan membuat Permintaan Barang otomatis saat disimpan. Setelah disetujui, ulangi input produksi ini.
            </p>
          </div>
        )}

        <DaftarBaris
          judul="3. Item Hasil Produksi"
          deskripsi="Item yang dihasilkan oleh divisi ini. Setiap baris menambah stok lewat mutasi MASUK."
          rows={hasilRows}
          errors={errors.hasil}
          opsi={opsiHasil}
          bolehTambah
          catatanTerbuka={catatanTerbuka}
          onTambah={() => tambahBaris("hasil")}
          onUbah={(key, patch) => ubahBaris("hasil", key, patch)}
          onHapus={(key) => hapusBaris("hasil", key)}
          onBukaCatatan={bukaCatatan}
        />

        {errors.umum && (
          <p role="alert" className="text-sm text-[#EF4444]">
            {errors.umum}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-sky-50 px-3 py-1.5 font-semibold text-sky-700 ring-1 ring-sky-200">
              Input {ringkasan.input.toLocaleString("id-ID")}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Hasil {ringkasan.hasil.toLocaleString("id-ID")}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 ring-1 ring-slate-200">
              Selisih {ringkasan.selisih.toLocaleString("id-ID")}
            </span>
          </div>
          <button
            type="submit"
            disabled={saving || divisis.length === 0 || wipLoading || Boolean(wipError)}
            className={`${btnPrimary} w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {saving ? "Menyimpan..." : `Simpan Produksi${divisiNama ? ` — ${divisiNama}` : ""}`}
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-sm text-[#EF4444]">
            {error}
          </p>
        )}

        {wipKurang && (
          <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            <p className="font-bold">Produksi belum disimpan: WIP kurang.</p>
            <p className="mt-1">{wipKurang.message}</p>
            {wipKurang.dataKekurangan && (
              <p className="mt-1 text-xs">
                Butuh {wipKurang.dataKekurangan.jumlahMasuk.toLocaleString("id-ID")}{" "}
                {wipKurang.dataKekurangan.unit}, WIP{" "}
                {wipKurang.dataKekurangan.wipTersedia.toLocaleString("id-ID")}{" "}
                {wipKurang.dataKekurangan.unit}, kurang{" "}
                {wipKurang.dataKekurangan.kekurangan.toLocaleString("id-ID")}{" "}
                {wipKurang.dataKekurangan.unit}.
              </p>
            )}
            {wipKurang.saranTransfer ? (
              <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                <p>
                  <strong>Material SM memakai WIP, bukan stok gudang.</strong>{" "}
                  {wipKurang.saranTransfer.divisiAsalNama
                    ? `Minta transfer dari divisi ${wipKurang.saranTransfer.divisiAsalNama}.`
                    : "Gunakan Transfer WIP dari divisi pemilik item."}
                </p>
                <Link
                  to="/divisi/transfer-wip"
                  className="mt-1 inline-block font-semibold text-[#0077A8] underline hover:text-[#00A8E8]"
                >
                  Buka Transfer WIP
                </Link>
              </div>
            ) : wipKurang.permintaanBarang ? (
              <p className="mt-2">
                Permintaan Barang otomatis:{" "}
                <strong>{wipKurang.permintaanBarang.nomor}</strong>{" "}
                <Link
                  to="/admin/permintaan-barang"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#1E3A5F] underline hover:text-[#00A8E8]"
                >
                  Buka halaman approval
                </Link>
              </p>
            ) : (
              <p className="mt-2 text-xs">
                Permintaan Barang otomatis tidak terbentuk.
                {wipKurang.errorPermintaan ? ` ${wipKurang.errorPermintaan}` : ""}
              </p>
            )}
            <p className="mt-2 text-xs">
              Form tidak direset. Setelah WIP tersedia atau transfer disetujui, tekan Simpan lagi.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={onRetryWip} className={miniBtn}>
                Muat ulang WIP
              </button>
              <button type="button" onClick={() => setWipKurang(null)} className={miniBtn}>
                Tutup
              </button>
            </div>
          </div>
        )}

        {success && (
          <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <p>
              Tersimpan: <strong>{success.nomor}</strong>.
            </p>
            <p className="mt-1">
              {success.itemInput ? `${success.itemInput}: WIP akhir ` : "WIP akhir: "}
              {success.wipAkhir === null
                ? "tidak tersedia"
                : formatWip(success.wipAkhir, success.unitInput ?? "")}
            </p>
            {success.hasil.length > 0 && (
              <p className="mt-1">
                Hasil:{" "}
                {success.hasil
                  .map((item) => `${item.nama} ${formatWip(item.jumlah, item.unit)}`)
                  .join(", ")}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={onLihatRiwayat} className={miniBtn}>
                Lihat riwayat
              </button>
              <button type="button" onClick={() => setSuccess(null)} className={miniBtn}>
                Tutup
              </button>
            </div>
          </div>
        )}
      </form>

      {konfirmasi && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0F1C2E]/50 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi simpan produksi"
          onClick={() => {
            if (!saving) setKonfirmasi(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#1E3A5F]">Konfirmasi Simpan</h3>
            <p className="mt-1 text-sm text-[#6B7280]">
              Periksa ringkasan sebelum menyimpan transaksi produksi.
            </p>
            <dl className="mt-4 space-y-2 rounded-lg bg-[#F5F7FA] p-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[#6B7280]">Divisi</dt>
                <dd className="font-semibold text-[#1F2937]">{divisiNama ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#6B7280]">Tanggal</dt>
                <dd className="font-semibold text-[#1F2937]">{tanggal || "Hari ini"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#6B7280]">Total input</dt>
                <dd className="font-semibold text-sky-700">{ringkasan.input.toLocaleString("id-ID")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#6B7280]">Total hasil</dt>
                <dd className="font-semibold text-emerald-700">{ringkasan.hasil.toLocaleString("id-ID")}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                <dt className="text-[#6B7280]">Selisih (hasil − input)</dt>
                <dd className="font-bold text-[#1E3A5F]">{ringkasan.selisih.toLocaleString("id-ID")}</dd>
              </div>
            </dl>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Input</p>
                <ul className="mt-1 space-y-1 text-sm text-[#1F2937]">
                  {ringkasBaris(inputRows, opsiInput).map((row) => (
                    <li key={row.key}>
                      {row.nama}: {formatWip(row.jumlah, row.unit)}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Hasil</p>
                <ul className="mt-1 space-y-1 text-sm text-[#1F2937]">
                  {ringkasBaris(hasilRows, opsiHasil).map((row) => (
                    <li key={row.key}>
                      {row.nama}: {formatWip(row.jumlah, row.unit)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {kurang.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p className="font-semibold">WIP kurang.</p>
                <p className="mt-1 text-xs">
                  Material SM memakai Transfer WIP; material non-SM membuat Permintaan Barang otomatis sebesar
                  kekurangan. Setelah WIP tersedia, ulangi input produksi ini.
                </p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {kurang.map((row) => (
                    <li key={row.itemId}>
                      {namaItem(row.itemId)}: kurang {row.kekurangan.toLocaleString("id-ID")}.
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-3 text-xs text-[#6B7280]">
              Nomor transaksi akan dibuat otomatis setelah data berhasil disimpan.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setKonfirmasi(false)} disabled={saving} className={miniBtn}>
                Batal
              </button>
              <button
                type="button"
                onClick={() => void simpan()}
                disabled={saving}
                className={`${btnPrimary} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {saving ? "Menyimpan..." : "Konfirmasi Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
