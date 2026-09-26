import { useEffect, useState } from "react";
import { createOrder, type StatusProductionOrder } from "../../api/productionOrders";

type Props = {
  onClose: () => void;
  onCreated: (id: number) => void;
};

const STATUSES: StatusProductionOrder[] = ["DRAFT", "AKTIF", "SELESAI", "BATAL"];

const fieldCls =
  "mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[15px] focus:outline-2 focus:outline-[#00A8E8]";

export default function CreateOrderModal({ onClose, onCreated }: Props) {
  const [nomor, setNomor] = useState("");
  const [periode, setPeriode] = useState("");
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<StatusProductionOrder>("DRAFT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc tidak boleh nutup dialog saat submit berjalan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async () => {
    if (!nomor.trim() || !periode.trim()) {
      setError("Nomor dan periode wajib diisi");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createOrder({
        nomor: nomor.trim(),
        periode: periode.trim(),
        label: label.trim() || undefined,
        status,
      });
      onCreated(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat order");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buat production order"
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#1E3A5F]">Buat Production Order</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-[#1F2937]">
            Nomor *
            <input
              autoFocus
              value={nomor}
              onChange={(e) => setNomor(e.target.value)}
              placeholder="PO-2026-09-01"
              className={fieldCls}
            />
          </label>
          <label className="block text-sm font-medium text-[#1F2937]">
            Periode *
            <input
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              placeholder="2026-09"
              className={fieldCls}
            />
          </label>
          <label className="block text-sm font-medium text-[#1F2937]">
            Label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Produksi September"
              className={fieldCls}
            />
          </label>
          <label className="block text-sm font-medium text-[#1F2937]">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusProductionOrder)}
              className={`${fieldCls} bg-white`}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-[#EF4444]">{error}</p>
        )}
        <p className="mt-3 text-xs text-[#6B7280]">Item variant ditambah lewat tab Master setelah order dibuat.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onClose()}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-[#1F2937] hover:bg-slate-300 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-lg bg-[#00A8E8] px-4 py-2 text-sm font-medium text-white hover:bg-[#0088C0] disabled:opacity-50"
          >
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
