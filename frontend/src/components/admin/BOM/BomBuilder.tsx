import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faGripVertical, faMagnifyingGlass, faRotateLeft, faSave } from "@fortawesome/free-solid-svg-icons";
import { getItems, type Item } from "../../../api/item";
import { createBom, getBoms, updateBom, type BomItemInput } from "../../../api/bom";
import { createSubassembly, getSubassemblies } from "../../../api/subassembly";
import { getProducts, type ProductVariant } from "../../../api/products";
import { cloneNodes, countRows, depthOf, findNode, flatten, nid, normalizeNodes, rp, sumTree, unitCost, type BomNode, type FlatRow } from "./bomTree";

const inputCls = "h-10 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-[14px] text-[#1F2937] outline-none transition placeholder:text-[#6B7280]/60 focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20";
const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-[#0088C0] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
const secondaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1F2937] hover:bg-[#F5F7FA]";
const ghostBtn = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-medium text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]";

const ROW = "grid grid-cols-[18px_46px_52px_minmax(0,1fr)_72px_64px_112px_120px_28px] items-center gap-1.5 px-2";
const LEVEL_COLORS = ["#0F1C2E", "#006E99", "#4452c4", "#96590a", "#a23b72"];
const LEVEL_LABELS = ["Produk jadi", "Komponen langsung", "Isi rakitan L1", "Isi rakitan L2", "Level lebih dalam"];
const CELL_INPUT = "w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-[#1F2937] outline-none hover:border-[#D1D5DB] focus:border-[#00A8E8] focus:bg-white";

interface Draft {
  name: string;
  code: string;
  version: string;
  productVariantId: number | null;
  qty: number;
  nodes: BomNode[];
  blueprints: { id: string; name: string; code: string; nodes: BomNode[] }[];
}

const KEY = "rsv-bom-builder-v1";

const initial: Draft = {
  name: "",
  code: "",
  version: "1.0",
  productVariantId: null,
  qty: 1,
  nodes: [],
  blueprints: [],
};

function loadDraft(): Draft {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initial;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return initial;

    const d = parsed as Partial<Draft>;
    const blueprints = Array.isArray(d.blueprints) ? d.blueprints.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const b = raw as Partial<Draft["blueprints"][number]>;
      return [{
        id: typeof b.id === "string" && b.id ? b.id : nid(),
        name: typeof b.name === "string" ? b.name : "Tanpa nama",
        code: typeof b.code === "string" ? b.code : "",
        nodes: normalizeNodes(b.nodes),
      }];
    }) : [];

    return {
      name: typeof d.name === "string" ? d.name : "",
      code: typeof d.code === "string" ? d.code : "",
      version: typeof d.version === "string" && d.version.trim() ? d.version : "1.0",
      productVariantId: Number.isInteger(d.productVariantId) && Number(d.productVariantId) > 0 ? Number(d.productVariantId) : null,
      qty: typeof d.qty === "number" && Number.isFinite(d.qty) && d.qty >= 1 ? d.qty : 1,
      nodes: normalizeNodes(d.nodes),
      blueprints,
    };
  } catch {
    return initial;
  }
}

type DragPayload = { kind: "node" | "item" | "bp"; id: string };
type DropZone = "before" | "after" | "in";

export function BomBuilder() {
  const [draft, setDraft] = useState<Draft>(() => loadDraft());
  const [items, setItems] = useState<Item[]>([]);
  const [variants, setVariants] = useState<{ variant: ProductVariant; productName: string; prefix: string }[]>([]);
  const [variantSearch, setVariantSearch] = useState("");
  const [variantSelectOpen, setVariantSelectOpen] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"tree" | "flat">("tree");
  const [maxLevel, setMaxLevel] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [zone, setZone] = useState<{ id: string; z: DropZone } | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const armTimer = useRef<number | undefined>(undefined);

  const flash = useCallback((m: string) => {
    setNotice(m);
    window.setTimeout(() => setNotice((current) => current === m ? null : current), 2500);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      // The builder remains usable if storage is unavailable or full.
    }
  }, [draft]);

  useEffect(() => {
    void Promise.all([getItems({ aktif: true }), getProducts()]).then(([itemList, products]) => {
      setItems(itemList);
      setVariants(products.flatMap((product) => product.variants.map((variant) => ({
        variant,
        productName: product.nama,
        prefix: product.prefix,
      }))));
    }).catch((error: unknown) => {
      flash(error instanceof Error ? error.message : "Gagal memuat data komponen dan varian produk");
    });
  }, [flash]);

  /** Klik pertama minta konfirmasi, klik kedua dalam 3 detik menjalankan aksi. */
  const arm = (key: string, fn: () => void) => {
    if (armed === key) {
      window.clearTimeout(armTimer.current);
      setArmed(null);
      fn();
      return;
    }
    window.clearTimeout(armTimer.current);
    setArmed(key);
    armTimer.current = window.setTimeout(() => setArmed(null), 3000);
  };

  const patch = useCallback((fn: (d: Draft) => void) => {
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as Draft;
      fn(next);
      return next;
    });
  }, []);

  const updateNode = (id: string, p: Partial<BomNode>) => patch((d) => {
    const f = findNode(d.nodes, id);
    if (f) Object.assign(f.node, p);
  });

  const removeNode = (id: string) => patch((d) => {
    const f = findNode(d.nodes, id);
    if (f) f.list.splice(f.index, 1);
  });

  const nodeFromItem = (it: Item): BomNode => ({
    id: nid(),
    itemId: it.id,
    kode: it.kode,
    nama: it.nama,
    unit: it.unit || "pcs",
    qty: 1,
    cost: 0,
    kids: [],
  });

  const addFromItem = (item: Item) => patch((d) => {
    d.nodes.push(nodeFromItem(item));
  });

  const place = (source: DragPayload, targetId: string | null, dropZone: DropZone | null) => {
    patch((d) => {
      const node = (() => {
        if (source.kind === "item") {
          const it = items.find((i) => String(i.id) === source.id);
          return it ? nodeFromItem(it) : null;
        }
        if (source.kind === "bp") {
          const bp = d.blueprints.find((b) => b.id === source.id);
          return bp ? { id: nid(), kode: bp.code, nama: bp.name, unit: "set", qty: 1, cost: 0, kids: cloneNodes(bp.nodes) } : null;
        }
        const f = findNode(d.nodes, source.id);
        if (!f) return null;
        if (targetId && (targetId === source.id || findNode(f.node.kids, targetId))) return null;
        f.list.splice(f.index, 1);
        return f.node;
      })();

      if (!node) return;
      if (!targetId) {
        d.nodes.push(node);
        return;
      }
      const t = findNode(d.nodes, targetId);
      if (!t) {
        d.nodes.push(node);
        return;
      }
      if (dropZone === "in") t.node.kids.push(node);
      else t.list.splice(t.index + (dropZone === "after" ? 1 : 0), 0, node);
    });
  };

  const zoneAt = (e: DragEvent<HTMLDivElement>): DropZone => {
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    return y < 0.3 ? "before" : y > 0.7 ? "after" : "in";
  };

  const canDropOn = (id: string) => {
    if (!drag) return false;
    if (drag.kind !== "node") return true;
    const f = findNode(draft.nodes, drag.id);
    return !(f && (drag.id === id || findNode(f.node.kids, id)));
  };

  const filteredGroups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const groups = new Map<string, Item[]>();
    items
      .filter((i) => !s || `${i.kode} ${i.nama}`.toLowerCase().includes(s))
      .forEach((i) => {
        const key = i.jenis || "Lainnya";
        const list = groups.get(key);
        if (list) list.push(i);
        else groups.set(key, [i]);
      });
    return Array.from(groups.entries());
  }, [items, q]);

  const shownItems = useMemo(() => filteredGroups.reduce((s, [, list]) => s + list.length, 0), [filteredGroups]);

  const variantLabel = (entry: (typeof variants)[number]) =>
    [entry.productName, entry.variant.style.nama, entry.variant.color.nama, entry.variant.size.nama].filter(Boolean).join(" ");
  const selectedVariant = variants.find(({ variant }) => variant.id === draft.productVariantId);
  const matchingVariants = variants.filter((entry) =>
    variantLabel(entry).toLocaleLowerCase().includes(variantSearch.trim().toLocaleLowerCase()),
  );

  const depth = useMemo(() => depthOf(draft.nodes), [draft.nodes]);

  const stats = useMemo(() => {
    const acc = new Map<string, FlatRow>();
    flatten(draft.nodes, draft.qty, acc);
    const per = sumTree(draft.nodes);
    return { per, total: per * draft.qty, rows: countRows(draft.nodes), kinds: acc.size, flat: Array.from(acc.values()) };
  }, [draft.nodes, draft.qty]);

  const saveBlueprint = () => {
    if (!draft.nodes.length) { flash("BOM masih kosong"); return; }
    patch((d) => {
      const bp = {
        id: nid(),
        name: d.name.trim() || "Tanpa nama",
        code: d.code.trim(),
        nodes: cloneNodes(d.nodes),
      };
      const idx = bp.code ? d.blueprints.findIndex((b) => b.code.trim() === bp.code) : -1;
      if (idx >= 0) d.blueprints[idx] = { ...bp, id: d.blueprints[idx].id };
      else d.blueprints.push(bp);
    });
    flash("Blueprint tersimpan");
  };

  const saveToDatabase = async () => {
    if (!draft.version.trim()) { flash("Versi BOM wajib diisi"); return; }
    if (!selectedVariant) { flash("Pilih varian produk sebagai output BOM"); return; }
    if (!draft.nodes.length) { flash("BOM masih kosong"); return; }

    const validateNodes = (nodes: BomNode[]): string | null => {
      for (const node of nodes) {
        if (!node.nama.trim()) return "Nama setiap komponen BOM wajib diisi";
        if (node.qty <= 0) return `Jumlah ${node.nama || node.kode} harus lebih dari 0`;
        if (node.kids.length === 0 && !node.itemId) return `Komponen ${node.nama || node.kode} tidak terhubung ke item master`;
        if (node.kids.length > 0 && !node.itemId && !node.kode.trim()) return `Kode subassembly ${node.nama || "tanpa nama"} wajib diisi`;
        if (node.kids.length > 0 && node.kode.length > 30) return `Kode subassembly ${node.kode} maksimal 30 karakter`;
        const childError = validateNodes(node.kids);
        if (childError) return childError;
      }
      return null;
    };
    const validationError = validateNodes(draft.nodes);
    if (validationError) { flash(validationError); return; }

    setSaving(true);
    try {
      const [existingSubassemblies, existingBoms] = await Promise.all([getSubassemblies(), getBoms()]);
      const subassemblies = [...existingSubassemblies];
      const boms = [...existingBoms];

      const persistOutput = async (
        nodes: BomNode[],
        output: { productVariantId?: number; subassemblyId?: number },
        name: string,
        code: string,
      ) => {
        const bomItems: BomItemInput[] = [];
        for (const [index, node] of nodes.entries()) {
          if (node.kids.length > 0) {
            let subassembly = node.itemId
              ? subassemblies.find((candidate) => candidate.itemId === node.itemId)
              : undefined;
            if (!subassembly && !node.itemId) {
              subassembly = subassemblies.find((candidate) => candidate.kode.toLowerCase() === node.kode.trim().toLowerCase());
            }
            if (!subassembly) {
              subassembly = await createSubassembly({
                kode: node.kode.trim(),
                nama: node.nama.trim() || node.kode.trim(),
                ...(node.itemId ? { itemId: node.itemId } : {}),
              });
              subassemblies.push(subassembly);
            }

            await persistOutput(node.kids, { subassemblyId: subassembly.id }, node.nama, node.kode);
            bomItems.push({ urutan: index + 1, subassemblyId: subassembly.id, quantity: node.qty, unit: node.unit || null });
          } else {
            bomItems.push({ urutan: index + 1, itemId: node.itemId, quantity: node.qty, unit: node.unit || null });
          }
        }

        const matchingBom = boms.find((bom) =>
          bom.version === draft.version.trim()
          && (output.productVariantId !== undefined
            ? bom.productVariantId === output.productVariantId
            : bom.subassemblyId === output.subassemblyId),
        );
        const body = {
          ...(code.trim() ? { kode: code.trim() } : {}),
          nama: name.trim(),
          version: draft.version.trim(),
          isActive: true,
          ...output,
          items: bomItems,
        };
        if (matchingBom) {
          await updateBom(matchingBom.id, body);
        } else {
          const created = await createBom(body);
          boms.push(created);
        }
      };

      await persistOutput(
        draft.nodes,
        { productVariantId: selectedVariant.variant.id },
        variantLabel(selectedVariant),
        selectedVariant.variant.kodeVariant ?? "",
      );
      flash("BOM berhasil disimpan atau diperbarui di database");
    } catch (error) {
      flash(`Gagal menyimpan BOM: ${error instanceof Error ? error.message : "Terjadi kesalahan"}. Jika sebagian subassembly sudah dibuat, periksa kembali sebelum mencoba lagi.`);
    } finally {
      setSaving(false);
    }
  };

  const loadBlueprint = (id: string) => {
    const bp = draft.blueprints.find((b) => b.id === id);
    if (!bp) return;
    const go = () => patch((d) => {
      d.nodes = cloneNodes(bp.nodes);
      d.name = bp.name;
      d.code = bp.code ? `${bp.code}-salinan` : "";
    });
    if (draft.nodes.length) arm(`load:${id}`, go);
    else go();
  };

  const insertBlueprint = (id: string) => patch((d) => {
    const bp = d.blueprints.find((b) => b.id === id);
    if (!bp) return;
    d.nodes.push({ id: nid(), kode: bp.code, nama: bp.name, unit: "set", qty: 1, cost: 0, kids: cloneNodes(bp.nodes) });
  });

  const delBlueprint = (id: string) => patch((d) => { d.blueprints = d.blueprints.filter((b) => b.id !== id); });

  const copyCsv = () => {
    const rows: (string | number)[][] = [["Level", "No", "Kode", "Komponen", "Jumlah", "Satuan", "Harga satuan", "Subtotal"]];
    const walk = (nodes: BomNode[], prefix: string, level: number) => {
      nodes.forEach((n, i) => {
        const no = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        const cost = unitCost(n);
        rows.push([level, no, n.kode, n.nama, n.qty, n.unit, Math.round(cost), Math.round(n.qty * cost)]);
        walk(n.kids, no, level + 1);
      });
    };
    walk(draft.nodes, "", 0);
    const text = rows
      .map((r) => r.map((c) => String(c).replace(/[\t\n]/g, " ")).join("\t"))
      .join("\n");

    if (!navigator.clipboard?.writeText) {
      flash("Clipboard tidak tersedia. Gunakan HTTPS atau localhost.");
      return;
    }

    void navigator.clipboard.writeText(text)
      .then(() => flash("Tabel disalin ke clipboard"))
      .catch(() => flash("Gagal menyalin tabel. Periksa izin clipboard browser."));
  };

  const renderRow = (n: BomNode, no: string, lv: number): ReactNode => {
    const sub = n.kids.length > 0;
    const d = lv - 1;
    const showKids = sub && (maxLevel === 0 || lv < maxLevel);
    const color = LEVEL_COLORS[Math.min(lv, 4)];
    const rowZone = zone?.id === n.id ? zone.z : null;
    const dropCls = rowZone === "in"
      ? "shadow-[inset_0_0_0_2px_#00A8E8]"
      : rowZone === "before"
        ? "shadow-[0_-2px_0_#00A8E8]"
        : rowZone === "after"
          ? "shadow-[0_2px_0_#00A8E8]"
          : "";

    return (
      <div key={n.id}>
        <div
          className={`${ROW} border-b border-l-4 border-[#EDF0F4] py-1.5 text-[14px] ${sub ? "bg-[#F5F7FA] font-semibold" : "bg-white"} ${dropCls}`}
          style={{ borderLeftColor: color, backgroundColor: rowZone === "in" ? "#E6F6FD" : undefined }}
          onDragOver={(e) => {
            if (!canDropOn(n.id)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = drag?.kind === "node" ? "move" : "copy";
            const z = zoneAt(e);
            if (zone?.id !== n.id || zone.z !== z) setZone({ id: n.id, z });
          }}
          onDragLeave={() => setZone((cur) => cur?.id === n.id ? null : cur)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!drag) return;
            place(drag, n.id, zoneAt(e));
            setZone(null);
            setDrag(null);
          }}
        >
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", n.id);
              setDrag({ kind: "node", id: n.id });
            }}
            onDragEnd={() => { setDrag(null); setZone(null); }}
            className="cursor-grab text-center text-[#9AA7B6]"
            title="Seret untuk memindahkan"
            aria-hidden="true"
          >
            <FontAwesomeIcon icon={faGripVertical} className="h-3.5 w-3.5" />
          </span>
          <span
            className="justify-self-start rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ color, backgroundColor: `${color}24` }}
            title={`Level ${lv}, ${sub ? `rakitan berisi ${n.kids.length} item` : "material"}`}
          >
            L{lv}
          </span>
          <span className="text-[12px] text-[#6B7280]">{no}</span>
          <div className="min-w-0" style={{ paddingLeft: `${d * 20 + 6}px` }}>
            <input
              className={CELL_INPUT}
              value={n.nama}
              onChange={(e) => updateNode(n.id, { nama: e.target.value })}
              aria-label="Nama komponen"
            />
            <span className="px-1.5 text-[11px] text-[#6B7280]">{n.kode}</span>
          </div>
          <input
            type="number"
            min={0}
            step="any"
            className={`${CELL_INPUT} text-right`}
            value={n.qty}
            onChange={(e) => {
              const value = Number(e.target.value);
              updateNode(n.id, { qty: Number.isFinite(value) ? Math.max(0, value) : 0 });
            }}
            aria-label="Jumlah"
          />
          <input
            className={CELL_INPUT}
            value={n.unit}
            onChange={(e) => updateNode(n.id, { unit: e.target.value })}
            aria-label="Satuan"
          />
          {sub ? (
            <span className="pr-1.5 text-right text-[13px]">{rp(unitCost(n))}</span>
          ) : (
            <input
              type="number"
              min={0}
              step="any"
              className={`${CELL_INPUT} text-right`}
              value={n.cost}
              onChange={(e) => {
                const value = Number(e.target.value);
                updateNode(n.id, { cost: Number.isFinite(value) ? Math.max(0, value) : 0 });
              }}
              aria-label="Harga satuan"
            />
          )}
          <span className="pr-1.5 text-right text-[13px]">{rp(n.qty * unitCost(n))}</span>
          <button
            type="button"
            onClick={() => removeNode(n.id)}
            className="h-[26px] w-[26px] rounded text-[18px] leading-none text-[#6B7280] hover:text-[#EF4444]"
            aria-label={`Hapus ${n.nama}`}
          >
            ×
          </button>
        </div>
        {showKids && n.kids.map((k, i) => renderRow(k, `${no}.${i + 1}`, lv + 1))}
        {sub && !showKids && (
          <div
            className="border-b border-[#EDF0F4] py-1.5 text-[12px] text-[#6B7280]"
            style={{ paddingLeft: `${122 + (d + 1) * 20}px` }}
          >
            {countRows(n.kids)} item di level lebih dalam disembunyikan
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-3xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Bill of Materials</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Penyusun Bill of Materials</h1>
          <p className="mt-2 text-base text-[#6B7280]">Susun struktur produk, hitung biaya bahan, dan pakai ulang blueprint yang sudah ada.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => arm("reset", () => patch((d) => { d.nodes = []; }))} className={ghostBtn}>
            <FontAwesomeIcon icon={faRotateLeft} className="h-4 w-4" /> {armed === "reset" ? "Yakin? Klik lagi" : "Kosongkan BOM"}
          </button>
          <button type="button" onClick={copyCsv} className={secondaryBtn}>
            <FontAwesomeIcon icon={faCopy} className="h-4 w-4" /> Salin ke Excel
          </button>
          <button type="button" onClick={saveBlueprint} className={primaryBtn}>
            <FontAwesomeIcon icon={faSave} className="h-4 w-4" /> Simpan sebagai blueprint
          </button>
          <button type="button" onClick={() => void saveToDatabase()} className={primaryBtn} disabled={saving}>
            <FontAwesomeIcon icon={faSave} className="h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan ke database"}
          </button>
        </div>
      </header>

      <div aria-live="polite">
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[#1F2937]">{notice}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded-xl border border-[#EDF0F4] bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#6B7280]">Blueprint BOM</h3>
            {draft.blueprints.length === 0 ? (
              <p className="text-[13px] text-[#6B7280]">Belum ada blueprint. Simpan BOM saat ini sebagai blueprint.</p>
            ) : (
              <ul>
                {draft.blueprints.map((b) => (
                  <li
                    key={b.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "copy";
                      e.dataTransfer.setData("text/plain", b.id);
                      setDrag({ kind: "bp", id: b.id });
                    }}
                    onDragEnd={() => { setDrag(null); setZone(null); }}
                    className="mb-1.5 cursor-grab rounded-lg border border-[#D1D5DB] bg-white p-2 text-[13px] transition hover:border-[#00A8E8] hover:bg-[#E6F6FD]"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#9AA7B6]" aria-hidden="true"><FontAwesomeIcon icon={faGripVertical} className="h-3.5 w-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-[#1F2937]">{b.name}</div>
                        <div className="truncate text-[11px] text-[#6B7280]">
                          {b.code || "-"}, {countRows(b.nodes)} baris, {rp(sumTree(b.nodes))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1.5 flex gap-1.5 pl-5">
                      <button
                        type="button"
                        onClick={() => loadBlueprint(b.id)}
                        title="Ganti BOM saat ini dengan blueprint ini"
                        className="rounded border border-[#D1D5DB] px-2 py-0.5 text-[11px] hover:bg-white"
                      >
                        {armed === `load:${b.id}` ? "Yakin?" : "Muat"}
                      </button>
                      <button
                        type="button"
                        onClick={() => insertBlueprint(b.id)}
                        title="Sisipkan sebagai sub-rakitan"
                        className="rounded border border-[#D1D5DB] px-2 py-0.5 text-[11px] hover:bg-white"
                      >
                        Sisipkan
                      </button>
                      <button
                        type="button"
                        onClick={() => arm(`del:${b.id}`, () => delBlueprint(b.id))}
                        className={`rounded px-2 py-0.5 text-[11px] hover:bg-[#EF4444]/10 ${armed === `del:${b.id}` ? "text-[#DC2626]" : "text-[#6B7280]"}`}
                      >
                        {armed === `del:${b.id}` ? "Yakin?" : "Hapus"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="self-start rounded-xl border border-[#EDF0F4] bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] lg:sticky lg:top-4 lg:z-10">
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#6B7280]">Komponen</h3>
            <div className="relative mb-2">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input type="search" className={`${inputCls} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari komponen" aria-label="Cari komponen" />
            </div>
            <div className="max-h-[420px] overflow-y-auto pr-1">
              {filteredGroups.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-[#6B7280]">Tidak ada komponen yang cocok.</p>
              ) : filteredGroups.map(([cat, list]) => (
                <div key={cat}>
                  <h4 className="mb-1.5 mt-3 text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">{cat}</h4>
                  {list.map((it) => (
                    <div
                      key={it.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "copy";
                        e.dataTransfer.setData("text/plain", String(it.id));
                        setDrag({ kind: "item", id: String(it.id) });
                      }}
                      onDragEnd={() => { setDrag(null); setZone(null); }}
                      className="mb-1.5 flex cursor-grab items-start gap-2 rounded-lg border border-[#D1D5DB] bg-white px-2 py-1.5 text-[13px] transition hover:border-[#00A8E8] hover:bg-[#E6F6FD]"
                    >
                      <span className="mt-0.5 shrink-0 text-[#9AA7B6]" aria-hidden="true"><FontAwesomeIcon icon={faGripVertical} className="h-3.5 w-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="break-words font-medium text-[#1F2937]" title={it.nama}>{it.nama}</div>
                        <div className="break-words text-[11px] text-[#6B7280]" title={`${it.kode} · ${it.unit || "pcs"}`}>{it.kode} · {it.unit || "pcs"}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addFromItem(it)}
                        className="shrink-0 rounded border border-[#D1D5DB] px-2 py-0.5 text-[16px] leading-none text-[#1F2937] hover:border-[#00A8E8]"
                        aria-label={`Tambahkan ${it.nama}`}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-2 text-right text-[12px] text-[#6B7280]">{shownItems} dari {items.length} komponen</p>
          </section>
        </aside>

        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative grid gap-1 text-[14px] font-medium text-[#1F2937]">
              <label htmlFor="bom-product-variant">Output varian produk / nama BOM</label>
              <input
                id="bom-product-variant"
                className={inputCls}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={variantSelectOpen}
                aria-controls="bom-product-variant-options"
                value={variantSelectOpen ? variantSearch : selectedVariant ? variantLabel(selectedVariant) : ""}
                onFocus={() => { setVariantSearch(""); setVariantSelectOpen(true); }}
                onChange={(e) => { setVariantSearch(e.target.value); setVariantSelectOpen(true); }}
                placeholder="Cari dan pilih varian produk"
                autoComplete="off"
              />
              {variantSelectOpen && (
                <ul
                  id="bom-product-variant-options"
                  role="listbox"
                  className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#D1D5DB] bg-white py-1 shadow-lg"
                >
                  {matchingVariants.length === 0 ? (
                    <li className="px-3 py-2 text-[13px] font-normal text-[#6B7280]">Varian tidak ditemukan.</li>
                  ) : matchingVariants.map((entry) => (
                    <li key={entry.variant.id} role="option" aria-selected={entry.variant.id === draft.productVariantId}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-[13px] font-normal text-[#1F2937] hover:bg-[#E6F6FD]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          patch((d) => {
                            d.productVariantId = entry.variant.id;
                            d.name = variantLabel(entry);
                            d.code = entry.variant.kodeVariant ?? "";
                          });
                          setVariantSearch("");
                          setVariantSelectOpen(false);
                        }}
                      >
                        {variantLabel(entry)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <label className="grid gap-1 text-[14px] font-medium text-[#1F2937]">Versi
              <input className={inputCls} value={draft.version} onChange={(e) => patch((d) => { d.version = e.target.value; })} placeholder="1.0" />
            </label>
            <label className="grid gap-1 text-[14px] font-medium text-[#1F2937]">Jumlah produksi
              <input type="number" min={1} className={inputCls} value={draft.qty} onChange={(e) => patch((d) => { d.qty = Math.max(1, parseInt(e.target.value) || 1); })} />
            </label>
          </div>

          <div className="grid grid-cols-2 divide-x divide-[#D1D5DB] rounded-xl border border-[#D1D5DB] bg-white sm:grid-cols-4">
            <div className="flex flex-col px-4 py-3"><span className="text-[12px] text-[#6B7280]">Biaya per unit</span><b className="text-[20px] font-semibold text-[#1E3A5F]">{rp(stats.per)}</b></div>
            <div className="flex flex-col px-4 py-3"><span className="text-[12px] text-[#6B7280]">Biaya untuk {draft.qty} unit</span><b className="text-[20px] font-semibold text-[#1E3A5F]">{rp(stats.total)}</b></div>
            <div className="flex flex-col px-4 py-3"><span className="text-[12px] text-[#6B7280]">Baris BOM</span><b className="text-[20px] font-semibold text-[#1E3A5F]">{stats.rows}</b></div>
            <div className="flex flex-col px-4 py-3"><span className="text-[12px] text-[#6B7280]">Jenis komponen</span><b className="text-[20px] font-semibold text-[#1E3A5F]">{stats.kinds}</b></div>
          </div>

          <div className="flex gap-6 border-b border-[#D1D5DB]">
            {(["tree", "flat"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-px border-b-2 px-1 py-2.5 text-[15px] transition-colors ${tab === t ? "border-[#00A8E8] font-medium text-[#1E3A5F]" : "border-transparent text-[#6B7280] hover:text-[#1F2937]"}`}>
                {t === "tree" ? "Struktur BOM" : "Daftar belanja"}
              </button>
            ))}
          </div>

          {tab === "tree" && (
            <>
              {draft.nodes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {depth > 1 && (
                    <>
                      <span className="mr-1 text-[13px] text-[#6B7280]">Tampilkan</span>
                      {Array.from({ length: depth }, (_, k) => k).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setMaxLevel(k)}
                          aria-pressed={maxLevel === k}
                          className={`rounded-full border px-3 py-1 text-[13px] ${maxLevel === k ? "border-[#1E3A5F] bg-[#1E3A5F] text-white" : "border-[#D1D5DB] text-[#6B7280] hover:bg-[#F5F7FA]"}`}
                        >
                          {k ? `Sampai L${k}` : "Semua level"}
                        </button>
                      ))}
                    </>
                  )}
                  <span className="ml-auto flex flex-wrap gap-x-3.5 gap-y-1">
                    {LEVEL_LABELS.slice(0, Math.min(depth + 1, 5)).map((label, lv) => (
                      <span key={lv} className="inline-flex items-center gap-1.5 text-[13px] text-[#6B7280]">
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: LEVEL_COLORS[lv], backgroundColor: `${LEVEL_COLORS[lv]}24` }}>L{lv}</span>
                        {label}
                      </span>
                    ))}
                  </span>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-[#D1D5DB] bg-white">
                <div className="overflow-x-auto">
                  <div className="min-w-[900px]">
                    <div className={`${ROW} border-b border-[#D1D5DB] bg-[#F5F7FA] py-2 text-[12px] font-semibold text-[#6B7280]`}>
                      <span /><span>Level</span><span>No</span><span>Komponen</span>
                      <span className="text-right">Jumlah</span><span>Satuan</span>
                      <span className="text-right">Harga satuan</span><span className="text-right">Subtotal</span><span />
                    </div>
                    <div
                      onDragOver={(e) => {
                        if (!drag) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = drag.kind === "node" ? "move" : "copy";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!drag) return;
                        place(drag, null, null);
                        setZone(null);
                        setDrag(null);
                      }}
                      className="min-h-[260px]"
                    >
                      {draft.nodes.length === 0 ? (
                        <p className="px-4 py-16 text-center text-[#6B7280]">BOM masih kosong. Seret komponen dari pustaka ke sini, atau tekan + pada komponen.</p>
                      ) : (
                        <>
                          <div className={`${ROW} border-b border-l-4 border-[#D1D5DB] bg-[#F5F7FA] py-2.5 font-bold`} style={{ borderLeftColor: LEVEL_COLORS[0] }}>
                            <span />
                            <span className="justify-self-start rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: LEVEL_COLORS[0], backgroundColor: `${LEVEL_COLORS[0]}24` }}>L0</span>
                            <span className="text-[12px] text-[#6B7280]">0</span>
                            <span className="px-1.5">{draft.name || "Produk tanpa nama"}</span>
                            <span className="text-right">1</span>
                            <span>unit</span>
                            <span />
                            <span className="pr-1.5 text-right">{rp(stats.per)}</span>
                            <span />
                          </div>
                          {draft.nodes.map((n, i) => renderRow(n, `${i + 1}`, 1))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[12px] text-[#6B7280]">Seret ⠿ untuk memindahkan. Lepas di tengah baris untuk menjadikannya sub-rakitan, atau di tepi atas/bawah untuk mengatur urutan. Klik nama, jumlah, atau harga untuk mengedit. Blueprint dari pustaka juga bisa diseret ke sini sebagai sub-rakitan.</p>
            </>
          )}

          {tab === "flat" && (
            <div className="overflow-hidden rounded-xl border border-[#D1D5DB] bg-white">
              {stats.flat.length === 0 ? (
                <p className="px-4 py-16 text-center text-[#6B7280]">Belum ada komponen untuk dibelanjakan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[14px]">
                    <thead className="bg-[#F5F7FA] text-[12px] font-semibold text-[#6B7280]">
                      <tr>
                        <th className="px-4 py-2.5">Komponen</th>
                        <th className="px-4 py-2.5 text-right">Jumlah total</th>
                        <th className="px-4 py-2.5">Satuan</th>
                        <th className="px-4 py-2.5 text-right">Harga satuan</th>
                        <th className="px-4 py-2.5 text-right">Perkiraan biaya</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDF0F4]">
                      {stats.flat.map((x) => (
                        <tr key={`${x.kode}|${x.unit}`} className="hover:bg-[#F5F7FA]">
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-[#1F2937]">{x.nama}</span>
                            {x.kode && <span className="ml-2 text-[11px] text-[#6B7280]">{x.kode}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">{x.qty.toLocaleString("id-ID", { maximumFractionDigits: 3 })}</td>
                          <td className="px-4 py-2.5 text-[#6B7280]">{x.unit}</td>
                          <td className="px-4 py-2.5 text-right font-mono">{rp(x.cost)}</td>
                          <td className="px-4 py-2.5 text-right font-mono">{rp(x.qty * x.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
