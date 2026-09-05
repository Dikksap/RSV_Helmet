import hangtagCss from "../components/Hangtag/hangtag.css?raw";

export interface PrinterInfo {
  name: string;
  displayName?: string;
  isDefault?: boolean;
  description?: string;
  status?: number;
}

export interface SilentPrintPayload {
  html: string;
  printerName?: string | null;
  copies?: number;
  pageSize?: string | { width: number; height: number };
  landscape?: boolean;
}

export interface SilentPrintResult {
  status: "success" | "error";
  message: string;
}

const PRINTER_STORAGE_KEY = "defaultPrinter";

const MICRONS_PER_MM = 1000;
const MICRONS_PER_INCH = 25400;

export type LabelSize =
  | "33x15mm"
  | "50x50mm"
  | "58x58mm"
  | "100x75mm"
  | "100x100mm"
  | "100x140mm"
  | "100x200mm"
  | "4x6inch"
  | "custom";

export interface CustomLabelMm {
  width: number;
  height: number;
}

export const labelSizeMicrons: Record<
  LabelSize,
  { width: number; height: number }
> = {
  "33x15mm": {
    width: 33 * MICRONS_PER_MM,
    height: 15 * MICRONS_PER_MM,
  },
  "50x50mm": {
    width: 50 * MICRONS_PER_MM,
    height: 50 * MICRONS_PER_MM,
  },
  "58x58mm": {
    width: 58 * MICRONS_PER_MM,
    height: 58 * MICRONS_PER_MM,
  },
  "100x75mm": {
    width: 100 * MICRONS_PER_MM,
    height: 75 * MICRONS_PER_MM,
  },
  "100x100mm": {
    width: 100 * MICRONS_PER_MM,
    height: 100 * MICRONS_PER_MM,
  },
  "100x140mm": {
    width: 100 * MICRONS_PER_MM,
    height: 140 * MICRONS_PER_MM,
  },
  "100x200mm": {
    width: 100 * MICRONS_PER_MM,
    height: 200 * MICRONS_PER_MM,
  },
  "4x6inch": {
    width: 4 * MICRONS_PER_INCH,
    height: 6 * MICRONS_PER_INCH,
  },
  custom: {
    width: 80 * MICRONS_PER_MM,
    height: 80 * MICRONS_PER_MM,
  },
};

export const labelSizeMm: Record<LabelSize, { width: number; height: number }> =
  {
    "33x15mm": { width: 33, height: 15 },
    "50x50mm": { width: 50, height: 50 },
    "58x58mm": { width: 58, height: 58 },
    "100x75mm": { width: 100, height: 75 },
    "100x100mm": { width: 100, height: 100 },
    "100x140mm": { width: 100, height: 140 },
    "100x200mm": { width: 100, height: 200 },
    "4x6inch": { width: 101.6, height: 152.4 },
    custom: { width: 80, height: 80 },
  };

export const labelSizeConfig: Record<LabelSize, { page: string }> = {
  "33x15mm": { page: "33mm 15mm" },
  "50x50mm": { page: "50mm 50mm" },
  "100x75mm": { page: "100mm 75mm" },
  "100x100mm": { page: "100mm 100mm" },
  "100x140mm": { page: "100mm 140mm" },
  "100x200mm": { page: "100mm 200mm" },
  "58x58mm": { page: "58mm 58mm" },
  "4x6inch": { page: "4in 6in" },
  custom: { page: "80mm 80mm" },
};

export function sanitizeCustomMm(custom?: CustomLabelMm): CustomLabelMm {
  const width = Number(custom?.width);
  const height = Number(custom?.height);
  return {
    width: Number.isFinite(width) ? Math.min(500, Math.max(10, width)) : 80,
    height: Number.isFinite(height) ? Math.min(500, Math.max(10, height)) : 80,
  };
}

export function resolveLabelMm(
  size: LabelSize,
  custom?: CustomLabelMm,
): { width: number; height: number } {
  if (size === "custom") return sanitizeCustomMm(custom);
  return labelSizeMm[size];
}

export function resolveLabelMicrons(
  size: LabelSize,
  custom?: CustomLabelMm,
): { width: number; height: number } {
  if (size === "custom") {
    const mm = sanitizeCustomMm(custom);
    return { width: mm.width * MICRONS_PER_MM, height: mm.height * MICRONS_PER_MM };
  }
  return labelSizeMicrons[size];
}

export function resolveLabelPage(size: LabelSize, custom?: CustomLabelMm): string {
  if (size === "custom") {
    const mm = sanitizeCustomMm(custom);
    return `${mm.width}mm ${mm.height}mm`;
  }
  return labelSizeConfig[size].page;
}
export function isInElectron(): boolean {
  return typeof window !== "undefined" && window.electron?.isElectron === true;
}

export async function fetchPrinters(): Promise<PrinterInfo[]> {
  if (!isInElectron() || !window.electron) {
    return [];
  }
  return window.electron.getPrinters();
}

export function saveDefaultPrinter(name: string): void {
  if (name) {
    localStorage.setItem(PRINTER_STORAGE_KEY, name);
  } else {
    localStorage.removeItem(PRINTER_STORAGE_KEY);
  }
}

export function loadDefaultPrinter(): string {
  return localStorage.getItem(PRINTER_STORAGE_KEY) ?? "";
}

export interface HangtagPrintRequest {
  hangtagHtml: string;
  size: LabelSize;
  customMm?: CustomLabelMm;
  printerName?: string;
  copies?: number;
}

export function buildHangtagPrintHtml(request: HangtagPrintRequest): string {
  const microns = resolveLabelMicrons(request.size, request.customMm);
  const page = resolveLabelPage(request.size, request.customMm);
  const [width] = page.split(" ");
  const widthMm = microns.width / MICRONS_PER_MM;
  const heightMm = microns.height / MICRONS_PER_MM;
  const scale = Math.min(widthMm / 100, heightMm / 75);

  return [
    "<!doctype html>",
    '<html><head><meta charset="utf-8" /><style>',
    `@page { size: ${page}; page-orientation: portrait; margin: 0; }`,
    "* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }",
    `html, body { margin: 0; padding: 0; width: ${width}; height: ${heightMm}mm; overflow: hidden; background: #ffffff; }`,
    ".print-stage { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }",
    hangtagCss,
    "</style></head>",
    `<body><div class="print-stage"><div class="hangtag-fit" style="width: ${(100 * scale).toFixed(4)}mm; height: ${(75 * scale).toFixed(4)}mm;"><div class="hangtag-fit-inner" style="transform: scale(${scale});">${request.hangtagHtml}</div></div></div></body></html>`,
  ].join("");
}

export async function printHangtagSilently(
  request: HangtagPrintRequest,
): Promise<SilentPrintResult> {
  if (!window.electron) {
    throw new Error("Silent print hanya tersedia di aplikasi Electron.");
  }

  const html = buildHangtagPrintHtml(request);

  const savedPrinter = loadDefaultPrinter();
  const printerName = request.printerName ?? savedPrinter;

  return window.electron.printSilent({
    html,
    printerName: printerName || null,
    copies: request.copies ?? 1,
    pageSize: resolveLabelMicrons(request.size, request.customMm),
    landscape: false,
  });
}
