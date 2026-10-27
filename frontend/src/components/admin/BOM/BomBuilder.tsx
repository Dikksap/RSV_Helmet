import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowsRotate, faChevronDown, faCopy, faFolderOpen, faGripVertical, faMagnifyingGlass, faPlus, faRotateLeft, faSave, faTrash } from "@fortawesome/free-solid-svg-icons";
import { getItems, type Item } from "../../../api/item";
import { createBom, deleteBom, getBoms, updateBom, type Bom, type BomItemInput } from "../../../api/bom";
import { createSubassembly, getSubassemblies } from "../../../api/subassembly";
import { getProducts, type ProductVariant } from "../../../api/products";
import { cloneNodes, countRows, depthOf, findNode, flatten, nid, normalizeNodes, replaceNodeItem, rp, sumTree, unitCost, type BomNode, type FlatRow } from "./bomTree";

const inputCls = "h-10 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-[14px] text-[#1F2937] outline-none transition placeholder:text-[#6B7280]/60 focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20";
const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-[#0088C0] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
const secondaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1F2937] hover:bg-[#F5F7FA]";
const ghostBtn = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-medium text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]";

const ROW = "grid grid-cols-[18px_46px_52px_minmax(0,1fr)_72px_64px_112px_120px_28px] items-center gap-1.5 px-2";
const LEVEL_COLORS = ["#0F1C2E", "#006E99", "#4452c4", "#96590a", "#a23b72"];
const LEVEL_LABELS = ["Produk jadi", "Komponen langsung", "Isi rakitan L1", "Isi rakitan L2", "Level lebih dalam"];
const CELL_INPUT = "w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-[#1F2937] outline-none hover:border-[#D1D5DB] focus:border-[#00A8E8] focus:bg-white";

interface Blueprint {
  id: string;
  name: string;
  code: string;
  nodes: BomNode[];
  bomId?: number;
}

interface SavedBlueprint extends Blueprint {
  version: string;
  isActive: boolean;
  output: string;
}

interface Draft {
  name: string;
  code: string;
  version: string;
  productVariantId: number | null;
  qty: number;
  nodes: BomNode[];
  blueprints: Blueprint[];
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

function nodesFromBom(bom: Bom, boms: Bom[], ancestors = new Set<number>()): BomNode[] {
  if (ancestors.has(bom.id)) return [];
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(bom.id);

  return nodesFromBomItems(bom.items, bom, boms, nextAncestors);
}

function nodesFromBomItems(items: Bom["items"], bom: Bom, boms: Bom[], ancestors: Set<number>): BomNode[] {
  return items.map((entry) => {
    const children = entry.children ?? [];
    const nestedBom = children.length || entry.subassemblyId == null
      ? undefined
      : boms.find((candidate) => candidate.subassemblyId === entry.subassemblyId && candidate.version === bom.version)
        ?? boms.find((candidate) => candidate.subassemblyId === entry.subassemblyId);
    const quantity = Number(entry.quantity);

    return {
      id: nid(),
      ...(entry.item ? { itemId: entry.item.id } : {}),
      kode: entry.item?.kode ?? entry.subassembly?.kode ?? "",
      nama: entry.item?.nama ?? entry.subassembly?.nama ?? "Komponen tidak dikenal",
      unit: entry.unit ?? entry.item?.unit ?? "pcs",
      qty: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      cost: 0,
      kids: children.length
        ? nodesFromBomItems(children, bom, boms, ancestors)
        : nestedBom ? nodesFromBom(nestedBom, boms, ancestors) : [],
    };
  });
}

function blueprintFromBom(bom: Bom, boms: Bom[]): SavedBlueprint {
  const output = bom.productVariant
    ? [bom.productVariant.product?.nama, bom.productVariant.kodeVariant].filter(Boolean).join(" · ")
    : bom.subassembly
      ? `${bom.subassembly.kode} · ${bom.subassembly.nama}`
      : "Output tidak diketahui";

  return {
    id: `db-${bom.id}`,
    bomId: bom.id,
    name: bom.nama,
    code: bom.kode ?? bom.productVariant?.kodeVariant ?? bom.subassembly?.kode ?? "",
    nodes: nodesFromBom(bom, boms),
    version: bom.version,
    isActive: bom.isActive,
    output,
  };
}

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
type VariantEntry = { variant: ProductVariant; productName: string; prefix: string };
type BlueprintEntry = Blueprint & { origin: "database" | "local"; detail?: string; isActive?: boolean };

const variantLabel = (entry: VariantEntry) =>
  [entry.productName, entry.variant.style.nama, entry.variant.color.nama, entry.variant.size.nama].filter(Boolean).join(" ");

export function BomBuilder() {
  const [draft, setDraft] = useState<Draft>(() => loadDraft());
  const [savedBoms, setSavedBoms] = useState<Bom[]>([]);
  const [loadingSavedBoms, setLoadingSavedBoms] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [variants, setVariants] = useState<VariantEntry[]>([]);
  const [variantSearch, setVariantSearch] = useState("");
  const [variantSelectOpen, setVariantSelectOpen] = useState(false);
  const [q, setQ] = useState("");
  const [replacingNodeId, setReplacingNodeId] = useState<string | null>(null);
  const [replacementSearch, setReplacementSearch] = useState("");
  const [tab, setTab] = useState<"tree" | "flat">("tree");
  const [maxLevel, setMaxLevel] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [zone, setZone] = useState<{ id: string; z: DropZone } | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [blueprintOpen, setBlueprintOpen] = useState(true);
  const [blueprintModalOpen, setBlueprintModalOpen] = useState(false);
  const [selectedBlueprintIds, setSelectedBlueprintIds] = useState<string[]>([]);
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

  const refreshSavedBoms = useCallback(async () => {
    setSavedBoms(await getBoms());
  }, []);

  useEffect(() => {
    void getBoms()
      .then(setSavedBoms)
      .catch((error: unknown) => {
        flash(error instanceof Error ? `Gagal memuat blueprint database: ${error.message}` : "Gagal memuat blueprint database");
      })
      .finally(() => setLoadingSavedBoms(false));
  }, [flash, refreshSavedBoms]);

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

  const replaceComponent = (nodeId: string, item: Item) => {
    patch((d) => {
      const found = findNode(d.nodes, nodeId);
      if (found) Object.assign(found.node, replaceNodeItem(found.node, item));
    });
    setReplacingNodeId(null);
    setReplacementSearch("");
    flash(`Komponen diganti menjadi ${item.nama}; anak komponennya tetap`);
  };

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

  const selectedVariant = variants.find(({ variant }) => variant.id === draft.productVariantId);
  const replacingNode = replacingNodeId ? findNode(draft.nodes, replacingNodeId)?.node : undefined;
  const matchingReplacementItems = useMemo(() => {
    const term = replacementSearch.trim().toLocaleLowerCase();
    return items
      .filter((item) => !term || `${item.kode} ${item.nama}`.toLocaleLowerCase().includes(term))
      .slice(0, 100);
  }, [items, replacementSearch]);
  const matchingVariants = useMemo(() => {
    const term = variantSearch.trim().toLocaleLowerCase();
    return variants
      .filter((entry) => variantLabel(entry).toLocaleLowerCase().includes(term))
      .sort((a, b) => variantLabel(a).localeCompare(variantLabel(b), "id", { sensitivity: "base" }));
  }, [variants, variantSearch]);

  const depth = useMemo(() => depthOf(draft.nodes), [draft.nodes]);

  const stats = useMemo(() => {
    const acc = new Map<string, FlatRow>();
    flatten(draft.nodes, draft.qty, acc);
    const per = sumTree(draft.nodes);
    return { per, total: per * draft.qty, rows: countRows(draft.nodes), kinds: acc.size, flat: Array.from(acc.values()) };
  }, [draft.nodes, draft.qty]);

  const savedBlueprints = useMemo(
    () => savedBoms.map((bom) => blueprintFromBom(bom, savedBoms)),
    [savedBoms],
  );
  const allBlueprints: BlueprintEntry[] = [
    ...savedBlueprints.map((blueprint) => ({
      ...blueprint,
      origin: "database" as const,
      detail: `Versi ${blueprint.version} · ${blueprint.output}`,
    })),
    ...draft.blueprints.map((blueprint) => ({ ...blueprint, origin: "local" as const })),
  ];

  const place = (source: DragPayload, targetId: string | null, dropZone: DropZone | null) => {
    patch((d) => {
      const nodes = (() => {
        if (source.kind === "item") {
          const item = items.find((candidate) => String(candidate.id) === source.id);
          return item ? [nodeFromItem(item)] : [];
        }
        if (source.kind === "bp") {
          const blueprint = allBlueprints.find((candidate) => candidate.id === source.id);
          return blueprint ? cloneNodes(blueprint.nodes) : [];
        }
        const found = findNode(d.nodes, source.id);
        if (!found) return [];
        if (targetId && (targetId === source.id || findNode(found.node.kids, targetId))) return [];
        found.list.splice(found.index, 1);
        return [found.node];
      })();

      if (!nodes.length) return;
      if (!targetId) {
        d.nodes.push(...nodes);
        return;
      }
      const target = findNode(d.nodes, targetId);
      if (!target) {
        d.nodes.push(...nodes);
        return;
      }
      if (dropZone === "in") target.node.kids.push(...nodes);
      else target.list.splice(target.index + (dropZone === "after" ? 1 : 0), 0, ...nodes);
    });
  };

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

      const buildItems = async (nodes: BomNode[]): Promise<BomItemInput[]> => {
        const items: BomItemInput[] = [];
        for (const [index, node] of nodes.entries()) {
          const children = await buildItems(node.kids);
          if (children.length > 0) {
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
            items.push({
              urutan: index + 1,
              subassemblyId: subassembly.id,
              quantity: node.qty,
              unit: node.unit || null,
              children,
            });
          } else {
            items.push({
              urutan: index + 1,
              itemId: node.itemId,
              quantity: node.qty,
              unit: node.unit || null,
            });
          }
        }
        return items;
      };

      const bomItems = await buildItems(draft.nodes);
      const matchingBom = boms.find((bom) =>
        bom.version === draft.version.trim()
        && bom.productVariantId === selectedVariant.variant.id,
      );
      const body = {
        nama: variantLabel(selectedVariant),
        version: draft.version.trim(),
        isActive: true,
        productVariantId: selectedVariant.variant.id,
        items: bomItems,
      };
      if (matchingBom) {
        await updateBom(matchingBom.id, body);
      } else {
        await createBom({
          ...body,
          ...(selectedVariant.variant.kodeVariant?.trim() ? { kode: selectedVariant.variant.kodeVariant.trim() } : {}),
        });
      }
      flash("BOM berhasil disimpan atau diperbarui di database");
      try {
        await refreshSavedBoms();
      } catch (error) {
        flash(`BOM tersimpan, tetapi daftar blueprint gagal diperbarui: ${error instanceof Error ? error.message : "Terjadi kesalahan"}`);
      }
    } catch (error) {
      flash(`Gagal menyimpan BOM: ${error instanceof Error ? error.message : "Terjadi kesalahan"}. Jika sebagian subassembly sudah dibuat, periksa kembali sebelum mencoba lagi.`);
    } finally {
      setSaving(false);
    }
  };

  const loadBlueprint = (bp: Blueprint) => {
    const go = () => patch((d) => {
      d.nodes = cloneNodes(bp.nodes);
      d.name = bp.name;
      d.code = bp.code ? `${bp.code}-salinan` : "";
    });
    if (draft.nodes.length) arm(`load:${bp.id}`, go);
    else go();
  };

  const insertBlueprint = (bp: Blueprint) => patch((d) => {
    d.nodes.push(...cloneNodes(bp.nodes));
  });

  const delBlueprint = (id: string) => patch((d) => { d.blueprints = d.blueprints.filter((b) => b.id !== id); });

  const delSavedBom = async (id: number) => {
    try {
      await deleteBom(id);
      setSavedBoms((prev) => prev.filter((bom) => bom.id !== id));
      flash("BOM dihapus dari database");
    } catch (error) {
      flash(`Gagal menghapus BOM: ${error instanceof Error ? error.message : "Terjadi kesalahan"}`);
    }
  };

  const closeBlueprintModal = () => {
    setBlueprintModalOpen(false);
    setSelectedBlueprintIds([]);
  };

  const selectedBlueprints = allBlueprints.filter((b) => selectedBlueprintIds.includes(b.id));

  const toggleBlueprint = (id: string) => setSelectedBlueprintIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
  );

  const insertSelectedBlueprints = () => {
    patch((d) => {
      selectedBlueprints.forEach((bp) => {
        d.nodes.push(...cloneNodes(bp.nodes));
      });
    });
    flash(`Isi ${selectedBlueprints.length} blueprint disisipkan tanpa baris output`);
  };

  const deleteSelectedBlueprints = async () => {
    const localIds = selectedBlueprints.filter((b) => b.origin === "local").map((b) => b.id);
    if (localIds.length) patch((d) => { d.blueprints = d.blueprints.filter((b) => !localIds.includes(b.id)); });

    const dbIds = selectedBlueprints.flatMap((b) => (b.origin === "database" && b.bomId ? [b.bomId] : []));
    const results = await Promise.allSettled(dbIds.map((id) => deleteBom(id)));
    const deletedIds = dbIds.filter((_, i) => results[i].status === "fulfilled");
    if (deletedIds.length) setSavedBoms((prev) => prev.filter((bom) => !deletedIds.includes(bom.id)));

    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedBlueprintIds([]);
    flash(failed
      ? `${deletedIds.length + localIds.length} blueprint dihapus, ${failed} gagal dihapus dari database`
      : `${deletedIds.length + localIds.length} blueprint dihapus`);
  };

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
            <div className="flex min-w-0 items-center gap-1">
              <input
                className={CELL_INPUT}
                value={n.nama}
                onChange={(e) => updateNode(n.id, { nama: e.target.value })}
                aria-label="Nama komponen"
              />
              <button
                type="button"
                onClick={() => {
                  setReplacementSearch("");
                  setReplacingNodeId(n.id);
                }}
                className="shrink-0 rounded px-1.5 py-1 text-[11px] text-[#006E99] hover:bg-[#E6F6FD]"
                title="Ganti komponen, pertahankan anak"
                aria-label={`Ganti komponen ${n.nama}`}
              >
                <FontAwesomeIcon icon={faArrowsRotate} />
              </button>
            </div>
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

  const renderBlueprintItem = (b: BlueprintEntry, selectable = false) => (
    <li
      key={b.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", b.id);
        setDrag({ kind: "bp", id: b.id });
      }}
      onDragEnd={() => { setDrag(null); setZone(null); }}
      title={b.detail ? `${b.name} · ${b.detail}` : b.name}
      className="mb-1 flex cursor-grab items-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-1.5 py-1 text-[13px] transition hover:border-[#00A8E8] hover:bg-[#E6F6FD]"
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selectedBlueprintIds.includes(b.id)}
          onChange={() => toggleBlueprint(b.id)}
          aria-label={`Pilih ${b.name}`}
          className="h-3.5 w-3.5 shrink-0 accent-[#00A8E8]"
        />
      )}
      <span className="shrink-0 text-[#9AA7B6]" aria-hidden="true"><FontAwesomeIcon icon={faGripVertical} className="h-3 w-3" /></span>
      <div className="min-w-0 flex-1">
        <div className="break-words font-medium text-[#1F2937]">{b.name}</div>
        <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
          <span className={`shrink-0 rounded px-1 text-[9px] ${b.origin === "database" ? "bg-[#E6F6FD] text-[#006E99]" : "bg-[#F5F7FA] text-[#6B7280]"}`}>
            {b.origin === "database" ? "DB" : "lokal"}
          </span>
          {b.origin === "database" && !b.isActive && (
            <span className="shrink-0 rounded bg-[#FEF2F2] px-1 text-[9px] text-[#B91C1C]">nonaktif</span>
          )}
          <span className="truncate">{b.code || "-"} · {countRows(b.nodes)} baris · {rp(sumTree(b.nodes))}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => loadBlueprint(b)}
          title="Ganti BOM saat ini dengan blueprint ini"
          aria-label={`Muat ${b.name}`}
          className={`rounded px-1 py-0.5 text-[11px] ${armed === `load:${b.id}` ? "bg-[#FEF3C7] font-semibold text-[#92400E]" : "text-[#6B7280] hover:text-[#006E99]"}`}
        >
          {armed === `load:${b.id}` ? "Yakin?" : <FontAwesomeIcon icon={faFolderOpen} className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={() => insertBlueprint(b)}
          title="Sisipkan isi blueprint tanpa baris output"
          aria-label={`Sisipkan ${b.name}`}
          className="rounded px-1 py-0.5 text-[11px] text-[#6B7280] hover:text-[#006E99]"
        >
          <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => arm(`del:${b.id}`, () => {
            if (b.origin === "database" && b.bomId) void delSavedBom(b.bomId);
            else delBlueprint(b.id);
          })}
          title={armed === `del:${b.id}` ? "Klik lagi untuk menghapus" : b.origin === "database" ? "Hapus BOM dari database" : "Hapus blueprint lokal"}
          aria-label={`Hapus ${b.name}`}
          className={`rounded px-1 py-0.5 text-[11px] ${armed === `del:${b.id}` ? "bg-[#EF4444]/10 font-semibold text-[#DC2626]" : "text-[#6B7280] hover:text-[#EF4444]"}`}
        >
          {armed === `del:${b.id}` ? "Yakin?" : <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />}
        </button>
      </div>
    </li>
  );

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
          <section className="rounded-xl border border-[#EDF0F4] bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Blueprint BOM <span className="font-normal normal-case text-[#9AA7B6]">({allBlueprints.length})</span>
              </h3>
              <div className="flex items-center gap-1">
                {allBlueprints.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBlueprintModalOpen(true)}
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium text-[#006E99] hover:bg-[#E6F6FD]"
                  >
                    Lihat semua
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBlueprintOpen((open) => !open)}
                  aria-expanded={blueprintOpen}
                  title={blueprintOpen ? "Ringkas daftar blueprint" : "Buka daftar blueprint"}
                  className="rounded px-1 py-0.5 text-[#6B7280] hover:text-[#1F2937]"
                >
                  <FontAwesomeIcon icon={faChevronDown} className={`h-3 w-3 transition-transform ${blueprintOpen ? "" : "-rotate-90"}`} />
                </button>
              </div>
            </div>
            {blueprintOpen && (
              <div className="mt-2">
                {loadingSavedBoms && <p className="mb-2 text-[12px] text-[#6B7280]">Memuat BOM dari database...</p>}
                {allBlueprints.length === 0 ? (
                  <p className="text-[13px] text-[#6B7280]">Belum ada blueprint. Simpan BOM saat ini sebagai blueprint.</p>
                ) : (
                  <ul className="max-h-[260px] overflow-y-auto pr-1">
                    {allBlueprints.map((blueprint) => renderBlueprintItem(blueprint))}
                  </ul>
                )}
              </div>
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

              <p className="text-[12px] text-[#6B7280]">Seret ⠿ untuk memindahkan. Gunakan ikon putar pada komponen untuk menggantinya tanpa mengubah anak. Lepas di tengah baris untuk menambahkan anak, atau di tepi atas/bawah untuk mengatur urutan.</p>
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

      {blueprintModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeBlueprintModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="blueprint-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-[#EDF0F4] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#EDF0F4] px-5 py-3">
              <h2 id="blueprint-modal-title" className="text-[16px] font-semibold text-[#1E3A5F]">
                Semua Blueprint BOM <span className="font-normal text-[#6B7280]">({allBlueprints.length})</span>
              </h2>
              <button
                type="button"
                onClick={closeBlueprintModal}
                aria-label="Tutup daftar blueprint"
                className="rounded px-2 py-1 text-[18px] leading-none text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]"
              >
                ×
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-[#EDF0F4] bg-[#F9FAFB] px-5 py-2">
              <label className="flex items-center gap-1.5 text-[12px] text-[#1F2937]">
                <input
                  type="checkbox"
                  checked={allBlueprints.length > 0 && selectedBlueprintIds.length === allBlueprints.length}
                  onChange={(e) => setSelectedBlueprintIds(e.target.checked ? allBlueprints.map((b) => b.id) : [])}
                  className="h-3.5 w-3.5 accent-[#00A8E8]"
                />
                Pilih semua
              </label>
              <span className="text-[12px] text-[#6B7280]">{selectedBlueprintIds.length} dipilih</span>
              <div className="ml-auto flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={insertSelectedBlueprints}
                  disabled={selectedBlueprintIds.length === 0}
                  className="rounded border border-[#D1D5DB] bg-white px-2 py-1 text-[12px] font-medium text-[#1F2937] hover:bg-[#E6F6FD] disabled:pointer-events-none disabled:opacity-40"
                >
                  Sisipkan terpilih
                </button>
                <button
                  type="button"
                  onClick={() => arm("del-selected", () => void deleteSelectedBlueprints())}
                  disabled={selectedBlueprintIds.length === 0}
                  className={`rounded border px-2 py-1 text-[12px] font-medium disabled:pointer-events-none disabled:opacity-40 ${armed === "del-selected" ? "border-[#EF4444] bg-[#EF4444] text-white" : "border-[#D1D5DB] bg-white text-[#B91C1C] hover:bg-[#FEF2F2]"}`}
                >
                  {armed === "del-selected" ? "Yakin? Klik lagi" : "Hapus terpilih"}
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-4">
              {allBlueprints.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-[#6B7280]">Belum ada blueprint. Simpan BOM saat ini sebagai blueprint.</p>
              ) : (
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {allBlueprints.map((b) => renderBlueprintItem(b, true))}
                </ul>
              )}
            </div>
            <p className="border-t border-[#EDF0F4] px-5 py-2 text-[11px] text-[#6B7280]">
              Seret atau sisipkan kartu untuk memasukkan isi blueprint tanpa menambahkan baris output blueprint.
            </p>
          </div>
        </div>
      )}
      {replacingNode && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0F1C2E]/50 p-4 backdrop-blur-sm"
          onClick={() => setReplacingNodeId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="replace-component-title"
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-2xl"
          >
            <div className="border-b border-[#EDF0F4] px-5 py-4">
              <h2 id="replace-component-title" className="text-lg font-semibold text-[#1E3A5F]">Ganti komponen</h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                Pilih pengganti untuk <strong>{replacingNode.nama}</strong>. Anak komponen, jumlah, dan posisi tetap dipertahankan.
              </p>
              <label className="relative mt-3 block">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="search"
                  autoFocus
                  className={`${inputCls} pl-9`}
                  value={replacementSearch}
                  onChange={(event) => setReplacementSearch(event.target.value)}
                  placeholder="Cari kode atau nama komponen"
                  aria-label="Cari komponen pengganti"
                />
              </label>
            </div>
            <div className="overflow-y-auto p-3">
              {matchingReplacementItems.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-[#6B7280]">Komponen tidak ditemukan.</p>
              ) : (
                <ul className="space-y-1">
                  {matchingReplacementItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => replaceComponent(replacingNode.id, item)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-[#E6F6FD]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-[#1F2937]">{item.nama}</span>
                          <span className="block truncate text-xs text-[#6B7280]">{item.kode} · {item.unit || "pcs"}</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-[#006E99]">Pilih</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end border-t border-[#EDF0F4] px-5 py-3">
              <button type="button" onClick={() => setReplacingNodeId(null)} className={secondaryBtn}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
