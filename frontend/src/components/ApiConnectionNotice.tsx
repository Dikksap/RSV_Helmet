import { useEffect, useState } from "react";
import { API_CONNECTION_EVENT } from "../api/errors";

export default function ApiConnectionNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleConnection = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setMessage(typeof detail === "string" && detail ? detail : null);
    };

    window.addEventListener(API_CONNECTION_EVENT, handleConnection);
    return () => window.removeEventListener(API_CONNECTION_EVENT, handleConnection);
  }, []);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-3 top-3 z-[100] mx-auto flex max-w-xl items-start gap-3 rounded-xl border border-red-200 bg-white p-4 text-sm text-red-800 shadow-lg sm:inset-x-auto"
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={() => setMessage(null)}
        aria-label="Tutup pemberitahuan koneksi"
        className="rounded px-1 text-lg leading-none text-red-600 hover:bg-red-50"
      >
        ×
      </button>
    </div>
  );
}
