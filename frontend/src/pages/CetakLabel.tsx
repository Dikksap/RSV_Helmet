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

type PrintSize = LabelSize;

// PERBAIKAN: Gunakan border-2 untuk keduanya agar layout tidak melompat (jitter) saat diklik
const activeBtn =
  "border-2 border-slate-800 bg-slate-800 text-white font-bold shadow-inner";
const idleBtn =
  "border-2 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-medium";

function CetakLabel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [colorId, setColorId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [generateInfo, setGenerateInfo] = useState<GenerateInfo | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
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
        .print-document { position: static !important; width: 100% !important; height: 100% !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 0 !important; overflow: visible !important; visibility: visible !important; }
      }
    `,
    onPrintError: (errorLocation, printError) => {
      console.error(`Print error during ${errorLocation}:`, printError);
      setError(`Gagal print: ${printError.message}`);
    },
    onAfterPrint: () => setGeneratedCode(null),
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
    setGeneratedCode(null);
  };

  const handleGenerate = async () => {
    if (!selectedVariant) return;
    setIsGenerating(true);
    setError(null);
    setGeneratedCode(null);
    try {
      const response = await generateBarang(selectedVariant.id);
      const code = response.batches[0]?.barang[0]?.kodeBarang;
      if (!code) throw new Error("Gagal generate barang");

      setGeneratedCode(code);
      setGenerateInfo(await getGenerateInfo(selectedVariant.id));

      if (isInElectron()) {
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        const hangtagMarkup = contentRef.current?.querySelector(".hangtag")?.outerHTML ?? "";
        if (!hangtagMarkup) throw new Error("Label belum siap untuk dicetak");

        const result = await printHangtagSilently({
          hangtagHtml: hangtagMarkup,
          size: printSize,
          customMm,
          printerName: selectedPrinter || undefined,
          copies: Math.max(1, copies),
        });

        if (result.status === "error") {
          setError(`Gagal print: ${result.message}`);
        } else {
          setGeneratedCode(null);
        }
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

  const formatDate = (date: string) => new Date(date).toLocaleDateString("id-ID");

  const previewCode = generateInfo && selectedVariant
    ? `${generateInfo.batch.kodeBatch}-${generateInfo.kodeVariant}-${generateInfo.tanggal.replaceAll("-", "").slice(2)}-${String(generateInfo.nextNumber).padStart(4, "0")}`
    : null;

  const qrValue = generatedCode ?? previewCode ?? "-";
  const variantDescription = [selectedProduct?.nama, selectedStyleName, selectedColorName, selectedSizeName]
    .filter(Boolean)
    .join(" > ");

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-transparent font-[Inter,sans-serif] text-slate-800 lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden">
      {error && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-4">
          <div className="pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-md bg-red-600 p-4 text-sm text-white shadow-2xl">
            <span className="font-semibold">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 rounded bg-red-700 px-3 py-1 font-bold hover:bg-red-800 focus:ring-2 focus:ring-white"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area: Split layout */}
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">

        {/* Left Panel: Data Entry */}
        <section className="w-full min-w-0 border-r border-slate-200 bg-white p-4 lg:w-3/5 lg:flex-1 lg:overflow-y-auto lg:p-5 xl:w-2/3">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 pb-2">
            <h2 className="text-lg font-bold text-slate-800">Konfigurasi Label</h2>
            <span className="rounded bg-slate-100 px-2 py-1 text-sm font-medium text-slate-500">
              Batch: <span className="text-slate-800">{generateInfo?.batch.kodeBatch ?? "-"}</span>
            </span>
          </div>

          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="animate-pulse text-sm font-medium text-slate-500">Memuat data produk industri...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">1. Pilih Produk</label>
                  <select
                    value={productId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-base font-medium text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama} ({p.variants.length} Varian)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">2. Style</label>
                  <div className="grid grid-cols-2 gap-3">
                    {styles.length === 0 && <p className="col-span-2 text-sm text-slate-400">Pilih produk dulu.</p>}
                    {styles.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setStyleId(String(s.id));
                          setColorId("");
                          setSizeId("");
                          setGenerateInfo(null);
                          setGeneratedCode(null);
                        }}
                        className={`option-btn w-full rounded-md px-4 py-2.5 text-base transition-colors focus:outline-none ${String(s.id) === styleId ? activeBtn : idleBtn}`}
                      >
                        {s.nama}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700">3. Warna</label>
                    {selectedColorName && (
                      <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-600">
                        Terpilih: {selectedColorName}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {colors.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setColorId(String(c.id));
                          setSizeId("");
                          setGenerateInfo(null);
                          setGeneratedCode(null);
                        }}
                        className={`option-btn truncate rounded-md px-4 py-2.5 text-left text-base transition-colors focus:outline-none ${String(c.id) === colorId ? activeBtn : idleBtn}`}
                      >
                        {c.nama}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700">4. Ukuran</label>
                    {selectedSizeName && (
                      <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-600">
                        Terpilih: {selectedSizeName}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {sizes.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSizeId(String(s.id));
                          setGeneratedCode(null);
                        }}
                        className={`option-btn rounded-md py-2.5 text-center text-base transition-colors focus:outline-none ${String(s.id) === sizeId ? activeBtn : idleBtn}`}
                      >
                        {s.nama}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Printer Settings */}
          <div className="mt-5 border-t border-slate-200 pt-4">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-700">Pengaturan Printer</h3>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-slate-500">Ukuran Label</label>
                <select
                  value={printSize}
                  onChange={(e) => setPrintSize(e.target.value as PrintSize)}
                  className="w-full rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none"
                >
                  <option value="100x75mm">100 &times; 75 mm (Hangtag)</option>
                  <option value="50x50mm">50 &times; 50 mm (Sticker)</option>
                  <option value="33x15mm">33 &times; 15 mm (Kecil)</option>
                  <option value="58x58mm">58 &times; 58 mm (Thermal)</option>
                  <option value="100x100mm">100 &times; 100 mm</option>
                  <option value="custom">Custom Ukuran...</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-slate-500">Target Printer</label>
                {isInElectron() ? (
                  <select
                    value={selectedPrinter}
                    onChange={(e) => {
                      setSelectedPrinter(e.target.value);
                      saveDefaultPrinter(e.target.value);
                    }}
                    className="w-full rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none"
                  >
                    <option value="">Default OS Printer</option>
                    {printers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.displayName || p.name} {p.isDefault ? " (Default)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select disabled className="w-full rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm text-slate-500 shadow-sm">
                    <option>ZDesigner (Browser Mode)</option>
                  </select>
                )}
              </div>
              <div className="w-full sm:w-24">
                <label className="mb-1 block text-xs font-semibold text-slate-500">Jumlah</label>
                <input
                  type="number"
                  value={copies}
                  min={1}
                  max={100}
                  onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-center text-sm font-bold shadow-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            {printSize === "custom" && (
              <div className="mt-3 flex gap-3">
                <div className="flex-1">
                  <span className="text-xs font-medium text-slate-500">Lebar (mm)</span>
                  <input type="number" min={10} max={500} value={customMm.width} onChange={(e) => setCustomMm({ ...customMm, width: Number(e.target.value) })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-slate-500">Tinggi (mm)</span>
                  <input type="number" min={10} max={500} value={customMm.height} onChange={(e) => setCustomMm({ ...customMm, height: Number(e.target.value) })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Panel: Fixed Preview and Action */}
        <section className="z-0 flex w-full min-w-0 flex-col border-t border-slate-200 bg-transparent lg:w-2/5 lg:border-l lg:border-t-0 xl:w-1/3">
          <div className="flex flex-col p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Live Preview</h2>
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-500"></span>
              </span>
            </div>

            <div className="flex h-[240px] flex-none items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:h-[280px]">
              {!selectedVariant ? (
                <div className="text-center text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-2 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  <p className="text-sm font-medium">Pilih spesifikasi produk untuk melihat preview label.</p>
                </div>
              ) : (
                <div>
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
                    />
                  </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-md bg-slate-800 p-3 text-sm shadow-sm">
              <div className="mb-1 flex justify-between border-b border-slate-600 pb-1">
                <span className="text-slate-400">Kode Varian</span>
                <span className="font-mono font-bold text-white">{selectedVariant?.kodeVariant ?? "-"}</span>
              </div>
              <div className="mb-1 flex justify-between border-b border-slate-600 pb-1">
                <span className="text-slate-400">QR Value</span>
                <span className="max-w-[180px] truncate font-mono text-xs font-bold text-sky-400" title={qrValue}>{qrValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tanggal Batch</span>
                <span className="font-mono font-bold text-white">{generateInfo ? formatDate(generateInfo.tanggal) : "-"}</span>
              </div>
            </div>
          </div>

          {/* Fixed Bottom Action Area */}
          <div className="shrink-0 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="mb-3">
              <p className="text-center text-xs text-slate-500">Pastikan printer thermal siap sebelum klik Generate.</p>
            </div>
            <button
              type="button"
              disabled={!selectedVariant || isGenerating || !generateInfo}
              onClick={handleGenerate}
              className="flex w-full transform items-center justify-center gap-2 rounded-md bg-sky-500 px-6 py-3 text-lg font-bold text-white shadow-lg transition active:scale-[0.98] hover:bg-sky-600 focus:outline-none focus:ring-4 focus:ring-sky-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
            >
              {isGenerating ? (
                <>
                  <svg className="h-6 w-6 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  MENCETAK...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  CETAK LABEL SEKARANG
                </>
              )}
            </button>
            <div className="mt-3 flex justify-between rounded bg-slate-100 p-2 text-xs font-semibold text-slate-700">
              <span>Ringkasan:</span>
              <span className="ml-2 truncate text-slate-900">{variantDescription || "—"}</span>
            </div>
          </div>
        </section>
      </main>

      {/* Tersembunyi untuk keperluan print API */}
      <PrintDocument
        contentRef={contentRef}
        generatedCode={generatedCode}
        selectedVariant={selectedVariant}
        selectedProduct={selectedProduct}
        sizes={sizes}
        sizeId={sizeId}
        generateInfo={generateInfo}
        printSize={printSize}
        customMm={customMm}
        formatDate={formatDate}
      />
    </div>
  );
}

export default CetakLabel;
