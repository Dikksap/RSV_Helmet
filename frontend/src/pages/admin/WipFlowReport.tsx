import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getDivisi, type Divisi } from "../../api/divisi";
import {
  createWipStocktake,
  getWipFlowReport,
  listWipStocktakeOptions,
  listWipStocktakes,
  type WipFlowReport,
  type WipStocktakeOption,
  type WipStocktakeSession,
} from "../../api/erp";
import { getUserPermissions } from "../../api/auth";

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "rounded-lg bg-[#00A8E8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondaryButton = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50";
const stageLabels: Record<string, string> = {
  BUFFING: "Buffing",
  BASE_COAT: "Base Coat",
  DECAL_SOLID: "Decal Solid",
  DECAL_MOTIF: "Decal Motif",
  TOP_COAT: "Top Coat",
};

type CountEntry = { physicalQuantity: string; reason: string };

function dateString(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

function emptyDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return { from: dateString(from), to: dateString(today) };
}

function numberText(value: number | string) {
  return Number(value).toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

export default function WipFlowReport() {
  const permissions = getUserPermissions();
  const canViewReport = permissions.includes("INVENTORY_VIEW") || permissions.includes("QUALITY_VIEW");
  const canCount = permissions.includes("INVENTORY_ADJUST");
  const [tab, setTab] = useState<"report" | "stocktake">(canViewReport ? "report" : "stocktake");
  const [range, setRange] = useState(emptyDateRange);
  const [divisionId, setDivisionId] = useState("");
  const [itemId, setItemId] = useState("");
  const [divisions, setDivisions] = useState<Divisi[]>([]);
  const [report, setReport] = useState<WipFlowReport | null>(null);
  const [options, setOptions] = useState<WipStocktakeOption[]>([]);
  const [sessions, setSessions] = useState<WipStocktakeSession[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [countEntries, setCountEntries] = useState<Record<number, CountEntry>>({});
  const [sessionNotes, setSessionNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchReport = useCallback(async () => {
    const [nextReport, nextDivisions] = await Promise.all([
      getWipFlowReport({
        ...range,
        ...(divisionId ? { divisionId: Number(divisionId) } : {}),
        ...(itemId ? { itemId: Number(itemId) } : {}),
      }),
      divisions.length ? Promise.resolve(divisions) : getDivisi(),
    ]);
    return { nextReport, nextDivisions };
  }, [divisionId, divisions, itemId, range]);

  const refreshReport = useCallback(async () => {
    const { nextReport, nextDivisions } = await fetchReport();
    setReport(nextReport);
    setDivisions(nextDivisions);
  }, [fetchReport]);

  const fetchStocktakes = useCallback(async () => {
    const [nextOptions, nextSessions] = await Promise.all([
      listWipStocktakeOptions(),
      listWipStocktakes(1, 50),
    ]);
    return { nextOptions, nextSessions };
  }, []);

  const refreshStocktakes = useCallback(async () => {
    const { nextOptions, nextSessions } = await fetchStocktakes();
    setOptions(nextOptions);
    setSessions(nextSessions.data);
  }, [fetchStocktakes]);

  useEffect(() => {
    if (!canViewReport) return;
    fetchReport().then(({ nextReport, nextDivisions }) => {
      setReport(nextReport);
      setDivisions(nextDivisions);
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Gagal memuat laporan aliran WIP.");
    });
  }, [canViewReport, fetchReport]);

  useEffect(() => {
    if (!canCount) return;
    fetchStocktakes().then(({ nextOptions, nextSessions }) => {
      setOptions(nextOptions);
      setSessions(nextSessions.data);
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Gagal memuat opname WIP.");
    });
  }, [canCount, fetchStocktakes]);

  const locationOptions = useMemo(
    () => [...new Map(options.map((option) => [option.locationId, option])).values()],
    [options],
  );
  const itemsForLocation = options.filter((option) => option.locationId === Number(selectedLocationId));
  const selectedCount = itemsForLocation.filter((option) => countEntries[option.itemId]);

  const submitReportFilters = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await refreshReport();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal memuat laporan aliran WIP.");
    } finally {
      setBusy(false);
    }
  };

  const saveStocktake = async (event: FormEvent) => {
    event.preventDefault();
    const items = selectedCount.map((option) => ({
      itemId: option.itemId,
      physicalQuantity: Number(countEntries[option.itemId].physicalQuantity),
      reason: countEntries[option.itemId].reason.trim(),
    }));
    if (items.length === 0 || items.some((line) => {
      const entry = countEntries[line.itemId];
      const option = itemsForLocation.find((candidate) => candidate.itemId === line.itemId);
      return !entry.physicalQuantity.trim() ||
        !Number.isFinite(line.physicalQuantity) ||
        line.physicalQuantity < 0 ||
        (option !== undefined && line.physicalQuantity !== option.quantity && line.reason.length < 5);
    })) {
      setError("Isi jumlah fisik setiap item dan berikan alasan minimal 5 karakter bila ada selisih.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await createWipStocktake({
        locationId: Number(selectedLocationId),
        notes: sessionNotes.trim() || undefined,
        items,
      });
      setNotice(`Opname ${session.number} disimpan. Selisih telah dicatat sebagai mutasi penyesuaian.`);
      setCountEntries({});
      setSessionNotes("");
      await refreshStocktakes();
      await refreshReport();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal menyimpan opname WIP.");
    } finally {
      setBusy(false);
    }
  };

  if (!canViewReport && !canCount) {
    return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Akun ini tidak memiliki izin melihat laporan atau melakukan opname WIP.</p>;
  }

  return (
    <main className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">ERP · Produksi</p>
        <h1 className="mt-1 text-3xl font-bold text-[#1E3A5F]">Aliran WIP & Opname</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-600">Telusuri perpindahan, produksi, QC, repair, dan saldo per tahap. Hitung fisik WIP akan dibandingkan dengan ledger dan setiap koreksi disimpan sebagai mutasi baru beralasan.</p>
      </header>
      {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ?? notice}</p>}

      <nav className="flex gap-2">
        {canViewReport && <button type="button" className={tab === "report" ? button : secondaryButton} onClick={() => setTab("report")}>Laporan aliran</button>}
        {canCount && <button type="button" className={tab === "stocktake" ? button : secondaryButton} onClick={() => setTab("stocktake")}>Opname fisik WIP</button>}
      </nav>

      {tab === "report" && canViewReport && (
        <section className="space-y-5">
          <form onSubmit={submitReportFilters} className="grid gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-sm">Dari<input className={field} type="date" required value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} /></label>
            <label className="text-sm">Sampai<input className={field} type="date" required value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} /></label>
            <label className="text-sm">Divisi
              <select className={field} value={divisionId} onChange={(event) => { setDivisionId(event.target.value); setItemId(""); }}>
                <option value="">Semua divisi proses</option>
                {divisions.map((division) => <option key={division.id} value={division.id}>{division.nama}</option>)}
              </select>
            </label>
            <label className="text-sm">Item WIP
              <select className={field} value={itemId} onChange={(event) => setItemId(event.target.value)}>
                <option value="">Semua item</option>
                {[...new Map((report?.balances ?? []).map((row) => [row.itemId, row])).values()].map((row) => <option key={row.itemId} value={row.itemId}>{row.itemCode} · {row.itemName}</option>)}
              </select>
            </label>
            <div className="flex items-end"><button className={button} disabled={busy}>{busy ? "Memuat…" : "Tampilkan laporan"}</button></div>
          </form>

          {report && <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Saldo awal WIP", report.totals.openingBalance],
                ["Masuk produksi", report.totals.productionIn],
                ["QC diperiksa", report.totals.inspected],
                ["Saldo akhir WIP", report.totals.closingBalance],
                ["Transfer masuk / keluar", `${numberText(report.totals.transferIn)} / ${numberText(report.totals.transferOut)}`],
                ["Lolos QC", report.totals.passed],
                ["Reject QC", report.totals.rejected],
                ["Unit dialokasikan untuk repair", report.totals.repair],
                ["Repair dicoba / disetujui", `${numberText(report.totals.repairAttempted)} / ${numberText(report.totals.repairApproved)}`],
                ["Penyesuaian + / −", `${numberText(report.totals.adjustmentIn)} / ${numberText(report.totals.adjustmentOut)}`],
                ["Shipment masuk / keluar", `${numberText(report.totals.shipmentIn)} / ${numberText(report.totals.shipmentOut)}`],
                ["Repair gagal review", report.totals.repairFailed],
              ].map(([label, value]) => (
                <article key={String(label)} className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-xl font-bold text-[#1E3A5F]">{typeof value === "number" ? numberText(value) : value}</p>
                </article>
              ))}
            </div>

            <article className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="border-b px-5 py-4"><h2 className="font-semibold text-[#1E3A5F]">Saldo dan pergerakan per divisi / Item</h2><p className="mt-1 text-xs text-slate-500">Saldo akhir = saldo awal + seluruh mutasi masuk − seluruh mutasi keluar dalam rentang.</p></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Tahap</th><th>Divisi</th><th>Item WIP</th><th className="text-right">Awal</th><th className="text-right">Masuk</th><th className="text-right">Keluar</th><th className="text-right">Akhir</th><th className="text-right">Saldo ledger akhir</th></tr></thead>
                  <tbody className="divide-y">
                    {report.balances.map((row) => <tr key={`${row.locationId}:${row.itemId}`}>
                      <td className="px-4 py-3">{row.stage ? stageLabels[row.stage] ?? row.stage : "Tidak ada di routing aktif"}</td>
                      <td>{row.divisionName}</td><td>{row.itemCode} · {row.itemName}</td>
                      <td className="text-right">{numberText(row.opening)} {row.unit}</td>
                      <td className="text-right">{numberText(row.inflow)} {row.unit}</td>
                      <td className="text-right">{numberText(row.outflow)} {row.unit}</td>
                      <td className="text-right">{numberText(row.expectedClosing)} {row.unit}</td>
                      <td className="px-4 text-right font-semibold">{numberText(row.closing)} {row.unit}</td>
                    </tr>)}
                    {report.balances.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Tidak ada saldo atau pergerakan pada filter ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            </article>

            <div className="grid gap-5 xl:grid-cols-2">
              <article className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="border-b px-5 py-4"><h2 className="font-semibold text-[#1E3A5F]">Hasil QC per tahap routing</h2></div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[580px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Tahap / divisi</th><th>Diperiksa</th><th>Lolos</th><th>Repair</th><th>Reject</th></tr></thead>
                    <tbody className="divide-y">
                      {report.qualityByStage.map((row) => <tr key={`${row.stage}:${row.divisionName}`}><td className="px-4 py-3">{stageLabels[row.stage] ?? row.stage} · {row.divisionName}</td><td>{numberText(row.inspected)}</td><td>{numberText(row.passed)}</td><td>{numberText(row.repair)}</td><td>{numberText(row.rejected)}</td></tr>)}
                      {!report.qualityByStage.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Belum ada inspeksi final di periode ini.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </article>
              <article className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="border-b px-5 py-4"><h2 className="font-semibold text-[#1E3A5F]">Aktivitas repair</h2></div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Divisi</th><th>Dicoba</th><th>Berhasil</th><th>Disetujui QC</th><th>Gagal review</th></tr></thead>
                    <tbody className="divide-y">
                      {report.repairByDivision.map((row) => <tr key={row.divisionId}><td className="px-4 py-3">{row.divisionName}</td><td>{numberText(row.attempted)}</td><td>{numberText(row.repaired)}</td><td>{numberText(row.approved)}</td><td>{numberText(row.failed)}</td></tr>)}
                      {!report.repairByDivision.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Belum ada attempt repair di periode ini.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>

            <article className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="border-b px-5 py-4"><h2 className="font-semibold text-[#1E3A5F]">Jejak mutasi WIP · {numberText(report.movementCount)} mutasi</h2>{report.movementsTruncated && <p className="mt-1 text-xs text-amber-700">Ringkasan saldo mencakup seluruh mutasi periode; tabel berikut menampilkan 1.000 mutasi terbaru. Persempit rentang untuk menelusuri detail.</p>}</div>
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Waktu</th><th>Jenis</th><th>Item</th><th>Asal</th><th>Tujuan</th><th>Jumlah</th><th>Referensi / alasan</th></tr></thead>
                  <tbody className="divide-y">
                    {report.movements.map((movement) => <tr key={movement.id}><td className="whitespace-nowrap px-4 py-3">{new Date(movement.occurredAt).toLocaleString("id-ID")}</td><td>{movement.type}</td><td>{movement.item ? `${movement.item.kode} · ${movement.item.nama}` : "WIP"}</td><td>{movement.fromLocation?.divisi?.nama ?? movement.fromLocation?.name ?? "—"}</td><td>{movement.toLocation?.divisi?.nama ?? movement.toLocation?.name ?? "—"}</td><td>{numberText(movement.quantity)} {movement.item?.unit}</td><td>{movement.reason ?? movement.sourceType}</td></tr>)}
                    {!report.movements.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Tidak ada mutasi dalam periode.</td></tr>}
                  </tbody>
                </table>
              </div>
            </article>
          </>}
        </section>
      )}

      {tab === "stocktake" && canCount && (
        <section className="space-y-5">
          <form onSubmit={saveStocktake} className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
            <div>
              <h2 className="font-semibold text-[#1E3A5F]">Catat hitung fisik WIP</h2>
              <p className="mt-1 text-sm text-slate-600">Selisih dibandingkan dengan saldo ledger saat penyimpanan. Kekurangan dialokasikan ke lot tersedia; kelebihan membuat lot penyesuaian WIP baru. Setiap selisih memerlukan alasan.</p>
            </div>
            <label className="block max-w-lg text-sm">Lokasi / divisi yang dihitung
              <select className={field} required value={selectedLocationId} onChange={(event) => { setSelectedLocationId(event.target.value); setCountEntries({}); }}>
                <option value="">Pilih lokasi WIP</option>
                {locationOptions.map((option) => <option key={option.locationId} value={option.locationId}>{option.divisionName}</option>)}
              </select>
            </label>
            {selectedLocationId && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Hitung</th><th>Tahap</th><th>Item</th><th>Saldo sistem</th><th>Jumlah fisik</th><th>Alasan bila ada selisih</th></tr></thead>
                  <tbody className="divide-y">
                    {itemsForLocation.map((option) => {
                      const entry = countEntries[option.itemId];
                      return <tr key={option.itemId}>
                        <td className="px-4 py-3"><input type="checkbox" aria-label={`Hitung ${option.itemName}`} checked={Boolean(entry)} onChange={(event) => setCountEntries((current) => {
                          if (!event.target.checked) {
                            const next = { ...current };
                            delete next[option.itemId];
                            return next;
                          }
                          return { ...current, [option.itemId]: { physicalQuantity: String(option.quantity), reason: "" } };
                        })} /></td>
                        <td>{option.stage ? stageLabels[option.stage] ?? option.stage : "WIP tersimpan"}</td>
                        <td>{option.itemCode} · {option.itemName}</td>
                        <td>{numberText(option.quantity)} {option.unit}</td>
                        <td><input className={field} aria-label={`Jumlah fisik ${option.itemName}`} type="number" min="0" step="0.000001" disabled={!entry} value={entry?.physicalQuantity ?? ""} onChange={(event) => setCountEntries((current) => ({ ...current, [option.itemId]: { ...current[option.itemId], physicalQuantity: event.target.value, reason: current[option.itemId]?.reason ?? "" } }))} /></td>
                        <td><input className={field} aria-label={`Alasan ${option.itemName}`} disabled={!entry} value={entry?.reason ?? ""} onChange={(event) => setCountEntries((current) => ({ ...current, [option.itemId]: { ...current[option.itemId], physicalQuantity: current[option.itemId]?.physicalQuantity ?? String(option.quantity), reason: event.target.value } }))} placeholder="Contoh: salah input / hilang / ditemukan" /></td>
                      </tr>;
                    })}
                    {!itemsForLocation.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Tidak ada Item WIP/routing aktif untuk lokasi ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <label className="block max-w-2xl text-sm">Catatan sesi (opsional)<input className={field} value={sessionNotes} onChange={(event) => setSessionNotes(event.target.value)} /></label>
            <button className={button} disabled={busy || !selectedLocationId || selectedCount.length === 0}>{busy ? "Menyimpan opname…" : `Simpan opname ${selectedCount.length ? `(${selectedCount.length} item)` : ""}`}</button>
          </form>

          <article className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="border-b px-5 py-4"><h2 className="font-semibold text-[#1E3A5F]">Riwayat opname WIP</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Sesi</th><th>Waktu</th><th>Lokasi</th><th>Item</th><th>Saldo sistem</th><th>Fisik</th><th>Selisih</th><th>Alasan</th></tr></thead>
                <tbody className="divide-y">
                  {sessions.flatMap((session) => session.lines.map((line) => <tr key={`${session.number}:${line.id}`}>
                    <td className="px-4 py-3">{session.number}</td><td>{new Date(session.countedAt).toLocaleString("id-ID")}</td><td>{session.location.divisi?.nama ?? session.location.name}</td>
                    <td>{line.item ? `${line.item.kode} · ${line.item.nama}` : "Item WIP"}</td><td>{numberText(line.systemQuantity)}</td><td>{numberText(line.physicalQuantity)}</td>
                    <td className={Number(line.difference) < 0 ? "font-semibold text-red-700" : Number(line.difference) > 0 ? "font-semibold text-emerald-700" : ""}>{Number(line.difference) > 0 ? "+" : ""}{numberText(line.difference)}</td>
                    <td>{line.reason || "—"}</td>
                  </tr>))}
                  {!sessions.some((session) => session.lines.length > 0) && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Belum ada sesi opname WIP.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
