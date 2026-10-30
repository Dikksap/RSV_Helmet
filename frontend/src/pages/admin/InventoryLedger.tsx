import { useCallback, useEffect, useState } from "react";
import { getDivisi, type Divisi } from "../../api/divisi";
import { getGudangList, type Gudang } from "../../api/gudang";
import { getItems, type Item } from "../../api/item";
import {
  listErpBalances,
  listErpLocations,
  listErpMovements,
  listErpStockAdjustments,
  listUnmappedLegacyItems,
  mapErpDivision,
  mapErpWarehouse,
  postErpMovement,
  requestErpStockAdjustment,
  reviewErpStockAdjustment,
  setErpItemDefaultLocation,
  type ErpBalance,
  type ErpLocation,
  type ErpMovement,
  type ErpStockAdjustment,
  type ErpUnmappedLegacyItem,
} from "../../api/erp";
import { getUserPermissions } from "../../api/auth";

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const buttonClass = "rounded-lg bg-[#00A8E8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

export default function InventoryLedger() {
  const permissions = getUserPermissions();
  const canMap = permissions.includes("INVENTORY_LOCATION_MANAGE");
  const canMove = permissions.includes("INVENTORY_MOVE");
  const canAdjust = permissions.includes("INVENTORY_ADJUST");
  const canApproveAdjustments = permissions.includes("INVENTORY_ADJUST_APPROVE");
  const [locations, setLocations] = useState<ErpLocation[]>([]);
  const [balances, setBalances] = useState<ErpBalance[]>([]);
  const [movements, setMovements] = useState<ErpMovement[]>([]);
  const [adjustments, setAdjustments] = useState<ErpStockAdjustment[]>([]);
  const [unmappedItems, setUnmappedItems] = useState<ErpUnmappedLegacyItem[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Gudang[]>([]);
  const [divisions, setDivisions] = useState<Divisi[]>([]);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [itemLocationIds, setItemLocationIds] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [adjustmentItemId, setAdjustmentItemId] = useState("");
  const [adjustmentLocationId, setAdjustmentLocationId] = useState("");
  const [physicalQuantity, setPhysicalQuantity] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [nextLocations, nextBalances, nextMovements, nextItems, nextUnmappedItems, nextAdjustments] = await Promise.all([
      listErpLocations(),
      listErpBalances(),
      listErpMovements(),
      getItems(),
      canMap ? listUnmappedLegacyItems() : Promise.resolve([]),
      canAdjust || canApproveAdjustments
        ? listErpStockAdjustments()
        : Promise.resolve([]),
    ]);
    setLocations(nextLocations);
    setBalances(nextBalances);
    setMovements(nextMovements);
    setItems(nextItems);
    setUnmappedItems(nextUnmappedItems);
    setAdjustments(nextAdjustments);
  }, [canAdjust, canApproveAdjustments, canMap]);

  useEffect(() => {
    let active = true;
    Promise.all([load(), getGudangList(), getDivisi()])
      .then(([, nextWarehouses, nextDivisions]) => {
        if (!active) return;
        setWarehouses(nextWarehouses);
        setDivisions(nextDivisions);
        setError(null);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Gagal memuat inventory.");
      });
    return () => { active = false; };
  }, [load]);

  const submitMovement = async (event: React.FormEvent) => {
    event.preventDefault();
    const item = Number(itemId);
    const amount = Number(quantity);
    const from = fromLocationId ? Number(fromLocationId) : undefined;
    const to = toLocationId ? Number(toLocationId) : undefined;
    if (!Number.isSafeInteger(item) || item <= 0 || !Number.isFinite(amount) || amount <= 0 || !reason.trim()) {
      setError("Pilih item, masukkan kuantitas positif, dan isi alasan mutasi.");
      return;
    }
    if (!from || !to || from === to) {
      setError("Pilih lokasi asal dan tujuan yang berbeda untuk transfer.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postErpMovement({
        itemId: item,
        fromLocationId: from,
        toLocationId: to,
        quantity: amount,
        idempotencyKey: crypto.randomUUID(),
        reason: reason.trim(),
      });
      setNotice("Mutasi berhasil dicatat.");
      setQuantity("");
      setReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mencatat mutasi.");
    } finally {
      setBusy(false);
    }
  };

  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    const item = Number(adjustmentItemId);
    const location = Number(adjustmentLocationId);
    const physical = Number(physicalQuantity);
    if (
      !Number.isSafeInteger(item) ||
      item <= 0 ||
      !Number.isSafeInteger(location) ||
      location <= 0 ||
      !Number.isFinite(physical) ||
      physical < 0 ||
      !adjustmentReason.trim()
    ) {
      setError("Pilih item dan lokasi, masukkan stok fisik >= 0, serta isi alasan.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestErpStockAdjustment({
        itemId: item,
        locationId: location,
        physicalQuantity: physical,
        reason: adjustmentReason.trim(),
      });
      setNotice("Adjustment diajukan dan menunggu persetujuan supervisor.");
      setPhysicalQuantity("");
      setAdjustmentReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengajukan adjustment.");
    } finally {
      setBusy(false);
    }
  };

  const reviewAdjustment = async (
    adjustmentId: number,
    decision: "approve" | "reject",
  ) => {
    const reviewNotes =
      decision === "reject"
        ? window.prompt("Tuliskan alasan penolakan (minimal 5 karakter):")?.trim()
        : undefined;
    if (decision === "reject" && (!reviewNotes || reviewNotes.length < 5)) {
      if (reviewNotes !== undefined) setError("Alasan penolakan minimal 5 karakter.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reviewErpStockAdjustment(adjustmentId, decision, reviewNotes);
      setNotice(
        decision === "approve"
          ? "Adjustment disetujui dan mutasi stok sudah diposting."
          : "Adjustment ditolak.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mereview adjustment.");
    } finally {
      setBusy(false);
    }
  };

  const mapLocation = async (kind: "warehouse" | "division", id: number) => {
    try {
      if (kind === "warehouse") await mapErpWarehouse(id);
      else await mapErpDivision(id);
      setNotice("Lokasi berhasil dipetakan.");
      setError(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memetakan lokasi.");
    }
  };

  const mapLegacyItem = async (itemId: number) => {
    const locationId = Number(itemLocationIds[itemId]);
    if (!Number.isSafeInteger(locationId) || locationId <= 0) {
      setError("Pilih lokasi tujuan untuk item.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setErpItemDefaultLocation(itemId, locationId);
      setNotice("Saldo legacy item dipetakan dan dicatat sebagai saldo pembuka.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memetakan saldo item.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">ERP · Inventory</p>
        <h1 className="mt-1 text-3xl font-bold text-[#1E3A5F]">Ledger Lokasi</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Saldo ini dihitung dari gerakan ERP. Data legacy tanpa lokasi tidak dianggap saldo ledger.
        </p>
      </header>

      {(error || notice) && (
        <p role={error ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {error ?? notice}
        </p>
      )}

      {canMap && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[#1E3A5F]">Pemetaan gudang</h2>
            <div className="mt-3 space-y-2">
              {warehouses.filter((row) => !locations.some((location) => location.gudangId === row.id)).map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
                  <span className="text-sm">{row.kode} · {row.name}</span>
                  <button className={buttonClass} type="button" onClick={() => void mapLocation("warehouse", row.id)}>Petakan</button>
                </div>
              ))}
              {!warehouses.some((row) => !locations.some((location) => location.gudangId === row.id)) && (
                <p className="text-sm text-slate-500">Semua gudang sudah dipetakan; gudang legacy tidak dibuat otomatis.</p>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[#1E3A5F]">Pemetaan divisi</h2>
            <div className="mt-3 space-y-2">
              {divisions.filter((row) => !locations.some((location) => location.divisiId === row.id)).map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
                  <span className="text-sm">{row.nama}</span>
                  <button className={buttonClass} type="button" onClick={() => void mapLocation("division", row.id)}>Petakan</button>
                </div>
              ))}
              {divisions.every((row) => locations.some((location) => location.divisiId === row.id)) && (
                <p className="text-sm text-slate-500">Semua divisi sudah dipetakan.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {canMap && (
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-[#1E3A5F]">Pemetaan saldo item legacy</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pilih lokasi yang benar. Saldo lama dicatat satu kali sebagai saldo pembuka; saldo negatif perlu direkonsiliasi terlebih dahulu.
          </p>
          <div className="mt-3 space-y-2">
            {unmappedItems.map((item) => (
              <div key={item.id} className="grid gap-2 border-b border-slate-100 py-3 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-center">
                <span className="text-sm">
                  {item.kode} · {item.nama} <span className={item.legacyBalance < 0 ? "font-semibold text-red-700" : "text-slate-500"}>
                    (legacy: {item.legacyBalance.toLocaleString("id-ID")} {item.unit})
                  </span>
                </span>
                <select
                  className={inputClass}
                  aria-label={`Lokasi untuk ${item.kode}`}
                  value={itemLocationIds[item.id] ?? ""}
                  onChange={(event) => setItemLocationIds((current) => ({ ...current, [item.id]: event.target.value }))}
                >
                  <option value="">Pilih lokasi</option>
                  {locations.filter((location) => location.isActive).map((location) => (
                    <option key={location.id} value={location.id}>{location.code} · {location.name}</option>
                  ))}
                </select>
                <button
                  className={buttonClass}
                  type="button"
                  disabled={busy || item.legacyBalance < 0}
                  onClick={() => void mapLegacyItem(item.id)}
                >
                  Petakan item
                </button>
              </div>
            ))}
            {unmappedItems.length === 0 && (
              <p className="py-2 text-sm text-slate-500">Tidak ada saldo legacy item yang menunggu pemetaan.</p>
            )}
          </div>
        </section>
      )}

      {(canMove || canAdjust) && (
        <form onSubmit={submitMovement} className="grid gap-4 rounded-xl bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-5">
          <div className="md:col-span-2 xl:col-span-5">
            <h2 className="font-semibold text-[#1E3A5F]">Transfer antar lokasi</h2>
            <p className="mt-1 text-sm text-slate-600">Koreksi saldo tidak dicatat langsung; gunakan pengajuan adjustment di bawah.</p>
          </div>
          <label className="text-sm">Item
            <select className={inputClass} required value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">Pilih item</option>
              {items.filter((item) => item.isActive).map((item) => (
                <option key={item.id} value={item.id}>{item.kode} · {item.nama} ({item.unit})</option>
              ))}
            </select>
          </label>
          <label className="text-sm">Kuantitas<input className={inputClass} type="number" min="0.000001" step="0.000001" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
          <label className="text-sm">Lokasi asal
            <select className={inputClass} value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)}>
              <option value="">— Tidak ada —</option>
              {locations.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Lokasi tujuan
            <select className={inputClass} value={toLocationId} onChange={(e) => setToLocationId(e.target.value)}>
              <option value="">— Tidak ada —</option>
              {locations.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Alasan<input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="md:col-span-2 xl:col-span-5">
            <button className={buttonClass} disabled={busy || !canMove || !fromLocationId || !toLocationId}>
              {busy ? "Menyimpan…" : "Catat transfer"}
            </button>
          </div>
        </form>
      )}

      {canAdjust && (
        <form onSubmit={submitAdjustment} className="grid gap-4 rounded-xl bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
          <div className="md:col-span-2 xl:col-span-4">
            <h2 className="font-semibold text-[#1E3A5F]">Ajukan penyesuaian stok</h2>
            <p className="mt-1 text-sm text-slate-600">Saldo sistem tidak berubah sebelum supervisor menyetujui permintaan.</p>
          </div>
          <label className="text-sm">Item
            <select className={inputClass} required value={adjustmentItemId} onChange={(event) => setAdjustmentItemId(event.target.value)}>
              <option value="">Pilih item</option>
              {items.filter((item) => item.isActive).map((item) => (
                <option key={item.id} value={item.id}>{item.kode} · {item.nama}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">Lokasi
            <select className={inputClass} required value={adjustmentLocationId} onChange={(event) => setAdjustmentLocationId(event.target.value)}>
              <option value="">Pilih lokasi</option>
              {locations.filter((location) => location.isActive).map((location) => (
                <option key={location.id} value={location.id}>{location.code} · {location.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">Jumlah fisik
            <input className={inputClass} type="number" min="0" step="0.000001" required value={physicalQuantity} onChange={(event) => setPhysicalQuantity(event.target.value)} />
          </label>
          <label className="text-sm">Alasan
            <input className={inputClass} minLength={5} required value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} />
          </label>
          <div className="md:col-span-2 xl:col-span-4">
            <button className={buttonClass} disabled={busy}>{busy ? "Mengirim…" : "Ajukan adjustment"}</button>
          </div>
        </form>
      )}

      {(canAdjust || canApproveAdjustments) && (
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-[#1E3A5F]">Permintaan adjustment stok</h2>
          <div className="mt-3 space-y-3">
            {adjustments.map((adjustment) => (
              <article key={adjustment.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{adjustment.item.kode} · {adjustment.item.nama}</p>
                    <p className="text-sm text-slate-600">{adjustment.location.code} · {adjustment.location.name}</p>
                    <p className="mt-1 text-sm">Sistem {Number(adjustment.systemQuantity).toLocaleString("id-ID")} → fisik {Number(adjustment.physicalQuantity).toLocaleString("id-ID")} {adjustment.item.unit}</p>
                    <p className="text-sm text-slate-600">Selisih {Number(adjustment.difference).toLocaleString("id-ID")} · {adjustment.reason}</p>
                    <p className="text-xs text-slate-500">Diajukan {adjustment.requester.name} · {new Date(adjustment.requestedAt).toLocaleString("id-ID")}</p>
                    {adjustment.reviewNotes && <p className="mt-1 text-sm text-red-700">Catatan review: {adjustment.reviewNotes}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${adjustment.status === "PENDING" ? "bg-amber-100 text-amber-800" : adjustment.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    {adjustment.status}
                  </span>
                </div>
                {adjustment.status === "PENDING" && canApproveAdjustments && (
                  <div className="mt-3 flex gap-2">
                    <button className={buttonClass} type="button" disabled={busy} onClick={() => void reviewAdjustment(adjustment.id, "approve")}>Setujui & posting</button>
                    <button className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50" type="button" disabled={busy} onClick={() => void reviewAdjustment(adjustment.id, "reject")}>Tolak</button>
                  </div>
                )}
              </article>
            ))}
            {adjustments.length === 0 && <p className="py-2 text-sm text-slate-500">Belum ada permintaan adjustment.</p>}
          </div>
        </section>
      )}

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-[#1E3A5F]">Saldo per lokasi</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead><tr className="border-b text-slate-500"><th className="py-2">Item</th><th>Lokasi</th><th className="text-right">Saldo</th></tr></thead>
            <tbody>{balances.map((row, index) => {
              const item = row.itemId === null ? null : items.find((candidate) => candidate.id === row.itemId);
              return <tr key={`${row.itemId}-${row.locationId}-${index}`} className="border-b border-slate-100">
                <td className="py-2">{item ? `${item.kode} · ${item.nama}` : row.itemId !== null ? "Item tidak ditemukan" : "Barang individual"}</td>
                <td>{locations.find((location) => location.id === row.locationId)?.name ?? `Lokasi ${row.locationId}`}</td>
                <td className="text-right tabular-nums">{row.quantity.toLocaleString("id-ID")}</td>
              </tr>
            })}</tbody>
          </table>
          {balances.length === 0 && <p className="py-4 text-sm text-slate-500">Belum ada mutasi pada ledger ERP.</p>}
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-[#1E3A5F]">Gerakan terbaru</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead><tr className="border-b text-slate-500"><th className="py-2">Tipe</th><th>Item/unit</th><th>Asal</th><th>Tujuan</th><th className="text-right">Jumlah</th></tr></thead>
            <tbody>{movements.map((row) => {
              const item = row.item ?? items.find((candidate) => candidate.id === row.itemId);
              return <tr key={row.id} className="border-b border-slate-100">
                <td className="py-2">{row.type || "—"}</td>
                <td>{item ? `${item.kode} · ${item.nama}` : row.barang?.kodeBarang ?? "Barang individual"}</td>
                <td>{row.fromLocation?.name ?? "—"}</td><td>{row.toLocation?.name ?? "—"}</td>
                <td className="text-right tabular-nums">{Number(row.quantity).toLocaleString("id-ID")}</td>
              </tr>;
            })}</tbody>
          </table>
          {movements.length === 0 && <p className="py-4 text-sm text-slate-500">Belum ada gerakan.</p>}
        </div>
      </section>
    </div>
  );
}
