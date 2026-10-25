import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getUserPermissions } from "../../api/auth";
import {
  cancelErpShipment,
  createErpShipment,
  listAvailableFinishedGoods,
  listFinishedGoodsReceiptCandidates,
  listErpLocations,
  listErpShipments,
  postErpShipment,
  receiveErpFinishedGoods,
  receiveErpShipmentReturn,
  type AvailableFinishedGood,
  type ErpLocation,
  type FinishedGoodsReceiptCandidate,
  type Shipment,
} from "../../api/erp";

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "rounded-lg bg-[#00A8E8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

export default function Shipments() {
  const permissions = getUserPermissions();
  const canManage = permissions.includes("SHIPMENT_MANAGE");
  const canPost = permissions.includes("SHIPMENT_POST");
  const canReturn = permissions.includes("SHIPMENT_RETURN");
  const canReceiveFinishedGoods = canPost;
  const [rows, setRows] = useState<Shipment[]>([]);
  const [warehouses, setWarehouses] = useState<ErpLocation[]>([]);
  const [fromLocationId, setFromLocationId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [reference, setReference] = useState("");
  const [availableGoods, setAvailableGoods] = useState<AvailableFinishedGood[]>([]);
  const [availableGoodsLoading, setAvailableGoodsLoading] = useState(false);
  const [availableGoodsError, setAvailableGoodsError] = useState<string | null>(null);
  const [selectedShipmentGoods, setSelectedShipmentGoods] = useState<number[]>([]);
  const [receiptCandidates, setReceiptCandidates] = useState<FinishedGoodsReceiptCandidate[]>([]);
  const [receiptCandidatesLoading, setReceiptCandidatesLoading] = useState(false);
  const [receiptCandidatesError, setReceiptCandidatesError] = useState<string | null>(null);
  const [finishedGoods, setFinishedGoods] = useState({ lineId: "", locationId: "", unitIds: [] as number[] });
  const [returnForm, setReturnForm] = useState({ shipmentId: "", shipmentLineId: "", toLocationId: "", condition: "Perlu pemeriksaan", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [nextRows, locations] = await Promise.all([listErpShipments(), listErpLocations()]);
    setRows(nextRows);
    setWarehouses(locations.filter((row) => row.type === "WAREHOUSE" && row.isActive));
    if (canReceiveFinishedGoods) {
      setReceiptCandidatesLoading(true);
      setReceiptCandidatesError(null);
      try {
        setReceiptCandidates(await listFinishedGoodsReceiptCandidates());
      } catch (e) {
        setReceiptCandidates([]);
        setReceiptCandidatesError(e instanceof Error ? e.message : "Gagal memuat unit hasil QC.");
      } finally {
        setReceiptCandidatesLoading(false);
      }
    } else {
      setReceiptCandidates([]);
    }
  }, [canReceiveFinishedGoods]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await load();
        if (active) setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Gagal memuat shipment.");
      }
    })();
    return () => { active = false; };
  }, [load]);

  useEffect(() => {
    let active = true;
    if (!fromLocationId || !canManage) {
      return () => { active = false; };
    }
    listAvailableFinishedGoods(Number(fromLocationId))
      .then((goods) => {
        if (!active) return;
        setAvailableGoods(goods);
        setSelectedShipmentGoods((selected) => selected.filter((id) => goods.some((good) => good.id === id)));
      })
      .catch((e: unknown) => {
        if (!active) return;
        setAvailableGoods([]);
        setAvailableGoodsError(e instanceof Error ? e.message : "Gagal memuat Finish Good yang tersedia.");
      })
      .finally(() => { if (active) setAvailableGoodsLoading(false); });
    return () => { active = false; };
  }, [canManage, fromLocationId]);

  const submitDraft = async (event: FormEvent) => {
    event.preventDefault();
    const ids = selectedShipmentGoods;
    if (!Number(fromLocationId) || !recipientName.trim() || !recipientAddress.trim() || ids.length === 0) {
      setError("Pilih gudang dan minimal satu unit Finish Good, lalu isi penerima dan alamat.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createErpShipment({
        fromLocationId: Number(fromLocationId),
        recipientName: recipientName.trim(),
        recipientAddress: recipientAddress.trim(),
        reference: reference.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
        barangIds: ids,
      });
      setNotice("Draft shipment berhasil dibuat.");
      setRecipientName("");
      setRecipientAddress("");
      setReference("");
      setSelectedShipmentGoods([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat draft shipment.");
    } finally {
      setBusy(false);
    }
  };

  const postShipment = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      await postErpShipment(id);
      setNotice("Shipment diposting dan saldo unit gudang diperbarui.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memosting shipment.");
    } finally {
      setBusy(false);
    }
  };

  const cancelShipment = async (id: number) => {
    const reason = window.prompt("Alasan pembatalan draft shipment:");
    if (!reason?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await cancelErpShipment(id, reason.trim());
      setNotice("Draft shipment dibatalkan.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membatalkan shipment.");
    } finally {
      setBusy(false);
    }
  };

  const submitReturn = async (event: FormEvent) => {
    event.preventDefault();
    if (!Number(returnForm.shipmentId) || !Number(returnForm.shipmentLineId) || !Number(returnForm.toLocationId) || !returnForm.reason.trim() || !returnForm.condition.trim()) {
      setError("Pilih shipment, unit, gudang penerimaan, kondisi, dan isi alasan retur.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await receiveErpShipmentReturn({
        shipmentId: Number(returnForm.shipmentId),
        toLocationId: Number(returnForm.toLocationId),
        idempotencyKey: crypto.randomUUID(),
        reason: returnForm.reason.trim(),
        lines: [{ shipmentLineId: Number(returnForm.shipmentLineId), condition: returnForm.condition.trim() }],
      });
      setNotice("Retur dicatat sebagai penerimaan terpisah.");
      setReturnForm({ shipmentId: "", shipmentLineId: "", toLocationId: "", condition: "Perlu pemeriksaan", reason: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mencatat retur.");
    } finally {
      setBusy(false);
    }
  };

  const submitFinishedGoods = async (event: FormEvent) => {
    event.preventDefault();
    const ids = finishedGoods.unitIds;
    if (!Number(finishedGoods.lineId) || !Number(finishedGoods.locationId) || ids.length === 0) {
      setError("Pilih hasil inspeksi QC, gudang penerimaan, dan minimal satu unit.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await receiveErpFinishedGoods({
        qualityInspectionLineId: Number(finishedGoods.lineId),
        locationId: Number(finishedGoods.locationId),
        idempotencyKey: crypto.randomUUID(),
        barangIds: ids,
      });
      setNotice(`${ids.length} unit diterima sebagai Finish Good.`);
      setFinishedGoods({ lineId: "", locationId: "", unitIds: [] });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menerima Finish Good.");
    } finally {
      setBusy(false);
    }
  };

  const selectedReceiptCandidate = receiptCandidates.find((row) => row.id === Number(finishedGoods.lineId));
  const postedShipments = rows.filter((row) => row.status === "POSTED");
  const selectedReturnShipment = postedShipments.find((row) => row.id === Number(returnForm.shipmentId));
  const selectedReturnLine = selectedReturnShipment?.lines.find((line) => line.id === Number(returnForm.shipmentLineId));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">ERP · Distribution</p>
        <h1 className="mt-1 text-3xl font-bold text-[#1E3A5F]">Shipment Pelanggan</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Shipment parsial didukung. Hanya unit Finish Good yang tersedia di ledger lokasi gudang dapat diposting.</p>
      </header>
      {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ?? notice}</p>}

      {canReceiveFinishedGoods && (
        <form onSubmit={submitFinishedGoods} className="grid gap-3 rounded-xl bg-white p-5 shadow-sm md:grid-cols-2">
          <h2 className="font-semibold text-[#1E3A5F] md:col-span-2">Penerimaan Finish Good dari QC</h2>
          <label className="text-sm">Hasil inspeksi QC
            <select
              className={field}
              required
              value={finishedGoods.lineId}
              onChange={(e) => setFinishedGoods({ ...finishedGoods, lineId: e.target.value, unitIds: [] })}
            >
              <option value="">Pilih inspeksi QC</option>
              {receiptCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.inspectionNumber} · {candidate.variantCode ?? "Varian tidak dicantumkan"} · {candidate.units.length} unit siap diterima
                </option>
              ))}
            </select>
          </label>
          {receiptCandidatesLoading && <p className="text-sm text-slate-500 md:col-span-2">Memuat hasil inspeksi QC...</p>}
          {receiptCandidatesError && <p role="alert" className="text-sm text-red-700 md:col-span-2">{receiptCandidatesError}</p>}
          {!receiptCandidatesLoading && !receiptCandidatesError && receiptCandidates.length === 0 && (
            <p className="text-sm text-slate-500 md:col-span-2">Belum ada unit lolos QC yang tersedia untuk diterima.</p>
          )}
          <label className="text-sm">Gudang FG
            <select className={field} required value={finishedGoods.locationId} onChange={(e) => setFinishedGoods({ ...finishedGoods, locationId: e.target.value })}>
              <option value="">Pilih gudang penerimaan</option>
              {warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}
            </select>
          </label>
          <fieldset className="rounded-lg border border-slate-200 p-3 md:col-span-2">
            <legend className="px-1 text-sm font-medium">Pilih unit yang akan diterima</legend>
            {selectedReceiptCandidate ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {selectedReceiptCandidate.units.map((unit) => {
                  const checked = finishedGoods.unitIds.includes(unit.id);
                  return (
                    <label key={unit.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setFinishedGoods((current) => ({
                          ...current,
                          unitIds: event.target.checked
                            ? [...current.unitIds, unit.id]
                            : current.unitIds.filter((id) => id !== unit.id),
                        }))}
                      />
                      <span className="font-mono">{unit.kodeBarang}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Pilih hasil inspeksi untuk melihat unit lolos yang tersedia di QC.</p>
            )}
          </fieldset>
          <p className="text-xs text-slate-500 md:col-span-2">Hanya unit yang lolos QC dan masih berada di lokasi QC yang ditampilkan.</p>
          <div className="md:col-span-2"><button className={button} disabled={busy || !finishedGoods.unitIds.length}>Terima unit terpilih sebagai Finish Good</button></div>
        </form>
      )}

      {canManage && (
        <form onSubmit={submitDraft} className="grid gap-4 rounded-xl bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-3">
          <h2 className="font-semibold text-[#1E3A5F] md:col-span-2 xl:col-span-3">Buat draft shipment</h2>
          <label className="text-sm">Gudang FG asal
            <select className={field} value={fromLocationId} onChange={(e) => {
              const locationId = e.target.value;
              setFromLocationId(locationId);
              setAvailableGoods([]);
              setSelectedShipmentGoods([]);
              setAvailableGoodsError(null);
              setAvailableGoodsLoading(Boolean(locationId));
            }}>
              <option value="">Pilih lokasi gudang</option>
              {warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Nama penerima<input className={field} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></label>
          <label className="text-sm">Referensi<input className={field} value={reference} onChange={(e) => setReference(e.target.value)} /></label>
          <label className="text-sm md:col-span-2 xl:col-span-3">Alamat snapshot<textarea className={field} rows={2} value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} /></label>
          <fieldset className="rounded-lg border border-slate-200 p-3 md:col-span-2 xl:col-span-3">
            <legend className="px-1 text-sm font-medium">Pilih unit Finish Good yang akan dikirim</legend>
            {!fromLocationId ? (
              <p className="text-sm text-slate-500">Pilih gudang asal untuk melihat unit yang tersedia.</p>
            ) : availableGoodsLoading ? (
              <p className="text-sm text-slate-500">Memuat unit Finish Good yang tersedia...</p>
            ) : availableGoodsError ? (
              <p role="alert" className="text-sm text-red-700">{availableGoodsError}</p>
            ) : availableGoods.length === 0 ? (
              <p className="text-sm text-slate-500">Tidak ada unit Finish Good tersedia di gudang ini.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {availableGoods.map((unit) => {
                  const checked = selectedShipmentGoods.includes(unit.id);
                  return (
                    <label key={unit.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setSelectedShipmentGoods((current) =>
                          event.target.checked ? [...current, unit.id] : current.filter((id) => id !== unit.id),
                        )}
                      />
                      <span><span className="font-mono">{unit.kodeBarang}</span><span className="block text-xs text-slate-500">{unit.variant.kodeVariant}</span></span>
                    </label>
                  );
                })}
              </div>
            )}
            {selectedShipmentGoods.length > 0 && <p className="mt-2 text-xs text-slate-500">{selectedShipmentGoods.length} unit dipilih.</p>}
          </fieldset>
          <div className="md:col-span-2 xl:col-span-3"><button className={button} disabled={busy || availableGoodsLoading || selectedShipmentGoods.length === 0}>Buat draft</button></div>
        </form>
      )}

      {canReturn && (
        <form onSubmit={submitReturn} className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 md:grid-cols-3">
          <h2 className="font-semibold text-amber-950 md:col-span-3">Penerimaan retur</h2>
          <label className="text-sm">Shipment yang diretur
            <select className={field} value={returnForm.shipmentId} onChange={(e) => setReturnForm({ ...returnForm, shipmentId: e.target.value, shipmentLineId: "" })}>
              <option value="">Pilih shipment terkirim</option>
              {postedShipments.map((row) => <option key={row.id} value={row.id}>{row.number} · {row.recipientName}</option>)}
            </select>
          </label>
          <label className="text-sm">Unit yang dikembalikan
            <select className={field} value={returnForm.shipmentLineId} onChange={(e) => setReturnForm({ ...returnForm, shipmentLineId: e.target.value })}>
              <option value="">Pilih barcode unit</option>
              {selectedReturnShipment?.lines.filter((line) => line.returns.length === 0).map((line) => (
                <option key={line.id} value={line.id}>{line.barang.kodeBarang}</option>
              ))}
            </select>
            {selectedReturnShipment && selectedReturnShipment.lines.every((line) => line.returns.length > 0) && (
              <span className="mt-1 block text-xs text-slate-500">Semua unit pada shipment ini sudah tercatat retur.</span>
            )}
          </label>
          <label className="text-sm">Gudang penerimaan<select className={field} value={returnForm.toLocationId} onChange={(e) => setReturnForm({ ...returnForm, toLocationId: e.target.value })}><option value="">Pilih gudang</option>{warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
          <label className="text-sm">Kondisi<input className={field} value={returnForm.condition} onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })} /></label>
          <label className="text-sm md:col-span-2">Alasan retur<input className={field} value={returnForm.reason} onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })} /></label>
          {selectedReturnLine && <p className="text-xs text-slate-600 md:col-span-3">Barcode dipilih: {selectedReturnLine.barang.kodeBarang}</p>}
          <div className="md:col-span-3"><button className={button} disabled={busy}>Catat retur</button></div>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold text-[#1E3A5F]">Daftar shipment</h2>
        {rows.map((row) => (
          <article key={row.id} className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{row.number}</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{row.status}</span></div>
              <p className="mt-1 text-sm text-slate-600">{row.recipientName} · {row.recipientAddress}</p>
              <p className="mt-1 text-xs text-slate-500">{row.lines.length} unit: {row.lines.map((line) => line.barang.kodeBarang).join(", ")}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {canPost && row.status === "DRAFT" && <button type="button" className={button} disabled={busy} onClick={() => void postShipment(row.id)}>Posting</button>}
              {canManage && row.status === "DRAFT" && <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50" disabled={busy} onClick={() => void cancelShipment(row.id)}>Batalkan draft</button>}
            </div>
          </article>
        ))}
        {rows.length === 0 && <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Belum ada shipment.</p>}
      </section>
    </div>
  );
}
