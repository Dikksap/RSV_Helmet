import { useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faFileCsv, faUpload, faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import type { Product } from "../../api/products";
import type { MasterStyle, MasterColor, MasterSize } from "../../api/masterData";
import { createProductVariant } from "../../api/products";

type Props = {
  open: boolean;
  onClose: () => void;
  products: Product[];
  styles: Pick<MasterStyle, "id" | "nama">[];
  colors: Pick<MasterColor, "id" | "nama">[];
  sizes: Pick<MasterSize, "id" | "nama" | "urutan">[];
  onImported: () => void;
};

type ParsedRow = {
  idx: number; // 1-based data row number (excluding header)
  raw: Record<string, string>;
  produk: string;
  style: string;
  warna: string;
  ukuran: string;
  tanggal: string;
  productId?: number;
  styleId?: number;
  colorId?: number;
  sizeId?: number;
  errors: string[];
};

function normalizeHeader(h: string): string {
  const k = h.trim().toLowerCase();
  if (["produk", "product", "nama_produk", "namaproduk", "product_name", "produk_name"].includes(k)) return "produk";
  if (["style", "motif", "nama_style"].includes(k)) return "style";
  if (["warna", "color", "colour", "nama_warna", "nama_color"].includes(k)) return "warna";
  if (["ukuran", "size", "nama_ukuran", "nama_size"].includes(k)) return "ukuran";
  if (["tanggal", "date", "tgl"].includes(k)) return "tanggal";
  return k;
}

// CSV parser minimal — handle quoted fields, comma, newline
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushField = () => { cur.push(field); field = ""; };
  const pushRow = () => { lines.push(cur); cur = []; };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      } else { field += ch; i++; continue; }
    } else {
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ",") { pushField(); i++; continue; }
      if (ch === "\r") { i++; continue; }
      if (ch === "\n") { pushField(); pushRow(); i++; continue; }
      field += ch; i++; continue;
    }
  }
  pushField(); pushRow();
  // trim trailing empty rows
  while (lines.length && lines[lines.length - 1].every(v => v.trim() === "")) lines.pop();
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].map(h => h.trim());
  const rows = lines.slice(1).map(r => r.map(v => v.trim()));
  return { headers, rows };
}

function toISODate(s: string): string | null {
  if (!s) return null;
  const t = s.trim();
  // allow YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : t;
  }
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const dd = new Date(iso);
    return isNaN(dd.getTime()) ? null : iso;
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function VariantImportModal({ open, onClose, products, styles, colors, sizes, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: number; fail: number; fails: { idx: number; reason: string }[] } | null>(null);

  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) {
      m.set(p.nama.toLowerCase(), p);
      m.set(p.prefix.toLowerCase(), p);
      m.set(String(p.id), p);
    }
    return m;
  }, [products]);
  const styleMap = useMemo(() => new Map(styles.map(s => [s.nama.toLowerCase(), s])), [styles]);
  const colorMap = useMemo(() => new Map(colors.map(c => [c.nama.toLowerCase(), c])), [colors]);
  const sizeMap = useMemo(() => new Map(sizes.map(z => [z.nama.toLowerCase(), z])), [sizes]);

  const reset = () => {
    setParsed([]); setFileName(null); setResult(null); setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => { if (!importing) { reset(); onClose(); } };

  const downloadTemplate = () => {
    const header = "produk,style,warna,ukuran,tanggal";
    const example = [
      `${products[0]?.nama ?? "Windbreaker"},${styles[0]?.nama ?? "Motif"},${colors[0]?.nama ?? "BOB"},${sizes[0]?.nama ?? "LG"},2026-08-01`,
      `${products[0]?.nama ?? "Windbreaker"},${styles[1]?.nama ?? styles[0]?.nama ?? "Polos"},${colors[1]?.nama ?? colors[0]?.nama ?? "HITAM"},${sizes[1]?.nama ?? sizes[0]?.nama ?? "XL"},2026-08-02`,
    ];
    const csv = [header, ...example].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "template_import_variant.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const buildRows = (headers: string[], rows: string[][]): ParsedRow[] => {
    const normHeaders = headers.map(normalizeHeader);
    const idxProduk = normHeaders.indexOf("produk");
    const idxStyle = normHeaders.indexOf("style");
    const idxWarna = normHeaders.indexOf("warna");
    const idxUkuran = normHeaders.indexOf("ukuran");
    const idxTanggal = normHeaders.indexOf("tanggal");

    const missing: string[] = [];
    if (idxProduk === -1) missing.push("produk");
    if (idxStyle === -1) missing.push("style");
    if (idxWarna === -1) missing.push("warna");
    if (idxUkuran === -1) missing.push("ukuran");
    if (missing.length) {
      throw new Error(`Header wajib: produk, style, warna, ukuran. Hilang: ${missing.join(", ")}. Header ditemukan: ${headers.join(", ")}`);
    }

    const seen = new Set<string>();
    return rows.map((r, i) => {
      const produk = (r[idxProduk] ?? "").trim();
      const style = (r[idxStyle] ?? "").trim();
      const warna = (r[idxWarna] ?? "").trim();
      const ukuran = (r[idxUkuran] ?? "").trim();
      const tanggalRaw = idxTanggal === -1 ? "" : (r[idxTanggal] ?? "").trim();
      const tanggalISO = tanggalRaw ? toISODate(tanggalRaw) : "";
      const errors: string[] = [];
      let productId: number | undefined;
      let styleId: number | undefined;
      let colorId: number | undefined;
      let sizeId: number | undefined;

      if (!produk) errors.push("produk wajib");
      else {
        const p = productMap.get(produk.toLowerCase());
        if (!p) errors.push(`produk "${produk}" tidak ditemukan`);
        else productId = p.id;
      }
      if (!style) errors.push("style wajib");
      else {
        const s = styleMap.get(style.toLowerCase());
        if (!s) errors.push(`style "${style}" tidak ditemukan di master`);
        else styleId = s.id;
      }
      if (!warna) errors.push("warna wajib");
      else {
        const c = colorMap.get(warna.toLowerCase());
        if (!c) errors.push(`warna "${warna}" tidak ditemukan`);
        else colorId = c.id;
      }
      if (!ukuran) errors.push("ukuran wajib");
      else {
        const z = sizeMap.get(ukuran.toLowerCase());
        if (!z) errors.push(`ukuran "${ukuran}" tidak ditemukan`);
        else sizeId = z.id;
      }
      if (tanggalRaw && tanggalISO === null) errors.push(`tanggal "${tanggalRaw}" format tidak valid (pakai YYYY-MM-DD)`);

      let key: string | null = null;
      if (productId && styleId && colorId && sizeId) {
        key = `${productId}-${styleId}-${colorId}-${sizeId}`;
        if (seen.has(key)) errors.push("duplikat kombinasi dalam file");
        else seen.add(key);
      }

      const raw: Record<string, string> = {};
      headers.forEach((h, hi) => { raw[h] = r[hi] ?? ""; });

      return {
        idx: i + 1,
        raw,
        produk, style, warna, ukuran,
        tanggal: tanggalRaw ? (tanggalISO ?? tanggalRaw) : "",
        productId, styleId, colorId, sizeId,
        errors: tanggalRaw && tanggalISO ? (() => { const e = [...errors]; return e; })() : errors,
      };
    }).map(r => {
      // normalize tanggal to ISO if valid
      if (r.tanggal && toISODate(r.tanggal)) r.tanggal = toISODate(r.tanggal)!;
      return r;
    });
  };

  const handleFile = async (file: File) => {
    setResult(null); setProgress(0);
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      if (ext === "csv" || ext === "txt") {
        const text = await file.text();
        const { headers, rows } = parseCSV(text);
        if (headers.length === 0) throw new Error("File kosong atau header hilang");
        const built = buildRows(headers, rows);
        setParsed(built);
        setFileName(file.name);
        return;
      }
      if (ext === "xlsx" || ext === "xls") {
        // Try dynamic import xlsx if available
        try {
          // @ts-ignore
          const mod: any = await import("xlsx");
          const XLSX: any = mod.default ?? mod;
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
          if (json.length === 0) throw new Error("Sheet kosong");
          const headers = (json[0] as string[]).map(String);
          const rows = json.slice(1).map(r => (headers as string[]).map((_, i) => String(r[i] ?? "").trim()));
          const built = buildRows(headers, rows);
          setParsed(built);
          setFileName(file.name);
          return;
        } catch (e: any) {
          if (e?.message?.includes("Cannot find package") || e?.message?.includes("Failed to resolve")) {
            throw new Error("File XLSX butuh dependency 'xlsx'. Install: npm i xlsx  atau simpan sebagai CSV.");
          }
          throw e;
        }
      }
      // fallback: try as text
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      const built = buildRows(headers, rows);
      setParsed(built);
      setFileName(file.name);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal parse file");
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  };

  const validRows = useMemo(() => parsed.filter(r => r.errors.length === 0), [parsed]);
  const invalidRows = useMemo(() => parsed.filter(r => r.errors.length > 0), [parsed]);

  const doImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true); setProgress(0); setResult(null);
    let ok = 0; let fail = 0;
    const fails: { idx: number; reason: string }[] = [];
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      try {
        await createProductVariant(r.productId!, { styleId: r.styleId!, colorId: r.colorId!, sizeId: r.sizeId!, tanggal: r.tanggal || undefined });
        ok++;
      } catch (e) {
        fail++;
        fails.push({ idx: r.idx, reason: e instanceof Error ? e.message : "Gagal" });
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }
    setResult({ ok, fail, fails });
    setImporting(false);
    if (ok > 0) onImported();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-brand-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Import Variant</h2>
            <p className="text-xs text-brand-grey">CSV/XLSX — POST /api/products/:id/variants per baris. KodeVariant auto W001.</p>
          </div>
          <button type="button" onClick={handleClose} disabled={importing} className="rounded-lg p-1 text-brand-grey hover:text-white disabled:opacity-40">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm font-bold text-brand-grey-light hover:border-brand-gold hover:text-brand-gold">
                <FontAwesomeIcon icon={faDownload} className="h-4 w-4" /> Template CSV
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2 text-sm font-bold text-brand-gold hover:bg-brand-gold hover:text-brand-black">
                <FontAwesomeIcon icon={faUpload} className="h-4 w-4" /> Pilih File
                <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={onFileChange} className="hidden" />
              </label>
              {fileName && <span className="flex items-center gap-1 text-xs text-brand-grey-light"><FontAwesomeIcon icon={faFileCsv} /> {fileName} — {parsed.length} baris</span>}
            </div>

            <div className="rounded-lg border border-brand-border bg-brand-surface p-3 text-xs leading-relaxed text-brand-grey">
              <p className="font-bold text-brand-grey-light">Format header (case-insensitive): <code className="font-mono text-brand-gold">produk,style,warna,ukuran,tanggal</code></p>
              <p>Alias diterima: produk→product/prefix/ID, warna→color, ukuran→size, tanggal opsional YYYY-MM-DD (atau DD/MM/YYYY). Nama harus persis dengan Master Data & Produk.</p>
              <p>POST per baris — 409 jika kombinasi produk/style/warna/ukuran sudah ada. Tanggal kosong = now.</p>
            </div>

            <details className="rounded-lg border border-brand-gold/20 bg-brand-gold/5 px-4 py-3">
              <summary className="cursor-pointer list-none text-xs font-bold text-brand-gold"><FontAwesomeIcon icon={faCircleInfo} className="mr-1 h-3 w-3" /> Cara import (6 langkah) — klik untuk buka</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-brand-grey-light">
                <li>Buat <strong>Produk</strong> di tab Produk & <strong>Style/Warna/Ukuran</strong> di <code className="font-mono">/admin/master-data</code> dulu.</li>
                <li>Klik <strong>Template CSV</strong> → buka di Excel/Sheets, isi baris. Contoh: <code className="font-mono">Windbreaker,Motif,BOB,LG,2026-08-01</code></li>
                <li>Simpan sebagai <strong>CSV UTF-8</strong> (koma). XLSX bisa tapi butuh <code className="font-mono">npm i xlsx</code> atau save as CSV.</li>
                <li>Klik <strong>Pilih File</strong> → preview cek <span className="text-emerald-300">OK</span> vs <span className="text-rose-300">invalid + alasan</span>.</li>
                <li>Klik <strong>Import X variant</strong> → progress bar, jangan tutup modal.</li>
                <li>Selesai → tabel otomatis reload. Gagal 409 = kombinasi sudah ada, perbaiki CSV dan import lagi.</li>
              </ol>
              <p className="mt-2 text-[11px] text-brand-grey">Panduan lengkap: <code className="font-mono">frontend/IMPORT_VARIANT_GUIDE.md</code> (header alias, error table, curl alternatif).</p>
            </details>

            {/* stats */}
            {parsed.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-bold text-emerald-300">{validRows.length} valid</span>
                <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 font-bold text-rose-300">{invalidRows.length} invalid</span>
                <span className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-brand-grey">{parsed.length} total</span>
              </div>
            )}

            {/* preview */}
            {parsed.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-brand-border">
                <div className="max-h-64 overflow-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-brand-surface text-brand-grey">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Produk</th>
                        <th className="px-3 py-2">Style</th>
                        <th className="px-3 py-2">Warna</th>
                        <th className="px-3 py-2">Ukuran</th>
                        <th className="px-3 py-2">Tanggal</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {parsed.slice(0, 100).map(r => (
                        <tr key={r.idx} className={r.errors.length ? "bg-rose-500/5" : "bg-emerald-500/5"}>
                          <td className="px-3 py-1.5 font-mono text-brand-grey-light">{r.idx}</td>
                          <td className="px-3 py-1.5 text-white">{r.produk}{r.productId ? <span className="ml-1 text-[10px] text-brand-grey">→{r.productId}</span> : null}</td>
                          <td className="px-3 py-1.5 text-brand-grey-light">{r.style}</td>
                          <td className="px-3 py-1.5 text-brand-grey-light">{r.warna}</td>
                          <td className="px-3 py-1.5 text-brand-grey-light">{r.ukuran}</td>
                          <td className="px-3 py-1.5 text-brand-grey">{r.tanggal || "-"}</td>
                          <td className="px-3 py-1.5">
                            {r.errors.length === 0 ? <span className="font-bold text-emerald-400">OK</span> : <span className="text-rose-300">{r.errors.join("; ")}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsed.length > 100 && <p className="border-t border-brand-border bg-brand-surface px-3 py-2 text-center text-xs text-brand-grey">... +{parsed.length - 100} baris lagi (preview 100 pertama)</p>}
              </div>
            )}

            {/* progress / result */}
            {importing && (
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-brand-surface">
                  <div className="h-full bg-brand-gold transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-brand-grey">Mengimpor {progress}% — jangan tutup modal...</p>
              </div>
            )}
            {result && (
              <div className={`rounded-lg border px-4 py-3 text-sm ${result.fail === 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
                <p className="font-bold">Selesai: {result.ok} berhasil, {result.fail} gagal dari {validRows.length} valid.</p>
                {result.fails.length > 0 && (
                  <ul className="mt-2 max-h-32 list-disc overflow-auto pl-5 text-xs">
                    {result.fails.slice(0, 20).map(f => <li key={f.idx}>baris {f.idx}: {f.reason}</li>)}
                    {result.fails.length > 20 && <li>... +{result.fails.length - 20} lagi</li>}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between gap-2 border-t border-brand-border bg-brand-surface/40 px-6 py-4">
          <button type="button" onClick={handleClose} disabled={importing} className="rounded-lg border border-brand-border bg-brand-surface px-4 py-2.5 text-sm font-bold text-brand-grey-light hover:text-white disabled:opacity-40">Tutup</button>
          <button type="button" disabled={importing || validRows.length === 0} onClick={() => void doImport()} className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold hover:bg-brand-gold hover:text-brand-black disabled:opacity-40">
            {importing ? `Mengimpor ${progress}%...` : `Import ${validRows.length} variant`}
          </button>
        </div>
      </div>
    </div>
  );
}
