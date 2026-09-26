const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export type StatusProductionOrder = "DRAFT" | "AKTIF" | "SELESAI" | "BATAL";

export interface ProductionOrderListItem {
  id: number;
  nomor: string;
  periode: string;
  label: string | null;
  totalQty: number;
  status: StatusProductionOrder;
  mulaiProduksi: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { items: number };
}

export interface OrderItemVariant {
  id: number;
  kodeVariant: string;
  product: { id: number; nama: string; prefix: string };
  style: { id: number; nama: string };
  color: { id: number; nama: string };
  size: { id: number; nama: string; urutan: number };
}

export interface ProductionOrderItem {
  id: number;
  orderId: number;
  variantId: number;
  qty: number;
  priority: number;
  variant: OrderItemVariant;
}

export interface ProductionOrderRingkasan {
  item: string;
  total: number;
  priority: number;
  persentase: number;
}

export interface ProductionOrderDetail extends Omit<ProductionOrderListItem, "_count"> {
  items: ProductionOrderItem[];
}

export interface ProductionOrderSummary extends ProductionOrderDetail {
  ringkasan: ProductionOrderRingkasan[];
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`);
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function getProductionOrders(): Promise<ProductionOrderListItem[]> {
  return request<ProductionOrderListItem[]>("/production-orders");
}

async function mutate<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data?.message === "string") message = data.message;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function createOrder(
  body: { nomor: string; periode: string; label?: string; status?: StatusProductionOrder },
): Promise<ProductionOrderDetail> {
  return mutate<ProductionOrderDetail>("/production-orders", "POST", body);
}

export async function updateOrder(
  id: number,
  body: { nomor?: string; periode?: string; label?: string | null; status?: StatusProductionOrder; mulaiProduksi?: string | null },
): Promise<ProductionOrderDetail> {
  return mutate<ProductionOrderDetail>(`/production-orders/${id}`, "PUT", body);
}

export async function deleteOrder(id: number): Promise<void> {
  await mutate<unknown>(`/production-orders/${id}`, "DELETE");
}

export async function addOrderItem(
  orderId: number,
  body: { variantId: number; qty: number; priority?: number },
): Promise<ProductionOrderItem> {
  return mutate<ProductionOrderItem>(`/production-orders/${orderId}/items`, "POST", body);
}

export async function updateOrderItem(
  orderId: number,
  itemId: number,
  body: { qty?: number; priority?: number },
): Promise<ProductionOrderItem> {
  return mutate<ProductionOrderItem>(`/production-orders/${orderId}/items/${itemId}`, "PUT", body);
}

export async function deleteOrderItem(orderId: number, itemId: number): Promise<void> {
  await mutate<unknown>(`/production-orders/${orderId}/items/${itemId}`, "DELETE");
}

export async function getProductionOrderSummary(
  id: number,
): Promise<ProductionOrderSummary> {
  return request<ProductionOrderSummary>(`/production-orders/${id}?summary=1`);
}

export interface ProductionCapacity {
  id: number;
  orderId: number;
  stage: string;
  kapasitasWeekday: number;
  kapasitasSabtu: number;
  mulai: string | null;
  selesai: string | null;
  hariKerja: number;
  totalKapasitas: number;
  catatan: string | null;
  urutan: number;
}

export async function getProductionCapacities(
  orderId: number,
): Promise<ProductionCapacity[]> {
  return request<ProductionCapacity[]>(`/production-orders/${orderId}/capacities`);
}

export interface ScheduleRow {
  tanggal: string;
  hari: string;
  size: string;
  jam: number;
  buffing: number;
  baseCoat: number;
  decalSolid: number;
  decalMotif: number;
  topCoat: number;
  perakitan: number;
  qc: number;
  item: string;
  jumlah: number;
  variantId: number;
}

export interface ScheduleStageTake {
  tanggal: string;
  stage: "buffing" | "baseCoat" | "decalSolid" | "decalMotif" | "topCoat" | "perakitan" | "qc";
  variantId: number;
  size: string;
  item: string;
  jumlah: number;
}

export interface ProductionSchedule {
  order: { id: number; nomor: string; periode: string; totalQty: number };
  rows: ScheduleRow[];
  rincian: ScheduleStageTake[];
  meta: {
    dialokasikan: number;
    sisa: number;
    hariProduksi: number;
    prepDays: string[];
    qcDays: string[];
  };
  overrides?: {
    targets: { tanggal: string; stage: string }[];
    allocs: { tanggal: string; variantId: number }[];
  };
}

export type ScheduleStageKey = "buffing" | "baseCoat" | "decalSolid" | "decalMotif" | "topCoat" | "perakitan" | "qc";

export async function getProductionSchedule(orderId: number): Promise<ProductionSchedule> {
  return request<ProductionSchedule>(`/production-orders/${orderId}/schedule`);
}

// qty null = hapus edit (kembali ke angka auto).
export async function saveScheduleTarget(
  orderId: number,
  body: { tanggal: string; stage: ScheduleStageKey; qty: number | null },
): Promise<{ tanggal: string; stage: string; qty: number }[]> {
  return mutate<{ tanggal: string; stage: string; qty: number }[]>(
    `/production-orders/${orderId}/schedule/targets`,
    "PUT",
    body,
  );
}

export async function saveScheduleAlloc(
  orderId: number,
  body: { tanggal: string; variantId: number; qty: number | null; mode?: "set" | "add" },
): Promise<{ tanggal: string; variantId: number; qty: number }[]> {
  return mutate<{ tanggal: string; variantId: number; qty: number }[]>(
    `/production-orders/${orderId}/schedule/allocs`,
    "PUT",
    body,
  );
}

export interface RealisasiRow {
  tanggal: string;
  variantId: number;
  qty: number;
  reject: number;
}

export interface RealisasiStageRow {
  tanggal: string;
  stage: string;
  qty: number;
}

export interface RealisasiData {
  orderId: number;
  realisasi: RealisasiRow[];
  finishgood: RealisasiRow[];
  tahapan: RealisasiStageRow[];
}

export const REALISASI_STAGE_LABEL: Record<string, string> = {
  buffing: "Buffing",
  baseCoat: "Base Coat",
  decalSolid: "Decal Solid",
  decalMotif: "Decal Motif",
  topCoat: "Top Coat",
  perakitan: "Perakitan",
  qc: "QC",
};

export async function getRealisasi(orderId: number, awal?: string, akhir?: string): Promise<RealisasiData> {
  const q = awal && akhir ? `?awal=${awal}&akhir=${akhir}` : "";
  return request<RealisasiData>(`/production-orders/${orderId}/realisasi${q}`);
}

export async function saveRealisasi(
  orderId: number,
  tanggal: string,
  items: { variantId: number; qty: number; reject?: number }[],
  tahapan?: { stage: string; qty: number }[],
): Promise<{ items: RealisasiRow[]; tahapan: RealisasiStageRow[] }> {
  return mutate<{ items: RealisasiRow[]; tahapan: RealisasiStageRow[] }>(
    `/production-orders/${orderId}/realisasi`,
    "PUT",
    tahapan === undefined ? { tanggal, items } : { tanggal, items, tahapan },
  );
}

export async function replaceProductionCapacities(
  orderId: number,
  items: Omit<ProductionCapacity, "id" | "orderId">[],
): Promise<ProductionCapacity[]> {
  const response = await fetch(`${apiUrl}/production-orders/${orderId}/capacities`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }
  return response.json() as Promise<ProductionCapacity[]>;
}
