import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardList, faTrash, faPlus, faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import type { ProductionOrderSummary, StatusProductionOrder } from "../../api/productionOrders";
import {
  updateOrder,
  addOrderItem,
  updateOrderItem,
  deleteOrderItem,
} from "../../api/productionOrders";
import { getVariantProduk, type VariantProdukRow } from "../../api/products";
import EditableCell from "./EditableCell";
import { STATUS_STYLE, fmt, fmtPct, groupItems, recomputeRingkasan } from "./utils";

interface Props {
  orderId: number;
  detail: ProductionOrderSummary;
  loading: boolean;
  onChanged: () => void;
}

const ORDER_STATUS: StatusProductionOrder[] = ["DRAFT", "AKTIF", "SELESAI", "BATAL"];

export default function MasterTab({ orderId, detail, loading, onChanged }: Props) {
  // Salinan lokal: update (>Enter) langsung tampil tanpa refetch + loading.
  const [local, setLocal] = useState(detail);
  useEffect(() => {
    setLocal(detail);
  }, [detail]);
  const groups = groupItems(local.items);
  const [variants, setVariants] = useState<VariantProdukRow[]>([]);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addVariant, setAddVariant] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addPriority, setAddPriority] = useState("0");
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  useEffect(() => {
    getVariantProduk().then(setVariants).catch(() => undefined);
  }, []);

  const usedIds = useMemo(() => new Set(local.items.map((i) => i.variantId)), [local]);

  const styleTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of local.ringkasan) {
      const style = r.item.split(" ")[0];
      map.set(style, (map.get(style) ?? 0) + r.total);
    }
    return [...map.entries()].map(([style, total]) => ({ style, total }));
  }, [local]);
  const options = useMemo(
    () => variants.filter((v) => !usedIds.has(v.id)),
    [variants, usedIds],
  );

  const refreshRingkasan = (items: typeof local.items, totalQty: number) =>
    recomputeRingkasan(
      items.map((i) => ({ qty: i.qty, priority: i.priority, label: `${i.variant.style.nama} ${i.variant.color.nama}` })),
      totalQty,
    );

  const saveItem = (itemId: number, field: "qty" | "priority") => async (raw: string) => {
    const updated = await updateOrderItem(orderId, itemId, { [field]: Number(raw) });
    setLocal((prev) => {
      const items = prev.items.map((i) =>
        i.id === itemId ? { ...i, qty: updated.qty, priority: updated.priority } : i,
      );
      const totalQty = items.reduce((n, i) => n + i.qty, 0);
      return { ...prev, items, totalQty, ringkasan: refreshRingkasan(items, totalQty) };
    });
    onChanged();
  };

  const saveHeader = (field: "nomor" | "periode" | "label") => async (raw: string) => {
    if (!raw && field !== "label") throw new Error("Tidak boleh kosong");
    await updateOrder(orderId, { [field]: raw || null });
    setLocal((prev) => ({ ...prev, [field]: raw }));
    onChanged();
  };

  const saveStatus = async (status: StatusProductionOrder) => {
    try {
      await updateOrder(orderId, { status });
      setLocal((prev) => ({ ...prev, status }));
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal update status");
    }
  };

  const remove = async (itemId: number) => {
    try {
      const gone = local.items.find((i) => i.id === itemId);
      await deleteOrderItem(orderId, itemId);
      setConfirmId(null);
      setLocal((prev) => {
        const items = prev.items.filter((i) => i.id !== itemId);
        const totalQty = prev.totalQty - (gone?.qty ?? 0);
        return { ...prev, items, totalQty, ringkasan: refreshRingkasan(items, totalQty) };
      });
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal menghapus");
    }
  };

  const submitAdd = async () => {
    const variantId = Number(addVariant);
    const qty = Number(addQty);
    const priority = Number(addPriority || "0");
    if (!variantId) {
      setAddError("Pilih variant dulu");
      return;
    }
    if (!Number.isInteger(qty) || qty < 0) {
      setAddError("Qty harus angka ≥ 0");
      return;
    }
    if (!Number.isInteger(priority) || priority < 0) {
      setAddError("Priority harus angka ≥ 0");
      return;
    }
    setAddBusy(true);
    try {
      const created = await addOrderItem(orderId, { variantId, qty, priority });
      setAddOpen(false);
      setAddVariant("");
      setAddQty("");
      setAddPriority("0");
      setAddError(null);
      setLocal((prev) => {
        const items = [...prev.items, created];
        const totalQty = prev.totalQty + created.qty;
        return { ...prev, items, totalQty, ringkasan: refreshRingkasan(items, totalQty) };
      });
      onChanged();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Gagal menambah");
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <main className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#1E3A5F] text-white">
            <FontAwesomeIcon icon={faClipboardList} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 text-xl font-bold text-[#1E3A5F]">
            <EditableCell value={local.nomor} onSave={saveHeader("nomor")} />
            <span className="text-base font-medium text-[#6B7280]">
              · <EditableCell value={local.periode} onSave={saveHeader("periode")} />
            </span>
          </div>
          <select
            value={local.status}
            onChange={(e) => void saveStatus(e.target.value as StatusProductionOrder)}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLE[local.status]}`}
          >
            {ORDER_STATUS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <p className="mt-1 truncate text-sm text-[#6B7280]">
          <EditableCell value={local.label ?? ""} onSave={saveHeader("label")} />
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] xl:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <h3 className="font-semibold text-[#1E3A5F]">Data Master Produksi</h3>
            <button
              type="button"
              onClick={() => {
                setAddOpen((v) => !v);
                setAddError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#00A8E8] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#0088C0]"
            >
              <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" /> Tambah
            </button>
          </div>
          {loading ? (
            <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat rincian...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                    <th className="w-10 px-4 py-3 font-semibold">No</th>
                    <th className="px-4 py-3 font-semibold">Item</th>
                    <th className="px-4 py-3 font-semibold">Size</th>
                    <th className="px-4 py-3 text-right font-semibold">Stok</th>
                    <th className="px-4 py-3 text-right font-semibold">Total per Item</th>
                    <th className="px-4 py-3 text-right font-semibold">Priority</th>
                    <th className="w-16 px-4 py-3" aria-label="Aksi" />
                  </tr>
                </thead>
                <tbody>
                  {groups.flatMap((g, gi) =>
                    g.rows.map((it, ri) => {
                      const no =
                        groups.slice(0, gi).reduce((n, x) => n + x.rows.length, 0) + ri + 1;
                      return (
                        <tr key={it.id} className="border-b border-slate-50 last:border-0 hover:bg-[#F5F7FA]">
                          <td className="px-4 py-2.5 tabular-nums text-[#6B7280]">{no}</td>
                          {ri === 0 && (
                            <td rowSpan={g.rows.length} className="border-l border-slate-100 px-4 py-2.5 align-top font-medium text-[#1F2937]">
                              {g.item}
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-[#1F2937]">{it.variant.size.nama}</td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-[#1F2937]">
                            <EditableCell value={it.qty} numeric align="right" onSave={saveItem(it.id, "qty")} />
                          </td>
                          {ri === 0 && (
                            <td rowSpan={g.rows.length} className="border-l border-slate-100 px-4 py-2.5 text-right align-top font-bold tabular-nums text-[#1E3A5F]">
                              {fmt(g.total)}
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-right tabular-nums text-[#6B7280]">
                            <EditableCell value={it.priority} numeric align="right" onSave={saveItem(it.id, "priority")} />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {confirmId === it.id ? (
                              <span className="inline-flex gap-1">
                                <button
                                  type="button"
                                  title="Ya, hapus"
                                  onClick={() => void remove(it.id)}
                                  className="grid h-7 w-7 place-items-center rounded-lg bg-[#EF4444] text-white hover:bg-red-600"
                                >
                                  <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Batal"
                                  onClick={() => setConfirmId(null)}
                                  className="grid h-7 w-7 place-items-center rounded-lg bg-slate-200 text-[#1F2937] hover:bg-slate-300"
                                >
                                  <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                title="Hapus baris"
                                onClick={() => setConfirmId(it.id)}
                                className="grid h-7 w-7 place-items-center rounded-lg text-[#6B7280] hover:bg-red-50 hover:text-[#EF4444]"
                              >
                                <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    }),
                  )}
                  {addOpen && (
                    <tr className="bg-[#00A8E8]/5">
                      <td className="px-4 py-2.5 text-[#6B7280]">+</td>
                      <td colSpan={2} className="px-4 py-2.5">
                        <select
                          value={addVariant}
                          onChange={(e) => setAddVariant(e.target.value)}
                          className="w-full rounded-lg border border-[#D1D5DB] bg-white px-2 py-1.5 text-sm"
                        >
                          <option value="">— Pilih variant —</option>
                          {options.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.namaStyle} {v.namaColor} {v.namaSize} ({v.kodeVariant})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          value={addQty}
                          inputMode="numeric"
                          placeholder="Qty"
                          onChange={(e) => setAddQty(e.target.value)}
                          className="w-full rounded-lg border border-[#D1D5DB] px-2 py-1.5 text-right text-sm"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6B7280]">otomatis</td>
                      <td className="px-4 py-2.5">
                        <input
                          value={addPriority}
                          inputMode="numeric"
                          onChange={(e) => setAddPriority(e.target.value)}
                          className="w-full rounded-lg border border-[#D1D5DB] px-2 py-1.5 text-right text-sm"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={addBusy}
                          onClick={() => void submitAdd()}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-[#10B981] text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                          <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {addError && <p role="alert" className="px-4 py-2 text-sm text-[#EF4444]">{addError}</p>}
            </div>
          )}
        </section>

        <section className="h-fit overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] xl:col-span-2">
          <h3 className="border-b border-slate-100 p-4 font-semibold text-[#1E3A5F]">
            Ringkasan
          </h3>
          {loading ? (
            <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat ringkasan...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Stok</th>
                  <th className="px-4 py-3 text-right font-semibold">Persentase</th>
                </tr>
              </thead>
              <tbody>
                {local.ringkasan.map((r) => (
                  <tr key={r.item} className="border-b border-slate-50 hover:bg-[#F5F7FA]">
                    <td className="px-4 py-2.5 font-medium text-[#1F2937]">{r.item}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-[#1F2937]">
                      {fmt(r.total)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#6B7280]">
                      {fmtPct(r.persentase)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#1E3A5F]/15 bg-[#1E3A5F]/5 font-bold">
                  <td className="px-4 py-2.5 text-[#1E3A5F]">TOTAL</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#1E3A5F]">
                    {fmt(local.totalQty)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#1E3A5F]">100,00%</td>
                </tr>
              </tfoot>
            </table>
          )}
          {!loading && styleTotals.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-[#F5F7FA] px-4 py-3">
              {styleTotals.map((s) => (
                <span key={s.style} className="inline-flex items-baseline gap-1.5 rounded-full bg-white px-3 py-1 text-sm ring-1 ring-slate-200/70">
                  <span className="font-medium text-[#6B7280]">{s.style} :</span>
                  <span className="font-bold tabular-nums text-[#1E3A5F]">{fmt(s.total)}</span>
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
