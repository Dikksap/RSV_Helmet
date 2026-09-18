import { useMemo, useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import type { Barang } from "../../api/barang";
import type { Product } from "../../api/products";
import { Hangtag } from "../Hangtag/Hangtag";
import { getManufactureBarcode } from "../../lib/manufactureBarcode";
import {
  buildHangtagPrintHtml,
  isInElectron,
  printHangtagSilently,
} from "../../lib/print";

type HangtagModalProps = {
  barang: Barang;
  products?: Product[];
  onClose: () => void;
};

export function HangtagModal({ barang, products, onClose }: HangtagModalProps) {
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const hangtagRef = useRef<HTMLDivElement>(null);

  const sizes = useMemo(() => {
    const product = products?.find((p) =>
      p.variants.some((v) => v.id === barang.variantId),
    );
    const siblings = product?.variants.filter(
      (v) =>
        v.styleId === barang.variant.styleId &&
        v.colorId === barang.variant.colorId,
    );
    if (siblings && siblings.length > 0) {
      const seen = new Map<number, string>();
      for (const v of siblings) seen.set(v.sizeId, v.size.nama);
      return [...seen.entries()]
        .map(([id, nama]) => ({ id, nama }))
        .sort((a, b) => a.nama.localeCompare(b.nama));
    }
    return [{ id: barang.variant.sizeId, nama: barang.variant.size.nama }];
  }, [products, barang]);

  const getHangtagMarkup = () => {
    const markup =
      hangtagRef.current?.querySelector(".hangtag")?.outerHTML ?? "";
    if (!markup) throw new Error("Hangtag belum siap untuk dicetak");
    return markup;
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setActionMsg(null);
    try {
      const node = hangtagRef.current?.querySelector(
        ".hangtag",
      ) as HTMLElement | null;
      if (!node) throw new Error("Hangtag belum siap untuk diunduh");
      const dataUrl = await toJpeg(node, {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `hangtag-${barang.kodeBarang}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Gagal download hangtag");
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    setActionMsg(null);
    try {
      const hangtagHtml = getHangtagMarkup();
      if (isInElectron()) {
        const result = await printHangtagSilently({
          hangtagHtml,
          size: "100x75mm",
        });
        if (result.status === "error") {
          setActionMsg(`Gagal print: ${result.message}`);
        }
      } else {
        const html = buildHangtagPrintHtml({ hangtagHtml, size: "100x75mm" });
        const w = window.open("", "_blank", "width=800,height=600");
        if (!w) throw new Error("Popup diblokir browser. Izinkan popup untuk print.");
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
      }
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Gagal print hangtag");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(barang.kodeBarang);
    } catch {
      const el = document.createElement("textarea");
      el.value = barang.kodeBarang;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0F1C2E]/60 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-slate-200 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_4px_20px_rgba(0,0,0,0.12)] sm:max-w-2xl sm:rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hangtag-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <button
          className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-lg text-[#6B7280] transition duration-200 ease hover:bg-[#F5F7FA] hover:text-[#1F2937] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40"
          type="button"
          aria-label="Tutup modal"
          onClick={onClose}
        >
          ✕
        </button>

        <p className="text-xs font-bold uppercase tracking-widest text-[#00A8E8]">
          Hangtag Barang
        </p>
        <h2
          id="hangtag-title"
          className="mt-1 font-mono text-xl font-bold tracking-tight text-[#1E3A5F]"
        >
          {barang.kodeBarang}
        </h2>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-3 py-3 text-sm font-medium text-[#1E3A5F] transition duration-200 ease hover:border-[#00A8E8] hover:text-[#00A8E8] active:scale-[0.98]"
            aria-label="Copy kode barang"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3" /></svg>
            {copied ? "Tersalin!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-3 py-3 text-sm font-medium text-[#1E3A5F] transition duration-200 ease hover:border-[#00A8E8] hover:text-[#00A8E8] active:scale-[0.98] disabled:opacity-50"
            aria-label="Download hangtag"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {isDownloading ? "..." : "JPG"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg bg-[#00A8E8] px-6 py-3 text-sm font-medium text-white transition duration-200 ease hover:bg-[#0088C0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 active:scale-[0.98] disabled:opacity-50"
            aria-label="Print hangtag"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            {isPrinting ? "..." : "Print"}
          </button>
        </div>
        {actionMsg && (
          <p className="mt-2 text-sm text-[#EF4444]">{actionMsg}</p>
        )}

        <div
          ref={hangtagRef}
          className="mt-6 flex justify-center overflow-x-auto rounded-xl bg-[#F5F7FA] p-6"
        >
          <div className="origin-top scale-[0.82] sm:scale-95 lg:scale-100">
            <Hangtag
              productName={barang.variant.product.nama}
              styleName={barang.variant.style.nama}
              colorName={barang.variant.color.nama}
              sizeName={barang.variant.size.nama}
              sizes={sizes}
              selectedSizeId={barang.variant.sizeId}
              kodeVariant={barang.variant.kodeVariant}
              kodeBatch={
                barang.batch
                  ? `BC${String(barang.batch.nomorBatch).padStart(3, "0")}`
                  : undefined
              }
              qrValue={barang.kodeBarang}
              barcodeValue={
                getManufactureBarcode(
                  barang.variant.style.nama,
                  barang.variant.color.nama,
                  barang.variant.size.nama,
                ) ?? undefined
              }
            />
          </div>
        </div>

        <div className="mt-4 space-y-1 text-center">
          <p className="font-semibold text-[#1F2937]">
            {barang.variant.product.nama}
          </p>
          <p className="text-sm text-[#6B7280]">
            {barang.variant.style.nama} / {barang.variant.color.nama} /{" "}
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
  );
}
