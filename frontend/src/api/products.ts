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

export async function getProducts(): Promise<Product[]> {
  return request<Product[]>("/products");
}

export async function getProduct(id: number): Promise<Product> {
  return request<Product>(`/products/${id}`);
}

export async function createProduct(body: {
  nama: string;
  prefix: string;
}): Promise<Product> {
  return request<Product>("/products", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateProduct(
  id: number,
  body: { nama: string },
): Promise<Product> {
  return request<Product>(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteProduct(id: number): Promise<void> {
  await request<unknown>(`/products/${id}`, { method: "DELETE" });
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
  return request<ProductVariant>(`/products/${productId}/variants`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateProductVariantDate(
  productId: number,
  variantId: number,
  body: { tanggal?: string },
): Promise<ProductVariant> {
  return request<ProductVariant>(
    `/products/${productId}/variants/${variantId}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export async function deleteProductVariant(
  productId: number,
  variantId: number,
): Promise<void> {
  await request<unknown>(`/products/${productId}/variants/${variantId}`, {
    method: "DELETE",
  });
}

export interface VariantProdukParams {
  productId?: number;
  styleId?: number;
  colorId?: number;
  sizeId?: number;
}

export async function getVariantProduk(
  params: VariantProdukParams = {},
): Promise<ProductVariant[]> {
  const searchParams = new URLSearchParams();
  if (params.productId) searchParams.set("productId", String(params.productId));
  if (params.styleId) searchParams.set("styleId", String(params.styleId));
  if (params.colorId) searchParams.set("colorId", String(params.colorId));
  if (params.sizeId) searchParams.set("sizeId", String(params.sizeId));
  const query = searchParams.toString();

  return request<ProductVariant[]>(
    `/variant-produk${query ? `?${query}` : ""}`,
  );
}

export async function getVariantProdukById(id: number): Promise<ProductVariant> {
  return request<ProductVariant>(`/variant-produk/${id}`);
}

export async function createVariantProduk(
  body: CreateVariantBody & { productId: number },
): Promise<ProductVariant> {
  return request<ProductVariant>("/variant-produk", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateVariantProduk(
  id: number,
  body: Partial<CreateVariantBody>,
): Promise<ProductVariant> {
  return request<ProductVariant>(`/variant-produk/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteVariantProduk(id: number): Promise<void> {
  await request<unknown>(`/variant-produk/${id}`, { method: "DELETE" });
}
