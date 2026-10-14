import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
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
      className="rounded-lg border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[1rem] font-black text-[#E30613]">
            {String(i + 1).padStart(2, "0")}
          </span>
          {b.itemId ? (
            <span className="truncate rounded bg-[#0B0B0B] px-2 py-0.5 font-mono text-[0.75rem] font-bold text-white">
              {b.kode}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onHapus}
          disabled={!canDelete}
          title={!canDelete ? "Minimal 1 barang harus tersedia" : `Hapus barang baris ${i + 1}`}
          aria-label={`Hapus barang baris ${i + 1}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E5E5] px-3 py-2 text-[0.8rem] font-bold text-[#A3A3A3] transition hover:border-[#E30613] hover:bg-[#E30613]/10 hover:text-[#E30613] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E30613]/40"
        >
          <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
          Hapus
        </button>
      </div>

      <div className="mb-3">
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
          className={inputCls}
        />
        {b.itemId && (
          <p className="mt-1 text-[0.75rem] text-[#A3A3A3]">
            Satuan mengikuti data barang.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`b-spek-${i}`} className={labelCls}>
            Spesifikasi <span className="font-normal normal-case text-[#A3A3A3]">(merek / ukuran / keterangan)</span>
          </label>
          <input
            id={`b-spek-${i}`}
            value={b.spesifikasi}
            onChange={(e) => onField("spesifikasi", e.target.value)}
            placeholder="Merek / ukuran / keterangan tambahan"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor={`b-jml-${i}`} className={labelCls}>
            Jumlah {req}
          </label>
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => onStep(-1)}
              aria-label={`Kurangi jumlah baris ${i + 1}`}
              className="grid h-[46px] w-11 shrink-0 place-items-center rounded-lg border border-[#DADADA] bg-white text-xl font-black text-[#171717] transition hover:border-[#E30613] hover:text-[#E30613] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E30613]/40"
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
              placeholder="0"
              className={`${inputCls} text-center font-bold`}
            />
            <button
              type="button"
              onClick={() => onStep(1)}
              aria-label={`Tambah jumlah baris ${i + 1}`}
              className="grid h-[46px] w-11 shrink-0 place-items-center rounded-lg border border-[#DADADA] bg-white text-xl font-black text-[#171717] transition hover:border-[#E30613] hover:text-[#E30613] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E30613]/40"
            >
              +
            </button>
          </div>
        </div>
        <div>
          <label htmlFor={`b-sat-${i}`} className={labelCls}>
            Satuan
          </label>
          <div className="flex items-stretch gap-2">
            <input
              id={`b-sat-${i}`}
              value={b.satuan}
              readOnly={Boolean(b.itemId)}
              onChange={(e) => onField("satuan", e.target.value)}
              placeholder="Pcs"
              title={b.itemId ? "Satuan mengikuti data barang" : undefined}
              className={`${inputCls} disabled:bg-[#F3F3F3]`}
            />
            <span
              aria-hidden="true"
              title="Satuan yang dipakai"
              className="grid h-[46px] shrink-0 place-items-center rounded-lg bg-[#0B0B0B] px-3 text-[0.85rem] font-bold text-white"
            >
              {b.satuan.trim() || "—"}
            </span>
          </div>
        </div>
      </div>
      {err && (
        <p role="alert" className="mt-3 rounded-lg border border-[#E30613]/30 bg-[#E30613]/5 px-3 py-2 text-[0.82rem] font-semibold text-[#E30613]">
          {err}
        </p>
      )}
    </article>
  );
}
