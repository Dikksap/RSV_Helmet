import type { ProductModalState, VariantModalState } from "./types";

export const FILTER_RESET = {
  product: "",
  style: "",
  color: "",
  size: "",
};

export const inputCls =
  "h-11 rounded-lg border border-brand-border bg-brand-surface px-3 text-sm text-white outline-none transition placeholder:text-brand-grey focus:border-brand-gold focus:ring-1 focus:ring-brand-gold";

export const labelCls = "grid gap-1 text-xs font-bold text-brand-grey";

export const EMPTY_PRODUCT_MODAL: ProductModalState = {
  open: false,
  editing: null,
  nama: "",
  prefix: "",
  loading: false,
};

export const EMPTY_VARIANT_MODAL: VariantModalState = {
  open: false,
  editing: null,
  productId: "",
  styleId: "",
  colorId: "",
  sizeId: "",
  tanggal: "",
  loading: false,
};
