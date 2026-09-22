import { useMemo, useRef, useState } from "react";
import { createBarang, type StatusBarang } from "../../api/barang";

type Props = {
  open: boolean;
  onClose: () => void;
  variantOptions: { id: number; nama: string }[];
  onImported: () => void;
};

type ParsedRow = {
  idx: number;
  variant: string;
  kodeBarang: string;
  batchId: string;
  status: string;
  tanggal: string;
  keterangan: string;
  variantId?: number;
  errors: string[];
};

const STATUSES: StatusBarang[] = ["REGISTER", "FINISHGOOD", "RETUR", "OUT", "BAD"];

function normalizeHeader(h: string): string {
  const k = h.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["variant", "variant_id", "variantid", "id_variant"].includes(k)) return "variant";
  if (["kode", "kode_barang", "kodebarang", "code", "barcode"].includes(k)) return "kodeBarang";
  if (["batch", "batch_id", "batchid", "id_batch"].includes(k)) return "batchId";
  if (["status"].includes(k)) return "status";
  if (["tanggal", "date", "tgl"].includes(k)) return "tanggal";
  if (["keterangan", "catatan", "note", "notes"].includes(k)) return "keterangan";
  return k;
}

// CSV parser minimal — handle quoted fields, koma, newline (sama kayak VariantImportModal)
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

function toISODate(s: string): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : t;
  }
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const dd = new Date(iso);
    return Number.isNaN(dd.getTime()) ? null : iso;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function BarangImportModal({ open, onClose, variantOptions, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: number; fail: number; fails: { idx: number; reason: string }[] } | null>(null);

  const variantMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of variantOptions) {
      m.set(v.nama.toLowerCase(), v.id);
      m.set(String(v.id), v.id);
    }
    return m;
  }, [variantOptions]);

  const reset = () => {
    setParsed([]); setFileName(null); setResult(null); setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => { if (!importing) { reset(); onClose(); } };

  const downloadTemplate = () => {
    const header = "variant,kodeBarang,batchId,status,tanggal,keterangan";
    const example = [
      `${variantOptions[0]?.nama ?? "Windbreaker / Polos / HITAM / M"},,REGISTER,,`,
      `${variantOptions[0]?.id ?? "1"},BC001-0001,,FINISHGOOD,2026-09-01,Stok awal`,
    ];
    const csv = [header, ...example].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "template_import_barang.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const buildRows = (headers: string[], rows: string[][]): ParsedRow[] => {
    const norm = headers.map(normalizeHeader);
    const iv = norm.indexOf("variant");
    const ik = norm.indexOf("kodeBarang");
    const ib = norm.indexOf("batchId");
    const is = norm.indexOf("status");
    const it = norm.indexOf("tanggal");
    const ic = norm.indexOf("keterangan");
    if (iv === -1) {
      throw new Error(`Header wajib: variant. Header ditemukan: ${headers.join(", ")}`);
    }
    return rows.map((r, i) => {
      const variant = (r[iv] ?? "").trim();
      const kodeBarang = ik === -1 ? "" : (r[ik] ?? "").trim();
      const batchId = ib === -1 ? "" : (r[ib] ?? "").trim();
      const statusRaw = is === -1 ? "" : (r[is] ?? "").trim().toUpperCase();
      const tanggalRaw = it === -1 ? "" : (r[it] ?? "").trim();
      const keterangan = ic === -1 ? "" : (r[ic] ?? "").trim();
      const errors: string[] = [];
      let variantId: number | undefined;

      if (!variant) errors.push("variant wajib");
      else {
        const found = variantMap.get(variant.toLowerCase());
        if (!found) errors.push(`variant "${variant}" tidak cocok (pakai ID atau nama persis dari dropdown)`);
        else variantId = found;
      }
      if (batchId && !/^\d+$/.test(batchId)) errors.push(`batchId "${batchId}" harus angka`);
      const status = statusRaw || "REGISTER";
      if (!STATUSES.includes(status as StatusBarang)) errors.push(`status "${statusRaw}" tidak valid (${STATUSES.join("/")})`);
      let tanggal = "";
      if (tanggalRaw) {
        const iso = toISODate(tanggalRaw);
        if (!iso) errors.push(`tanggal "${tanggalRaw}" format tidak valid (pakai YYYY-MM-DD)`);
        else tanggal = iso;
      }
      return { idx: i + 1, variant, kodeBarang, batchId, status, tanggal, keterangan, variantId, errors };
    });
  };

  const handleFile = async (file: File) => {
    setResult(null); setProgress(0);
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      if (ext === "xlsx" || ext === "xls") {
        try {
          const mod: unknown = await import("xlsx");
          const XLSX = ((mod as { default?: unknown }).default ?? mod) as {
            read: (buf: ArrayBuffer, opts: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
            utils: { sheet_to_json: (sheet: unknown, opts: { header: number; defval: string }) => string[][] };
          };
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
          if (json.length === 0) throw new Error("Sheet kosong");
          const headers = json[0].map(String);
          const rows = json.slice(1).map((r) => headers.map((_, hi) => String(r[hi] ?? "").trim()));
          setParsed(buildRows(headers, rows));
          setFileName(file.name);
          return;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (msg.includes("Cannot find package") || msg.includes("Failed to resolve")) {
            throw new Error("File XLSX butuh dependency 'xlsx' — simpan sebagai CSV.");
          }
          throw e;
        }
      }
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) throw new Error("File kosong atau header hilang");
      setParsed(buildRows(headers, rows));
      setFileName(file.name);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal parse file");
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
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
        await createBarang({
          variantId: r.variantId!,
          batchId: r.batchId ? Number(r.batchId) : undefined,
          kodeBarang: r.kodeBarang || undefined,
          tanggal: r.tanggal ? new Date(r.tanggal + "T00:00:00").toISOString() : undefined,
          status: r.status as StatusBarang,
          keterangan: r.keterangan || undefined,
        });
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="presentation" onClick={handleClose}>
      <div className="fixed inset-0 bg-[#0F1C2E]/60 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.12)] sm:max-w-4xl sm:rounded-xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1E3A5F]">Import Barang</h2>
            <p className="text-xs text-[#6B7280]">CSV/XLSX — POST /api/barang per baris. Kode kosong = auto-generate.</p>
          </div>
          <button type="button" onClick={handleClose} disabled={importing} aria-label="Tutup" className="flex h-10 w-10 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F5F7FA] disabled:opacity-40">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={downloadTemplate} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 bg-[#F5F7FA] px-4 py-2 text-sm font-bold text-[#1F2937] hover:border-[#00A8E8] hover:text-[#00A8E8]">
                ↓ Template CSV
              </button>
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg bg-[#00A8E8] px-5 py-2 text-sm font-medium text-white hover:bg-[#0088C0]">
                ↑ Pilih File
                <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={onFileChange} className="hidden" />
              </label>
              {fileName && <span className="text-xs text-[#1F2937]">{fileName} — {parsed.length} baris</span>}
            </div>

            <div className="rounded-lg border border-slate-200 bg-[#F5F7FA] p-3 text-xs leading-relaxed text-[#6B7280]">
              <p className="font-bold text-[#1F2937]">Header: <code className="font-mono text-[#00A8E8]">variant,kodeBarang,batchId,status,tanggal,keterangan</code></p>
              <p>Wajib cuma <strong>variant</strong> (ID angka atau nama persis kayak di dropdown, mis. <code className="font-mono">Windbreaker / Polos / HITAM / M</code>). Status default REGISTER. Tanggal YYYY-MM-DD.</p>
            </div>

            {parsed.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-bold text-emerald-700">{validRows.length} valid</span>
                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-bold text-[#EF4444]">{invalidRows.length} invalid</span>
                <span className="rounded-full border border-slate-200 bg-[#F5F7FA] px-3 py-1 text-[#6B7280]">{parsed.length} total</span>
              </div>
            )}

            {parsed.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="max-h-64 overflow-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-[#F5F7FA] text-[#6B7280]">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Variant</th>
                        <th className="px-3 py-2">Kode</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsed.slice(0, 100).map((r) => (
                        <tr key={r.idx} className={r.errors.length ? "bg-red-50" : "bg-emerald-50"}>
                          <td className="px-3 py-1.5 font-mono text-[#1F2937]">{r.idx}</td>
                          <td className="max-w-[220px] truncate px-3 py-1.5 font-medium text-[#1F2937]" title={r.variant}>{r.variant}{r.variantId ? <span className="ml-1 text-[10px] text-[#6B7280]">→{r.variantId}</span> : null}</td>
                          <td className="px-3 py-1.5 font-mono text-[#1F2937]">{r.kodeBarang || <span className="text-[#6B7280]">auto</span>}</td>
                          <td className="px-3 py-1.5 text-[#1F2937]">{r.status}</td>
                          <td className="px-3 py-1.5">
                            {r.errors.length === 0 ? <span className="font-bold text-emerald-600">OK</span> : <span className="text-[#EF4444]">{r.errors.join("; ")}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsed.length > 100 && <p className="border-t border-slate-200 bg-[#F5F7FA] px-3 py-2 text-center text-xs text-[#6B7280]">... +{parsed.length - 100} baris lagi (preview 100 pertama)</p>}
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
                    {result.fails.length > 20 && <li>... +{result.fails.length - 20} lagi</li>}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between gap-2 border-t border-slate-200 bg-[#F5F7FA]/40 px-5 py-4">
          <button type="button" onClick={handleClose} disabled={importing} className="inline-flex min-h-[48px] items-center rounded-lg border border-[#D1D5DB] bg-white px-6 py-3 text-sm font-medium text-[#1F2937] hover:bg-[#F5F7FA] disabled:opacity-40">Tutup</button>
          <button type="button" disabled={importing || validRows.length === 0} onClick={() => void doImport()} className="inline-flex min-h-[48px] items-center rounded-lg bg-[#00A8E8] px-6 py-3 text-sm font-medium text-white hover:bg-[#0088C0] disabled:opacity-40">
            {importing ? `Mengimpor ${progress}%...` : `Import ${validRows.length} barang`}
          </button>
        </div>
      </div>
    </div>
  );
}
