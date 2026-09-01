import { useEffect, useRef, useState, type FormEvent } from "react";
import { getScanBarang } from "../api/barang";
import Navbar from "../components/Navbar";

type ScannedItem = {
  id: number;
  kode: string;
  variant: string;
  waktu: string;
};

function ScanQr() {
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const kode = inputValue.trim();

    if (!kode) {
      setError("Kode barang belum diisi.");
      return;
    }

    try {
      const barang = await getScanBarang(kode);
      const alreadyExists = scannedItems.some(
        (item) => item.kode.toLowerCase() === barang.kodeBarang.toLowerCase(),
      );

      if (alreadyExists) {
        setError("Kode barang sudah ada di tabel.");
        setInputValue("");
        inputRef.current?.focus();
        return;
      }

      const variantName =
        barang.variant?.product &&
        barang.variant?.style &&
        barang.variant?.color &&
        barang.variant?.size
          ? `${barang.variant.product.nama} / ${barang.variant.style.nama} / ${barang.variant.color.nama} / ${barang.variant.size.nama}`
          : "-";

      const newItem: ScannedItem = {
        id: barang.id ?? Date.now(),
        kode: barang.kodeBarang,
        variant: variantName,
        waktu: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };

      setScannedItems((prev) => [newItem, ...prev]);
      setInputValue("");
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Kode barang tidak ditemukan.",
      );
    }

    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleGlobalKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const activeTag = target?.tagName;

      if (activeTag && ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) {
        if (target === inputRef.current) {
          return;
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void handleSubmit();
        return;
      }

      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        setInputValue((prev) => prev + event.key);
      }
    };

    window.addEventListener("keydown", handleGlobalKeydown);

    return () => {
      window.removeEventListener("keydown", handleGlobalKeydown);
    };
  }, [handleSubmit, inputValue]);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <Navbar />

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            SCAN QR / INPUT BARANG
          </p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-950">
            Entry Barang
          </h1>
        </header>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Masukkan kode barang atau scan QR"
              autoComplete="off"
              className="h-12 flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-4 text-base text-zinc-900 outline-none transition focus:border-zinc-950 focus:bg-white focus:ring-4 focus:ring-zinc-100"
            />
            <button
              type="submit"
              className="h-12 rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white transition hover:bg-zinc-800"
            >
              Cari
            </button>
          </form>

          {error ? (
            <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
          ) : null}
        </div>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-4">
            <h2 className="text-lg font-black tracking-tight text-zinc-900">
              Daftar Input Terbaru
            </h2>
            <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-bold text-zinc-700">
              {scannedItems.length} item
            </span>
          </div>

          {scannedItems.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-zinc-500">
              Belum ada data yang sesuai dengan kode barang.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-zinc-600">
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider">
                      No
                    </th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider">
                      Kode Barang
                    </th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider">
                      Variant
                    </th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider">
                      Waktu
                    </th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scannedItems.map((item, index) => (
                    <tr
                      key={item.id}
                      className="border-t border-zinc-200 hover:bg-zinc-50"
                    >
                      <td className="px-5 py-3 font-semibold text-zinc-700">
                        {index + 1}
                      </td>
                      <td className="px-5 py-3 font-mono font-bold text-zinc-900">
                        {item.kode}
                      </td>
                      <td className="px-5 py-3 text-zinc-700">
                        {item.variant}
                      </td>
                      <td className="px-5 py-3 text-zinc-600">{item.waktu}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          Ditemukan
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default ScanQr;
