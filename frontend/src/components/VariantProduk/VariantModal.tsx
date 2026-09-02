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
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Edit variant: hanya <code className="font-mono">tanggal</code> dapat diubah (PATCH). Kode:{" "}
            <strong className="font-mono text-amber-200">{state.editing.kodeVariant ?? "-"}</strong>
          </p>
        )}
        <label className={labelCls}>
          <span>Produk {isEdit && <em className="font-normal text-amber-300">(terkunci)</em>}</span>
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
          <button type="button" onClick={onClose} className="rounded-lg border border-brand-border bg-brand-surface px-4 py-2.5 text-sm font-bold text-brand-grey-light transition hover:text-white">
            Batal
          </button>
          <button
            type="button"
            disabled={state.loading || (!state.editing && (!state.productId || !state.styleId || !state.colorId || !state.sizeId))}
            onClick={onSubmit}
            className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold transition hover:bg-brand-gold hover:text-brand-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {state.loading ? "Menyimpan..." : state.editing ? "Simpan Tanggal" : "Tambah Variant"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
