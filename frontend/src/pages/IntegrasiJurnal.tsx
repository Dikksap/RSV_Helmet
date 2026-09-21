import { useCallback, useEffect, useState } from "react";
import { getJurnalProducts, type JurnalProduct } from "../api/integrasiJurnal";

const rupiah = (n: number | null) =>
  n === null || n === undefined ? "—" : `Rp${Number(n).toLocaleString("id-ID")}`;

export default function IntegrasiJurnal() {
  const [products, setProducts] = useState<JurnalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await getJurnalProducts());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat produk Jurnal.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">
            Integrasi
          </p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">
            Data Mekari Jurnal
          </h1>
          <p className="mt-2 text-base text-[#6B7280]">
            Produk dari Mekari Jurnal via backend{" "}
            <span className="font-mono text-sm">GET /api/integrasi-jurnal/products</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-[15px] font-medium text-white transition hover:bg-[#16294a] disabled:opacity-40"
        >
          {loading ? "Memuat..." : "Muat Ulang"}
        </button>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="border-b border-slate-100 p-4">
          <h3 className="font-semibold text-[#1E3A5F]">
            Produk Jurnal{" "}
            <span className="font-normal text-xs text-[#6B7280]">· {products.length} produk</span>
          </h3>
        </div>
        {loading ? (
          <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat produk Jurnal...</p>
        ) : products.length === 0 && !error ? (
          <p className="p-6 text-center text-[#6B7280]">Belum ada produk di Jurnal.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                  <th scope="col" className="px-3 py-3 font-semibold">Nama</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Kode</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Kategori</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Satuan</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Stok</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Harga Jual</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-[#F5F7FA]">
                    <td className="px-3 py-2.5 font-medium text-[#1F2937]">{p.name}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-[#6B7280]">
                      {p.product_code || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[#6B7280]">
                      {p.product_categories_string || (p.product_categories ?? []).map((c) => c.name).join(", ") || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">{p.unit?.name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">
                      {p.quantity === null ? "—" : Number(p.quantity).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">
                      {rupiah(p.sell_price_per_unit)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          p.archive
                            ? "bg-slate-100 text-slate-500"
                            : p.active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {p.archive ? "Arsip" : p.active ? "Aktif" : "Nonaktif"}
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
  );
}
