import type { Product } from "../../api/products";
import type { GenerateInfo } from "../../api/barang";
import type { ProductSize } from "../../api/products";
import type { ProductVariant } from "../../api/products";
import type { LabelSize, PrinterInfo } from "../../lib/print";
import { Hangtag, HangtagFit } from "../Hangtag/Hangtag";
import { labelSizeMm, isInElectron } from "../../lib/print";

type PreviewModalProps = {
  isOpen: boolean;
  selectedProduct: Product | undefined;
  selectedVariant: ProductVariant | undefined;
  sizes: ProductSize[];
  sizeId: string;
  generateInfo: GenerateInfo | null;
  generatedCode: string | null;
  previewCode: string | null;
  printSize: LabelSize;
  printers: PrinterInfo[];
  selectedPrinter: string;
  isGenerating: boolean;
  formatDate: (date: string) => string;
  onClose: () => void;
  onPrintSizeChange: (size: LabelSize) => void;
  onPrinterChange: (printer: string) => void;
  onGenerate: () => void;
  onSaveDefaultPrinter: (printer: string) => void;
};

export function PreviewModal({
  isOpen,
  selectedProduct,
  selectedVariant,
  sizes,
  sizeId,
  generateInfo,
  generatedCode,
  previewCode,
  printSize,
  printers,
  selectedPrinter,
  isGenerating,
  formatDate,
  onClose,
  onPrintSizeChange,
  onPrinterChange,
  onGenerate,
  onSaveDefaultPrinter,
}: PreviewModalProps) {
  if (!isOpen || !selectedVariant) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
      >
        <button
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-900 hover:text-white"
          type="button"
          aria-label="Tutup preview"
          onClick={onClose}
        >
          ×
        </button>

        <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
          Preview Barang
        </p>
        <h2 id="preview-title" className="mt-1 text-xl font-black tracking-tight text-zinc-900 sm:text-2xl">
          {generatedCode ? "Barang Berhasil Dibuat" : "Siap Digenerate"}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {selectedProduct?.nama} › {selectedVariant.style.nama} › {selectedVariant.color.nama} › {selectedVariant.size.nama}
        </p>

        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
          <HangtagFit
            widthMm={labelSizeMm[printSize].width}
            heightMm={labelSizeMm[printSize].height}
          >
            <Hangtag
              productName={selectedProduct?.nama ?? "-"}
              styleName={selectedVariant.style.nama}
              colorName={selectedVariant.color.nama}
              sizeName={selectedVariant.size.nama}
              sizes={sizes.map((size) => ({ id: size.id, nama: size.nama }))}
              selectedSizeId={Number(sizeId)}
              kodeVariant={
                selectedVariant.kodeVariant ??
                `Variant #${selectedVariant.id}`
              }
              kodeBatch={generateInfo?.batch.kodeBatch}
              tanggal={
                generateInfo ? formatDate(generateInfo.tanggal) : undefined
              }
              qrValue={generatedCode ?? previewCode ?? "-"}
            />
          </HangtagFit>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${generatedCode ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {generatedCode ? "Kode barang final" : "Preview kode, belum disimpan"}
          </span>
          <p className="max-w-full break-all font-mono text-xs font-bold text-zinc-900">
            {generatedCode ?? previewCode ?? "-"}
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-zinc-700">
            <span>Ukuran label print</span>
            <select
              value={printSize}
              onChange={(e) =>
                onPrintSizeChange(e.target.value as LabelSize)
              }
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            >
              <option value="33x15mm">33 × 15 mm (Thermal Kecil)</option>
              <option value="50x50mm">50 × 50 mm (5 × 5 cm)</option>
              <option value="58x58mm">58 × 58 mm (Thermal Printer)</option>
              <option value="100x100mm">100 × 100 mm (Medium Label)</option>
              <option value="100x140mm">100 × 140 mm</option>
              <option value="100x200mm">100 × 200 mm (10 × 20 cm)</option>
              <option value="4x6inch">4 × 6 inch (Standard)</option>
              <option value="custom">80 × 80 mm (Custom)</option>
            </select>
          </label>
          {isInElectron() && (
            <label className="grid gap-1.5 text-xs font-semibold text-zinc-700">
              <span>Printer</span>
              <select
                value={selectedPrinter}
                onChange={(e) => {
                  onPrinterChange(e.target.value);
                  onSaveDefaultPrinter(e.target.value);
                }}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="">Default sistem</option>
                {printers.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.displayName || printer.name}
                    {printer.isDefault ? " (Default)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <button
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          type="button"
          disabled={isGenerating || !generateInfo}
          onClick={onGenerate}
        >
          {isGenerating ? "Membuat Barang..." : "Generate & Print"}
        </button>
      </section>
    </div>
  );
}
