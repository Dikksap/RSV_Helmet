import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export interface SumberWipInfo {
  divisiId: number;
  divisiNama: string;
  saldo: number;
}

export interface SumberWipResponse {
  item: {
    id: number;
    kode: string;
    nama: string;
    unit: string;
    jenis: string;
    divisiId?: number | null;
    divisi?: { id: number; nama: string } | null;
  };
  sumber: SumberWipInfo[];
}

export interface WipTransferPayload {
  divisiAsalId: number;
  divisiTujuanId: number;
  items: Array<{ itemId: number; jumlah: number }>;
  keterangan?: string;
  autoApprove?: boolean;
}

export interface WipAdjustPayload {
  divisiId: number;
  itemId: number;
  jumlah: number;
  keterangan?: string;
}

export async function fetchSumberWip(itemId: number): Promise<SumberWipResponse> {
  const response = await fetch(`${apiUrl}/wip-transfer/stok-sumber?itemId=${itemId}`, {
    headers: { ...authHeaders() },
  });
  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Sesi telah berakhir");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? "Gagal mengambil data sumber WIP");
  }
  return response.json();
}

export async function executeWipTransfer(payload: WipTransferPayload): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(`${apiUrl}/wip-transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Sesi telah berakhir");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message ?? "Gagal memproses transfer WIP");
  }
  return body;
}

export async function executeWipAdjust(payload: WipAdjustPayload): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(`${apiUrl}/wip-transfer/adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Sesi telah berakhir");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message ?? "Gagal menambahkan saldo WIP");
  }
  return body;
}

