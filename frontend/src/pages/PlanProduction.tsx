import { useCallback, useEffect, useState } from "react";
import {
  getProductionOrders,
  getProductionOrderSummary,
  getProductionCapacities,
  createOrder,
  deleteOrder,
  type ProductionOrderListItem,
  type ProductionOrderSummary,
  type ProductionCapacity,
  type StatusProductionOrder,
} from "../api/productionOrders";
import MasterTab from "../components/PlanProduction/MasterTab";
import CapacityTab from "../components/PlanProduction/CapacityTab";
import ScheduleTab from "../components/PlanProduction/ScheduleTab";
import SummaryTab from "../components/PlanProduction/SummaryTab";
import { TABS, fmt, STATUS_STYLE, type Tab } from "../components/PlanProduction/utils";

export default function PlanProduction() {
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<ProductionOrderListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ProductionOrderSummary | null>(null);
  const [capacities, setCapacities] = useState<ProductionCapacity[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingCapacities, setLoadingCapacities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [formNomor, setFormNomor] = useState("");
  const [formPeriode, setFormPeriode] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formStatus, setFormStatus] = useState<StatusProductionOrder>("DRAFT");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const loadList = useCallback((selectId?: number) => {
    setLoadingList(true);
    getProductionOrders()
      .then((res) => {
        setOrders(res);
        setError(null);
        if (res.length === 0) setSelectedId(null);
        else if (selectId !== undefined) setSelectedId(selectId);
        else setSelectedId((prev) => (prev === null ? res[0].id : prev));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat production order."))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // silent = sinkronisasi latar tanpa spinner (lepas edit cell).
  const reloadDetail = useCallback(
    (silent = false) => {
      if (selectedId === null) return;
      if (!silent) setLoadingDetail(true);
      getProductionOrderSummary(selectedId)
        .then((res) => {
          setDetail(res);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat detail order."))
        .finally(() => setLoadingDetail(false));
    },
    [selectedId],
  );

  useEffect(() => {
    reloadDetail(false);
  }, [reloadDetail]);

  const reloadCapacities = useCallback(
    (silent = false) => {
      if (tab !== "kapasitas" || selectedId === null) return;
      if (!silent) setLoadingCapacities(true);
      getProductionCapacities(selectedId)
        .then((res) => {
          setCapacities(res);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat kapasitas produksi."))
        .finally(() => setLoadingCapacities(false));
    },
    [tab, selectedId],
  );

  useEffect(() => {
    reloadCapacities(false);
  }, [reloadCapacities]);

  useEffect(() => {
    setDeleteTarget(null);
  }, [selectedId]);

  const submitCreate = async () => {
    if (!formNomor.trim() || !formPeriode.trim()) {
      setCreateError("Nomor dan periode wajib diisi");
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await createOrder({
        nomor: formNomor.trim(),
        periode: formPeriode.trim(),
        label: formLabel.trim() || undefined,
        status: formStatus,
      });
      setCreateOpen(false);
      setFormNomor("");
      setFormPeriode("");
      setFormLabel("");
      setFormStatus("DRAFT");
      loadList(created.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Gagal membuat order");
    } finally {
      setCreateBusy(false);
    }
  };

  const removeOrder = async (id: number) => {
    try {
      await deleteOrder(id);
      setDeleteTarget(null);
      if (id === selectedId) {
        setDetail(null);
        setSelectedId(null);
      }
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus order");
    }
  };

  const pickOrder = (id: number) => {
    setSelectedId(id);
    setTab("master");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">
            Barang Produksi
          </p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">
            Plan Production
          </h1>
          <p className="mt-2 text-base text-[#6B7280]">
            Rencana produksi per periode dari <span className="font-mono text-sm">GET /api/production-orders</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            className="rounded-lg bg-[#00A8E8] px-4 py-2.5 text-[15px] font-medium text-white transition hover:bg-[#0088C0]"
          >
            + Buat Order
          </button>
          <label className="flex items-center gap-2 text-sm font-medium text-[#1F2937]">
            Periode
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              disabled={loadingList || orders.length === 0}
              className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-[15px] focus:outline-2 focus:outline-[#00A8E8] disabled:opacity-40"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nomor} · {o.periode} ({fmt(o.totalQty)} pcs)
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div aria-live="polite" className="space-y-3">
        {loadingList && <p className="animate-pulse text-[15px] text-[#6B7280]">Memuat plan production...</p>}
        {error && (
          <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">
            {error}
          </p>
        )}
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Tab plan production">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={active}
              className={`rounded-lg px-4 py-2.5 text-[15px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#00A8E8] ${
                active
                  ? "bg-[#1E3A5F] text-white"
                  : "bg-white text-[#6B7280] ring-1 ring-slate-200/70 hover:bg-[#F5F7FA] hover:text-[#1F2937]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "orders" && (
        <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <h3 className="font-semibold text-[#1E3A5F]">Daftar Orders ({orders.length})</h3>
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
              className="rounded-lg bg-[#00A8E8] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#0088C0]"
            >
              + Buat Order
            </button>
          </div>
          {loadingList ? (
            <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat orders...</p>
          ) : orders.length === 0 ? (
            <p className="p-6 text-center text-[#6B7280]">Belum ada production order.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {orders.map((o) => (
                <article
                  key={o.id}
                  className={`flex flex-col rounded-xl ring-1 transition hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] ${
                    o.id === selectedId ? "bg-[#00A8E8]/5 ring-2 ring-[#00A8E8]" : "bg-white ring-slate-200/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 p-4 pb-0">
                    <div className="min-w-0">
                      <h4 className="truncate font-mono font-bold text-[#1E3A5F]">{o.nomor}</h4>
                      <p className="truncate text-sm text-[#6B7280]">
                        {o.periode}{o.label ? ` · ${o.label}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLE[o.status]}`}>
                      {o.status}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-4 px-4 pt-3">
                    <p className="text-2xl font-bold tabular-nums text-[#1E3A5F]">{fmt(o.totalQty)}</p>
                    <p className="text-xs uppercase tracking-wide text-[#6B7280]">pcs · {o._count.items} items</p>
                  </div>
                  <div className="mt-auto flex gap-2 p-4 pt-3">
                    {deleteTarget === o.id ? (
                      <>
                        <span className="flex-1 self-center text-sm font-medium text-[#EF4444]">Hapus order ini?</span>
                        <button
                          type="button"
                          onClick={() => void removeOrder(o.id)}
                          className="rounded-lg bg-[#EF4444] px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
                        >
                          Ya
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(null)}
                          className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-medium text-[#1F2937] hover:bg-slate-300"
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => pickOrder(o.id)}
                          className="flex-1 rounded-lg bg-[#1E3A5F] px-3 py-2 text-sm font-medium text-white hover:bg-[#162942]"
                        >
                          Buka
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(o.id)}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-[#6B7280] ring-1 ring-slate-200/70 hover:bg-red-50 hover:text-[#EF4444]"
                        >
                          Hapus
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "jadwal" && <ScheduleTab orderId={selectedId} />}

      {tab === "ringkasan" && <SummaryTab orderId={selectedId} />}

      {tab === "manpower" && (
        <p className="rounded-xl bg-white p-6 text-center text-[#6B7280] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          Halaman Man Power belum tersedia.
        </p>
      )}

      {tab === "kapasitas" && selectedId !== null && (
        <CapacityTab
          orderId={selectedId}
          detail={detail}
          capacities={capacities}
          loading={loadingCapacities}
          onChanged={() => {
            reloadCapacities(true);
            reloadDetail(true);
          }}
        />
      )}

      {tab === "master" && detail && selectedId !== null && (
        <MasterTab orderId={selectedId} detail={detail} loading={loadingDetail} onChanged={() => reloadDetail(true)} />
      )}

      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Buat production order"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[#1E3A5F]">Buat Production Order</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-[#1F2937]">
                Nomor *
                <input
                  value={formNomor}
                  onChange={(e) => setFormNomor(e.target.value)}
                  placeholder="PO-2026-09-01"
                  className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[15px] focus:outline-2 focus:outline-[#00A8E8]"
                />
              </label>
              <label className="block text-sm font-medium text-[#1F2937]">
                Periode *
                <input
                  value={formPeriode}
                  onChange={(e) => setFormPeriode(e.target.value)}
                  placeholder="2026-09"
                  className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[15px] focus:outline-2 focus:outline-[#00A8E8]"
                />
              </label>
              <label className="block text-sm font-medium text-[#1F2937]">
                Label
                <input
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="Produksi September"
                  className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[15px] focus:outline-2 focus:outline-[#00A8E8]"
                />
              </label>
              <label className="block text-sm font-medium text-[#1F2937]">
                Status
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as StatusProductionOrder)}
                  className="mt-1 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[15px] focus:outline-2 focus:outline-[#00A8E8]"
                >
                  {(["DRAFT", "AKTIF", "SELESAI", "BATAL"] as const).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            {createError && (
              <p role="alert" className="mt-3 text-sm text-[#EF4444]">{createError}</p>
            )}
            <p className="mt-3 text-xs text-[#6B7280]">Item variant ditambah lewat tab Master setelah order dibuat.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-[#1F2937] hover:bg-slate-300"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={createBusy}
                onClick={() => void submitCreate()}
                className="rounded-lg bg-[#00A8E8] px-4 py-2 text-sm font-medium text-white hover:bg-[#0088C0] disabled:opacity-50"
              >
                {createBusy ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
