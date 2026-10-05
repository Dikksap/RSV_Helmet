import { useCallback, useEffect, useMemo, useState, Fragment, type ReactNode } from "react";
import {
  createBarangGroup,
  deleteBarangGroup,
  getBarangGroups,
  getBarangInGroup,
  unassignBarangFromGroup,
  updateBarangGroup,
  type BarangGroup,
  type BarangInGroup,
} from "../../api/barangGroup";
import type { StatusBarang } from "../../api/barang";
import { downloadCsv } from "../../lib/csv";
import { isDusPengganti } from "../../lib/dus";

const DUS_CAPACITY = 8;

const STATUS_BADGE: Record<StatusBarang, string> = {
  FINISHGOOD: "bg-emerald-100 text-emerald-700",
  RETUR: "bg-amber-100 text-amber-800",
  OUT: "bg-sky-100 text-sky-700",
  BAD: "bg-red-100 text-red-700",
  REGISTER: "bg-slate-100 text-slate-600",
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-[#1F2937] outline-none transition placeholder:text-slate-400 focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20";
const labelCls = "flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-700";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function variantName(barang: BarangInGroup) {
  const v = barang.variant;
  if (v?.product && v?.style && v?.color && v?.size)
    return `${v.product.nama} ${v.style.nama} ${v.color.nama} ${v.size.nama}`;
  return "-";
}

function kondisiLabel(barang: BarangInGroup): "R" | "FG" {
  return barang.pernahRetur ? "R" : "FG";
}

function labelEntries(barang: BarangInGroup[]): { produk: string; size: string; n: number }[] {
  const m = new Map<string, { produk: string; size: string; n: number }>();
  for (const b of barang) {
    const v = b.variant;
    if (!v?.product || !v?.color || !v?.size) continue;
    const produk = `${(v.product.prefix ?? v.product.nama).toUpperCase()} ${v.color.nama}`;
    const size = v.size.nama;
    const k = `${produk} ${size} ${kondisiLabel(b)}`;
    const prev = m.get(k);
    m.set(k, { produk, size, n: (prev?.n ?? 0) + 1 });
  }
  return [...m.values()];
}

function summarizeEntries(barang: BarangInGroup[], nameFn: (b: BarangInGroup) => string = variantName): [string, number, "R" | "FG"][] {
  const m = new Map<string, { name: string; n: number; label: "R" | "FG" }>();
  for (const b of barang) {
    const label = kondisiLabel(b);
    const name = nameFn(b);
    const k = `${name} ${label}`;
    const prev = m.get(k);
    m.set(k, { name, n: (prev?.n ?? 0) + 1, label });
  }
  return [...m.values()].map(({ name, n, label }) => [name, n, label]);
}

function summarize(barang: BarangInGroup[]): string {
  return summarizeEntries(barang)
    .map(([k, n, label]) => `${k} × ${n} ${label}`)
    .join(" · ");
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Nama dus = string berisi angka ("5", "12", "Dus A-1"): urut numerik menaik,
// non-angka di belakang.
function dusOrder(nama: string): number {
  const m = nama.match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

function compareDus(a: { nama: string }, b: { nama: string }): number {
  const d = dusOrder(a.nama) - dusOrder(b.nama);
  return d !== 0 ? d : a.nama.localeCompare(b.nama, "id", { numeric: true });
}

function toast(message: string, type: "success" | "error" = "success") {
  window.dispatchEvent(
    new CustomEvent("app:toast", {
      detail: { type: type === "success" ? "barang.created" : "barang.updated", message },
    }),
  );
}

function StokProduksi() {
  const [groups, setGroups] = useState<BarangGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "penuh" | "tersedia">("all");

  const [showCreate, setShowCreate] = useState(false);
  const [editingGroup, setEditingGroup] = useState<BarangGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<BarangGroup | null>(null);
  const [cNama, setCNama] = useState("");
  const [eNama, setENama] = useState("");
  const [crudLoading, setCrudLoading] = useState(false);
  const [crudError, setCrudError] = useState<string | null>(null);

  const [detailGroup, setDetailGroup] = useState<BarangGroup | null>(null);
  const [detailBarang, setDetailBarang] = useState<BarangInGroup[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPrinting, setIsPrinting] = useState(false);

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setGroups(await getBarangGroups());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar dus");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void fetchGroups(), 0);
    return () => window.clearTimeout(id);
  }, [fetchGroups]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCreate(false);
        setEditingGroup(null);
        setDeletingGroup(null);
        setDetailGroup(null);
      }
    };
    if (showCreate || editingGroup || deletingGroup || detailGroup) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreate, editingGroup, deletingGroup, detailGroup]);

  const totalBarang = groups.reduce((acc, g) => acc + g._count.barang, 0);
  const maxCapacity = groups.length * DUS_CAPACITY;
  const fullDusCount = groups.filter((g) => g._count.barang >= DUS_CAPACITY).length;
  const availableDusCount = groups.length - fullDusCount;

  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return groups
      .filter((g) => !g.isArsip)
      .filter((g) => {
        const matchKeyword =
          g.nama.toLowerCase().includes(keyword) ||
          (g.barang ?? []).some((b) => b.kodeBarang.toLowerCase().includes(keyword));
        const isFull = g._count.barang >= DUS_CAPACITY;
        const matchStatus =
          statusFilter === "all" || (statusFilter === "penuh" ? isFull : !isFull);
        return matchKeyword && matchStatus;
      });
  }, [groups, search, statusFilter]);

  const normalGroups = useMemo(() => filteredGroups.filter((g) => !isDusPengganti(g)), [filteredGroups]);
  const penggantiGroups = useMemo(() => filteredGroups.filter((g) => isDusPengganti(g)), [filteredGroups]);
  const arsipGroups = useMemo(() => groups.filter((g) => g.isArsip), [groups]);
  const [showArsip, setShowArsip] = useState(false);
  const [archivingId, setArchivingId] = useState<number | null>(null);

  const handleArsip = async (group: BarangGroup) => {
    if (!window.confirm(`Arsipkan "${group.nama}"?`)) return;
    setArchivingId(group.id);
    try {
      await updateBarangGroup(group.id, { isArsip: true });
      toast(`"${group.nama}" diarsipkan`);
      await fetchGroups();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal mengarsipkan dus", "error");
    } finally {
      setArchivingId(null);
    }
  };

  const handlePulihkan = async (group: BarangGroup) => {
    setArchivingId(group.id);
    try {
      await updateBarangGroup(group.id, { isArsip: false });
      toast(`"${group.nama}" dikembalikan ke daftar aktif`);
      await fetchGroups();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal memulihkan dus", "error");
    } finally {
      setArchivingId(null);
    }
  };

  const openCreate = () => {
    setCrudError(null);
    setCNama("");
    setShowCreate(true);
  };

  const handleCreate = async () => {
    const nama = cNama.trim();
    if (!nama) {
      setCrudError("Field 'nama' wajib diisi");
      return;
    }
    setCrudLoading(true);
    setCrudError(null);
    try {
      await createBarangGroup(nama);
      setShowCreate(false);
      toast(`Dus "${nama}" berhasil dibuat`);
      await fetchGroups();
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : "Gagal membuat dus");
    } finally {
      setCrudLoading(false);
    }
  };

  const openEdit = (group: BarangGroup) => {
    setCrudError(null);
    setENama(group.nama);
    setEditingGroup(group);
  };

  const handleUpdate = async () => {
    if (!editingGroup) return;
    const nama = eNama.trim();
    if (!nama) {
      setCrudError("Field 'nama' tidak boleh kosong");
      return;
    }
    setCrudLoading(true);
    setCrudError(null);
    try {
      await updateBarangGroup(editingGroup.id, { nama });
      setEditingGroup(null);
      toast(`Dus berhasil diubah menjadi "${nama}"`);
      await fetchGroups();
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : "Gagal memperbarui dus");
    } finally {
      setCrudLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    setCrudLoading(true);
    setCrudError(null);
    try {
      await deleteBarangGroup(deletingGroup.id);
      setDeletingGroup(null);
      toast(`Dus "${deletingGroup.nama}" berhasil dihapus`);
      await fetchGroups();
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : "Gagal menghapus dus");
    } finally {
      setCrudLoading(false);
    }
  };

  const openDetail = async (group: BarangGroup) => {
    setDetailError(null);
    setDetailBarang(group.barang ?? []);
    setDetailGroup(group);
    setIsLoadingDetail(true);
    try {
      setDetailBarang(await getBarangInGroup(group.id));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Gagal memuat isi dus");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleUnassign = async (barangId: number) => {
    if (!detailGroup) return;
    setUnassigningId(barangId);
    try {
      await unassignBarangFromGroup(detailGroup.id, [barangId]);
      setDetailBarang((prev) => prev.filter((b) => b.id !== barangId));
      toast("Barang dilepas dari dus");
      await fetchGroups();
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Gagal melepas barang");
    } finally {
      setUnassigningId(null);
    }
  };

  const handleExportCSV = async () => {
    if (filteredGroups.length === 0) return;
    try {
      const targets = [...filteredGroups].sort(compareDus);
      const resolved = await Promise.all(
        targets.map(async (g) => ({ group: g, items: await resolveItems(g) })),
      );
      const rows: unknown[][] = [];
      const sectionRows = (title: string, list: typeof resolved) => {
        if (list.length === 0) return;
        rows.push([title]);
        rows.push(["NO", "PRODUCT", "SIZE", "JUMLAH"]);
        let subtotal = 0;
        list.forEach(({ group, items }) => {
          rows.push([`${group.nama}`]);
          const m = new Map<string, { product: string; size: string; n: number }>();
          for (const b of items) {
            const v = b.variant;
            const product =
              [v?.product?.nama, v?.style?.nama, v?.color?.nama].filter(Boolean).join(" ") || "-";
            const size = v?.size?.nama ?? "-";
            const k = `${product}|||${size}`;
            const prev = m.get(k);
            m.set(k, { product, size, n: (prev?.n ?? 0) + 1 });
          }
          const entries = [...m.values()].sort(
            (a, b) =>
              a.product.localeCompare(b.product, "id") ||
              a.size.localeCompare(b.size, "id", { numeric: true }),
          );
          if (entries.length === 0) rows.push(["Kosong"]);
          entries.forEach((e, i) => rows.push([i + 1, e.product, e.size, e.n]));
          subtotal += items.length;
          rows.push([]);
        });
        rows.push(["TOTAL", "", "", subtotal]);
        rows.push([]);
      };
      sectionRows("DUS", resolved.filter((r) => !isDusPengganti(r.group)));
      sectionRows("DUS PENGGANTI", resolved.filter((r) => isDusPengganti(r.group)));
      const stamp = new Date().toISOString().slice(0, 10);
      const suffix = statusFilter === "all" ? "" : `-${statusFilter}`;
      downloadCsv(`stok-produksi-${stamp}${suffix}.csv`, rows);
      toast(`Export rekap ${targets.length} dus ke CSV`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal export CSV", "error");
    }
  };

  const resolveItems = async (group: BarangGroup) => {
    const cached = group.barang ?? [];
    if (cached.length >= group._count.barang) return cached;
    return getBarangInGroup(group.id);
  };

  const printGroups = async (targets: BarangGroup[], mode: "label" | "biasa" = "biasa") => {
    if (targets.length === 0) return;
    setIsPrinting(true);
    try {
      const resolved = await Promise.all(
        targets.map(async (g) => ({ group: g, items: await resolveItems(g) })),
      );
      resolved.sort((a, b) => compareDus(a.group, b.group));
      const w = window.open("", "_blank", "width=400,height=600");
      if (!w) {
        toast("Popup diblokir, izinkan popup untuk print", "error");
        return;
      }
      if (mode === "biasa") {
        if (resolved.length === 1) {
          const { group, items } = resolved[0]!;
          const entries = summarizeEntries(items);
          const total = items.length || group._count.barang;
          const body = entries.length === 0
            ? `<p>Kosong</p>`
            : `<table><tr><th>Isi</th><th>Qty</th><th>R/FG</th></tr>` +
              entries.map(([k, n, label]) => `<tr><td>${escapeHtml(k)}</td><td>x ${n}</td><td>${label}</td></tr>`).join("") +
              `</table><p class="total">Total: ${total} pcs</p>`;
          w.document.write(
            `<html><head><title>${escapeHtml(group.nama)}</title>` +
              `<style>body{font-family:Arial,sans-serif;padding:24px;color:#111}` +
              `.nama{font-size:42px;font-weight:800;margin:0}` +
              `.sub{font-size:14px;color:#555;margin:4px 0 16px}` +
              `table{width:100%;border-collapse:collapse;margin-top:8px}` +
              `td,th{border:1px solid #333;padding:8px;font-size:18px;text-align:left}` +
              `.total{font-size:20px;font-weight:700;margin-top:12px}` +
              `@media print{button{display:none}}</style></head><body>` +
              `<p class="nama">${escapeHtml(group.nama)}</p>` +
              `<p class="sub">${total}/${DUS_CAPACITY} barang &middot; ${escapeHtml(formatDate(group.updatedAt))}</p>` +
              body +
              `<script>window.onload=()=>{window.print()}</script>` +
              `</body></html>`,
          );
          w.document.close();
          return;
        }
        const biasa = resolved.filter((r) => !isDusPengganti(r.group));
        const pengganti = resolved.filter((r) => isDusPengganti(r.group));
        const sectionRows = (list: typeof resolved) =>
          list
            .map(({ group, items }) => {
              const entries = summarizeEntries(items);
              const total = items.length || group._count.barang;
              const isi = entries.length === 0
                ? `Kosong`
                : entries.map(([k, n, label]) => `${escapeHtml(k)} x ${n} ${label}`).join("<br>");
              return `<tr><td class="dus">${escapeHtml(group.nama)}</td><td>${isi}</td><td class="num">${total}</td></tr>`;
            })
            .join("");
        const sectionSubtotal = (list: typeof resolved) =>
          list.reduce((a, r) => a + (r.items.length || r.group._count.barang), 0);
        const sections = [
          biasa.length > 0 ? `<h2>Dus (${biasa.length})</h2><table><tr><th>Dus</th><th>Isi Dus</th><th>Total</th></tr>${sectionRows(biasa)}</table><p class="total">Total: ${sectionSubtotal(biasa)} pcs</p>` : "",
          pengganti.length > 0 ? `<h2 class="${biasa.length > 0 ? "break" : ""}">Dus Pengganti (${pengganti.length})</h2><table><tr><th>Dus</th><th>Isi Dus</th><th>Total</th></tr>${sectionRows(pengganti)}</table><p class="total">Total: ${sectionSubtotal(pengganti)} pcs</p>` : "",
        ].filter(Boolean).join("");
        w.document.write(
          `<html><head><title>Rekap ${targets.length} Dus</title>` +
            `<style>body{font-family:Arial,sans-serif;padding:24px;color:#111}` +
              `h1{font-size:22px;margin:0 0 4px}` +
              `h2{font-size:17px;margin:18px 0 8px}` +
              `.break{break-before:page;page-break-before:always}` +
              `.sub{font-size:13px;color:#555;margin:0 0 12px}` +
              `table{width:100%;border-collapse:collapse}` +
              `td,th{border:1px solid #333;padding:6px 8px;font-size:14px;text-align:left;vertical-align:top}` +
              `.dus{white-space:nowrap;font-weight:700}` +
              `.num{text-align:center;font-weight:700}` +
              `.total{font-size:15px;font-weight:700;margin-top:10px}` +
              `@media print{button{display:none}}</style></head><body>` +
              `<h1>Rekap ${targets.length} Dus</h1>` +
              `<p class="sub">${escapeHtml(new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }))}</p>` +
              sections +
            `<script>window.onload=()=>{window.print()}</script>` +
            `</body></html>`,
        );
        w.document.close();
        return;
      }
      if (resolved.length === 1) {
        const { group, items } = resolved[0]!;
        const entries = labelEntries(items);
        const body = entries.length === 0
          ? `<p class="isi">Kosong</p>`
          : `<table class="isi">` +
            entries.map((e) => `<tr><td class="item">${escapeHtml(e.produk)}</td><td class="size">${escapeHtml(e.size)}</td><td class="qty">x ${e.n}</td></tr>`).join("") +
            `</table>`;
        w.document.write(
          `<html><head><title>${escapeHtml(group.nama)}</title>` +
            `<style>@page{size:100mm 75mm;margin:0}` +
            `html,body{margin:0}` +
            `body{font-family:Arial,sans-serif;padding:6mm;color:#111;text-align:center}` +
            `.nama{font-size:34px;font-weight:800;margin:0 0 10px;line-height:1.1;text-align:center}` +
            `table.isi{width:100%;border-collapse:collapse;font-size:26px;font-weight:700}` +
            `table.isi td{border:none;padding:2px 0;line-height:1.25}` +
            `td.item{text-align:left}` +
            `td.size{text-align:center;white-space:nowrap;padding:2px 8px}` +
            `td.qty{text-align:right;white-space:nowrap}` +
            `p.isi{font-size:26px;font-weight:700}` +
            `@media print{button{display:none}}</style></head><body>` +
            `<p class="nama">${escapeHtml(group.nama)}</p>` +
            body +
            `<script>window.onload=()=>{window.print()}</script>` +
            `</body></html>`,
        );
        w.document.close();
        return;
      }
      const labels = resolved
        .map(({ group, items }, idx) => {
          const entries = labelEntries(items);
          const body = entries.length === 0
            ? `<p class="isi">Kosong</p>`
            : `<table class="isi">` +
              entries.map((e) => `<tr><td class="item">${escapeHtml(e.produk)}</td><td class="size">${escapeHtml(e.size)}</td><td class="qty">x ${e.n}</td></tr>`).join("") +
              `</table>`;
          return `<div class="page${idx > 0 ? " break" : ""}"><p class="nama">${escapeHtml(group.nama)}</p>${body}</div>`;
        })
        .join("");
      w.document.write(
        `<html><head><title>Label ${targets.length} Dus</title>` +
          `<style>@page{size:100mm 75mm;margin:0}` +
            `html,body{margin:0}` +
            `body{font-family:Arial,sans-serif;padding:6mm;color:#111;text-align:center}` +
            `.nama{font-size:32px;font-weight:800;margin:0 0 10px;line-height:1.1;text-align:center}` +
            `table.isi{width:100%;border-collapse:collapse;font-size:26px;font-weight:700}` +
            `table.isi td{border:none;padding:2px 0;line-height:1.25}` +
            `td.item{text-align:left}` +
            `td.size{text-align:center;white-space:nowrap;padding:2px 8px}` +
            `td.qty{text-align:right;white-space:nowrap}` +
            `p.isi{font-size:26px;font-weight:700}` +
            `.break{break-before:page;page-break-before:always}` +
            `@media print{button{display:none}}</style></head><body>` +
            labels +
          `<script>window.onload=()=>{window.print()}</script>` +
          `</body></html>`,
      );
      w.document.close();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal print dus", "error");
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrint = (group: BarangGroup, mode: "label" | "biasa" = "biasa") => void printGroups([group], mode);

  const handlePrintSelected = (mode: "label" | "biasa" = "biasa") => {
    const targets = filteredGroups.filter((g) => selected.has(g.id));
    if (targets.length === 0) {
      toast("Pilih dus dulu", "error");
      return;
    }
    void printGroups(targets, mode);
  };

  const handleArsipSelected = async () => {
    const targets = filteredGroups.filter((g) => selected.has(g.id));
    if (targets.length === 0) {
      toast("Pilih dus dulu", "error");
      return;
    }
    if (!window.confirm(`Arsipkan ${targets.length} dus yang dipilih?`)) return;
    setArchivingId(-1);
    let ok = 0;
    let firstError = "";
    for (const g of targets) {
      try {
        await updateBarangGroup(g.id, { isArsip: true });
        ok++;
      } catch (err) {
        if (!firstError) firstError = err instanceof Error ? err.message : "Gagal mengarsipkan";
      }
    }
    setArchivingId(null);
    setSelected(new Set());
    await fetchGroups();
    if (ok === targets.length) toast(`${ok} dus diarsipkan`);
    else toast(`${ok} diarsipkan, ${targets.length - ok} gagal. ${firstError}`, "error");
  };

  const handlePulihkanSelected = async () => {
    const targets = arsipGroups.filter((g) => selected.has(g.id));
    if (targets.length === 0) {
      toast("Pilih arsip dulu", "error");
      return;
    }
    if (!window.confirm(`Pulihkan ${targets.length} arsip yang dipilih?`)) return;
    setArchivingId(-1);
    let ok = 0;
    let firstError = "";
    for (const g of targets) {
      try {
        await updateBarangGroup(g.id, { isArsip: false });
        ok++;
      } catch (err) {
        if (!firstError) firstError = err instanceof Error ? err.message : "Gagal memulihkan";
      }
    }
    setArchivingId(null);
    setSelected(new Set());
    await fetchGroups();
    if (ok === targets.length) toast(`${ok} arsip dipulihkan`);
    else toast(`${ok} dipulihkan, ${targets.length - ok} gagal. ${firstError}`, "error");
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected =
    filteredGroups.length > 0 && filteredGroups.every((g) => selected.has(g.id));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const g of filteredGroups) next.delete(g.id);
      } else {
        for (const g of filteredGroups) next.add(g.id);
      }
      return next;
    });
  };

  const modalShell = (onClose: () => void, children: ReactNode, size: "md" | "lg" = "md") => (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`w-full ${size === "lg" ? "max-w-2xl" : "max-w-md"} rounded-3xl bg-white p-6 shadow-2xl`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Barang Produksi</p>
          <h2 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900">
            Stok Produksi — Dus Barang
            <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              Total {groups.length} Dus
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Satu dus maksimal {DUS_CAPACITY} barang. Klik kartu untuk melihat isi dus.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleExportCSV()}
            disabled={isLoading || filteredGroups.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export CSV
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00A8E8] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#00A8E8]/25 transition hover:bg-[#0088C0] active:scale-95"
          >
            <span className="text-base leading-none">+</span> Dus Baru
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-xl text-[#00A8E8]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Kapasitas Terpakai</p>
            <p className="text-lg font-bold text-slate-900">
              {totalBarang} / {maxCapacity} Barang
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Dus Penuh</p>
            <p className="text-lg font-bold text-slate-900">{fullDusCount} Dus</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-xl text-amber-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /><path d="M7.5 4.27 16.5 9.4" /></svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Dus Tersedia / Sebagian</p>
            <p className="text-lg font-bold text-slate-900">{availableDusCount} Dus</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="relative w-full sm:w-80">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama dus atau kode barang..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "penuh" | "tersedia")}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 sm:w-auto"
        >
          <option value="all">Semua Status</option>
          <option value="penuh">Penuh (8/8)</option>
          <option value="tersedia">Belum Penuh</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleSelectAll}
            disabled={filteredGroups.length === 0}
            className="h-4 w-4 accent-[#00A8E8]"
          />
          Pilih semua ({filteredGroups.length})
        </label>
        <span className="text-sm text-slate-500">{selected.size} dipilih</span>
        <div className="ml-auto flex gap-2">
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Batal
            </button>
          )}
          <button
            type="button"
            onClick={() => handlePrintSelected("biasa")}
            disabled={selected.size === 0 || isPrinting}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {isPrinting ? "Menyiapkan..." : `Print Biasa ${selected.size > 0 ? `(${selected.size})` : ""}`}
          </button>
          <button
            type="button"
            onClick={() => handlePrintSelected("label")}
            disabled={selected.size === 0 || isPrinting}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
          >
            {isPrinting ? "Menyiapkan..." : `Print Label ${selected.size > 0 ? `(${selected.size})` : ""}`}
          </button>
          <button
            type="button"
            onClick={() => void handleArsipSelected()}
            disabled={selected.size === 0 || archivingId !== null}
            className="rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-200 disabled:opacity-50"
          >
            {archivingId !== null ? "Mengarsipkan..." : `Arsipkan ${selected.size > 0 ? `(${selected.size})` : ""}`}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Memuat daftar dus">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-200" />
                <div className="h-4 w-1/2 rounded bg-slate-200" />
              </div>
              <div className="mt-4 h-2 w-full rounded-full bg-slate-100" />
              <div className="mt-3 h-3 w-3/4 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-[#EF4444]">
          <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span>{error}</span>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-400">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
          </div>
          <h3 className="text-base font-bold text-slate-800">Tidak ada dus ditemukan</h3>
          <p className="mt-1 text-sm text-slate-500">Coba kata kunci pencarian lain atau buat dus baru.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...normalGroups, ...penggantiGroups].map((g, i, arr) => {
            const showNormalDivider = !isDusPengganti(g) && i === 0 && penggantiGroups.length > 0;
            const showPenggantiDivider = isDusPengganti(g) && (i === 0 || !isDusPengganti(arr[i - 1]));
            const count = g._count.barang;
            const isFull = count >= DUS_CAPACITY;
            const percentage = Math.round((count / DUS_CAPACITY) * 100);
            const barColor = isFull ? "bg-rose-500" : count === 0 ? "bg-slate-300" : "bg-[#00A8E8]";
            const ringkasan = summarize(g.barang ?? []);
            const isSelected = selected.has(g.id);
            return (
              <Fragment key={g.id}>
                {(showNormalDivider || showPenggantiDivider) && (
                  <p className="col-span-full mt-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                    {showPenggantiDivider ? "Dus Pengganti" : "Dus"}{" "}
                    <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5">
                      {showPenggantiDivider ? penggantiGroups.length : normalGroups.length}
                    </span>
                  </p>
                )}
              <div
                role="button"
                tabIndex={0}
                onClick={() => void openDetail(g)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void openDetail(g); } }}
                className={`group cursor-pointer rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-[#00A8E8]/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#00A8E8] ${isSelected ? "border-[#00A8E8] ring-2 ring-[#00A8E8]/30" : "border-slate-200"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(g.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Pilih Dus ${g.nama}`}
                      className="h-4 w-4 shrink-0 accent-[#00A8E8]"
                    />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#00A8E8] transition group-hover:bg-[#00A8E8] group-hover:text-white">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">{g.nama}</p>
                      <p className="text-[11px] text-slate-400">{formatDate(g.updatedAt)}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      isFull ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}/{DUS_CAPACITY}
                    {isFull && " PENUH"}
                  </span>
                </div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-slate-200/60 bg-slate-100">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Isi Dus</p>
                  <p className="mt-0.5 text-sm font-medium leading-relaxed text-slate-700">
                    {ringkasan || "Kosong"}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void handlePrint(g, "biasa"); }}
                    className="rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 transition hover:bg-sky-100"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void handlePrint(g, "label"); }}
                    className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    Label
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openEdit(g); }}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCrudError(null); setDeletingGroup(g); }}
                    className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-100"
                  >
                    Hapus
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void handleArsip(g); }}
                    disabled={archivingId === g.id}
                    className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                  >
                    {archivingId === g.id ? "..." : "Arsip"}
                  </button>
                </div>
              </div>
              </Fragment>
            );
          })}
        </div>
      )}

      {arsipGroups.length > 0 && (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={() => setShowArsip((v) => !v)}
            aria-expanded={showArsip}
            className="flex w-full items-center justify-between text-sm font-bold text-slate-600"
          >
            Arsip ({arsipGroups.length})
            <span aria-hidden="true">{showArsip ? "▾" : "▸"}</span>
          </button>
          {showArsip && (
            <>
              {arsipGroups.some((g) => selected.has(g.id)) && (
                <button
                  type="button"
                  onClick={() => void handlePulihkanSelected()}
                  disabled={archivingId !== null}
                  className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {archivingId !== null ? "Memulihkan..." : `Pulihkan Dipilih (${arsipGroups.filter((g) => selected.has(g.id)).length})`}
                </button>
              )}
              <ul className="mt-3 space-y-2">
                {arsipGroups.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(g.id)}
                      onChange={() => toggleSelect(g.id)}
                      className="h-4 w-4 shrink-0 accent-[#00A8E8]"
                      aria-label={`Pilih arsip ${g.nama}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-700">{g.nama}</p>
                      <p className="text-[11px] text-slate-400">{g._count.barang}/{DUS_CAPACITY} barang</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handlePulihkan(g)}
                      disabled={archivingId === g.id}
                      className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {archivingId === g.id ? "..." : "Pulihkan"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {showCreate &&
        modalShell(() => setShowCreate(false), (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Tambah Dus Baru</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 pt-4">
              <label className={labelCls}>
                <span>Nama / Nomor Dus</span>
                <input
                  className={inputCls}
                  placeholder="Contoh: 5 atau Dus A-1"
                  value={cNama}
                  onChange={(e) => setCNama(e.target.value)}
                  autoFocus
                />
              </label>
              {crudError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#EF4444]">{crudError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={crudLoading}
                  className="flex-1 rounded-xl bg-[#00A8E8] py-3 text-sm font-semibold text-white shadow-lg shadow-[#00A8E8]/25 transition hover:bg-[#0088C0] disabled:opacity-50"
                >
                  {crudLoading ? "Menyimpan..." : "Simpan Dus"}
                </button>
              </div>
            </div>
          </>
        ))}

      {editingGroup &&
        modalShell(() => setEditingGroup(null), (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Edit Dus — {editingGroup.nama}</h3>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 pt-4">
              <label className={labelCls}>
                <span>Nama / Nomor Dus</span>
                <input
                  className={inputCls}
                  value={eNama}
                  onChange={(e) => setENama(e.target.value)}
                  autoFocus
                />
              </label>
              {crudError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#EF4444]">{crudError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={crudLoading}
                  className="flex-1 rounded-xl bg-[#00A8E8] py-3 text-sm font-semibold text-white shadow-lg shadow-[#00A8E8]/25 transition hover:bg-[#0088C0] disabled:opacity-50"
                >
                  {crudLoading ? "Menyimpan..." : "Simpan Dus"}
                </button>
              </div>
            </div>
          </>
        ))}

      {deletingGroup &&
        modalShell(() => setDeletingGroup(null), (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Hapus Dus?</h3>
              <button
                type="button"
                onClick={() => setDeletingGroup(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 pt-4">
              <p className="text-sm text-slate-600">
                Yakin hapus <span className="font-bold text-slate-900">Dus {deletingGroup.nama}</span>? Tindakan ini
                tidak dapat dibatalkan.
              </p>
              {deletingGroup._count.barang > 0 && (
                <p className="text-sm text-amber-600">
                  {deletingGroup._count.barang} barang di dalam dus akan dilepas (barang tetap ada di sistem).
                </p>
              )}
              {crudError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#EF4444]">{crudError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingGroup(null)}
                  className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={crudLoading}
                  className="flex-1 rounded-xl bg-[#EF4444] py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
                >
                  {crudLoading ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </>
        ))}

      {detailGroup &&
        modalShell(() => setDetailGroup(null), (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#00A8E8]">Detail Dus</p>
                <h3 className="text-lg font-bold text-slate-900">Kelola Isi {detailGroup.nama}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailGroup(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="py-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Daftar Barang (Maks {DUS_CAPACITY})
                </span>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {detailGroup._count.barang}/{DUS_CAPACITY} Barang
                </span>
              </div>
              {detailError && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#EF4444]">{detailError}</div>
              )}
              {isLoadingDetail ? (
                <p className="py-4 text-center text-sm text-slate-500">Memuat isi dus...</p>
              ) : detailBarang.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                  Dus kosong — scan barang lalu simpan ke dus ini lewat halaman Scan QR.
                </p>
              ) : (
                <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                  {detailBarang.map((b, i) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#00A8E8] text-xs font-bold text-white">
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="break-all font-mono text-[11px] font-bold text-slate-800">{b.kodeBarang}</p>
                          <p className="truncate text-[11px] text-slate-500">{variantName(b)}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[b.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {b.status}
                        </span>
                        <span
                          title={b.pernahRetur ? "Pernah retur" : "Tidak pernah retur"}
                          className={`rounded px-2 py-0.5 text-[11px] font-bold ${b.pernahRetur ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
                        >
                          {kondisiLabel(b)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleUnassign(b.id)}
                          disabled={unassigningId === b.id}
                          className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {unassigningId === b.id ? "..." : "Lepas"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setDetailGroup(null)}
                className="rounded-xl bg-[#00A8E8] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#00A8E8]/25 transition hover:bg-[#0088C0]"
              >
                Selesai
              </button>
            </div>
          </>), "lg")}
    </div>
  );
}

export default StokProduksi;
