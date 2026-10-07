import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useReactToPrint } from "react-to-print";
import { generateBarang, getGenerateInfo, type GenerateInfo } from "../../api/barang";
import { getProducts, type Product } from "../../api/products";
import {
  fetchPrinters,
  isInElectron,
  loadDefaultPrinter,
  printHangtagSilently,
  resolveLabelMm,
  resolveLabelPage,
  sanitizeCustomMm,
  saveDefaultPrinter,
  type CustomLabelMm,
  type LabelSize,
  type PrinterInfo,
} from "../../lib/print";
import { Hangtag } from "../../components/public/Hangtag/Hangtag";
import { PrintDocument, type PrintJob } from "../../components/public/CetakLabel/PrintDocument";
import { getManufactureBarcode } from "../../lib/manufactureBarcode";
import { beep } from "../../lib/beep";

// ponytail: 50 label/job — window Electron + IPC per job, bukan per label.
// Naikkan bila driver printer terbukti tahan job lebih besar.
const PRINT_CHUNK = 50;
const MAX_COPIES = 500;

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]";
const CARD = "rounded-2xl border border-[#E5E9F0] bg-white";
const FIELD =
  "h-10 w-full rounded-lg border border-[#E5E9F0] bg-white px-3 text-sm text-[#0F1C2E] focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/25 disabled:opacity-60";
const SUB_BTN = `h-10 rounded-lg border border-[#E5E9F0] bg-white text-sm font-semibold text-[#475569] transition hover:border-[#1E3A5F]/40 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

const SIZE_OPTIONS: [LabelSize, string][] = [
  ["100x75mm", "100 × 75 mm (Hangtag)"],
  ["50x50mm", "50 × 50 mm (Sticker)"],
  ["33x15mm", "33 × 15 mm (Kecil)"],
  ["58x58mm", "58 × 58 mm (Thermal)"],
  ["100x100mm", "100 × 100 mm"],
  ["100x140mm", "100 × 140 mm"],
  ["100x200mm", "100 × 200 mm"],
  ["4x6inch", "4 × 6 inch"],
  ["custom", "Custom…"],
];

const MODEL_SUBTITLE: Record<string, string> = {
  windbreaker: "Open Face Series",
  sv300: "Double Visor",
  ffs21: "Full Face Racing",
  classic: "Retro Jet Series",
};

const CHECK = (
  <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
    <path clipRule="evenodd" fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
  </svg>
);

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const formatDate = (date: string) => new Date(date).toLocaleDateString("id-ID");

function uniqueBy<T extends { id: number }>(list: T[]) {
  return [...new Map(list.map((x) => [x.id, x])).values()];
}

function pick<T extends { id: number }>(list: T[], id: number | null) {
  return list.find((x) => x.id === id) ?? list[0];
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="font-mono tabular-nums">
      {now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} ·{" "}
      {now.toLocaleTimeString("id-ID")}
    </span>
  );
}

function Chip({ on, disabled, onClick, children, className = "" }: { on: boolean; disabled?: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border text-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS} ${
        on
          ? "border-[#1E3A5F] bg-[#1E3A5F] font-semibold text-white shadow-sm"
          : "border-[#E5E9F0] bg-white font-medium text-[#475569] hover:border-[#1E3A5F]/40"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Step({ n, title, aside, children }: { n: number; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${CARD} p-4 sm:p-5`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold text-[#0F1C2E]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#00A8E8]/10 text-xs font-bold text-[#0088C0]">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function CetakLabel() {
  const electron = isInElectron();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pickProduct, setPickProduct] = useState<number | null>(null);
  const [pickStyle, setPickStyle] = useState<number | null>(null);
  const [pickColor, setPickColor] = useState<number | null>(null);
  const [pickSize, setPickSize] = useState<number | null>(null);
  const [generateInfo, setGenerateInfo] = useState<GenerateInfo | null>(null);
  const [infoFetchedFor, setInfoFetchedFor] = useState<number | null>(null);
  const [queue, setQueue] = useState<PrintJob | null>(null);
  const [job, setJob] = useState<PrintJob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [printSize, setPrintSize] = useState<LabelSize>("100x75mm");
  const [customMm, setCustomMm] = useState<CustomLabelMm>({ width: 80, height: 80 });
  const [copies, setCopies] = useState(1);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>(() => loadDefaultPrinter());
  const [clearArmed, setClearArmed] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const page = resolveLabelPage(printSize, customMm);
  const labelMm = resolveLabelMm(printSize, customMm);
  const effectiveCopies = Math.max(1, Math.min(MAX_COPIES, Math.floor(copies) || 1));
  const busy = isGenerating || isPrinting;
  const printerLabel = electron ? selectedPrinter || "Printer default OS" : "Dialog cetak browser";
  const notify = useCallback((type: "success" | "error", msg: string) => setToast({ type, msg }), []);

  const printFn = useReactToPrint({
    contentRef,
    documentTitle: `Label-Barang-${new Date().toISOString().split("T")[0]}`,
    pageStyle: `
      @page { size: ${page}; page-orientation: portrait; margin: 0; }
      @media print {
        html, body { width: ${page.split(" ")[0]} !important; height: ${page.split(" ")[1]} !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #ffffff !important; }
        body > *:not(.print-document) { display: none !important; }
        .print-document { position: static !important; width: 100% !important; height: auto !important; display: block !important; padding: 0 !important; overflow: visible !important; visibility: visible !important; }
        .print-sheet { break-after: page !important; display: flex !important; align-items: center !important; justify-content: center !important; width: 100% !important; }
        .print-sheet:last-child { break-after: auto !important; }
      }
    `,
    onPrintError: (location, error) => {
      console.error(`Print error during ${location}:`, error);
      notify("error", `Gagal print: ${error.message}`);
    },
    onAfterPrint: () => setJob(null),
  });

  const loadProducts = useCallback(() => {
    setIsLoading(true);
    return getProducts()
      .then(setProducts)
      .catch(() => notify("error", "Produk belum dapat dimuat. Pastikan server API aktif."))
      .finally(() => setIsLoading(false));
  }, [notify]);

  useEffect(() => {
    let alive = true;
    getProducts()
      .then((list) => alive && setProducts(list))
      .catch(() => alive && notify("error", "Produk belum dapat dimuat. Pastikan server API aktif."))
      .finally(() => alive && setIsLoading(false));
    return () => {
      alive = false;
    };
  }, [notify]);

  useEffect(() => {
    if (!electron) return;
    fetchPrinters()
      .then((list) => {
        setPrinters(list);
        setSelectedPrinter((cur) =>
          cur && list.some((p) => p.name === cur) ? cur : (list.find((p) => p.isDefault)?.name ?? ""),
        );
      })
      .catch(() => setPrinters([]));
  }, [electron]);

  useEffect(() => {
    if (toast?.type !== "success") return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!clearArmed) return;
    const id = window.setTimeout(() => setClearArmed(false), 3000);
    return () => window.clearTimeout(id);
  }, [clearArmed]);

  const product = pick(products, pickProduct);
  const variants = product?.variants ?? [];
  const styles = uniqueBy(variants.map((v) => v.style));
  const style = pick(styles, pickStyle);
  const styleVariants = variants.filter((v) => v.styleId === style?.id);
  const colors = uniqueBy(styleVariants.map((v) => v.color));
  const color = pick(colors, pickColor);
  const colorVariants = styleVariants.filter((v) => v.colorId === color?.id);
  const sizes = uniqueBy(colorVariants.map((v) => v.size)).sort((a, b) => a.urutan - b.urutan);
  const size = pick(sizes, pickSize);
  const variant = colorVariants.find((v) => v.sizeId === size?.id);
  const variantId = variant?.id;
  const info = generateInfo && generateInfo.variantId === variantId ? generateInfo : null;
  const isInfoLoading = variantId != null && infoFetchedFor !== variantId;

  const barcodeValue = variant
    ? (getManufactureBarcode(variant.style.nama, variant.color.nama, variant.size.nama) ?? undefined)
    : undefined;
  const sizeOptions = sizes.map((s) => ({ id: s.id, nama: s.nama }));
  const previewCode = info
    ? (() => {
        const [y, m, d] = info.tanggal.split("-");
        return `${info.batch.kodeBatch}-${info.kodeVariant}-${d}${m}${y.slice(2)}-${String(info.nextNumber).padStart(4, "0")}`;
      })()
    : null;
  const spec = [product?.nama, style?.nama, color?.nama, size?.nama].filter(Boolean).join(" · ");

  const loadInfo = useCallback(
    (vid: number) =>
      getGenerateInfo(vid)
        .then(setGenerateInfo)
        .catch((e) => notify("error", errMsg(e, "Gagal memuat info batch.")))
        .finally(() => setInfoFetchedFor(vid)),
    [notify],
  );

  useEffect(() => {
    if (variantId == null) return;
    void loadInfo(variantId);
  }, [variantId, loadInfo]);

  const makeJob = (codes: string[]): PrintJob | null =>
    variant && product ? { codes, productName: product.nama, variant, sizes: sizeOptions, barcodeValue } : null;

  const waitForLabels = async (n: number) => {
    const deadline = Date.now() + Math.max(2000, n * 30);
    while (Date.now() < deadline) {
      const nodes = contentRef.current?.querySelectorAll(".hangtag");
      if (nodes?.length === n) return Array.from(nodes, (el) => (el as HTMLElement).outerHTML);
      await sleep(50);
    }
    return null;
  };

  const printJob = async (target: PrintJob, isTest: boolean) => {
    setIsPrinting(true);
    setJob(target);
    let keepJob = false;
    try {
      const htmls = await waitForLabels(target.codes.length);
      if (!htmls) {
        notify("error", "Label belum siap dirender — coba Cetak ulang.");
        beep(false);
        return;
      }
      if (!electron) {
        keepJob = true;
        printFn();
        return;
      }
      let sent = 0;
      for (let i = 0; i < htmls.length; i += PRINT_CHUNK) {
        const chunk = htmls.slice(i, i + PRINT_CHUNK);
        const result = await printHangtagSilently({
          hangtagHtmls: chunk,
          size: printSize,
          customMm,
          printerName: selectedPrinter || undefined,
          copies: 1,
        });
        if (result.status === "error") {
          if (!isTest) setQueue({ ...target, codes: target.codes.slice(sent) });
          notify("error", `${sent}/${target.codes.length} label terkirim. Printer: ${result.message}`);
          beep(false);
          return;
        }
        sent += chunk.length;
      }
      if (!isTest) setQueue(null);
      notify("success", `${target.codes.length} label terkirim ke ${printerLabel}.`);
      beep(true);
    } finally {
      if (!keepJob) setJob(null);
      setIsPrinting(false);
    }
  };

  const handleGenerate = async () => {
    if (!variant || busy || queue || !info) return;
    setIsGenerating(true);
    setToast(null);
    let codes: string[];
    try {
      const response = await generateBarang(variant.id, effectiveCopies);
      codes = response.batches.flatMap((b) => b.barang.map((x) => x.kodeBarang));
      if (codes.length === 0) throw new Error("Gagal generate barang");
    } catch (e) {
      notify("error", `${errMsg(e, "Gagal generate barang")} untuk varian ${variant.kodeVariant ?? variant.id}`);
      beep(false);
      return;
    } finally {
      setIsGenerating(false);
    }
    const newJob = makeJob(codes);
    if (!newJob) return;
    setQueue(newJob);
    void loadInfo(variant.id);
    await printJob(newJob, false);
  };

  const handleTestPrint = () => {
    if (!variant || busy) return;
    const time = new Date().toLocaleTimeString("id-ID", { hour12: false }).replace(/\D/g, "");
    const testJob = makeJob([`TEST-${variant.kodeVariant ?? variant.id}-${time}`]);
    if (testJob) void printJob(testJob, true);
  };

  const handleClearQueue = () => {
    if (electron && !clearArmed) {
      setClearArmed(true);
      return;
    }
    setClearArmed(false);
    setQueue(null);
  };

  const handleReset = () => {
    setPickProduct(null);
    setPickStyle(null);
    setPickColor(null);
    setPickSize(null);
    setCopies(1);
  };

  const generateRef = useRef(handleGenerate);
  useEffect(() => {
    generateRef.current = handleGenerate;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A", "SUMMARY"].includes(t.tagName) || t.isContentEditable)) return;
      e.preventDefault();
      void generateRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const canPrint = !!variant && !busy && !queue && !!info && !isInfoLoading;
  const printLabel = queue
    ? "Selesaikan antrean dulu"
    : isInfoLoading
      ? "Memuat info batch…"
      : isGenerating
        ? "Membuat kode…"
        : isPrinting
          ? "Mengirim ke printer…"
          : `Cetak ${effectiveCopies} label`;

  return (
    <div className="flex flex-1 flex-col bg-[#F6F8FB] pb-40 font-[Inter,sans-serif] text-[#0F1C2E] antialiased xl:pb-0">
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
          <div
            role={toast.type === "error" ? "alert" : "status"}
            aria-live={toast.type === "error" ? "assertive" : "polite"}
            className={`pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-[0_12px_32px_rgba(15,28,46,0.15)] ${
              toast.type === "error" ? "border-[#EF4444]/40" : "border-[#10B981]/40"
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${toast.type === "error" ? "bg-[#EF4444]" : "bg-[#10B981]"}`}
            >
              {toast.type === "error" ? "!" : "✓"}
            </span>
            <span className="flex-1 leading-snug">{toast.msg}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Tutup notifikasi"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${FOCUS}`}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 md:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Cetak Label</h1>
            <p className="mt-0.5 text-sm text-[#64748B]">Pilih varian, atur jumlah, lalu cetak.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
            <span className="rounded-lg border border-[#E5E9F0] bg-white px-3 py-1.5">
              <Clock />
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-[#E5E9F0] bg-white px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" aria-hidden="true" />
              {printerLabel}
            </span>
          </div>
        </div>

        <main className="flex flex-col gap-5 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 space-y-4">
            {isLoading ? (
              <div className={`${CARD} flex flex-col items-center py-16`}>
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#00A8E8]" />
                <p className="mt-3 text-sm text-[#64748B]">Memuat data produk…</p>
              </div>
            ) : products.length === 0 ? (
              <div className={`${CARD} flex flex-col items-center border-dashed py-14 text-center`}>
                <p className="font-semibold text-[#475569]">Belum ada produk</p>
                <p className="mt-1 max-w-sm text-sm text-[#64748B]">
                  Kalau server baru menyala, muat ulang. Kalau kosong, buat produk &amp; varian di Admin → Variant Produk.
                </p>
                <button type="button" onClick={() => void loadProducts()} className={`${SUB_BTN} mt-4 px-4`}>
                  Muat ulang
                </button>
              </div>
            ) : (
              <>
                <Step n={1} title="Model & style">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {products.map((p) => {
                      const on = p.id === product?.id;
                      return (
                        <Chip key={p.id} on={on} disabled={busy} onClick={() => setPickProduct(p.id)} className="flex-col !items-start px-3.5 py-3 text-left">
                          <span className="flex w-full items-center justify-between gap-2 font-bold tracking-tight">
                            {p.nama.toUpperCase()}
                            {on && CHECK}
                          </span>
                          <span className={`text-xs font-normal ${on ? "text-white/70" : "text-[#94A3B8]"}`}>
                            {MODEL_SUBTITLE[p.nama.trim().toLowerCase()] ?? `${p.variants.length} varian`}
                          </span>
                        </Chip>
                      );
                    })}
                  </div>
                  {styles.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#E5E9F0] pt-4">
                      {styles.map((s) => (
                        <Chip key={s.id} on={s.id === style?.id} disabled={busy} onClick={() => setPickStyle(s.id)} className="h-10 px-4">
                          {s.id === style?.id && CHECK}
                          {s.nama}
                        </Chip>
                      ))}
                    </div>
                  )}
                </Step>

                <Step n={2} title="Warna & ukuran" aside={<span className="text-xs text-[#64748B]">{[color?.nama, size && `Size ${size.nama}`].filter(Boolean).join(" · ")}</span>}>
                  <p className="mb-2 text-xs font-medium text-[#64748B]">Varian grafis</p>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((c) => (
                      <Chip key={c.id} on={c.id === color?.id} disabled={busy} onClick={() => setPickColor(c.id)} className="h-10 px-4">
                        {c.id === color?.id && CHECK}
                        {c.nama}
                      </Chip>
                    ))}
                  </div>
                  <p className="mb-2 mt-4 text-xs font-medium text-[#64748B]">Ukuran helm</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {sizes.map((s) => (
                      <Chip key={s.id} on={s.id === size?.id} disabled={busy} onClick={() => setPickSize(s.id)} className="h-12 text-base font-bold">
                        {s.nama}
                      </Chip>
                    ))}
                  </div>
                </Step>

                <Step n={3} title="Jumlah cetak">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex h-12 items-center overflow-hidden rounded-xl border border-[#E5E9F0] bg-white">
                      <button
                        type="button"
                        aria-label="Kurangi"
                        disabled={busy}
                        onClick={() => setCopies((c) => Math.max(1, c - 1))}
                        className={`grid h-12 w-12 place-items-center text-lg font-bold text-[#475569] hover:bg-slate-50 disabled:opacity-50 ${FOCUS}`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={MAX_COPIES}
                        value={copies}
                        disabled={busy}
                        aria-label="Jumlah label"
                        onChange={(e) => setCopies(Math.max(0, Number(e.target.value) || 0))}
                        onBlur={() => setCopies(effectiveCopies)}
                        className="h-12 w-20 border-x border-[#E5E9F0] text-center font-mono text-lg font-bold focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        aria-label="Tambah"
                        disabled={busy}
                        onClick={() => setCopies((c) => Math.min(MAX_COPIES, c + 1))}
                        className={`grid h-12 w-12 place-items-center text-lg font-bold text-[#475569] hover:bg-slate-50 disabled:opacity-50 ${FOCUS}`}
                      >
                        +
                      </button>
                    </div>
                    <div className="grid flex-1 grid-cols-4 gap-2">
                      {[1, 5, 10, 50].map((n) => (
                        <Chip key={n} on={effectiveCopies === n} disabled={busy} onClick={() => setCopies(n)} className="h-10">
                          {n}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <details className="mt-4 border-t border-[#E5E9F0] pt-3">
                    <summary className={`cursor-pointer list-none rounded text-sm font-semibold text-[#0088C0] [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                      Pengaturan printer · {labelMm.width}×{labelMm.height} mm
                    </summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium text-[#64748B]">
                        Ukuran kertas
                        <select value={printSize} disabled={busy} onChange={(e) => setPrintSize(e.target.value as LabelSize)} className={`${FIELD} mt-1`}>
                          {SIZE_OPTIONS.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-medium text-[#64748B]">
                        Printer
                        {electron ? (
                          <select
                            value={selectedPrinter}
                            disabled={busy}
                            onChange={(e) => {
                              setSelectedPrinter(e.target.value);
                              saveDefaultPrinter(e.target.value);
                            }}
                            className={`${FIELD} mt-1`}
                          >
                            <option value="">Default OS Printer</option>
                            {printers.map((p) => (
                              <option key={p.name} value={p.name}>
                                {p.displayName || p.name}
                                {p.isDefault ? " (Default)" : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`${FIELD} mt-1 flex items-center text-[#64748B]`}>Dipilih lewat dialog browser</span>
                        )}
                      </label>
                      {printSize === "custom" &&
                        (["width", "height"] as const).map((k) => (
                          <label key={k} className="text-xs font-medium text-[#64748B]">
                            {k === "width" ? "Lebar" : "Tinggi"} (mm)
                            <input
                              type="number"
                              min={10}
                              max={500}
                              value={customMm[k]}
                              disabled={busy}
                              onChange={(e) => setCustomMm((m) => ({ ...m, [k]: Number(e.target.value) }))}
                              onBlur={() => setCustomMm((m) => sanitizeCustomMm(m))}
                              className={`${FIELD} mt-1`}
                            />
                          </label>
                        ))}
                    </div>
                  </details>
                </Step>
              </>
            )}
          </div>

          <aside className="w-full space-y-4 xl:sticky xl:top-20 xl:w-[420px] xl:shrink-0">
            <section className={`${CARD} p-4 sm:p-5`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Pratinjau</h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-[#64748B]">
                  {labelMm.width}×{labelMm.height} mm
                </span>
              </div>
              <div
                className="flex h-[200px] items-center justify-center overflow-hidden rounded-xl border border-[#E5E9F0] sm:h-[250px]"
                style={{ backgroundColor: "#F1F5F9", backgroundImage: "radial-gradient(#CBD5E1 1px, transparent 1px)", backgroundSize: "16px 16px" }}
              >
                {variant && product ? (
                  <div className="origin-center scale-[0.6] sm:scale-[0.75]">
                    <div className="h-[284px] w-[378px] border border-[#E5E9F0] bg-white shadow-lg">
                      <Hangtag
                        productName={product.nama}
                        styleName={variant.style.nama}
                        colorName={variant.color.nama}
                        sizeName={variant.size.nama}
                        sizes={sizeOptions}
                        selectedSizeId={variant.sizeId}
                        kodeVariant={variant.kodeVariant ?? `Variant #${variant.id}`}
                        qrValue={previewCode ?? "-"}
                        barcodeValue={barcodeValue}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="px-6 text-center text-sm text-[#94A3B8]">Pilih varian untuk melihat pratinjau.</p>
                )}
              </div>

              <dl className="mt-3 divide-y divide-[#E5E9F0] text-xs">
                {[
                  ["Batch & tanggal", isInfoLoading ? "memuat…" : info ? `${info.batch.kodeBatch} · ${formatDate(info.tanggal)}` : "-"],
                  ["Spesifikasi", spec || "-"],
                  ["Kode berikutnya", previewCode ?? "-"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 py-2">
                    <dt className="shrink-0 text-[#64748B]">{k}</dt>
                    <dd className="truncate font-mono font-semibold" title={v}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
              {variant && !barcodeValue && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-800">
                  Kombinasi ini belum punya kode manufaktur — label dicetak tanpa barcode garis (QR tetap ada).
                </p>
              )}
            </section>

            <section className="fixed inset-x-0 bottom-0 z-30 space-y-2 border-t border-[#E5E9F0] bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur xl:static xl:rounded-2xl xl:border xl:p-5">
              {queue && (
                <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-900">
                    {queue.codes.length} label {electron ? "belum tercetak" : "menunggu konfirmasi"}
                  </p>
                  <p className="truncate text-xs text-amber-800">
                    {queue.productName} · {queue.variant.style.nama} · {queue.variant.color.nama} · {queue.variant.size.nama}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" disabled={busy} onClick={() => void printJob(queue, false)} className={`${SUB_BTN} border-amber-300`}>
                      Cetak ulang
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleClearQueue}
                      className={`${SUB_BTN} ${
                        electron
                          ? clearArmed
                            ? "!border-[#EF4444] !bg-[#EF4444] !text-white"
                            : "!text-[#EF4444]"
                          : "!border-[#10B981] !bg-[#10B981] !text-white"
                      }`}
                    >
                      {electron ? (clearArmed ? "Yakin? Ketuk lagi" : "Kosongkan antrean") : "Sudah tercetak ✓"}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={!canPrint}
                title="Tekan Enter untuk cetak"
                className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-[#1E3A5F] px-6 text-base font-bold text-white shadow-sm transition hover:bg-[#162C48] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none ${FOCUS}`}
              >
                {busy || isInfoLoading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                )}
                {printLabel}
              </button>
              <p className="truncate text-center text-xs text-[#64748B] xl:hidden">{spec}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={handleTestPrint} disabled={!variant || busy} title="Cetak 1 label contoh (tidak membuat data)" className={SUB_BTN}>
                  Test print
                </button>
                <button type="button" onClick={handleReset} disabled={busy} className={`${SUB_BTN} hover:!text-[#EF4444]`}>
                  Reset pilihan
                </button>
              </div>
              <p className="hidden items-center justify-center gap-1.5 text-xs text-[#64748B] xl:flex">
                <kbd className="rounded border border-[#E5E9F0] bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
                untuk cetak cepat
              </p>
            </section>
          </aside>
        </main>
      </div>

      <PrintDocument contentRef={contentRef} job={job} printSize={printSize} customMm={customMm} />
    </div>
  );
}

export default CetakLabel;
