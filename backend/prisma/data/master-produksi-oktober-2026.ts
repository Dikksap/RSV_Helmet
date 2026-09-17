// Sumber: Google Sheet "DATA MASTER PRODUKSI OKTOBER 2026"
// Sheet: MASTER PRODUKSI — 24 baris (6 style+color x 4 size), total 5000 pcs.
// Kolom "Item" di sheet = Style + Color; seed me-resolve ke ProductVariant via
// (product, style, color, size).
export const PRODUCTION_ORDER_OKTOBER_2026 = {
  nomor: "PO-202610-001",
  periode: "2026-10",
  label: "DATA MASTER PRODUKSI OKTOBER 2026",
  status: "AKTIF" as const,
  product: "Windbreaker",
  items: [
    { style: "Motif", color: "Carbon", size: "MD", qty: 600, priority: 5 },
    { style: "Motif", color: "Carbon", size: "LG", qty: 443, priority: 5 },
    { style: "Motif", color: "Carbon", size: "XL", qty: 243, priority: 5 },
    { style: "Motif", color: "Carbon", size: "XXL", qty: 215, priority: 5 },
    { style: "Motif", color: "Redline", size: "MD", qty: 265, priority: 6 },
    { style: "Motif", color: "Redline", size: "LG", qty: 364, priority: 6 },
    { style: "Motif", color: "Redline", size: "XL", qty: 370, priority: 6 },
    { style: "Motif", color: "Redline", size: "XXL", qty: 101, priority: 6 },
    { style: "Solid", color: "Black Doff", size: "MD", qty: 3, priority: 2 },
    { style: "Solid", color: "Black Doff", size: "LG", qty: 214, priority: 2 },
    { style: "Solid", color: "Black Doff", size: "XL", qty: 144, priority: 2 },
    { style: "Solid", color: "Black Doff", size: "XXL", qty: 88, priority: 2 },
    { style: "Solid", color: "Black Glossy", size: "MD", qty: 150, priority: 1 },
    { style: "Solid", color: "Black Glossy", size: "LG", qty: 90, priority: 1 },
    { style: "Solid", color: "Black Glossy", size: "XL", qty: 262, priority: 1 },
    { style: "Solid", color: "Black Glossy", size: "XXL", qty: 149, priority: 1 },
    { style: "Solid", color: "White Glossy", size: "MD", qty: 196, priority: 3 },
    { style: "Solid", color: "White Glossy", size: "LG", qty: 221, priority: 3 },
    { style: "Solid", color: "White Glossy", size: "XL", qty: 151, priority: 3 },
    { style: "Solid", color: "White Glossy", size: "XXL", qty: 82, priority: 3 },
    { style: "Solid", color: "Platinum Grey", size: "MD", qty: 176, priority: 4 },
    { style: "Solid", color: "Platinum Grey", size: "LG", qty: 229, priority: 4 },
    { style: "Solid", color: "Platinum Grey", size: "XL", qty: 150, priority: 4 },
    { style: "Solid", color: "Platinum Grey", size: "XXL", qty: 94, priority: 4 },
  ],
};
