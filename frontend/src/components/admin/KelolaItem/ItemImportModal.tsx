import { useMemo, useRef, useState } from "react";
import { createItem } from "../../../api/item";
import type { Divisi } from "../../../api/divisi";

type Props = {
  open: boolean;
  onClose: () => void;
  divisiOptions: Divisi[];
  onImported: () => void;
};

type ParsedRow = {
  idx: number;
  kode: string;
  nama: string;
  divisi: string;
  unit: string;
  jenis: string;
  aktif: string;
  divisiId?: number | null;
  isActive: boolean;
  errors: string[];
};

function normalizeHeader(h: string): string {
  const k = h.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["kode", "code"].includes(k)) return "kode";
  if (["nama", "name"].includes(k)) return "nama";
  if (["divisi", "divisi_id", "divisiid", "id_divisi", "nama_divisi"].includes(k)) return "divisi";
  if (["unit", "satuan"].includes(k)) return "unit";
  if (["jenis", "type", "tipe"].includes(k)) return "jenis";
  if (["aktif", "is_active", "isactive", "status", "active"].includes(k)) return "aktif";
  return k;
}

// CSV parser minimal — handle quoted fields, koma, newline (sama kayak BarangImportModal)
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

function parseAktif(raw: string): { value: boolean } | { error: string } {
  if (!raw) return { value: true };
  const v = raw.trim().toLowerCase();
  if (["true", "1", "aktif", "active", "ya", "y"].includes(v)) return { value: true };
  if (["false", "0", "nonaktif", "inactive", "tidak", "t"].includes(v)) return { value: false };
  return { error: `aktif "${raw}" tidak valid (pakai aktif/nonaktif)` };
}

export function ItemImportModal({ open, onClose, divisiOptions, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: number; fail: number; fails: { idx: number; reason: string }[] } | null>(null);

  const divisiMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of divisiOptions) {
      m.set(d.nama.toLowerCase(), d.id);
      m.set(String(d.id), d.id);
    }
    return m;
  }, [divisiOptions]);

  const reset = () => {
    setParsed([]); setFileName(null); setResult(null); setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => { if (!importing) { reset(); onClose(); } };

  const downloadTemplate = () => {
    const header = "kode,nama,divisi,unit,jenis,aktif";
    const example = [
      `BRG-001,Baut M8,${divisiOptions[0]?.nama ?? "Perakitan"},pcs,RAW MATERIAL,aktif`,
      `BRG-002,Kain Oxford,,roll,HABIS PAKAI,aktif`,
    ];
    const csv = [header, ...example].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "template_import_item.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const buildRows = (headers: string[], rows: string[][]): ParsedRow[] => {
    const norm = headers.map(normalizeHeader);
    const ik = norm.indexOf("kode");
    const inm = norm.indexOf("nama");
    const id = norm.indexOf("divisi");
    const iu = norm.indexOf("unit");
    const ij = norm.indexOf("jenis");
    const ia = norm.indexOf("aktif");
    if (ik === -1 || inm === -1) {
      throw new Error(`Header wajib: kode, nama. Header ditemukan: ${headers.join(", ")}`);
    }
    return rows.map((r, i) => {
      const kode = ((r[ik] ?? "").trim()).toUpperCase();
      const nama = (r[inm] ?? "").trim();
      const divisi = id === -1 ? "" : (r[id] ?? "").trim();
      const unit = iu === -1 ? "" : (r[iu] ?? "").trim();
      const jenis = ij === -1 ? "" : (r[ij] ?? "").trim();
      const aktifRaw = ia === -1 ? "" : (r[ia] ?? "").trim();
      const errors: string[] = [];
      let divisiId: number | null | undefined;

      if (!kode) errors.push("kode wajib");
      else if (kode.length > 30) errors.push("kode maksimal 30 karakter");
      if (!nama) errors.push("nama wajib");
      if (jenis.length > 50) errors.push("jenis maksimal 50 karakter");
      if (divisi) {
        const found = divisiMap.get(divisi.toLowerCase());
        if (found === undefined) errors.push(`divisi "${divisi}" tidak cocok (pakai ID atau nama persis)`);
        else divisiId = found;
      }
      let aktif = true;
      if (aktifRaw) {
        const p = parseAktif(aktifRaw);
        if ("error" in p) errors.push(p.error);
        else aktif = p.value;
      }
      return { idx: i + 1, kode, nama, divisi, unit: unit || "pcs", jenis, aktif: aktifRaw || "aktif", divisiId, isActive: aktif, errors };
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
            throw new Error("File XLSX butuh dependency 'xlsx' — simpan sebagai CSV.", { cause: e });
          }
          throw new Error("Gagal membaca sheet XLSX.", { cause: e });
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
        await createItem({
          kode: r.kode,
          nama: r.nama,
          divisiId: r.divisiId ?? null,
          unit: r.unit,
          jenis: r.jenis || null,
          isActive: r.isActive,
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
            <h2 className="text-lg font-bold text-[#1E3A5F]">Import Item</h2>
            <p className="text-xs text-[#6B7280]">CSV/XLSX — POST /api/items per baris. Kode duplikat ditolak per baris.</p>
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
              <p className="font-bold text-[#1F2937]">Header: <code className="font-mono text-[#00A8E8]">kode,nama,divisi,unit,jenis,aktif</code></p>
              <p>Wajib cuma <strong>kode</strong> &amp; <strong>nama</strong>. Divisi pakai ID angka atau nama persis (kosong = tanpa divisi). Unit default <code className="font-mono">pcs</code>. Jenis opsional, teks bebas (cth: RAW MATERIAL, SM, HABIS PAKAI). Aktif default <code className="font-mono">aktif</code> (terima aktif/nonaktif).</p>
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
                  <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-[#F5F7FA] text-[#6B7280]">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Kode</th>
                        <th className="px-3 py-2">Nama</th>
                        <th className="px-3 py-2">Divisi</th>
                        <th className="px-3 py-2">Unit</th>
                        <th className="px-3 py-2">Jenis</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsed.slice(0, 100).map((r) => (
                        <tr key={r.idx} className={r.errors.length ? "bg-red-50" : "bg-emerald-50"}>
                          <td className="px-3 py-1.5 font-mono text-[#1F2937]">{r.idx}</td>
                          <td className="px-3 py-1.5 font-mono font-medium text-[#1F2937]">{r.kode}</td>
                          <td className="max-w-[220px] truncate px-3 py-1.5 font-medium text-[#1F2937]" title={r.nama}>{r.nama}</td>
                          <td className="px-3 py-1.5 text-[#1F2937]">{r.divisi || <span className="text-[#6B7280]">—</span>}</td>
                          <td className="px-3 py-1.5 text-[#1F2937]">{r.unit}</td>
                          <td className="px-3 py-1.5 text-[#1F2937]">{r.jenis || <span className="text-[#6B7280]">—</span>}</td>
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
            {importing ? `Mengimpor ${progress}%...` : `Import ${validRows.length} item`}
          </button>
        </div>
      </div>
    </div>
  );
}
