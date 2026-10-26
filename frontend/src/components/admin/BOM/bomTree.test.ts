import { describe, expect, it } from "vitest";
import { countRows, flatten, normalizeNodes, sumTree, unitCost, type BomNode, type FlatRow } from "./bomTree";

const node = (partial: Partial<BomNode>): BomNode => ({
  id: "n1",
  kode: "K",
  nama: "N",
  unit: "pcs",
  qty: 1,
  cost: 0,
  kids: [],
  ...partial,
});

describe("bomTree", () => {
  it("menghitung harga rakitan dari jumlah anak", () => {
    const rakitan = node({ qty: 2, kids: [node({ qty: 3, cost: 1000 })] });
    expect(unitCost(rakitan)).toBe(3000);
    expect(sumTree([rakitan])).toBe(6000);
  });

  it("menggabungkan kebutuhan material per kode dan satuan", () => {
    const acc = new Map<string, FlatRow>();
    const tree = [node({
      kode: "A",
      qty: 2,
      kids: [node({ kode: "B", unit: "pcs", qty: 3, cost: 100 })],
    })];
    flatten(tree, 10, acc);
    expect(acc.get("B|pcs")?.qty).toBe(60);
    expect(countRows(tree)).toBe(2);
  });

  it("memberi nilai aman pada data localStorage lama tanpa harga", () => {
    const [n] = normalizeNodes([{ id: "x", kode: "A", nama: "B", unit: "pcs", qty: 2, kids: [] }]);
    expect(n.cost).toBe(0);
    expect(n.kids).toEqual([]);
  });

  it("mempertahankan referensi item master saat draft dinormalisasi", () => {
    const [n] = normalizeNodes([{ id: "x", itemId: 42, kode: "A", nama: "B", kids: [] }]);
    expect(n.itemId).toBe(42);
  });
});
