const API_UNAVAILABLE_MESSAGE =
  "Backend tidak dapat dihubungi. Periksa koneksi jaringan dan pastikan server API sedang berjalan.";
export const API_CONNECTION_EVENT = "rsv:api-connection";

export function reportApiConnection(message: string | null): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(API_CONNECTION_EVENT, { detail: message }));
  }
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TypeError) {
    return API_UNAVAILABLE_MESSAGE;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function getHttpErrorMessage(status: number, message?: unknown, fallback?: string): string {
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  if (status >= 500) {
    return "Server mengalami gangguan. Silakan coba kembali beberapa saat lagi.";
  }

  if (status === 404) {
    return "Endpoint tidak ditemukan. Periksa konfigurasi server API.";
  }

  return fallback ?? `Permintaan gagal (HTTP ${status}).`;
}
