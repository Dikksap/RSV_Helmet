import type { Product, ProductRelation, ProductSize } from "../../api/products";
import { Modal } from "./Modal";
import { SelectRelationField, SelectSizeField } from "./SelectField";
import { inputCls, labelCls } from "./constants";
import type { VariantModalState } from "./types";

type Props = {
  state: VariantModalState;
  products: Product[];
  styles: ProductRelation[];
  colors: ProductRelation[];
  sizes: ProductSize[];
  onClose: () => void;
  onChange: (patch: Partial<VariantModalState>) => void;
  onSubmit: () => void;
};

export function VariantModal({ state, products, styles, colors, sizes, onClose, onChange, onSubmit }: Props) {
  if (!state.open) return null;
  const isEdit = Boolean(state.editing);
  // PATCH /api/products/:id/variants/:variantId hanya boleh update tanggal per doc
  return (
    <Modal title={isEdit ? "Edit Variant" : "Tambah Variant"} onClose={onClose}>
      <div className="space-y-4">
        {isEdit && state.editing && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Edit variant: hanya <code className="font-mono">tanggal</code> dapat diubah (PATCH). Kode:{" "}
            <strong className="font-mono text-amber-800">{state.editing.kodeVariant ?? "-"}</strong>
          </p>
        )}
        <label className={labelCls}>
          <span>Produk {isEdit && <em className="font-normal text-amber-600">(terkunci)</em>}</span>
          <select className={inputCls} value={state.productId} disabled={isEdit} onChange={(e) => onChange({ productId: e.target.value })}>
            <option value="">Pilih produk</option>
            {products.slice().sort((a, b) => a.nama.localeCompare(b.nama)).map((p) => (
              <option key={p.id} value={String(p.id)}>{p.nama} ({p.prefix})</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <SelectRelationField label={isEdit ? "Style (terkunci)" : "Style"} value={state.styleId} options={styles} onChange={(v) => onChange({ styleId: v })} disabled={isEdit} />
          <SelectRelationField label={isEdit ? "Warna (terkunci)" : "Warna"} value={state.colorId} options={colors} onChange={(v) => onChange({ colorId: v })} disabled={isEdit} />
          <SelectSizeField label={isEdit ? "Ukuran (terkunci)" : "Ukuran"} value={state.sizeId} options={sizes} onChange={(v) => onChange({ sizeId: v })} disabled={isEdit} />
        </div>
        <label className={labelCls}>
          <span>Tanggal (opsional) — format ISO date</span>
          <input type="date" className={inputCls} value={state.tanggal} onChange={(e) => onChange({ tanggal: e.target.value })} />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="inline-flex min-h-[48px] items-center rounded-lg border border-[#D1D5DB] bg-white px-6 py-3 text-base font-medium text-[#1F2937] transition duration-200 ease hover:bg-[#F5F7FA]">
            Batal
          </button>
          <button
            type="button"
            disabled={state.loading || (!state.editing && (!state.productId || !state.styleId || !state.colorId || !state.sizeId))}
            onClick={onSubmit}
            className="inline-flex min-h-[48px] items-center rounded-lg bg-[#00A8E8] px-6 py-3 text-base font-medium text-white transition duration-200 ease hover:bg-[#0088C0] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {state.loading ? "Menyimpan..." : state.editing ? "Simpan Tanggal" : "Tambah Variant"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
