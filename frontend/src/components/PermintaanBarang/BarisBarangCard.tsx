import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faExclamationTriangle, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import type { Item } from "../../api/item";
import type { Baris } from "./types";
import { inputCls, labelCls, req } from "./formUi";
import { ItemSearchSelect } from "./ItemSearchSelect";

type Props = {
  b: Baris;
  index: number;
  canDelete: boolean;
  masterItems: Item[];
  error: string | null;
  onPick: (id: string) => void;
  onNama: (text: string) => void;
  onField: (field: keyof Baris, value: string) => void;
  onStep: (delta: 1 | -1) => void;
  onHapus: () => void;
};

export function BarisBarangCard({
  b,
  index: i,
  canDelete,
  masterItems,
  error: err,
  onPick,
  onNama,
  onField,
  onStep,
  onHapus,
}: Props) {
  return (
    <article
      aria-label={`Barang ${i + 1}`}
      className={`relative overflow-hidden rounded-xl border bg-white p-4 transition-all duration-200 shadow-sm sm:p-5 ${
        err ? "border-red-300 ring-2 ring-red-500/10" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Header Kartu Barang */}
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 font-mono text-xs font-black text-[#E30613]">
            {String(i + 1).padStart(2, "0")}
          </span>
          {b.itemId && (
            <span className="inline-flex items-center rounded-md bg-slate-900 px-2.5 py-1 font-mono text-[0.7rem] font-bold tracking-wider text-slate-100">
              KODE: {b.kode}
            </span>
          )}
          {b.divisi && (
            <span className="hidden rounded-md bg-slate-100 px-2.5 py-1 text-[0.7rem] font-semibold text-slate-600 sm:inline-block">
              {b.divisi}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onHapus}
          disabled={!canDelete}
          title={!canDelete ? "Minimal 1 barang harus tersedia" : `Hapus barang baris ${i + 1}`}
          aria-label={`Hapus barang baris ${i + 1}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-[#E30613] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-500"
        >
          <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
          <span>Hapus</span>
        </button>
      </div>

      {/* Input Utama */}
      <div className="space-y-4">
        {/* Pencarian / Input Barang */}
        <div>
          <label htmlFor={`b-barang-${i}`} className={labelCls}>
            Barang / Bahan {req}
          </label>
          <ItemSearchSelect
            items={masterItems}
            value={b.itemId}
            nama={b.nama}
            onPick={onPick}
            onNama={onNama}
            ariaLabel={`Nama barang baris ${i + 1}`}
            listId={`b-barang-${i}`}
            inputId={`b-barang-${i}`}
            className={`${inputCls} transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20`}
          />
          {b.itemId && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.72rem] text-slate-400">
              <FontAwesomeIcon icon={faInfoCircle} className="h-3 w-3 text-slate-400" />
              <span>Satuan &amp; divisi terkunci sesuai master katalog data barang.</span>
            </p>
          )}
        </div>

        {/* Grid Spesifikasi, Jumlah, dan Satuan */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          {/* Spesifikasi */}
          <div className="sm:col-span-6">
            <label htmlFor={`b-spek-${i}`} className={labelCls}>
              Spesifikasi{" "}
              <span className="font-normal text-slate-400">(merek / ukuran / warna)</span>
            </label>
            <input
              id={`b-spek-${i}`}
              value={b.spesifikasi}
              onChange={(e) => onField("spesifikasi", e.target.value)}
              placeholder="Contoh: Masker"
              className={`${inputCls} transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20`}
            />
          </div>

          {/* Jumlah dengan Stepper */}
          <div className="sm:col-span-3">
            <label htmlFor={`b-jml-${i}`} className={labelCls}>
              Jumlah {req}
            </label>
            <div className="flex items-stretch gap-1.5">
              <button
                type="button"
                onClick={() => onStep(-1)}
                aria-label={`Kurangi jumlah baris ${i + 1}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-lg font-black text-slate-700 transition hover:border-[#E30613] hover:bg-red-50/50 hover:text-[#E30613] active:scale-95"
              >
                −
              </button>
              <input
                id={`b-jml-${i}`}
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={b.jumlah}
                onChange={(e) => onField("jumlah", e.target.value)}
                placeholder="1"
                className={`${inputCls} text-center font-bold transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20`}
              />
              <button
                type="button"
                onClick={() => onStep(1)}
                aria-label={`Tambah jumlah baris ${i + 1}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-lg font-black text-slate-700 transition hover:border-[#E30613] hover:bg-red-50/50 hover:text-[#E30613] active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          {/* Satuan */}
          <div className="sm:col-span-3">
            <label htmlFor={`b-sat-${i}`} className={labelCls}>
              Satuan
            </label>
            <div className="relative flex items-center">
              <input
                id={`b-sat-${i}`}
                value={b.satuan}
                readOnly={Boolean(b.itemId)}
                onChange={(e) => onField("satuan", e.target.value)}
                placeholder="Pcs"
                title={b.itemId ? "Satuan mengikuti data barang" : undefined}
                className={`${inputCls} pr-12 transition ${
                  b.itemId
                    ? "cursor-not-allowed bg-slate-100 text-slate-500"
                    : "focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20"
                }`}
              />
              <span
                aria-hidden="true"
                className="absolute right-2 rounded bg-slate-800 px-2 py-0.5 text-[0.68rem] font-bold tracking-wider text-white uppercase"
              >
                {b.satuan.trim() || "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner Error Baris */}
      {err && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/80 p-3 text-xs font-semibold text-red-800"
        >
          <FontAwesomeIcon icon={faExclamationTriangle} className="h-3.5 w-3.5 shrink-0 text-[#E30613]" />
          <span>{err}</span>
        </div>
      )}
    </article>
  );
}