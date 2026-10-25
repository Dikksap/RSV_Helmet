import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export interface ErpLocation {
  id: number;
  code: string;
  name: string;
  type: "WAREHOUSE" | "DIVISION";
  gudangId: number | null;
  divisiId: number | null;
  isActive: boolean;
  gudang?: { id: number; kode: string; name: string } | null;
  divisi?: { id: number; nama: string } | null;
}

export interface ErpBalance {
  itemId: number | null;
  barangId: number | null;
  locationId: number;
  quantity: number;
}

export interface ErpMovement {
  id: number;
  type: string;
  itemId: number | null;
  barangId: number | null;
  item: { id: number; kode: string; nama: string; unit: string } | null;
  barang: { id: number; kodeBarang: string; status: string } | null;
  fromLocation: { id: number; code: string; name: string; type: string } | null;
  toLocation: { id: number; code: string; name: string; type: string } | null;
  quantity: number | string;
}

export type ProductionProcessStage = "BUFFING" | "BASE_COAT" | "DECAL_SOLID" | "DECAL_MOTIF" | "TOP_COAT";

export interface ProductionRouting {
  id: number;
  productVariantId: number;
  version: number;
  bomId: number;
  isActive: boolean;
  productVariant: {
    id: number;
    kodeVariant: string;
    product: { nama: string };
    style: { nama: string };
    color: { nama: string };
    size: { nama: string };
  };
  bom: {
    id: number;
    kode: string | null;
    nama: string;
    version: string;
    isActive: boolean;
    berlakuMulai: string | null;
    berlakuSelesai: string | null;
  };
  stages: Array<{
    id: number;
    stage: ProductionProcessStage;
    sequence: number;
    divisi: { id: number; nama: string };
    inputItem: { id: number; kode: string; nama: string; unit: string | null };
    outputItem: { id: number; kode: string; nama: string; unit: string | null };
  }>;
}

export interface ProductionRoutingInput {
  bomId: number;
  stages: Array<{
    stage: ProductionProcessStage;
    inputItemId: number;
    outputItemId: number;
  }>;
}

export interface Shipment {
  id: number;
  number: string;
  recipientName: string;
  recipientAddress: string;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  createdAt: string;
  fromLocation: { id: number; code: string; name: string; gudangId: number | null };
  lines: Array<{
    id: number;
    barangId: number;
    barang: { id: number; kodeBarang: string; status: string };
    returns: Array<{ id: number; returnId: number; condition: string }>;
  }>;
}

export interface FinishedGoodsReceiptCandidate {
  id: number;
  inspectionNumber: string;
  variantCode: string | null;
  units: Array<{ id: number; kodeBarang: string }>;
}

export interface AvailableFinishedGood {
  id: number;
  kodeBarang: string;
  variant: { kodeVariant: string };
  locationId: number;
}

export interface WipFlowBalance {
  locationId: number;
  locationName: string;
  divisionName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  unit: string;
  stage: ProductionProcessStage | null;
  opening: number;
  inflow: number;
  outflow: number;
  closing: number;
  expectedClosing: number;
}

export interface WipFlowReport {
  period: { from: string; to: string };
  totals: {
    openingBalance: number;
    closingBalance: number;
    productionIn: number;
    productionOut: number;
    transferIn: number;
    transferOut: number;
    qcIn: number;
    qcOut: number;
    repairIn: number;
    repairOut: number;
    adjustmentIn: number;
    adjustmentOut: number;
    shipmentIn: number;
    shipmentOut: number;
    inspected: number;
    passed: number;
    repair: number;
    rejected: number;
    repairAttempted: number;
    repairSucceeded: number;
    repairApproved: number;
    repairFailed: number;
  };
  balances: WipFlowBalance[];
  qualityByStage: Array<{
    stage: string;
    divisionName: string;
    inspected: number;
    passed: number;
    repair: number;
    rejected: number;
  }>;
  repairByDivision: Array<{
    divisionId: number;
    divisionName: string;
    attempted: number;
    repaired: number;
    approved: number;
    failed: number;
  }>;
  movements: Array<{
    id: string;
    type: string;
    quantity: number;
    occurredAt: string;
    sourceType: string;
    sourceId: string;
    reason: string | null;
    item: { kode: string; nama: string; unit: string } | null;
    fromLocation: { name: string; divisi: { nama: string } | null } | null;
    toLocation: { name: string; divisi: { nama: string } | null } | null;
  }>;
  movementCount: number;
  movementsTruncated: boolean;
}

export interface WipStocktakeOption {
  locationId: number;
  locationName: string;
  divisionId: number | null;
  divisionName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  stage: ProductionProcessStage | null;
}

export interface WipStocktakeLine {
  id: number;
  systemQuantity: number | string;
  physicalQuantity: number | string;
  difference: number | string;
  reason: string;
  item: { id: number; kode: string; nama: string; unit: string } | null;
}

export interface WipStocktakeSession {
  id: number;
  number: string;
  countedAt: string;
  notes: string | null;
  location: { id: number; name: string; divisi: { nama: string } | null };
  countedBy: { id: number; name: string };
  lines: WipStocktakeLine[];
}

export interface WipRejectReason {
  id: number;
  name: string;
  isActive: boolean;
  createdBy?: { id: number; name: string };
}

export interface WipRejectOptions {
  reasons: Array<{ id: number; name: string }>;
  divisions: Array<{ id: number; nama: string }>;
  items: Array<{ id: number; kode: string; nama: string; unit: string }>;
}

export interface WipRejectRepairAttempt {
  id: number;
  quantityAttempted: number | string;
  quantityRepaired: number | string;
  notes: string | null;
  performedAt: string;
  performedBy: { id: number; name: string };
  reviewedAt: string | null;
  reviewApproved: boolean | null;
  reviewNotes: string | null;
  reviewedBy: { id: number; name: string } | null;
}

export interface WipReject {
  id: number;
  number: string;
  quantity: number | string;
  quantityRemaining: number | string;
  status: "OPEN" | "IN_PROGRESS" | "WAITING_QC" | "COMPLETED";
  createdAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  item: { id: number; nama: string; kode: string; unit: string };
  reason: { id: number; name: string };
  repairDivision: { id: number; nama: string };
  recordedBy: { id: number; name: string };
  claimedBy: { id: number; name: string } | null;
  attempts: WipRejectRepairAttempt[];
}

export interface QualityDailyOutput {
  divisionId: number;
  divisionName: string;
  itemId: number;
  itemName: string;
  itemCode: string;
  quantity: number;
}

export interface QualityDailyReport {
  date: string;
  normalOutput: QualityDailyOutput[];
  repairOutput: QualityDailyOutput[];
  normalTotal: number;
  repairTotal: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    if (response.status === 401) redirectToLogin();
    let message = `Request gagal (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // Keep the HTTP status message when the server response is not JSON.
    }
    throw new Error(message);
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export const listErpLocations = () => request<ErpLocation[]>("/inventory/locations");
export const getWipRejectOptions = () => request<WipRejectOptions>("/quality/wip-rejects/options");
export const listWipRejectReasons = () => request<WipRejectReason[]>("/quality/wip-rejects/reasons");
export const createWipRejectReason = (name: string) =>
  request<WipRejectReason>("/quality/wip-rejects/reasons", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
export const listWipRejects = (status?: WipReject["status"] | "ACTIVE") =>
  request<WipReject[]>(`/quality/wip-rejects${status ? `?status=${encodeURIComponent(status)}` : ""}`);
export const createWipReject = (body: {
  itemId: number;
  quantity: number;
  reasonId: number;
  repairDivisionId: number;
}) => request<WipReject>("/quality/wip-rejects", { method: "POST", body: JSON.stringify(body) });
export const claimWipReject = (id: number) =>
  request<WipReject>(`/quality/wip-rejects/${id}/claim`, { method: "POST" });
export const createWipRejectRepairAttempt = (id: number, body: {
  quantityAttempted: number;
  quantityRepaired: number;
  notes?: string;
}) => request<WipRejectRepairAttempt>(`/quality/wip-rejects/${id}/attempts`, {
  method: "POST",
  body: JSON.stringify(body),
});
export const reviewWipRejectRepair = (id: number, attemptId: number, body: {
  approved: boolean;
  notes?: string;
}) => request<WipRejectRepairAttempt>(`/quality/wip-rejects/${id}/attempts/${attemptId}/review`, {
  method: "POST",
  body: JSON.stringify(body),
});
export const getQualityDailyReport = (date: string) =>
  request<QualityDailyReport>(`/quality/daily-report?date=${encodeURIComponent(date)}`);
export const listErpBalances = () => request<ErpBalance[]>("/inventory/balances");
export const listErpMovements = () => request<ErpMovement[]>("/inventory/movements?take=100");
export const mapErpWarehouse = (gudangId: number) =>
  request<ErpLocation>("/inventory/locations/warehouse", { method: "POST", body: JSON.stringify({ gudangId }) });
export const mapErpDivision = (divisiId: number) =>
  request<ErpLocation>("/inventory/locations/division", { method: "POST", body: JSON.stringify({ divisiId }) });
export const postErpMovement = (body: {
  itemId: number;
  fromLocationId?: number;
  toLocationId?: number;
  quantity: number;
  idempotencyKey: string;
  reason: string;
}) => request("/inventory/movements", { method: "POST", body: JSON.stringify(body) });

export const listProductionRoutings = () => request<ProductionRouting[]>("/quality/routings");
export const saveProductionRouting = (productVariantId: number, body: ProductionRoutingInput) =>
  request<ProductionRouting>(`/quality/routings/${productVariantId}`, { method: "PUT", body: JSON.stringify(body) });
export const receiveErpFinishedGoods = (body: {
  qualityInspectionLineId: number;
  locationId: number;
  idempotencyKey: string;
  barangIds: number[];
}) => request("/shipments/finished-goods/receive", { method: "POST", body: JSON.stringify(body) });

export const listErpShipments = () => request<Shipment[]>("/shipments?take=100");
export const listFinishedGoodsReceiptCandidates = () =>
  request<FinishedGoodsReceiptCandidate[]>("/shipments/finished-goods/receipt-candidates");
export const listAvailableFinishedGoods = (locationId: number) =>
  request<AvailableFinishedGood[]>(`/shipments/finished-goods/available?locationId=${locationId}`);
export const createErpShipment = (body: {
  fromLocationId: number;
  recipientName: string;
  recipientAddress: string;
  reference?: string;
  idempotencyKey: string;
  barangIds: number[];
}) => request<Shipment>("/shipments", { method: "POST", body: JSON.stringify(body) });
export const postErpShipment = (id: number) =>
  request<Shipment>(`/shipments/${id}/post`, { method: "POST" });
export const cancelErpShipment = (id: number, reason: string) =>
  request<Shipment>(`/shipments/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
export const receiveErpShipmentReturn = (body: {
  shipmentId: number;
  toLocationId: number;
  idempotencyKey: string;
  reason: string;
  lines: Array<{ shipmentLineId: number; condition: string }>;
}) => request("/shipments/returns", { method: "POST", body: JSON.stringify(body) });

export const getWipFlowReport = (params: {
  from: string;
  to: string;
  divisionId?: number;
  itemId?: number;
}) => {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  if (params.divisionId) query.set("divisionId", String(params.divisionId));
  if (params.itemId) query.set("itemId", String(params.itemId));
  return request<WipFlowReport>(`/quality/wip-flow?${query.toString()}`);
};

export const listWipStocktakeOptions = () =>
  request<WipStocktakeOption[]>("/quality/wip-stocktake/options");

export const createWipStocktake = (body: {
  locationId: number;
  notes?: string;
  items: Array<{ itemId: number; physicalQuantity: number; reason: string }>;
}) => request<WipStocktakeSession>("/quality/wip-stocktake", {
  method: "POST",
  body: JSON.stringify(body),
});

export const listWipStocktakes = (page = 1, limit = 20) =>
  request<{ data: WipStocktakeSession[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
    `/quality/wip-stocktake?page=${page}&limit=${limit}`,
  );
