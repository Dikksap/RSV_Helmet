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
import { PageHeader } from "../components/CetakBarang/PageHeader";
import { ErrorAlert } from "../components/CetakBarang/ErrorAlert";
import { LoadingState } from "../components/CetakBarang/LoadingState";
import { ProductSelector } from "../components/CetakBarang/ProductSelector";
import { StyleColorSelector } from "../components/CetakBarang/StyleColorSelector";
import { SizeSelector } from "../components/CetakBarang/SizeSelector";
import { VariantSummary } from "../components/CetakBarang/VariantSummary";
import { LivePreview } from "../components/CetakBarang/LivePreview";
import { PreviewModal } from "../components/CetakBarang/PreviewModal";
import { PrintDocument } from "../components/CetakBarang/PrintDocument";

type PrintSize = LabelSize;

function CetakBarang() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [styleId, setStyleId] = useState("");
  const [colorId, setColorId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [generateInfo, setGenerateInfo] = useState<GenerateInfo | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [printSize, setPrintSize] = useState<PrintSize>("100x75mm");
  const [customMm, setCustomMm] = useState<CustomLabelMm>({ width: 80, height: 80 });
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
    onAfterPrint: () => {
      window.location.reload();
    },
  });

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() =>
        setError("Produk belum dapat dimuat. Pastikan server API aktif."),
      )
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!isInElectron()) {
      return;
    }
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
  const selectedStyleName = styles.find(
    (style) => String(style.id) === styleId,
  )?.nama;
  const selectedColorName = colors.find(
    (color) => String(color.id) === colorId,
  )?.nama;
  const selectedSizeName = sizes.find(
    (size) => String(size.id) === sizeId,
  )?.nama;
  const selectedVariant = colorVariants.find(
    (variant) => variant.sizeId === Number(sizeId),
  );

  useEffect(() => {
    if (!selectedVariant) {
      return;
    }
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

  const handleStyleSelect = (id: string) => {
    setStyleId(id);
    setColorId("");
    setSizeId("");
    setGenerateInfo(null);
    setGeneratedCode(null);
  };

  const handleColorSelect = (id: string) => {
    setColorId(id);
    setSizeId("");
    setGenerateInfo(null);
    setGeneratedCode(null);
  };

  const handleSizeSelect = (id: string) => {
    setSizeId(id);
    setGenerateInfo(null);
    setGeneratedCode(null);
    setIsPreviewOpen(true);
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
        const hangtagMarkup =
          contentRef.current?.querySelector(".hangtag")?.outerHTML ?? "";
        if (!hangtagMarkup) {
          throw new Error("Label belum siap untuk dicetak");
        }
        const result = await printHangtagSilently({
          hangtagHtml: hangtagMarkup,
          size: printSize,
          customMm,
        });
        if (result.status === "error") {
          setError(`Gagal print: ${result.message}`);
        } else {
          window.location.reload();
        }
      } else {
        window.setTimeout(() => printFn(), 100);
      }
    } catch (requestError) {
      const status =
        requestError instanceof Error
          ? `${requestError.message}${selectedVariant ? ` untuk varian ${selectedVariant.kodeVariant}` : ""}`
          : "Gagal generate barang";
      setError(status);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("id-ID");
  const previewCode =
    generateInfo && selectedVariant
      ? `${generateInfo.batch.kodeBatch}-${generateInfo.kodeVariant}-${generateInfo.tanggal.replaceAll("-", "").slice(2)}-${String(generateInfo.nextNumber).padStart(4, "0")}`
      : null;

  const completionSteps = [
    productId ? 1 : 0,
    styleId ? 1 : 0,
    colorId ? 1 : 0,
    sizeId ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <PageHeader completionSteps={completionSteps} />

        <ErrorAlert error={error} onDismiss={() => setError(null)} />

        {isLoading ? (
          <LoadingState />
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-7 xl:col-span-8">
              <ProductSelector
                products={products}
                productId={productId}
                productSearch={productSearch}
                onProductSearchChange={setProductSearch}
                onProductSelect={handleProductSelect}
              />

              <StyleColorSelector
                productId={productId}
                styleId={styleId}
                colorId={colorId}
                productVariants={productVariants}
                onStyleSelect={handleStyleSelect}
                onColorSelect={handleColorSelect}
              />

              <SizeSelector
                colorId={colorId}
                sizeId={sizeId}
                sizes={sizes}
                selectedSizeName={selectedSizeName}
                onSizeSelect={handleSizeSelect}
              />

              <VariantSummary
                selectedProduct={selectedProduct}
                selectedStyleName={selectedStyleName}
                selectedColorName={selectedColorName}
                selectedSizeName={selectedSizeName}
                previewCode={previewCode}
                generateInfo={generateInfo}
                onPreviewOpen={() => setIsPreviewOpen(true)}
                disabled={!selectedVariant}
              />
            </div>

            <div className="lg:col-span-5 xl:col-span-4">
              <div className="sticky top-24 space-y-4">
                <LivePreview
                  selectedProduct={selectedProduct}
                  selectedVariant={selectedVariant}
                  sizes={sizes}
                  sizeId={sizeId}
                  generateInfo={generateInfo}
                  generatedCode={generatedCode}
                  previewCode={previewCode}
                  printSize={printSize}
                  customMm={customMm}
                  printers={printers}
                  selectedPrinter={selectedPrinter}
                  isGenerating={isGenerating}
                  formatDate={formatDate}
                  onPrintSizeChange={setPrintSize}
                  onCustomMmChange={setCustomMm}
                  onPrinterChange={setSelectedPrinter}
                  onGenerate={handleGenerate}
                  onSaveDefaultPrinter={saveDefaultPrinter}
                />

                <p className="px-1 text-center text-xs leading-5 text-zinc-500">
                  Hangtag akan tercetak sesuai ukuran yang dipilih. Pastikan printer thermal siap sebelum klik Generate.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <PreviewModal
        isOpen={isPreviewOpen}
        selectedProduct={selectedProduct}
        selectedVariant={selectedVariant}
        sizes={sizes}
        sizeId={sizeId}
        generateInfo={generateInfo}
        generatedCode={generatedCode}
        previewCode={previewCode}
        printSize={printSize}
        customMm={customMm}
        printers={printers}
        selectedPrinter={selectedPrinter}
        isGenerating={isGenerating}
        formatDate={formatDate}
        onClose={() => setIsPreviewOpen(false)}
        onPrintSizeChange={setPrintSize}
        onCustomMmChange={setCustomMm}
        onPrinterChange={setSelectedPrinter}
        onGenerate={handleGenerate}
        onSaveDefaultPrinter={saveDefaultPrinter}
      />

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

export default CetakBarang;
