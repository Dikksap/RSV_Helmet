export interface BomNode {
  id: string;
  itemId?: number;
  kode: string;
  nama: string;
  unit: string;
  qty: number;
  cost: number;
  kids: BomNode[];
}

export interface FlatRow {
  kode: string;
  nama: string;
  unit: string;
  cost: number;
  qty: number;
}

export const nid = () => `n${Math.random().toString(36).slice(2, 9)}`;

export const rp = (n: number) => `Rp\u00a0${Math.round(n).toLocaleString("id-ID")}`;

/** Harga satu unit rakitan: jumlah anak x harga anak, atau harga material itu sendiri. */
export function unitCost(n: BomNode): number {
  return n.kids.length ? n.kids.reduce((s, k) => s + k.qty * unitCost(k), 0) : n.cost;
}

export function sumTree(nodes: BomNode[]): number {
  return nodes.reduce((s, n) => s + n.qty * unitCost(n), 0);
}

export function countRows(nodes: BomNode[]): number {
  return nodes.reduce((s, n) => s + 1 + countRows(n.kids), 0);
}

export function depthOf(nodes: BomNode[]): number {
  return nodes.reduce((m, n) => Math.max(m, 1 + depthOf(n.kids)), 0);
}

export function flatten(nodes: BomNode[], mult: number, acc: Map<string, FlatRow>): void {
  nodes.forEach((n) => {
    const qty = mult * n.qty;
    if (n.kids.length) {
      flatten(n.kids, qty, acc);
      return;
    }
    const key = `${n.kode}|${n.unit}`;
    const row = acc.get(key);
    if (row) row.qty += qty;
    else acc.set(key, { kode: n.kode, nama: n.nama, unit: n.unit, cost: n.cost, qty });
  });
}

export function cloneNodes(nodes: BomNode[]): BomNode[] {
  return nodes.map((n) => ({ ...n, id: nid(), kids: cloneNodes(n.kids) }));
}

export function findNode(root: BomNode[], id: string): { list: BomNode[]; index: number; node: BomNode } | null {
  for (let i = 0; i < root.length; i++) {
    if (root[i].id === id) return { list: root, index: i, node: root[i] };
    const r = findNode(root[i].kids, id);
    if (r) return r;
  }
  return null;
}

export function normalizeNodes(value: unknown): BomNode[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const o = raw as Partial<BomNode>;
    return [{
      id: typeof o.id === "string" && o.id ? o.id : nid(),
      itemId: Number.isInteger(o.itemId) && Number(o.itemId) > 0 ? Number(o.itemId) : undefined,
      kode: typeof o.kode === "string" ? o.kode : "",
      nama: typeof o.nama === "string" ? o.nama : "",
      unit: typeof o.unit === "string" && o.unit ? o.unit : "pcs",
      qty: typeof o.qty === "number" && Number.isFinite(o.qty) && o.qty >= 0 ? o.qty : 1,
      cost: typeof o.cost === "number" && Number.isFinite(o.cost) && o.cost >= 0 ? o.cost : 0,
      kids: normalizeNodes(o.kids),
    }];
  });
}
