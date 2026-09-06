import type { Product } from "../../api/products";
import type { GenerateInfo } from "../../api/barang";
import type { ProductSize } from "../../api/products";
import type { ProductVariant } from "../../api/products";
import type { LabelSize, PrinterInfo, CustomLabelMm } from "../../lib/print";
import { Hangtag } from "../Hangtag/Hangtag";
import { isInElectron } from "../../lib/print";

type LivePreviewProps = {
  selectedProduct: Product | undefined;
  selectedVariant: ProductVariant | undefined;
  sizes: ProductSize[];
  sizeId: string;
  generateInfo: GenerateInfo | null;
  generatedCode: string | null;
  previewCode: string | null;
  printSize: LabelSize;
  customMm: CustomLabelMm;
  printers: PrinterInfo[];
  selectedPrinter: string;
  isGenerating: boolean;
  formatDate: (date: string) => string;
  onPrintSizeChange: (size: LabelSize) => void;
  onCustomMmChange: (custom: CustomLabelMm) => void;
  onPrinterChange: (printer: string) => void;
  onGenerate: () => void;
  onSaveDefaultPrinter: (printer: string) => void;
};

export function LivePreview({
  selectedProduct,
  selectedVariant,
  sizes,
  sizeId,
  generateInfo,
  generatedCode,
  previewCode,
  printSize,
  customMm,
  printers,
  selectedPrinter,
  isGenerating,
  formatDate,
  onPrintSizeChange,
  onCustomMmChange,
  onPrinterChange,
  onGenerate,
  onSaveDefaultPrinter,
}: LivePreviewProps) {
  // Preview dikunci di ukuran desain (100x75mm) — pilihan ukuran label
  // hanya dipakai saat print, tidak mengubah tampilan preview.
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900">Live Preview</h3>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
          {selectedVariant ? (generatedCode ? "Final" : "Preview") : "Pilih varian"}
        </span>
      </div>

      {!selectedVariant ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-12 text-center">
          <p className="text-sm font-medium text-zinc-500">
            Pilih produk, style, warna & ukuran untuk melihat hangtag.
          </p>
          <p className="mt-1 text-xs text-zinc-400">QR dan kode akan muncul otomatis</p>
        </div>
      ) : (
        <>
          <div className="relative flex h-[180px] items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:h-[240px]">
            {/* Box luar = ukuran visual hasil scale (159x119 mobile, 227x170 sm+).
                Layout Hangtag tetap 378px — tanpa box ini kolom grid ikut melebar. */}
            <div className="h-[119px] w-[159px] shrink-0 sm:h-[170px] sm:w-[227px]">
              <div className="h-[284px] w-[378px] origin-top-left scale-[0.42] sm:scale-[0.6]">
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
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-zinc-500">
            {generatedCode ? "Kode barang final" : "Preview kode, belum disimpan"}
          </p>
          <div className="mt-4 grid gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-xs text-zinc-300">
            <div className="flex justify-between">
              <span className="text-zinc-400">Kode Varian</span>
              <span className="font-mono font-semibold text-white">{selectedVariant.kodeVariant}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">QR Value</span>
              <span className="max-w-[170px] truncate font-mono font-semibold text-white" title={generatedCode ?? previewCode ?? "-"}>
                {generatedCode ?? previewCode ?? "-"}
              </span>
            </div>
            {generateInfo && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Tanggal Batch</span>
                <span className="font-semibold text-white">{formatDate(generateInfo.tanggal)}</span>
              </div>
            )}
          </div>
        </>
      )}

      <div className="mt-5 grid gap-3">
        <label className="grid gap-1.5 text-xs font-semibold text-zinc-700">
          <span>Ukuran label</span>
          <select
            value={printSize}
            onChange={(e) => onPrintSizeChange(e.target.value as LabelSize)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="33x15mm">33 × 15 mm (Thermal Kecil)</option>
            <option value="50x50mm">50 × 50 mm (5 × 5 cm)</option>
            <option value="58x58mm">58 × 58 mm (Thermal Printer)</option>
            <option value="100x75mm">100 × 75 mm (Hangtag)</option>
            <option value="100x100mm">100 × 100 mm (Medium)</option>
            <option value="100x140mm">100 × 140 mm</option>
            <option value="100x200mm">100 × 200 mm</option>
            <option value="4x6inch">4 × 6 inch (Standard)</option>
            <option value="custom">Custom (atur manual)</option>
          </select>
        </label>
        {printSize === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1.5 text-xs font-semibold text-zinc-700">
              <span>Lebar (mm)</span>
              <input
                type="number"
                min={10}
                max={500}
                value={customMm.width}
                onChange={(e) =>
                  onCustomMmChange({ ...customMm, width: Number(e.target.value) })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-zinc-700">
              <span>Tinggi (mm)</span>
              <input
                type="number"
                min={10}
                max={500}
                value={customMm.height}
                onChange={(e) =>
                  onCustomMmChange({ ...customMm, height: Number(e.target.value) })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </label>
          </div>
        )}
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
        <button
          type="button"
          disabled={!selectedVariant || isGenerating || !generateInfo}
          onClick={onGenerate}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? "Membuat Barang..." : "Generate & Print"}
        </button>
      </div>
    </div>
  );
}
