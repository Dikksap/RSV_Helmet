const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface ProductRelation {
  id: number;
  nama: string;
}

export interface ProductSize extends ProductRelation {
  urutan: number;
}

export interface ProductVariant {
  id: number;
  kodeVariant?: string;
  productId: number;
  styleId: number;
  colorId: number;
  sizeId: number;
  tanggal: string;
  createdAt: string;
  updatedAt: string;
  style: ProductRelation;
  color: ProductRelation;
  size: ProductSize;
}

export interface Product {
  id: number;
  nama: string;
  prefix: string;
  createdAt: string;
  updatedAt: string;
  variants: ProductVariant[];
}
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {

  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.message === "string") message = body.message;
      else if (typeof body?.detail === "string") message = body.detail;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// Cache list/detail produk di localStorage (TTL 5 menit) biar hemat hit API.
// Setiap mutasi produk/variant langsung bust agar tak basi.
const LS_PREFIX = "rsv:cache:";
const PRODUCTS_TTL = 5 * 60 * 1000;

function lsGet<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw) as { ts: number; data: T };
    if (Date.now() - ts > ttl) {
      localStorage.removeItem(LS_PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function lsSet(key: string, data: unknown): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    /* storage penuh/nonaktif: abaikan */
  }
}

function lsBust(prefix: string): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(LS_PREFIX + prefix)) localStorage.removeItem(k);
    }
  } catch {
    /* abaikan */
  }
}

export function bustProductCache(): void {
  lsBust("products");
}

export async function getProducts(force = false): Promise<Product[]> {
  if (!force) {
    const hit = lsGet<Product[]>("products", PRODUCTS_TTL);
    if (hit) return hit;
  }
  const data = await request<Product[]>("/products");
  lsSet("products", data);
  return data;
}

export async function getProduct(id: number, force = false): Promise<Product> {
  if (!force) {
    const hit = lsGet<Product>(`products/${id}`, PRODUCTS_TTL);
    if (hit) return hit;
  }
  const data = await request<Product>(`/products/${id}`);
  lsSet(`products/${id}`, data);
  return data;
}

export async function createProduct(body: {
  nama: string;
  prefix: string;
}): Promise<Product> {
  const data = await request<Product>("/products", {
    method: "POST",
    body: JSON.stringify(body),
  });
  lsBust("products");
  return data;
}

export async function updateProduct(
  id: number,
  body: { nama: string },
): Promise<Product> {
  const data = await request<Product>(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  lsBust("products");
  return data;
}

export async function deleteProduct(id: number): Promise<void> {
  await request<unknown>(`/products/${id}`, { method: "DELETE" });
  lsBust("products");
}

export interface CreateVariantBody {
  styleId: number;
  colorId: number;
  sizeId: number;
  tanggal?: string;
}

export async function getProductVariants(
  productId: number,
): Promise<ProductVariant[]> {
  return request<ProductVariant[]>(`/products/${productId}/variants`);
}

export async function createProductVariant(
  productId: number,
  body: CreateVariantBody,
): Promise<ProductVariant> {
  const data = await request<ProductVariant>(`/products/${productId}/variants`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  lsBust("products");
  return data;
}

export async function updateProductVariantDate(
  productId: number,
  variantId: number,
  body: { tanggal?: string },
): Promise<ProductVariant> {
  const data = await request<ProductVariant>(
    `/products/${productId}/variants/${variantId}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  lsBust("products");
  return data;
}

export async function deleteProductVariant(
  productId: number,
  variantId: number,
): Promise<void> {
  await request<unknown>(`/products/${productId}/variants/${variantId}`, {
    method: "DELETE",
  });
  lsBust("products");
}

export interface VariantProdukParams {
  productId?: number;
  styleId?: number;
  colorId?: number;
  sizeId?: number;
}

// Bentuk aktual GET /api/variant-produk: flat row dari ViewVariantProduk,
// BUKAN ProductVariant nested.
export interface VariantProdukRow {
  id: number;
  kodeVariant: string;
  productId: number;
  namaProduk: string;
  styleId: number;
  namaStyle: string;
  colorId: number;
  namaColor: string;
  sizeId: number;
  namaSize: string;
  urutanSize: number;
  tanggal: string;
}

export async function getVariantProduk(
  params: VariantProdukParams = {},
): Promise<VariantProdukRow[]> {
  const searchParams = new URLSearchParams();
  if (params.productId) searchParams.set("productId", String(params.productId));
  if (params.styleId) searchParams.set("styleId", String(params.styleId));
  if (params.colorId) searchParams.set("colorId", String(params.colorId));
  if (params.sizeId) searchParams.set("sizeId", String(params.sizeId));
  const query = searchParams.toString();

  return request<VariantProdukRow[]>(
    `/variant-produk${query ? `?${query}` : ""}`,
  );
}

export async function getVariantProdukById(id: number): Promise<VariantProdukRow> {
  return request<VariantProdukRow>(`/variant-produk/${id}`);
}

export async function createVariantProduk(
  body: CreateVariantBody & { productId: number },
): Promise<ProductVariant> {
  const data = await request<ProductVariant>("/variant-produk", {
    method: "POST",
    body: JSON.stringify(body),
  });
  lsBust("products");
  return data;
}

export async function updateVariantProduk(
  id: number,
  body: Partial<CreateVariantBody>,
): Promise<ProductVariant> {
  const data = await request<ProductVariant>(`/variant-produk/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  lsBust("products");
  return data;
}

export async function deleteVariantProduk(id: number): Promise<void> {
  await request<unknown>(`/variant-produk/${id}`, { method: "DELETE" });
  lsBust("products");
}
