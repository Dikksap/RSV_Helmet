import type { Product, ProductVariant } from "../../api/products";

export interface VariantRow {
  variant: ProductVariant;
  productName: string;
}

export type Tab = "variant" | "produk";

export interface ProductModalState {
  open: boolean;
  editing: Product | null;
  nama: string;
  prefix: string;
  loading: boolean;
}

export interface VariantModalState {
  open: boolean;
  editing: ProductVariant | null;
  productId: string;
  styleId: string;
  colorId: string;
  sizeId: string;
  tanggal: string;
  loading: boolean;
}
