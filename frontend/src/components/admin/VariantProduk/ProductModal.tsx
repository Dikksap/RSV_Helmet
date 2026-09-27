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
          <span>Prefix {state.editing && <em className="font-normal text-amber-600">(terkunci - PUT hanya nama)</em>}</span>
          <input className={inputCls} placeholder="cth: W (1 char, jadi W001)" disabled={Boolean(state.editing)} value={state.prefix} onChange={(e) => onChange({ prefix: e.target.value.toUpperCase() })} />
        </label>
        {state.editing && <p className="text-sm text-[#6B7280]">PUT /api/products/:id hanya menerima field <code className="font-mono">nama</code>.</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="inline-flex min-h-[48px] items-center rounded-lg border border-[#D1D5DB] bg-white px-6 py-3 text-base font-medium text-[#1F2937] transition duration-200 ease hover:bg-[#F5F7FA]">
            Batal
          </button>
          <button type="button" disabled={state.loading || !state.nama.trim()} onClick={onSubmit} className="inline-flex min-h-[48px] items-center rounded-lg bg-[#00A8E8] px-6 py-3 text-base font-medium text-white transition duration-200 ease hover:bg-[#0088C0] disabled:cursor-not-allowed disabled:opacity-40">
            {state.loading ? "Menyimpan..." : state.editing ? "Simpan Perubahan" : "Tambah Produk"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
