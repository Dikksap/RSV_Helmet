import type { ProductModalState, VariantModalState } from "./types";

export const FILTER_RESET = {
  product: "",
  style: "",
  color: "",
  size: "",
};

export const inputCls =
  "h-12 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-[15px] text-[#1F2937] outline-none transition duration-200 ease placeholder:text-[#6B7280]/70 focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20 disabled:opacity-50";

export const labelCls = "grid gap-1 text-sm font-medium text-[#1F2937]";

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
