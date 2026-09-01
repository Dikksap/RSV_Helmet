import { QRCodeSVG } from "qrcode.react";
import type { Barang } from "../../api/barang";

type QRModalProps = {
  barang: Barang;
  onClose: () => void;
};

export function QRModal({ barang, onClose }: QRModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm transition-opacity"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-brand-border bg-brand-surface-card p-6 text-center shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-brand-grey-light transition hover:border-brand-gold hover:text-white"
          type="button"
          aria-label="Tutup modal"
          onClick={onClose}
        >
          ✕
        </button>

        <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">
          Detail QR Code
        </p>
        <h2
          id="qr-title"
          className="mt-1 font-mono text-xl font-bold tracking-tight text-white"
        >
          {barang.kodeBarang}
        </h2>

        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="rounded-2xl bg-white p-4 shadow-inner">
            <QRCodeSVG
              value={barang.kodeBarang}
              size={180}
              includeMargin={false}
              level="H"
              bgColor="#ffffff"
              fgColor="#111111"
              title={`QR Code ${barang.kodeBarang}`}
            />
          </div>

          <div className="space-y-1 text-center">
            <p className="font-semibold text-white">
              {barang.variant.product.nama}
            </p>
            <p className="text-xs text-brand-grey">
              {barang.variant.style.nama} /{" "}
              {barang.variant.color.nama} /{" "}
              {barang.variant.size.nama}
            </p>
            <p className="text-xs font-mono font-medium text-brand-gold">
              {barang.batch
                ? `Batch: BC${String(barang.batch.nomorBatch).padStart(3, "0")}`
                : "No Batch"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
