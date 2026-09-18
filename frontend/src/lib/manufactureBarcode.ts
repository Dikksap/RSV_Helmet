// SKU barcode manufacture windbreaker untuk hangtag.
// Format: RSV + prefix style (AAA solid / AAB motif) + kode warna + kode size (XXL -> 2X).
// Cth: Motif + Carbon Graphic + MD -> RSVAAB001MD.
const STYLE_PREFIX: Record<string, string> = { motif: "AAB", solid: "AAA" };

const COLOR_CODE: Record<string, string> = {
  carbon: "001",
  "carbon graphic": "001",
  redline: "002",
  bob: "003",
  nation: "004",
  "black doff": "001",
  "black glossy": "002",
  "platinum grey": "003",
  "white glossy": "004",
};

export function getManufactureBarcode(
  styleName?: string,
  colorName?: string,
  sizeName?: string,
): string | null {
  const style = STYLE_PREFIX[(styleName ?? "").trim().toLowerCase()];
  const color =
    COLOR_CODE[(colorName ?? "").trim().toLowerCase().replace(/\s+/g, " ")];
  const sizeRaw = (sizeName ?? "").trim().toUpperCase();
  if (!style || !color || !sizeRaw) return null;
  return `RSV${style}${color}${sizeRaw === "XXL" ? "2X" : sizeRaw}`;
}
