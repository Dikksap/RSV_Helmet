const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface JurnalProduct {
  id: number;
  name: string;
  product_code: string | null;
  description: string | null;
  active: boolean;
  archive: boolean;
  track_inventory: boolean;
  quantity: string | null;
  unit: { id: number; name: string } | null;
  product_categories: { id: number; name: string }[] | null;
  product_categories_string: string | null;
  buy_price_per_unit: number | null;
  sell_price_per_unit: number | null;
}

export async function getJurnalProducts(includeArchive = false): Promise<JurnalProduct[]> {
  const q = includeArchive ? "" : "?include_archive=false";
  const response = await fetch(`${apiUrl}/integrasi-jurnal/products${q}`);
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
  const data = (await response.json()) as { products?: JurnalProduct[] };
  return data.products ?? [];
}
