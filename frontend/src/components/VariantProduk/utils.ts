import type { Product } from "../../api/products";
import type { VariantRow } from "./types";

export function flattenVariants(products: Product[]): VariantRow[] {
  return products.flatMap((product) =>
    [...product.variants]
      .sort((a, b) => a.size.urutan - b.size.urutan)
      .map((variant) => ({ variant, productName: product.nama })),
  );
}

export function uniqueBy<T extends { id: number }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
