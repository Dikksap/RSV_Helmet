import { Modal } from "./Modal";
import { inputCls, labelCls } from "./constants";
import type { ProductModalState } from "./types";

type Props = {
  state: ProductModalState;
  onClose: () => void;
  onChange: (patch: Partial<ProductModalState>) => void;
  onSubmit: () => void;
};

export function ProductModal({ state, onClose, onChange, onSubmit }: Props) {
  if (!state.open) return null;
  return (
    <Modal title={state.editing ? "Edit Produk" : "Tambah Produk"} onClose={onClose}>
      <div className="space-y-4">
        <label className={labelCls}>
          <span>Nama Produk</span>
          <input className={inputCls} placeholder="cth: Full Face" value={state.nama} onChange={(e) => onChange({ nama: e.target.value })} />
        </label>
        <label className={labelCls}>
          <span>Prefix {state.editing && <em className="font-normal text-amber-300">(terkunci - PUT hanya nama)</em>}</span>
          <input className={inputCls} placeholder="cth: W (1 char, jadi W001)" disabled={Boolean(state.editing)} value={state.prefix} onChange={(e) => onChange({ prefix: e.target.value.toUpperCase() })} />
        </label>
        {state.editing && <p className="text-xs text-brand-grey">PUT /api/products/:id hanya menerima field <code className="font-mono">nama</code>.</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-brand-border bg-brand-surface px-4 py-2.5 text-sm font-bold text-brand-grey-light transition hover:text-white">
            Batal
          </button>
          <button type="button" disabled={state.loading || !state.nama.trim()} onClick={onSubmit} className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold transition hover:bg-brand-gold hover:text-brand-black disabled:cursor-not-allowed disabled:opacity-40">
            {state.loading ? "Menyimpan..." : state.editing ? "Simpan Perubahan" : "Tambah Produk"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
