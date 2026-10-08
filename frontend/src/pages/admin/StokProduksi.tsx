import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
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
import { downloadCsv } from "../../lib/csv";
import { DUS_CAPACITY, isDusPengganti } from "../../lib/dus";
import { useStatusOptions } from "../../lib/useStatusOptions";

type Filter = "all" | "tersedia" | "penuh";
type Resolved = { group: BarangGroup; items: BarangInGroup[] };

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50";
const CARD = "rounded-2xl border border-slate-200 bg-white";
const FIELD = `h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20`;
const BTN = `inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const BTN_PRIMARY = `${BTN} bg-[#1E3A5F] text-white hover:bg-[#162C48]`;
const BTN_GHOST = `${BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const MINI = `rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${FOCUS}`;

const BOX_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </svg>
);

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const kondisi = (b: BarangInGroup): "R" | "FG" => (b.pernahRetur ? "R" : "FG");

function variantName(b: BarangInGroup) {
  const v = b.variant;
  return v?.product && v.style && v.color && v.size ? `${v.product.nama} ${v.style.nama} ${v.color.nama} ${v.size.nama}` : "-";
}

function countBy<T>(items: BarangInGroup[], keyOf: (b: BarangInGroup) => string | null, make: (b: BarangInGroup) => T) {
  const m = new Map<string, T & { n: number }>();
  for (const b of items) {
    const k = keyOf(b);
    if (k === null) continue;
    const prev = m.get(k);
    m.set(k, { ...make(b), n: (prev?.n ?? 0) + 1 });
  }
  return [...m.values()];
}

const summaryEntries = (items: BarangInGroup[]) =>
  countBy(items, (b) => `${variantName(b)} ${kondisi(b)}`, (b) => ({ name: variantName(b), label: kondisi(b) }));

const labelEntries = (items: BarangInGroup[]) =>
  countBy(
    items,
    (b) => (b.variant?.product && b.variant.color && b.variant.size ? `${b.variant.product.nama}|${b.variant.color.nama}|${b.variant.size.nama}|${kondisi(b)}` : null),
    (b) => ({ produk: `${(b.variant.product.prefix ?? b.variant.product.nama).toUpperCase()} ${b.variant.color.nama}`, size: b.variant.size.nama }),
  );

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Nama dus berisi angka ("5", "DUS 12"): urut numerik menaik, non-angka di belakang.
function compareDus(a: { nama: string }, b: { nama: string }) {
  const num = (s: string) => Number(s.match(/\d+(\.\d+)?/)?.[0] ?? Number.POSITIVE_INFINITY);
  return num(a.nama) - num(b.nama) || a.nama.localeCompare(b.nama, "id", { numeric: true });
}

function toast(message: string, type: "success" | "error" = "success") {
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { type, message } }));
}

function writeDoc(w: Window, title: string, css: string, body: string) {
  w.document.write(
    `<html><head><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#111}${css}</style></head><body>${body}` +
      `<script>window.onload=()=>{window.print()}</script></body></html>`,
  );
  w.document.close();
}

const total = ({ group, items }: Resolved) => items.length || group._count.barang;

function printBiasa(w: Window, resolved: Resolved[]) {
  if (resolved.length === 1) {
    const r = resolved[0];
    const entries = summaryEntries(r.items);
    const body =
      entries.length === 0
        ? "<p>Kosong</p>"
        : `<table><tr><th>Isi</th><th>Qty</th><th>R/FG</th></tr>${entries
            .map((e) => `<tr><td>${escapeHtml(e.name)}</td><td>x ${e.n}</td><td>${e.label}</td></tr>`)
            .join("")}</table><p class="total">Total: ${total(r)} pcs</p>`;
    writeDoc(
      w,
      r.group.nama,
      `body{padding:24px}.nama{font-size:42px;font-weight:800;margin:0}.sub{font-size:14px;color:#555;margin:4px 0 16px}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border:1px solid #333;padding:8px;font-size:18px;text-align:left}.total{font-size:20px;font-weight:700;margin-top:12px}`,
      `<p class="nama">${escapeHtml(r.group.nama)}</p><p class="sub">${total(r)}/${DUS_CAPACITY} barang &middot; ${escapeHtml(formatDate(r.group.updatedAt))}</p>${body}`,
    );
    return;
  }
  const section = (title: string, list: Resolved[], breakBefore: boolean) =>
    list.length === 0
      ? ""
      : `<h2 class="${breakBefore ? "break" : ""}">${title} (${list.length})</h2><table><tr><th>Dus</th><th>Isi Dus</th><th>Total</th></tr>${list
          .map((r) => {
            const entries = summaryEntries(r.items);
            const isi = entries.length === 0 ? "Kosong" : entries.map((e) => `${escapeHtml(e.name)} x ${e.n} ${e.label}`).join("<br>");
            return `<tr><td class="dus">${escapeHtml(r.group.nama)}</td><td>${isi}</td><td class="num">${total(r)}</td></tr>`;
          })
          .join("")}</table><p class="total">Total: ${list.reduce((a, r) => a + total(r), 0)} pcs</p>`;
  const biasa = resolved.filter((r) => !isDusPengganti(r.group));
  const pengganti = resolved.filter((r) => isDusPengganti(r.group));
  writeDoc(
    w,
    `Rekap ${resolved.length} Dus`,
    `body{padding:24px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:18px 0 8px}.break{break-before:page}.sub{font-size:13px;color:#555;margin:0 0 12px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #333;padding:6px 8px;font-size:14px;text-align:left;vertical-align:top}.dus{white-space:nowrap;font-weight:700}.num{text-align:center;font-weight:700}.total{font-size:15px;font-weight:700;margin-top:10px}`,
    `<h1>Rekap ${resolved.length} Dus</h1><p class="sub">${escapeHtml(formatDate(new Date().toISOString()))}</p>` +
      section("Dus", biasa, false) +
      section("Dus Pengganti", pengganti, biasa.length > 0),
  );
}

function printLabel(w: Window, resolved: Resolved[]) {
  const labels = resolved
    .map(({ group, items }, i) => {
      const entries = labelEntries(items);
      const ket = isDusPengganti({ nama: group.nama, barang: items }) ? "PENGGANTI" : "FINISHGOOD";
      const body =
        entries.length === 0
          ? `<p class="isi">Kosong</p>`
          : `<table class="isi">${entries
              .map((e) => `<tr><td class="item">${escapeHtml(e.produk)}</td><td class="size">${escapeHtml(e.size)}</td><td class="qty">x ${e.n}</td></tr>`)
              .join("")}</table>`;
      return `<div class="${i > 0 ? "break" : ""}"><p class="ket">${ket}</p><p class="nama">${escapeHtml(group.nama)}</p>${body}</div>`;
    })
    .join("");
  writeDoc(
    w,
    resolved.length === 1 ? resolved[0].group.nama : `Label ${resolved.length} Dus`,
    `@page{size:100mm 75mm;margin:0}html,body{margin:0}body{padding:6mm;text-align:center}.ket{font-size:20px;font-weight:800;letter-spacing:2px;margin:0 0 4px}.nama{font-size:34px;font-weight:800;margin:0 0 10px;line-height:1.1}table.isi{width:100%;border-collapse:collapse;font-size:26px;font-weight:700}table.isi td{padding:2px 0;line-height:1.25}td.item{text-align:left}td.size{text-align:center;white-space:nowrap;padding:2px 8px}td.qty{text-align:right;white-space:nowrap}p.isi{font-size:26px;font-weight:700}.break{break-before:page}`,
    labels,
  );
}

function Modal({ title, eyebrow, onClose, children, footer, wide }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0F1C2E]/50 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0088C0]">{eyebrow}</p>}
            <h3 className="truncate text-base font-bold text-slate-900">{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${FOCUS}`}>
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex gap-2 border-t border-slate-100 px-5 py-3 [&>*]:flex-1">{footer}</div>}
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string | null }) {
  return msg ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#EF4444]">{msg}</p> : null;
}

function StokProduksi() {
  const { options: statusOptions } = useStatusOptions();
  const [groups, setGroups] = useState<BarangGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedArsip, setSelectedArsip] = useState<Set<number>>(new Set());
  const [showArsip, setShowArsip] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formNama, setFormNama] = useState("");
  const [editingGroup, setEditingGroup] = useState<BarangGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<BarangGroup | null>(null);
  const [crudLoading, setCrudLoading] = useState(false);
  const [crudError, setCrudError] = useState<string | null>(null);

  const [detailGroup, setDetailGroup] = useState<BarangGroup | null>(null);
  const [detailBarang, setDetailBarang] = useState<BarangInGroup[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<number | null>(null);
  const detailFor = useRef<number | null>(null);

  const refresh = useCallback(
    () =>
      getBarangGroups()
        .then((data) => {
          setGroups(data);
          setError(null);
        })
        .catch((e) => setError(errMsg(e, "Gagal memuat daftar dus")))
        .finally(() => setIsLoading(false)),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const anyModal = formMode !== null || deletingGroup !== null || detailGroup !== null;
  const closeAll = useCallback(() => {
    setFormMode(null);
    setDeletingGroup(null);
    setDetailGroup(null);
    detailFor.current = null;
  }, []);

  useEffect(() => {
    if (!anyModal) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAll();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyModal, closeAll]);

  const active = useMemo(() => groups.filter((g) => !g.isArsip), [groups]);
  const arsip = useMemo(() => groups.filter((g) => g.isArsip), [groups]);
  const totalBarang = active.reduce((a, g) => a + g._count.barang, 0);
  const fullCount = active.filter((g) => g._count.barang >= DUS_CAPACITY).length;

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return active
      .filter((g) => {
        const isFull = g._count.barang >= DUS_CAPACITY;
        if (filter !== "all" && (filter === "penuh") !== isFull) return false;
        return !kw || g.nama.toLowerCase().includes(kw) || (g.barang ?? []).some((b) => b.kodeBarang.toLowerCase().includes(kw));
      })
      .sort(compareDus);
  }, [active, search, filter]);

  const normal = filtered.filter((g) => !isDusPengganti(g));
  const pengganti = filtered.filter((g) => isDusPengganti(g));
  const visibleSelected = filtered.filter((g) => selected.has(g.id));
  const allSelected = filtered.length > 0 && visibleSelected.length === filtered.length;
  const arsipSelected = arsip.filter((g) => selectedArsip.has(g.id));

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<number>>>, id: number) =>
    set((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const g of filtered) {
        if (allSelected) next.delete(g.id);
        else next.add(g.id);
      }
      return next;
    });

  const statusBadge = (kode: string) => {
    const warna = statusOptions.find((o) => o.value === kode)?.warna;
    return (
      <span
        className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${warna ? "text-white" : "bg-slate-100 text-slate-600"}`}
        style={warna ? { backgroundColor: warna } : undefined}
      >
        {statusOptions.find((o) => o.value === kode)?.label ?? kode}
      </span>
    );
  };

  // Nama boleh sama dengan dus arsip; sama dengan dus aktif hanya diberi peringatan.
  const activeNamesake = (nama: string, exceptId?: number) => {
    const key = nama.trim().toLowerCase();
    return key ? active.filter((g) => g.id !== exceptId && g.nama.trim().toLowerCase() === key) : [];
  };
  const formDup = formMode ? activeNamesake(formNama, formMode === "edit" ? editingGroup?.id : undefined) : [];

  const setArsipOne = async (g: BarangGroup, isArsip: boolean) => {
    if (isArsip && !window.confirm(`Arsipkan "${g.nama}"?`)) return;
    if (!isArsip && activeNamesake(g.nama).length > 0 && !window.confirm(`Sudah ada dus aktif bernama "${g.nama}". Tetap pulihkan?`)) return;
    setBusyId(g.id);
    try {
      await updateBarangGroup(g.id, { isArsip });
      toast(isArsip ? `"${g.nama}" diarsipkan` : `"${g.nama}" dikembalikan ke daftar aktif`);
      await refresh();
    } catch (e) {
      toast(errMsg(e, isArsip ? "Gagal mengarsipkan dus" : "Gagal memulihkan dus"), "error");
    } finally {
      setBusyId(null);
    }
  };

  const bulkSetArsip = async (targets: BarangGroup[], isArsip: boolean) => {
    if (targets.length === 0) return;
    const clashes = isArsip ? [] : targets.filter((g) => activeNamesake(g.nama).length > 0).map((g) => g.nama);
    const clashNote = clashes.length > 0 ? `\n\n${clashes.length} dus punya nama sama dengan dus aktif: ${clashes.join(", ")}.` : "";
    if (!window.confirm(`${isArsip ? "Arsipkan" : "Pulihkan"} ${targets.length} dus yang dipilih?${clashNote}`)) return;
    setBulkBusy(true);
    let ok = 0;
    let firstError = "";
    for (const g of targets) {
      try {
        await updateBarangGroup(g.id, { isArsip });
        ok++;
      } catch (e) {
        firstError ||= errMsg(e, "Gagal");
      }
    }
    setBulkBusy(false);
    if (isArsip) setSelected(new Set());
    else setSelectedArsip(new Set());
    await refresh();
    const verb = isArsip ? "diarsipkan" : "dipulihkan";
    if (ok === targets.length) toast(`${ok} dus ${verb}`);
    else toast(`${ok} ${verb}, ${targets.length - ok} gagal. ${firstError}`, "error");
  };

  const openForm = (mode: "create" | "edit", g?: BarangGroup) => {
    setCrudError(null);
    setFormNama(g?.nama ?? "");
    setEditingGroup(g ?? null);
    setFormMode(mode);
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    const nama = formNama.trim();
    if (!nama) {
      setCrudError("Nama dus wajib diisi");
      return;
    }
    setCrudLoading(true);
    setCrudError(null);
    try {
      if (formMode === "edit" && editingGroup) {
        await updateBarangGroup(editingGroup.id, { nama });
        toast(`Dus diubah menjadi "${nama}"`);
      } else {
        await createBarangGroup(nama);
        toast(`Dus "${nama}" dibuat`);
      }
      setFormMode(null);
      await refresh();
    } catch (err) {
      setCrudError(errMsg(err, "Gagal menyimpan dus"));
    } finally {
      setCrudLoading(false);
    }
  };

  const handleDelete = async () => {
    const g = deletingGroup;
    if (!g) return;
    setCrudLoading(true);
    setCrudError(null);
    try {
      await deleteBarangGroup(g.id);
      setDeletingGroup(null);
      toast(`Dus "${g.nama}" dihapus`);
      await refresh();
    } catch (err) {
      setCrudError(errMsg(err, "Gagal menghapus dus"));
    } finally {
      setCrudLoading(false);
    }
  };

  const openDetail = async (g: BarangGroup) => {
    detailFor.current = g.id;
    setDetailError(null);
    setDetailBarang(g.barang ?? []);
    setDetailGroup(g);
    setIsLoadingDetail(true);
    try {
      const items = await getBarangInGroup(g.id);
      if (detailFor.current === g.id) setDetailBarang(items);
    } catch (err) {
      if (detailFor.current === g.id) setDetailError(errMsg(err, "Gagal memuat isi dus"));
    } finally {
      if (detailFor.current === g.id) setIsLoadingDetail(false);
    }
  };

  const handleUnassign = async (barangId: number) => {
    if (!detailGroup) return;
    setUnassigningId(barangId);
    try {
      await unassignBarangFromGroup(detailGroup.id, [barangId]);
      setDetailBarang((prev) => prev.filter((b) => b.id !== barangId));
      toast("Barang dilepas dari dus");
      await refresh();
    } catch (err) {
      setDetailError(errMsg(err, "Gagal melepas barang"));
    } finally {
      setUnassigningId(null);
    }
  };

  const resolveAll = (targets: BarangGroup[]) =>
    Promise.all(
      [...targets].sort(compareDus).map(async (group) => ({
        group,
        items: (group.barang?.length ?? 0) >= group._count.barang ? (group.barang ?? []) : await getBarangInGroup(group.id),
      })),
    );

  const printGroups = async (targets: BarangGroup[], mode: "label" | "biasa") => {
    if (targets.length === 0) return;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) {
      toast("Popup diblokir — izinkan popup untuk print", "error");
      return;
    }
    setIsPrinting(true);
    try {
      const resolved = await resolveAll(targets);
      if (mode === "label") printLabel(w, resolved);
      else printBiasa(w, resolved);
    } catch (e) {
      w.close();
      toast(errMsg(e, "Gagal print dus"), "error");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExportCSV = async () => {
    if (filtered.length === 0) return;
    try {
      const resolved = await resolveAll(filtered);
      const rows: unknown[][] = [];
      const section = (title: string, list: Resolved[]) => {
        if (list.length === 0) return;
        rows.push([title], ["NO", "PRODUCT", "SIZE", "JUMLAH"]);
        let subtotal = 0;
        for (const { group, items } of list) {
          rows.push([group.nama]);
          const entries = countBy(
            items,
            (b) => `${[b.variant?.product?.nama, b.variant?.style?.nama, b.variant?.color?.nama].filter(Boolean).join(" ")}|${b.variant?.size?.nama}`,
            (b) => ({
              product: [b.variant?.product?.nama, b.variant?.style?.nama, b.variant?.color?.nama].filter(Boolean).join(" ") || "-",
              size: b.variant?.size?.nama ?? "-",
            }),
          ).sort((a, b) => a.product.localeCompare(b.product, "id") || a.size.localeCompare(b.size, "id", { numeric: true }));
          if (entries.length === 0) rows.push(["Kosong"]);
          entries.forEach((e, i) => rows.push([i + 1, e.product, e.size, e.n]));
          subtotal += items.length;
          rows.push([]);
        }
        rows.push(["TOTAL", "", "", subtotal], []);
      };
      section("DUS", resolved.filter((r) => !isDusPengganti(r.group)));
      section("DUS PENGGANTI", resolved.filter((r) => isDusPengganti(r.group)));
      downloadCsv(`stok-produksi-${new Date().toISOString().slice(0, 10)}${filter === "all" ? "" : `-${filter}`}.csv`, rows);
      toast(`Export rekap ${filtered.length} dus ke CSV`);
    } catch (e) {
      toast(errMsg(e, "Gagal export CSV"), "error");
    }
  };

  const renderCard = (g: BarangGroup) => {
    const count = g._count.barang;
    const isFull = count >= DUS_CAPACITY;
    const isSel = selected.has(g.id);
    const entries = summaryEntries(g.barang ?? []);
    return (
      <article
        key={g.id}
        className={`group flex flex-col rounded-2xl border bg-white p-4 transition hover:shadow-[0_8px_24px_rgba(15,28,46,0.08)] ${
          isSel ? "border-[#00A8E8] ring-2 ring-[#00A8E8]/25" : "border-slate-200 hover:border-[#00A8E8]/40"
        }`}
      >
        <div className="flex flex-1 items-start gap-3">
          <input
            type="checkbox"
            checked={isSel}
            onChange={() => toggle(setSelected, g.id)}
            aria-label={`Pilih ${g.nama}`}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#1E3A5F]"
          />
          <button type="button" onClick={() => void openDetail(g)} className={`min-w-0 flex-1 rounded-lg text-left ${FOCUS}`}>
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-bold text-slate-900 group-hover:text-[#1E3A5F]">{g.nama}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                  isFull ? "bg-[#1E3A5F] text-white" : count === 0 ? "bg-slate-100 text-slate-500" : "bg-[#00A8E8]/10 text-[#0088C0]"
                }`}
              >
                {count}/{DUS_CAPACITY}
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] text-slate-400">Diperbarui {formatDate(g.updatedAt)}</span>
            <span className="mt-3 grid grid-cols-8 gap-1" aria-hidden="true">
              {Array.from({ length: DUS_CAPACITY }, (_, i) => (
                <span key={i} className={`h-1.5 rounded-full ${i < count ? (isFull ? "bg-[#1E3A5F]" : "bg-[#00A8E8]") : "bg-slate-100"}`} />
              ))}
            </span>
            <span className="mt-3 block space-y-0.5">
              {entries.length === 0 ? (
                <span className="block text-sm text-slate-400">Kosong</span>
              ) : (
                entries.slice(0, 3).map((e) => (
                  <span key={`${e.name}${e.label}`} className="flex items-center gap-2 text-[13px] text-slate-600">
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    <span className={`shrink-0 rounded px-1 text-[10px] font-bold ${e.label === "R" ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{e.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-800">×{e.n}</span>
                  </span>
                ))
              )}
              {entries.length > 3 && <span className="block text-xs text-slate-400">+{entries.length - 3} jenis lain</span>}
            </span>
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
          <button type="button" disabled={isPrinting} onClick={() => void printGroups([g], "biasa")} className={`${MINI} text-slate-600 hover:bg-slate-100`}>
            Print
          </button>
          <button type="button" disabled={isPrinting} onClick={() => void printGroups([g], "label")} className={`${MINI} text-slate-600 hover:bg-slate-100`}>
            Label
          </button>
          <button type="button" onClick={() => openForm("edit", g)} className={`${MINI} text-slate-600 hover:bg-slate-100`}>
            Edit
          </button>
          <span className="flex-1" />
          <button type="button" disabled={busyId === g.id} onClick={() => void setArsipOne(g, true)} className={`${MINI} text-amber-700 hover:bg-amber-50`}>
            {busyId === g.id ? "…" : "Arsip"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCrudError(null);
              setDeletingGroup(g);
            }}
            className={`${MINI} text-[#EF4444] hover:bg-red-50`}
          >
            Hapus
          </button>
        </div>
      </article>
    );
  };

  const section = (title: string, list: BarangGroup[]) =>
    list.length > 0 && (
      <section aria-label={title}>
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
          {title}
          <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] text-slate-600">{list.length}</span>
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{list.map(renderCard)}</div>
      </section>
    );

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Barang Produksi</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Stok Produksi</h2>
          <p className="mt-1 text-sm text-slate-500">Satu dus maksimal {DUS_CAPACITY} barang. Klik dus untuk melihat isinya.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void handleExportCSV()} disabled={isLoading || filtered.length === 0} className={BTN_GHOST}>
            Export CSV
          </button>
          <button type="button" onClick={() => openForm("create")} className={BTN_PRIMARY}>
            + Dus Baru
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Dus aktif", value: active.length, cls: "text-slate-900" },
          { label: "Barang di dus", value: `${totalBarang}/${active.length * DUS_CAPACITY}`, cls: "text-slate-900" },
          { label: "Dus penuh", value: fullCount, cls: "text-[#1E3A5F]" },
          { label: "Belum penuh", value: active.length - fullCount, cls: "text-[#0088C0]" },
        ].map((s) => (
          <div key={s.label} className={`${CARD} px-4 py-3`}>
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className={`mt-0.5 text-xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama dus atau kode barang…"
            aria-label="Cari dus"
            className={`${FIELD} pl-10`}
          />
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto" role="group" aria-label="Filter status">
          {(
            [
              ["all", "Semua"],
              ["tersedia", "Belum penuh"],
              ["penuh", "Penuh"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${FOCUS} ${filter === v ? "bg-white text-[#1E3A5F] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur sm:top-16">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={filtered.length === 0} className="h-4 w-4 accent-[#1E3A5F]" />
          Pilih semua
        </label>
        <span className="text-sm text-slate-400">· {visibleSelected.length} dipilih</span>
        {visibleSelected.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelected(new Set())} className={`${BTN_GHOST} h-9`}>
              Batal
            </button>
            <button type="button" disabled={isPrinting} onClick={() => void printGroups(visibleSelected, "biasa")} className={`${BTN_GHOST} h-9`}>
              {isPrinting ? "Menyiapkan…" : "Print"}
            </button>
            <button type="button" disabled={isPrinting} onClick={() => void printGroups(visibleSelected, "label")} className={`${BTN_PRIMARY} h-9`}>
              {isPrinting ? "Menyiapkan…" : "Print label"}
            </button>
            <button type="button" disabled={bulkBusy} onClick={() => void bulkSetArsip(visibleSelected, true)} className={`${BTN} h-9 bg-amber-100 text-amber-800 hover:bg-amber-200`}>
              {bulkBusy ? "Memproses…" : "Arsipkan"}
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Memuat daftar dus">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${CARD} h-44 animate-pulse p-4`}>
              <div className="h-4 w-1/2 rounded bg-slate-200" />
              <div className="mt-4 h-1.5 rounded bg-slate-100" />
              <div className="mt-4 h-3 w-3/4 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-[#EF4444]">
          {error}
          <button type="button" onClick={() => void refresh()} className={`${BTN_GHOST} h-9`}>
            Coba lagi
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${CARD} py-14 text-center`}>
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">{BOX_ICON}</span>
          <p className="font-semibold text-slate-700">Tidak ada dus ditemukan</p>
          <p className="mt-1 text-sm text-slate-500">Ubah pencarian/filter atau buat dus baru.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {section("Dus", normal)}
          {section("Dus Pengganti", pengganti)}
        </div>
      )}

      {arsip.length > 0 && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-3">
          <button
            type="button"
            onClick={() => setShowArsip((v) => !v)}
            aria-expanded={showArsip}
            className={`flex w-full items-center justify-between rounded-lg text-sm font-semibold text-slate-600 ${FOCUS}`}
          >
            Arsip ({arsip.length})
            <span aria-hidden="true">{showArsip ? "▾" : "▸"}</span>
          </button>
          {showArsip && (
            <>
              {arsipSelected.length > 0 && (
                <button type="button" disabled={bulkBusy} onClick={() => void bulkSetArsip(arsipSelected, false)} className={`${BTN} mt-3 h-9 bg-[#10B981] text-white hover:bg-[#059669]`}>
                  {bulkBusy ? "Memulihkan…" : `Pulihkan ${arsipSelected.length} dipilih`}
                </button>
              )}
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {[...arsip].sort(compareDus).map((g) => (
                  <li key={g.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedArsip.has(g.id)}
                      onChange={() => toggle(setSelectedArsip, g.id)}
                      aria-label={`Pilih arsip ${g.nama}`}
                      className="h-4 w-4 shrink-0 accent-[#1E3A5F]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-700">{g.nama}</p>
                      <p className="text-[11px] text-slate-400">
                        {g._count.barang}/{DUS_CAPACITY} barang
                      </p>
                    </div>
                    <button type="button" disabled={busyId === g.id} onClick={() => void setArsipOne(g, false)} className={`${MINI} text-emerald-700 hover:bg-emerald-50`}>
                      {busyId === g.id ? "…" : "Pulihkan"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {formMode && (
        <Modal title={formMode === "edit" ? `Edit ${editingGroup?.nama ?? "dus"}` : "Dus baru"} onClose={() => setFormMode(null)}>
          <form onSubmit={submitForm}>
            <label className="block text-xs font-semibold text-slate-600">
              Nama / nomor dus
              <input
                className={`${FIELD} mt-1.5`}
                placeholder="Contoh: DUS 5"
                value={formNama}
                onChange={(e) => setFormNama(e.target.value)}
                aria-describedby={formDup.length > 0 ? "dus-dup-warning" : undefined}
                autoFocus
              />
            </label>
            {formDup.length > 0 && (
              <p id="dus-dup-warning" role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Nama sudah dipakai dus aktif: {formDup.map((g) => `${g.nama} (${g._count.barang}/${DUS_CAPACITY})`).join(", ")}. Tetap boleh disimpan.
              </p>
            )}
            <ErrorBox msg={crudError} />
            <div className="mt-5 flex gap-2 [&>*]:flex-1">
              <button type="button" onClick={() => setFormMode(null)} className={BTN_GHOST}>
                Batal
              </button>
              <button type="submit" disabled={crudLoading} className={formDup.length > 0 ? `${BTN} bg-amber-500 text-white hover:bg-amber-600` : BTN_PRIMARY}>
                {crudLoading ? "Menyimpan…" : formDup.length > 0 ? "Tetap simpan" : "Simpan"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deletingGroup && (
        <Modal
          title="Hapus dus?"
          onClose={() => setDeletingGroup(null)}
          footer={
            <>
              <button type="button" onClick={() => setDeletingGroup(null)} className={BTN_GHOST}>
                Batal
              </button>
              <button type="button" onClick={() => void handleDelete()} disabled={crudLoading} className={`${BTN} bg-[#EF4444] text-white hover:bg-red-600`}>
                {crudLoading ? "Menghapus…" : "Ya, hapus"}
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            Hapus <span className="font-semibold text-slate-900">{deletingGroup.nama}</span>? Tindakan ini tidak dapat dibatalkan.
          </p>
          {deletingGroup._count.barang > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {deletingGroup._count.barang} barang di dalamnya akan dilepas (barang tetap ada di sistem).
            </p>
          )}
          <ErrorBox msg={crudError} />
        </Modal>
      )}

      {detailGroup && (
        <Modal
          wide
          eyebrow="Detail dus"
          title={`${detailGroup.nama} · ${detailBarang.length}/${DUS_CAPACITY} barang`}
          onClose={closeAll}
          footer={
            <>
              <button type="button" disabled={isPrinting} onClick={() => void printGroups([detailGroup], "label")} className={BTN_GHOST}>
                Print label
              </button>
              <button type="button" onClick={closeAll} className={BTN_PRIMARY}>
                Selesai
              </button>
            </>
          }
        >
          <ErrorBox msg={detailError} />
          {isLoadingDetail && detailBarang.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Memuat isi dus…</p>
          ) : detailBarang.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
              Dus kosong — scan barang lalu simpan ke dus ini lewat halaman Scan QR.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {detailBarang.map((b, i) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-bold text-slate-800">{b.kodeBarang}</p>
                    <p className="truncate text-xs text-slate-500">{variantName(b)}</p>
                  </div>
                  {statusBadge(b.status)}
                  <span
                    title={b.pernahRetur ? "Pernah retur" : "Tidak pernah retur"}
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${b.pernahRetur ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
                  >
                    {kondisi(b)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleUnassign(b.id)}
                    disabled={unassigningId === b.id}
                    className={`${MINI} text-[#EF4444] hover:bg-red-50`}
                  >
                    {unassigningId === b.id ? "…" : "Lepas"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}

export default StokProduksi;
