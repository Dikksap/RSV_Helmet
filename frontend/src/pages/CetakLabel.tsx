import { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import {
  generateBarang,
  getGenerateInfo,
  type GenerateInfo,
} from "../api/barang";
import { getProducts, type Product } from "../api/products";
import {
  fetchPrinters,
  isInElectron,
  resolveLabelPage,
  loadDefaultPrinter,
  printHangtagSilently,
  saveDefaultPrinter,
  type CustomLabelMm,
  type LabelSize,
  type PrinterInfo,
} from "../lib/print";
import { Hangtag } from "../components/Hangtag/Hangtag";
import { PrintDocument } from "../components/CetakLabel/PrintDocument";
import { getManufactureBarcode } from "../lib/manufactureBarcode";

type PrintSize = LabelSize;

const activeBtn =
  "border-2 border-slate-900 bg-slate-900 text-white shadow-sm";
const idleBtn =
  "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100";

function CetakLabel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [colorId, setColorId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [generateInfo, setGenerateInfo] = useState<GenerateInfo | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printSize, setPrintSize] = useState<PrintSize>("100x75mm");
  const [customMm, setCustomMm] = useState<CustomLabelMm>({ width: 80, height: 80 });
  const [copies, setCopies] = useState(1);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>(() =>
    loadDefaultPrinter(),
  );
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const contentRef = useRef<HTMLDivElement>(null);
  const selectedPrintPage = resolveLabelPage(printSize, customMm);

  const printFn = useReactToPrint({
    contentRef,
    documentTitle: `Label-Barang-${new Date().toISOString().split("T")[0]}`,
    pageStyle: `
      @page { size: ${selectedPrintPage}; page-orientation: portrait; margin: 0; }
      @media print {
        html, body { width: ${selectedPrintPage.split(" ")[0]} !important; height: ${selectedPrintPage.split(" ")[1]} !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #ffffff !important; }
        body > *:not(.print-document) { display: none !important; }
        .print-document { position: static !important; width: 100% !important; height: auto !important; display: block !important; padding: 0 !important; overflow: visible !important; visibility: visible !important; }
        .print-sheet { break-after: page !important; display: flex !important; align-items: center !important; justify-content: center !important; width: 100% !important; }
        .print-sheet:last-child { break-after: auto !important; }
      }
    `,
    onPrintError: (errorLocation, printError) => {
      console.error(`Print error during ${errorLocation}:`, printError);
      setError(`Gagal print: ${printError.message}`);
    },
    onAfterPrint: () => setGeneratedCodes([]),
  });

  useEffect(() => {
    getProducts()
      .then((list) => {
        setProducts(list);
        if (list.length > 0) setProductId(String(list[0].id));
      })
      .catch(() =>
        setError("Produk belum dapat dimuat. Pastikan server API aktif."),
      )
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!isInElectron()) return;
    fetchPrinters()
      .then((list) => {
        setPrinters(list);
        setSelectedPrinter((current) =>
          current && list.some((printer) => printer.name === current)
            ? current
            : (list.find((printer) => printer.isDefault)?.name ?? ""),
        );
      })
      .catch(() => setPrinters([]));
  }, []);

  const selectedProduct = products.find(
    (product) => product.id === Number(productId),
  );
  const productVariants = selectedProduct?.variants ?? [];
  const styles = [
    ...new Map(
      productVariants.map((variant) => [variant.styleId, variant.style]),
    ).values(),
  ];
  const styleVariants = productVariants.filter(
    (variant) => variant.styleId === Number(styleId),
  );
  const colors = [
    ...new Map(
      styleVariants.map((variant) => [variant.colorId, variant.color]),
    ).values(),
  ];
  const colorVariants = styleVariants.filter(
    (variant) => variant.colorId === Number(colorId),
  );
  const sizes = [
    ...new Map(
      colorVariants.map((variant) => [variant.sizeId, variant.size]),
    ).values(),
  ].sort((a, b) => a.urutan - b.urutan);

  const selectedStyleName = styles.find((style) => String(style.id) === styleId)?.nama;
  const selectedColorName = colors.find((color) => String(color.id) === colorId)?.nama;
  const selectedSizeName = sizes.find((size) => String(size.id) === sizeId)?.nama;
  const selectedVariant = colorVariants.find((variant) => variant.sizeId === Number(sizeId));

  // Auto-pilih pertama saat opsi berubah agar alur produksi cepat.
  useEffect(() => {
    if (styles.length > 0 && !styles.some((s) => String(s.id) === styleId)) {
      setStyleId(String(styles[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, products]);

  useEffect(() => {
    if (colors.length > 0 && !colors.some((c) => String(c.id) === colorId)) {
      setColorId(String(colors[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleId]);

  useEffect(() => {
    if (sizes.length > 0 && !sizes.some((s) => String(s.id) === sizeId)) {
      setSizeId(String(sizes[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorId]);

  useEffect(() => {
    if (!selectedVariant) return;
    getGenerateInfo(selectedVariant.id)
      .then(setGenerateInfo)
      .catch((requestError: Error) => setError(requestError.message));
  }, [selectedVariant]);

  const handleProductSelect = (id: string) => {
    setProductId(id);
    setStyleId("");
    setColorId("");
    setSizeId("");
    setGenerateInfo(null);
    setGeneratedCodes([]);
  };

  const handleGenerate = async () => {
    if (!selectedVariant) return;
    const jumlah = Math.max(1, Math.min(500, Math.floor(copies) || 1));
    setIsGenerating(true);
    setError(null);
    setGeneratedCodes([]);
    try {
      const response = await generateBarang(selectedVariant.id, jumlah);
      const codes = response.batches.flatMap((b) => b.barang.map((x) => x.kodeBarang));
      if (codes.length === 0) throw new Error("Gagal generate barang");

      setGeneratedCodes(codes);
      setGenerateInfo(await getGenerateInfo(selectedVariant.id));

      if (isInElectron()) {
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        const nodes = contentRef.current?.querySelectorAll(".hangtag") ?? [];
        if (nodes.length === 0) throw new Error("Label belum siap untuk dicetak");

        for (const node of Array.from(nodes)) {
          const result = await printHangtagSilently({
            hangtagHtml: (node as HTMLElement).outerHTML,
            size: printSize,
            customMm,
            printerName: selectedPrinter || undefined,
            copies: 1,
          });
          if (result.status === "error") throw new Error(result.message);
        }
        setGeneratedCodes([]);
      } else {
        window.setTimeout(() => printFn(), 100);
      }
    } catch (requestError) {
      const status = requestError instanceof Error
        ? `${requestError.message}${selectedVariant ? ` untuk varian ${selectedVariant.kodeVariant}` : ""}`
        : "Gagal generate barang";
      setError(status);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    if (products.length > 0) handleProductSelect(String(products[0].id));
    setCopies(1);
  };

  // Enter / Spasi = cetak instan (kecuali fokus di input/select/textarea)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/INPUT|SELECT|TEXTAREA/.test(t.tagName)) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (selectedVariant && !isGenerating) void handleGenerate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant, isGenerating, copies, printSize, customMm, selectedPrinter]);

  const formatDate = (date: string) => new Date(date).toLocaleDateString("id-ID");

  const previewCode = generateInfo && selectedVariant
    ? `${generateInfo.batch.kodeBatch}-${generateInfo.kodeVariant}-${generateInfo.tanggal.replaceAll("-", "").slice(2)}-${String(generateInfo.nextNumber).padStart(4, "0")}`
    : null;

  const qrValue = generatedCodes[0] ?? previewCode ?? "-";
  const qrCount = generatedCodes.length > 1 ? ` (+${generatedCodes.length - 1} kode lain)` : "";
  const barcodeValue = selectedVariant
    ? (getManufactureBarcode(
        selectedVariant.style.nama,
        selectedVariant.color.nama,
        selectedVariant.size.nama,
      ) ?? undefined)
    : undefined;
  const variantDescription = [selectedProduct?.nama, selectedStyleName, selectedColorName, selectedSizeName]
    .filter(Boolean)
    .join(" > ");

  const btnBase = "rounded-xl px-3 py-3 text-xs transition-all active:scale-95 focus:outline-none";
  const checkIcon = (
    <svg className="h-4 w-4 shrink-0 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
      <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fillRule="evenodd" />
    </svg>
  );
  const whiteCheckIcon = (
    <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
      <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
    </svg>
  );
  // ponytail: subtitle statis hanya untuk model yang dikenal, fallback = jumlah varian agar tidak bohong untuk produk baru
  const modelSubtitle = (nama: string, varianCount: number): string => {
    const known: Record<string, string> = {
      windbreaker: "Open Face Series",
      sv300: "Double Visor",
      ffs21: "Full Face Racing",
      classic: "Retro Jet Series",
    };
    return known[nama.trim().toLowerCase()] ?? `${varianCount} varian`;
  };

return (
  <div className="flex flex-1 flex-col bg-white font-[Inter,sans-serif] text-slate-800">
    {/* Error Toast */}
    {error && (
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-4">
        <div className="pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-xl border border-red-500/30 bg-red-600 p-4 text-sm text-white shadow-2xl">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path clipRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" fillRule="evenodd" />
            </svg>
            <span className="font-semibold">{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="shrink-0 rounded-lg bg-red-700 px-3 py-1.5 font-bold transition-colors hover:bg-red-800">
            Tutup
          </button>
        </div>
      </div>
    )}

    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col bg-white p-4 pb-6 sm:p-6 sm:pb-6 md:px-12 md:pt-8 md:pb-8">
      {/* Status Bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono tabular-nums text-slate-700 shadow-sm">
          {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} • {now.toLocaleTimeString("id-ID")}
        </span>
        <span className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm sm:flex">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Shift 1 (Budi S.) • Line 04
        </span>
        <span className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-bold text-emerald-800 shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          {isInElectron() ? (selectedPrinter || "Printer Siap (Online)") : "ZD230 • Browser Mode"}
        </span>
      </div>

      <main className="flex flex-col items-start gap-5 xl:flex-row">
        {/* Kiri: Konfigurasi */}
        <section className="flex w-full min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-4 sm:p-5">
            {/* Header */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Konfigurasi Label Thermal</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">Ikuti 3 langkah cepat di bawah sebelum mencetak ke mesin thermal.</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 font-mono text-xs font-bold text-white shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />MODE OPERATOR CEPAT
              </span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                <p className="mt-3 text-sm font-medium text-slate-500">Memuat data produk...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Langkah 1 */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">1</span>
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Pilih Model Helm &amp; Style</label>
                    </div>
                    <span className="rounded-md border border-blue-200 bg-blue-100/80 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                      Model: {selectedProduct?.nama ?? "-"}
                    </span>
                  </div>
                  <div className="mb-3.5 grid grid-cols-2 gap-2.5">
                    {products.map((p) => {
                      const on = String(p.id) === productId;
                      return (
                        <button key={p.id} type="button" onClick={() => handleProductSelect(String(p.id))}
                          className={`${btnBase} flex flex-col justify-between p-3 text-left ${on ? activeBtn : idleBtn}`}>
                          <div className="mb-1 flex w-full items-center justify-between">
                            <span className="text-xs font-black tracking-tight">{p.nama.toUpperCase()}</span>
                            {on && checkIcon}
                          </div>
                          <span className={`text-[11px] font-medium ${on ? "text-slate-300" : "text-slate-500"}`}>{modelSubtitle(p.nama, p.variants.length)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 border-t border-slate-200/80 pt-3">
                    <span className="whitespace-nowrap text-xs font-bold text-slate-600">Style Helm:</span>
                    <div className="grid flex-1 grid-cols-2 gap-2">
                      {styles.map((s) => {
                        const on = String(s.id) === styleId;
                        return (
                          <button key={s.id} type="button"
                            onClick={() => { setStyleId(String(s.id)); setColorId(""); setSizeId(""); setGenerateInfo(null); setGeneratedCodes([]); }}
                            className={`${btnBase} flex items-center justify-center gap-1.5 px-4 py-2 text-center text-xs ${on ? "bg-slate-900 font-bold text-white shadow-sm" : "border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-100"}`}>
                            {on && whiteCheckIcon}{s.nama}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Langkah 2 */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">2</span>
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Pilih Varian Warna &amp; Ukuran</label>
                    </div>
                    <span className="rounded-md border border-blue-200 bg-blue-100/80 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                      {selectedColorName ?? "-"} • Size {selectedSizeName ?? "-"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <span className="block text-xs font-bold text-slate-600">Varian Grafis:</span>
                      <div className="grid grid-cols-2 gap-2">
                        {colors.map((c) => {
                          const on = String(c.id) === colorId;
                          return (
                            <button key={c.id} type="button"
                              onClick={() => { setColorId(String(c.id)); setSizeId(""); setGenerateInfo(null); setGeneratedCodes([]); }}
                              className={`${btnBase} flex items-center justify-between p-3 text-left text-xs ${on ? "border-2 border-slate-900 bg-slate-900 font-bold text-white shadow-sm" : "border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-100"}`}>
                              <span className="truncate">{c.nama}</span>{on && checkIcon}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="block text-xs font-bold text-slate-600">Ukuran Helm:</span>
                      <div className="grid grid-cols-4 gap-2">
                        {sizes.map((s) => {
                          const on = String(s.id) === sizeId;
                          return (
                            <button key={s.id} type="button" onClick={() => { setSizeId(String(s.id)); setGeneratedCodes([]); }}
                              className={`${btnBase} py-3.5 text-center text-lg ${on ? "border-2 border-slate-900 bg-slate-900 font-black text-white shadow-sm" : "border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100"}`}>
                              {s.nama}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Langkah 3 */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">3</span>
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Jumlah Cetak &amp; Preset Cepat</label>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-600">Target: {isInElectron() ? (selectedPrinter || "Default OS") : "Zebra ZD230"}</span>
                  </div>
                  <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-sm">
                      <button type="button" onClick={() => setCopies((c) => Math.max(1, c - 1))} className="flex h-12 w-12 items-center justify-center text-lg font-bold text-slate-700 transition-colors hover:bg-slate-100">−</button>
                      <input value={copies} min={1} max={500} type="number" onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                        className="h-12 w-16 border-0 text-center font-mono text-base font-extrabold text-slate-900 focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <button type="button" onClick={() => setCopies((c) => Math.min(500, c + 1))} className="flex h-12 w-12 items-center justify-center text-lg font-bold text-slate-700 transition-colors hover:bg-slate-100">+</button>
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Preset:</span>
                      {[1, 5, 10, 50].map((n) => (
                        <button key={n} type="button" onClick={() => setCopies(n)}
                          className={`flex-1 rounded-lg border px-3 py-2.5 text-xs transition-colors ${copies === n ? "border-blue-200 bg-blue-50 font-bold text-blue-700" : "border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-100"}`}>
                          {n} Pcs
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Pengaturan lanjutan */}
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <select value={printSize} onChange={(e) => setPrintSize(e.target.value as PrintSize)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500">
                      <option value="100x75mm">100 × 75 mm (Hangtag)</option>
                      <option value="50x50mm">50 × 50 mm (Sticker)</option>
                      <option value="33x15mm">33 × 15 mm (Kecil)</option>
                      <option value="58x58mm">58 × 58 mm (Thermal)</option>
                      <option value="100x100mm">100 × 100 mm</option>
                      <option value="custom">Custom...</option>
                    </select>
                    {isInElectron() ? (
                      <select value={selectedPrinter} onChange={(e) => { setSelectedPrinter(e.target.value); saveDefaultPrinter(e.target.value); }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 sm:col-span-2">
                        <option value="">Default OS Printer</option>
                        {printers.map((p) => (
                          <option key={p.name} value={p.name}>{p.displayName || p.name}{p.isDefault ? " (Default)" : ""}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs text-slate-500 sm:col-span-2">ZDesigner (Browser Mode)</span>
                    )}
                  </div>
                  {printSize === "custom" && (
                    <div className="mt-3 flex gap-3">
                      <label className="flex-1 text-xs text-slate-500">Lebar (mm)
                        <input type="number" min={10} max={500} value={customMm.width} onChange={(e) => setCustomMm({ ...customMm, width: Number(e.target.value) })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                      </label>
                      <label className="flex-1 text-xs text-slate-500">Tinggi (mm)
                        <input type="number" min={10} max={500} value={customMm.height} onChange={(e) => setCustomMm({ ...customMm, height: Number(e.target.value) })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Konfigurasi */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 sm:px-5">
            <span className="flex items-center gap-1.5 font-medium">
              <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fillRule="evenodd" />
              </svg>
              Sensor label kalibrasi otomatis • Ukuran standar 100×75mm
            </span>
            <span className="font-mono text-[11px] text-slate-400">Driver v3.4.1 OK</span>
          </div>
        </section>

        {/* Kanan: Preview */}
        <section className="flex w-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:w-[420px] xl:shrink-0">
          <div>
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Live Preview Hangtag</h3>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                </span>
              </div>
              <span className="rounded bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-500">100×75 mm • 203 DPI</span>
            </div>

            <div className="flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 p-4 sm:p-6"
              style={{ backgroundColor: "#f1f5f9", backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
              {!selectedVariant ? (
                <div className="flex flex-col items-center py-12">
                  <svg className="h-10 w-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mt-3 text-center text-sm font-medium text-slate-500">Pilih spesifikasi produk untuk melihat preview.</p>
                </div>
              ) : (
                <div className="origin-center scale-[0.55] sm:scale-[0.75]">
                  <div className="h-[284px] w-[378px] border border-slate-200 bg-white shadow-lg">
                    <Hangtag
                      productName={selectedProduct?.nama ?? "-"}
                      styleName={selectedVariant.style.nama}
                      colorName={selectedVariant.color.nama}
                      sizeName={selectedVariant.size.nama}
                      sizes={sizes.map((size) => ({ id: size.id, nama: size.nama }))}
                      selectedSizeId={Number(sizeId)}
                      kodeVariant={selectedVariant.kodeVariant ?? `Variant #${selectedVariant.id}`}
                      kodeBatch={generateInfo?.batch.kodeBatch}
                      tanggal={generateInfo ? formatDate(generateInfo.tanggal) : undefined}
                      qrValue={qrValue}
                      barcodeValue={barcodeValue}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white text-xs">
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="font-medium text-slate-500">Batch &amp; Tanggal</span>
                <span className="font-mono font-bold text-slate-900">{generateInfo ? `${generateInfo.batch.kodeBatch} • ${formatDate(generateInfo.tanggal)}` : "-"}</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="font-medium text-slate-500">Spesifikasi</span>
                <span className="truncate font-bold text-slate-900" title={variantDescription}>{variantDescription || "-"}</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="font-medium text-slate-500">QR Code Payload</span>
                <span className="ml-4 truncate font-mono font-bold text-blue-600" title={`${qrValue}${qrCount}`}>{qrValue}{qrCount}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button type="button" disabled={!selectedVariant || isGenerating || !generateInfo} onClick={handleGenerate} title="Cetak label thermal sekarang (Tekan Enter)"
              className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-[#0090ff] px-6 py-4 text-base font-extrabold uppercase tracking-wide text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-600 active:scale-[0.99] active:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none">
              {isGenerating ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                </svg>
              )}
              <span className="tracking-wide uppercase">{isGenerating ? "MENCETAK..." : `CETAK LABEL (${copies} PCS)`}</span>
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <kbd className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700">Enter</kbd>
              <span>atau</span>
              <kbd className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700">Spasi</kbd>
              <span>untuk cetak instan</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" onClick={() => printFn()} disabled={!selectedVariant}
                className="rounded-xl border border-slate-300 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50">
                Test Print (1 Lembar)
              </button>
              <button type="button" onClick={handleReset}
                className="rounded-xl border border-slate-300 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                Reset Pilihan
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>

    <PrintDocument
      contentRef={contentRef}
      generatedCodes={generatedCodes}
      selectedVariant={selectedVariant}
      selectedProduct={selectedProduct}
      sizes={sizes}
      sizeId={sizeId}
      generateInfo={generateInfo}
      printSize={printSize}
      customMm={customMm}
      formatDate={formatDate}
      barcodeValue={barcodeValue}
    />
  </div>
);
}

export default CetakLabel;
