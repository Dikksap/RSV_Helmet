import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Barang } from "../../api/barang";

type QRModalProps = {
  barang: Barang;
  onClose: () => void;
};

export function QRModal({ barang, onClose }: QRModalProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(barang.kodeBarang);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback select
      const el = document.createElement("textarea");
      el.value = barang.kodeBarang;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-[#0F1C2E]/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm transition-opacity"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] transition duration-200 ease hover:bg-[#F5F7FA] hover:text-[#1F2937] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40"
          type="button"
          aria-label="Tutup modal"
          onClick={onClose}
        >
          ✕
        </button>

        <p className="text-xs font-bold uppercase tracking-widest text-[#00A8E8]">
          Detail QR Code
        </p>
        <h2
          id="qr-title"
          className="mt-1 font-mono text-xl font-bold tracking-tight text-[#1E3A5F]"
        >
          {barang.kodeBarang}
        </h2>
        <button
          type="button"
          onClick={handleCopy}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-3 py-1.5 text-sm font-medium text-[#1E3A5F] transition duration-200 ease hover:border-[#00A8E8] hover:text-[#00A8E8] active:scale-[0.98]"
          aria-label="Copy kode barang"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3" /></svg>
          {copied ? "Tersalin!" : "Copy kode"}
        </button>

        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
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
            <p className="font-semibold text-[#1F2937]">
              {barang.variant.product.nama}
            </p>
            <p className="text-sm text-[#6B7280]">
              {barang.variant.style.nama} /{" "}
              {barang.variant.color.nama} /{" "}
              {barang.variant.size.nama}
            </p>
            <p className="font-mono text-xs font-medium text-[#00A8E8]">
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
