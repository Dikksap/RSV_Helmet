import { useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faFileCsv, faUpload } from "@fortawesome/free-solid-svg-icons";
import { addOrderItem } from "../../api/productionOrders";
import type { VariantProdukRow } from "../../api/products";

type Props = {
  open: boolean;
  onClose: () => void;
  orderId: number;
  variants: VariantProdukRow[];
  usedVariantIds: Set<number>;
  onImported: () => void;
};

type ParsedRow = {
  idx: number;
  kode: string;
  qtyRaw: string;
  priorityRaw: string;
  variantId?: number;
  qty?: number;
  priority?: number;
  errors: string[];
};
function normalizeHeader(h: string): string {
  const k = h.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["kode_variant", "kodevariant", "kode", "variant", "variant_code"].includes(k)) return "kode";
  if (["item", "nama_item", "produk", "product"].includes(k)) return "item";
  if (["size", "ukuran", "nama_size", "nama_ukuran"].includes(k)) return "size";
  if (["qty", "quantity", "jumlah", "stok", "stock"].includes(k)) return "qty";
  if (["priority", "prioritas", "prio"].includes(k)) return "priority";
  return k;
}

// CSV parser minimal — handle quoted fields, koma, newline.
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
  while (lines.length && lines[lines.length - 1].every((v) => v.trim() === "")) lines.pop();
  if (lines.length === 0) return { headers: [], rows: [] };
  return { headers: lines[0].map((h) => h.trim()), rows: lines.slice(1).map((r) => r.map((v) => v.trim())) };
}

export default function OrderImportModal({ open, onClose, orderId, variants, usedVariantIds, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: number; fail: number; fails: { idx: number; reason: string }[] } | null>(null);

  const variantMap = useMemo(() => {
    const m = new Map<string, VariantProdukRow>();
    for (const v of variants) {
      m.set(v.kodeVariant.toLowerCase(), v);
      m.set(String(v.id), v);
    }
    return m;
  }, [variants]);

  // Mode staf: "Item" = "<Style> <Color...>", mis. "Solid Black Doff".
  const styleNames = useMemo(() => {
    const names = [...new Set(variants.map((v) => v.namaStyle))];
    names.sort((a, b) => b.length - a.length); // prefix terpanjang dulu
    return names;
  }, [variants]);

  const variantByNames = useMemo(() => {
    const m = new Map<string, VariantProdukRow>();
    for (const v of variants) {
      m.set(`${v.namaStyle.toLowerCase()}|${v.namaColor.toLowerCase()}|${v.namaSize.toLowerCase()}`, v);
    }
    return m;
  }, [variants]);

  const splitItem = (item: string): { style: string; color: string } | null => {
    const t = item.trim();
    for (const s of styleNames) {
      if (t.length > s.length && t.slice(0, s.length).toLowerCase() === s.toLowerCase() && /\s/.test(t[s.length] ?? "")) {
        return { style: s, color: t.slice(s.length).trim() };
      }
    }
    return null;
  };

  const reset = () => {
    setParsed([]); setFileName(null); setResult(null); setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => { if (!importing) { reset(); onClose(); } };

  const downloadTemplate = () => {
    // Format staf: item,size,stok,priority (+ contoh). Kolom "total per item"
    // di file staf diabaikan saat import (dihitung ulang).
    const header = "item,size,stok,priority";
    const ex = variants.slice(0, 4);
    const example = ex.length > 0
      ? ex.map((v, i) => `${v.namaStyle} ${v.namaColor},${v.namaSize},100,${i}`)
      : ["Motif Carbon,MD,600,5", "Motif Carbon,LG,443,5"];
    const daftar = [...new Set(variants.map((v) => `${v.namaStyle} ${v.namaColor}`))].sort();
    const sizes = [...new Set(variants.map((v) => v.namaSize))];
    const csv = [
      header,
      ...example,
      "",
      "# DAFTAR ITEM VALID (hapus semua baris # sebelum import):",
      ...daftar.map((d) => `# ${d}`),
      `# SIZE VALID: ${sizes.join(" / ")}`,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "template_import_master_produksi.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const buildRows = (headers: string[], rows: string[][]): ParsedRow[] => {
    const norm = headers.map(normalizeHeader);
    const iKode = norm.indexOf("kode");
    const iItem = norm.indexOf("item");
    const iSize = ["size", "ukuran"].map((k) => norm.indexOf(k)).find((i) => i >= 0) ?? -1;
    const iQty = ["qty", "quantity", "jumlah", "stok", "stock"].map((k) => norm.indexOf(k)).find((i) => i >= 0) ?? -1;
    const iPrio = norm.indexOf("priority");

    // Dua format: kode_variant langsung, atau format staf (item + size).
    // "total per item" di file staf sengaja diabaikan (dihitung ulang).
    const mode: "kode" | "staf" | null =
      iKode !== -1 && iQty !== -1 ? "kode"
      : iItem !== -1 && iSize !== -1 && iQty !== -1 ? "staf"
      : null;
    if (!mode) {
      throw new Error(
        `Header tak dikenal. Pakai "kode_variant,qty,priority" atau "item,size,stok,priority". Ditemukan: ${headers.join(", ")}`,
      );
    }

    const seen = new Set<number>();
    const out: ParsedRow[] = [];
    rows.forEach((r, i) => {
      // Lewati baris komentar template (# ...) dan baris kosong.
      const firstCell = mode === "kode" ? (r[iKode] ?? "") : (r[iItem] ?? "");
      if (firstCell.trim().startsWith("#") || r.every((c) => (c ?? "").trim() === "")) return;

      const qtyRaw = (r[iQty] ?? "").trim();
      const priorityRaw = iPrio === -1 ? "0" : (r[iPrio] ?? "").trim() || "0";
      const errors: string[] = [];
      let variantId: number | undefined;
      let qty: number | undefined;
      let priority: number | undefined;
      let kode = "";

      if (mode === "kode") {
        kode = firstCell.trim();
        if (!kode) errors.push("kode_variant wajib");
        else {
          const v = variantMap.get(kode.toLowerCase());
          if (!v) errors.push(`variant "${kode}" tidak ditemukan`);
          else if (usedVariantIds.has(v.id)) errors.push(`"${kode}" sudah ada di order`);
          else if (seen.has(v.id)) errors.push(`"${kode}" duplikat dalam file`);
          else { variantId = v.id; seen.add(v.id); }
        }
      } else {
        const item = firstCell.trim();
        const size = (r[iSize] ?? "").trim();
        kode = item && size ? `${item} ${size}` : item || size;
        if (!item) errors.push("item wajib");
        if (!size) errors.push("size wajib");
        if (item && size) {
          const split = splitItem(item);
          const key = split ? `${split.style.toLowerCase()}|${split.color.toLowerCase()}|${size.toLowerCase()}` : null;
          const v = key ? variantByNames.get(key) : undefined;
          if (!v) errors.push(`kombinasi "${item} ${size}" tidak ditemukan di master`);
          else if (usedVariantIds.has(v.id)) errors.push(`"${item} ${size}" sudah ada di order`);
          else if (seen.has(v.id)) errors.push(`"${item} ${size}" duplikat dalam file`);
          else { variantId = v.id; seen.add(v.id); }
        }
      }

      const q = Number(qtyRaw);
      if (qtyRaw === "" || !Number.isInteger(q) || q < 0) errors.push(`stok "${qtyRaw}" harus angka ≥ 0`);
      else qty = q;
      const p = Number(priorityRaw);
      if (!Number.isInteger(p) || p < 0) errors.push(`priority "${priorityRaw}" harus angka ≥ 0`);
      else priority = p;

      out.push({ idx: i + 1, kode, qtyRaw, priorityRaw, variantId, qty, priority, errors });
    });
    return out;
  };

  const handleFile = async (file: File) => {
    setResult(null); setProgress(0);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let headers: string[] = [];
      let rows: string[][] = [];
      if (ext === "xlsx" || ext === "xls") {
        const mod: unknown = await import("xlsx");
        const XLSX = ((mod as { default?: unknown }).default ?? mod) as {
          read: (b: ArrayBuffer, o: object) => { SheetNames: string[]; Sheets: Record<string, unknown> };
          utils: { sheet_to_json: (s: unknown, o: object) => string[][] };
        };
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
        if (json.length === 0) throw new Error("Sheet kosong");
        headers = (json[0] as string[]).map(String);
        rows = json.slice(1).map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
      } else {
        // Copy-paste Excel (tab) ditempel ke .txt/.csv juga bisa.
        const text = await file.text();
        const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
        if (firstLine.includes("\t")) {
          const lines = text.split(/\r?\n/).map((l) => l.split("\t").map((v) => v.trim()));
          while (lines.length && lines[lines.length - 1].every((v) => v === "")) lines.pop();
          if (lines.length === 0) throw new Error("File kosong atau header hilang");
          headers = lines[0];
          rows = lines.slice(1);
        } else {
          const parsedCsv = parseCSV(text);
          if (parsedCsv.headers.length === 0) throw new Error("File kosong atau header hilang");
          headers = parsedCsv.headers;
          rows = parsedCsv.rows;
        }
      }
      setParsed(buildRows(headers, rows));
      setFileName(file.name);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal parse file");
    }
  };

  const validRows = useMemo(() => parsed.filter((r) => r.errors.length === 0), [parsed]);
  const invalidRows = useMemo(() => parsed.filter((r) => r.errors.length > 0), [parsed]);

  const doImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true); setProgress(0); setResult(null);
    let ok = 0; let fail = 0;
    const fails: { idx: number; reason: string }[] = [];
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      try {
        await addOrderItem(orderId, { variantId: r.variantId!, qty: r.qty!, priority: r.priority! });
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
      <div className="fixed inset-0 bg-[#0F1C2E]/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1E3A5F]">Import Master Produksi</h2>
            <p className="text-sm text-[#6B7280]">CSV/XLSX — POST /api/production-orders/:id/items per baris.</p>
          </div>
          <button type="button" onClick={handleClose} disabled={importing} className="rounded-lg p-1 text-[#6B7280] hover:bg-[#F5F7FA] disabled:opacity-40">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-2 text-sm font-bold text-[#1F2937] hover:border-[#00A8E8] hover:text-[#00A8E8]">
              <FontAwesomeIcon icon={faDownload} className="h-4 w-4" /> Template CSV
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#00A8E8] px-6 py-3 text-base font-medium text-white hover:bg-[#0088C0]">
              <FontAwesomeIcon icon={faUpload} className="h-4 w-4" /> Pilih File
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
                className="hidden"
              />
            </label>
            {fileName && <span className="flex items-center gap-1 text-xs text-[#1F2937]"><FontAwesomeIcon icon={faFileCsv} /> {fileName} — {parsed.length} baris</span>}
          </div>

          <div className="rounded-lg border border-slate-200 bg-[#F5F7FA] p-3 text-xs leading-relaxed text-[#6B7280]">
            <p className="font-bold text-[#1F2937]">Format staf: <code className="font-mono text-[#00A8E8]">item,size,stok,priority</code> — cth <code className="font-mono">Solid Black Doff,LG,214,2</code></p>
            <p>Kolom "total per item" bila ada diabaikan (dihitung ulang). Copy-paste dari Excel (tab) bisa disimpan .txt lalu dipilih. Alternatif: <code className="font-mono">kode_variant,qty,priority</code>.</p>
          </div>

          {parsed.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-bold text-emerald-700">{validRows.length} valid</span>
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-bold text-[#EF4444]">{invalidRows.length} invalid</span>
            </div>
          )}

          {parsed.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="max-h-64 overflow-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-[#F5F7FA] text-[#6B7280]">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Kode Variant</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Priority</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.slice(0, 100).map((r) => (
                      <tr key={r.idx} className={r.errors.length ? "bg-red-50" : "bg-emerald-50"}>
                        <td className="px-3 py-1.5 font-mono text-[#1F2937]">{r.idx}</td>
                        <td className="px-3 py-1.5 font-medium text-[#1F2937]">{r.kode}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-[#1F2937]">{r.qtyRaw}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-[#1F2937]">{r.priorityRaw}</td>
                        <td className="px-3 py-1.5">
                          {r.errors.length === 0
                            ? <span className="font-bold text-emerald-600">OK</span>
                            : <span className="text-[#EF4444]">{r.errors.join("; ")}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importing && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-[#F5F7FA]">
                <div className="h-full bg-[#00A8E8] transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-[#6B7280]">Mengimpor {progress}% — jangan tutup modal...</p>
            </div>
          )}
          {result && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${result.fail === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              <p className="font-bold">Selesai: {result.ok} berhasil, {result.fail} gagal dari {validRows.length} valid.</p>
              {result.fails.length > 0 && (
                <ul className="mt-2 max-h-32 list-disc overflow-auto pl-5 text-xs">
                  {result.fails.slice(0, 20).map((f) => <li key={f.idx}>baris {f.idx}: {f.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-slate-200 bg-[#F5F7FA]/40 px-6 py-4">
          <button type="button" onClick={handleClose} disabled={importing} className="rounded-lg border border-[#D1D5DB] bg-white px-6 py-3 font-medium text-[#1F2937] hover:bg-[#F5F7FA] disabled:opacity-40">Tutup</button>
          <button type="button" disabled={importing || validRows.length === 0} onClick={() => void doImport()} className="rounded-lg bg-[#00A8E8] px-6 py-3 font-medium text-white hover:bg-[#0088C0] disabled:opacity-40">
            {importing ? `Mengimpor ${progress}%...` : `Import ${validRows.length} baris`}
          </button>
        </div>
      </div>
    </div>
  );
}
