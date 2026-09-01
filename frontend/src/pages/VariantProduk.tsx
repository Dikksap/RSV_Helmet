import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxesStacked,
  faCirclePlus,
  faPen,
  faTags,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import {
  createProduct,
  createVariantProduk,
  deleteProduct,
  deleteVariantProduk,
  getProducts,
  updateProduct,
  updateVariantProduk,
  type Product,
  type ProductRelation,
  type ProductSize,
  type ProductVariant,
} from "../api/products";

interface VariantRow {
  variant: ProductVariant;
  productName: string;
}

function flattenVariants(products: Product[]): VariantRow[] {
  return products.flatMap((product) =>
    [...product.variants]
      .sort((a, b) => a.size.urutan - b.size.urutan)
      .map((variant) => ({ variant, productName: product.nama })),
  );
}

function uniqueBy<T extends { id: number }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

const FILTER_RESET = {
  product: "",
  style: "",
  color: "",
  size: "",
};

const inputCls =
  "h-11 rounded-lg border border-brand-border bg-brand-surface px-3 text-sm text-white outline-none transition placeholder:text-brand-grey focus:border-brand-gold focus:ring-1 focus:ring-brand-gold";
const labelCls = "grid gap-1 text-xs font-bold text-brand-grey";

type Tab = "variant" | "produk";

interface ProductModalState {
  open: boolean;
  editing: Product | null;
  nama: string;
  prefix: string;
  loading: boolean;
}

interface VariantModalState {
  open: boolean;
  editing: ProductVariant | null;
  productId: string;
  styleId: string;
  colorId: string;
  sizeId: string;
  tanggal: string;
  loading: boolean;
}

const EMPTY_PRODUCT_MODAL: ProductModalState = {
  open: false,
  editing: null,
  nama: "",
  prefix: "",
  loading: false,
};

const EMPTY_VARIANT_MODAL: VariantModalState = {
  open: false,
  editing: null,
  productId: "",
  styleId: "",
  colorId: "",
  sizeId: "",
  tanggal: "",
  loading: false,
};

function VariantProduk() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("variant");
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [styleFilter, setStyleFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [productModal, setProductModal] =
    useState<ProductModalState>(EMPTY_PRODUCT_MODAL);
  const [variantModal, setVariantModal] =
    useState<VariantModalState>(EMPTY_VARIANT_MODAL);

  const loadProducts = () => {
    getProducts()
      .then((data) => {
        setProducts(data);
        setError(null);
      })
      .catch(() =>
        setError("Variant belum dapat dimuat. Pastikan server API aktif."),
      )
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
  };

  const allRows = useMemo(() => flattenVariants(products), [products]);

  const allStyles = useMemo(
    () =>
      uniqueBy(
        products.flatMap((p) => p.variants.map((v) => v.style)),
      ).sort((a, b) => a.nama.localeCompare(b.nama)),
    [products],
  );

  const allColors = useMemo(
    () =>
      uniqueBy(
        products.flatMap((p) => p.variants.map((v) => v.color)),
      ).sort((a, b) => a.nama.localeCompare(b.nama)),
    [products],
  );

  const allSizes = useMemo(
    () =>
      uniqueBy(
        products.flatMap((p) => p.variants.map((v) => v.size)),
      ).sort((a, b) => a.urutan - b.urutan),
    [products],
  );

  const productOptions = useMemo(
    () =>
      uniqueBy(
        allRows.map((row) => ({
          id: row.variant.productId,
          nama: row.productName,
        })),
      ).sort((a, b) => a.nama.localeCompare(b.nama)),
    [allRows],
  );

  const styleOptions = useMemo(() => {
    const scoped = productFilter
      ? allRows.filter((row) => String(row.variant.productId) === productFilter)
      : allRows;
    return uniqueBy(scoped.map((row) => row.variant.style)).sort((a, b) =>
      a.nama.localeCompare(b.nama),
    );
  }, [allRows, productFilter]);

  const colorOptions = useMemo(() => {
    let scoped = allRows;
    if (productFilter) {
      scoped = scoped.filter(
        (row) => String(row.variant.productId) === productFilter,
      );
    }
    if (styleFilter) {
      scoped = scoped.filter(
        (row) => String(row.variant.styleId) === styleFilter,
      );
    }
    return uniqueBy(scoped.map((row) => row.variant.color)).sort((a, b) =>
      a.nama.localeCompare(b.nama),
    );
  }, [allRows, productFilter, styleFilter]);

  const sizeOptions = useMemo(() => {
    let scoped = allRows;
    if (productFilter) {
      scoped = scoped.filter(
        (row) => String(row.variant.productId) === productFilter,
      );
    }
    if (styleFilter) {
      scoped = scoped.filter(
        (row) => String(row.variant.styleId) === styleFilter,
      );
    }
    if (colorFilter) {
      scoped = scoped.filter(
        (row) => String(row.variant.colorId) === colorFilter,
      );
    }
    return uniqueBy(scoped.map((row) => row.variant.size)).sort(
      (a, b) => a.urutan - b.urutan,
    );
  }, [allRows, productFilter, styleFilter, colorFilter]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allRows
      .filter((row) => {
        const { variant } = row;
        if (productFilter && String(variant.productId) !== productFilter)
          return false;
        if (styleFilter && String(variant.styleId) !== styleFilter)
          return false;
        if (colorFilter && String(variant.colorId) !== colorFilter)
          return false;
        if (sizeFilter && String(variant.sizeId) !== sizeFilter) return false;
        if (!query) return true;
        const values = [
          variant.kodeVariant ?? "",
          row.productName,
          variant.style.nama,
          variant.color.nama,
          variant.size.nama,
        ];
        return values.some((value) => value.toLowerCase().includes(query));
      })
      .sort(
        (a, b) =>
          a.productName.localeCompare(b.productName) ||
          a.variant.size.urutan - b.variant.size.urutan,
      );
  }, [allRows, search, productFilter, styleFilter, colorFilter, sizeFilter]);

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(productFilter) ||
    Boolean(styleFilter) ||
    Boolean(colorFilter) ||
    Boolean(sizeFilter);

  const handleResetFilters = () => {
    setSearch("");
    setProductFilter(FILTER_RESET.product);
    setStyleFilter(FILTER_RESET.style);
    setColorFilter(FILTER_RESET.color);
    setSizeFilter(FILTER_RESET.size);
  };

  const totalVarian = allRows.length;

  const openCreateProduct = () => {
    setProductModal({ ...EMPTY_PRODUCT_MODAL, open: true });
  };

  const openEditProduct = (product: Product) => {
    setProductModal({
      open: true,
      editing: product,
      nama: product.nama,
      prefix: product.prefix,
      loading: false,
    });
  };

  const openCreateVariant = () => {
    setVariantModal({ ...EMPTY_VARIANT_MODAL, open: true });
  };

  const openEditVariant = (variant: ProductVariant) => {
    setVariantModal({
      open: true,
      editing: variant,
      productId: String(variant.productId),
      styleId: String(variant.styleId),
      colorId: String(variant.colorId),
      sizeId: String(variant.sizeId),
      tanggal: variant.tanggal ? variant.tanggal.slice(0, 10) : "",
      loading: false,
    });
  };

  const submitProduct = async () => {
    if (!productModal.nama.trim()) return;
    setProductModal((m) => ({ ...m, loading: true }));
    try {
      if (productModal.editing) {
        await updateProduct(productModal.editing.id, {
          nama: productModal.nama.trim(),
        });
        flash("Produk berhasil diperbarui.");
      } else {
        await createProduct({
          nama: productModal.nama.trim(),
          prefix: productModal.prefix.trim(),
        });
        flash("Produk berhasil ditambahkan.");
      }
      setProductModal(EMPTY_PRODUCT_MODAL);
      loadProducts();
    } catch (e) {
      setProductModal((m) => ({ ...m, loading: false }));
      window.alert(
        e instanceof Error ? e.message : "Gagal menyimpan produk.",
      );
    }
  };

  const deleteProductHandler = async (product: Product) => {
    const ok = window.confirm(
      `Hapus produk "${product.nama}" beserta seluruh variannya?`,
    );
    if (!ok) return;
    try {
      await deleteProduct(product.id);
      flash("Produk dihapus.");
      loadProducts();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal menghapus produk.");
    }
  };

  const submitVariant = async () => {
    const productId = Number(variantModal.productId);
    const styleId = Number(variantModal.styleId);
    const colorId = Number(variantModal.colorId);
    const sizeId = Number(variantModal.sizeId);
    if (!productId || !styleId || !colorId || !sizeId) return;
    setVariantModal((m) => ({ ...m, loading: true }));
    const tanggal = variantModal.tanggal || undefined;
    try {
      if (variantModal.editing) {
        await updateVariantProduk(variantModal.editing.id, {
          styleId,
          colorId,
          sizeId,
          tanggal,
        });
        flash("Variant berhasil diperbarui.");
      } else {
        await createVariantProduk({ productId, styleId, colorId, sizeId, tanggal });
        flash("Variant berhasil ditambahkan.");
      }
      setVariantModal(EMPTY_VARIANT_MODAL);
      loadProducts();
    } catch (e) {
      setVariantModal((m) => ({ ...m, loading: false }));
      window.alert(
        e instanceof Error ? e.message : "Gagal menyimpan variant.",
      );
    }
  };

  const deleteVariantHandler = async (variant: ProductVariant) => {
    const ok = window.confirm(
      `Hapus variant ${variant.kodeVariant ?? "#" + variant.id}?`,
    );
    if (!ok) return;
    try {
      await deleteVariantProduk(variant.id);
      flash("Variant dihapus.");
      loadProducts();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal menghapus variant.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">
            Product Inventory / Variant
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Variant Produk
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-grey">
            Daftar seluruh produk beserta varian (style, warna, dan ukuran).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateProduct}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-4 py-2.5 text-sm font-bold text-brand-grey-light transition hover:border-brand-gold hover:text-brand-gold"
          >
            <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" />
            Produk
          </button>
          <button
            type="button"
            onClick={openCreateVariant}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold transition hover:bg-brand-gold hover:text-brand-black"
          >
            <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" />
            Variant
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-brand-border bg-brand-surface-card p-1">
          <button
            type="button"
            onClick={() => setTab("variant")}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition ${
              tab === "variant"
                ? "bg-brand-gold text-brand-black"
                : "text-brand-grey hover:text-white"
            }`}
          >
            <FontAwesomeIcon icon={faTags} className="h-4 w-4" />
            Variant
          </button>
          <button
            type="button"
            onClick={() => setTab("produk")}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition ${
              tab === "produk"
                ? "bg-brand-gold text-brand-black"
                : "text-brand-grey hover:text-white"
            }`}
          >
            <FontAwesomeIcon icon={faBoxesStacked} className="h-4 w-4" />
            Produk
          </button>
        </div>
        {tab === "variant" && (
          <span className="w-fit rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-gold">
            {totalVarian} total varian
          </span>
        )}
        {tab === "produk" && (
          <span className="w-fit rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-gold">
            {products.length} total produk
          </span>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-brand-grey">Memuat variant produk...</p>
      )}
      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </p>
      )}

      {!isLoading && !error && tab === "variant" && (
        <section aria-label="Daftar variant produk" className="space-y-5">
          <div className="rounded-2xl border border-brand-border bg-brand-surface-card p-5">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <input
                type="search"
                className={inputCls}
                placeholder="Cari kode variant..."
                aria-label="Cari variant"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <label className={labelCls}>
                <span>Produk</span>
                <select
                  className={inputCls}
                  aria-label="Filter produk"
                  value={productFilter}
                  onChange={(event) => {
                    setProductFilter(event.target.value);
                    setStyleFilter("");
                    setColorFilter("");
                    setSizeFilter("");
                  }}
                >
                  <option value="">Semua</option>
                  {productOptions.map((option) => (
                    <option key={option.id} value={String(option.id)}>
                      {option.nama}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelCls}>
                <span>Style</span>
                <select
                  className={inputCls}
                  aria-label="Filter style"
                  value={styleFilter}
                  onChange={(event) => {
                    setStyleFilter(event.target.value);
                    setColorFilter("");
                    setSizeFilter("");
                  }}
                >
                  <option value="">Semua</option>
                  {styleOptions.map((option) => (
                    <option key={option.id} value={String(option.id)}>
                      {option.nama}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelCls}>
                <span>Warna</span>
                <select
                  className={inputCls}
                  aria-label="Filter warna"
                  value={colorFilter}
                  onChange={(event) => {
                    setColorFilter(event.target.value);
                    setSizeFilter("");
                  }}
                >
                  <option value="">Semua</option>
                  {colorOptions.map((option) => (
                    <option key={option.id} value={String(option.id)}>
                      {option.nama}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className={labelCls}>
                <span>Ukuran</span>
                <select
                  className={inputCls}
                  aria-label="Filter ukuran"
                  value={sizeFilter}
                  onChange={(event) => setSizeFilter(event.target.value)}
                >
                  <option value="">Semua</option>
                  {sizeOptions.map((option) => (
                    <option key={option.id} value={String(option.id)}>
                      {option.nama}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelCls}>
                <span className="text-transparent">Aksi</span>
                <button
                  type="button"
                  className="h-11 rounded-lg border border-brand-border bg-brand-surface px-4 text-sm font-bold text-brand-grey-light transition hover:border-brand-gold hover:bg-brand-gold hover:text-brand-black disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-brand-border disabled:hover:bg-brand-surface disabled:hover:text-brand-grey-light"
                  onClick={handleResetFilters}
                  disabled={!hasActiveFilters}
                >
                  Reset filter
                </button>
              </label>
              <span
                className="flex items-end pb-2 text-xs font-medium text-brand-grey"
                aria-live="polite"
              >
                Menampilkan {rows.length} dari {totalVarian} varian
              </span>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-2xl border border-brand-border bg-brand-surface-card p-8 text-center text-sm italic text-brand-grey">
              {hasActiveFilters
                ? "Tidak ada varian yang cocok dengan filter."
                : "Variant belum tersedia. Klik tombol Variant untuk menambah."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] border-collapse text-left">
                  <thead className="bg-brand-surface/40 text-brand-grey">
                    <tr>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">
                        Kode Variant
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">
                        Produk
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">
                        Style
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">
                        Warna
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">
                        Ukuran
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">
                        Tanggal
                      </th>
                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {rows.map(({ variant, productName }) => (
                      <tr
                        key={variant.id}
                        className="text-sm transition-colors hover:bg-brand-surface/60"
                      >
                        <td className="px-5 py-4">
                          <strong className="font-mono text-sm font-bold text-brand-gold">
                            {variant.kodeVariant ?? "-"}
                          </strong>
                        </td>
                        <td className="px-5 py-4 font-semibold text-white">
                          {productName}
                        </td>
                        <td className="px-5 py-4 text-brand-grey-light">
                          {variant.style.nama}
                        </td>
                        <td className="px-5 py-4 text-brand-grey-light">
                          {variant.color.nama}
                        </td>
                        <td className="px-5 py-4 text-brand-grey-light">
                          {variant.size.nama}
                        </td>
                        <td className="px-5 py-4 text-brand-grey">
                          {variant.tanggal
                            ? new Date(variant.tanggal).toLocaleDateString(
                                "id-ID",
                              )
                            : "-"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Edit variant"
                              onClick={() => openEditVariant(variant)}
                              className="rounded-lg p-2 text-brand-grey transition hover:bg-brand-gold/10 hover:text-brand-gold"
                            >
                              <FontAwesomeIcon icon={faPen} className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Hapus variant"
                              onClick={() => deleteVariantHandler(variant)}
                              className="rounded-lg p-2 text-brand-grey transition hover:bg-rose-500/10 hover:text-rose-400"
                            >
                              <FontAwesomeIcon
                                icon={faTrash}
                                className="h-4 w-4"
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {!isLoading && !error && tab === "produk" && (
        <section aria-label="Daftar produk" className="space-y-5">
          {products.length === 0 ? (
            <p className="rounded-2xl border border-brand-border bg-brand-surface-card p-8 text-center text-sm italic text-brand-grey">
              Produk belum tersedia. Klik tombol Produk untuk menambah.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead className="bg-brand-surface/40 text-brand-grey">
                    <tr>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">
                        Produk
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">
                        Prefix
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">
                        Jumlah Variant
                      </th>
                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {products
                      .slice()
                      .sort((a, b) => a.nama.localeCompare(b.nama))
                      .map((product) => (
                        <tr
                          key={product.id}
                          className="text-sm transition-colors hover:bg-brand-surface/60"
                        >
                          <td className="px-5 py-4 font-semibold text-white">
                            {product.nama}
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-mono text-brand-gold">
                              {product.prefix}
                            </span>
                          </td>
                          <td className="px-5 py-4 tabular-nums text-brand-grey-light">
                            {product.variants.length}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title="Edit produk"
                                onClick={() => openEditProduct(product)}
                                className="rounded-lg p-2 text-brand-grey transition hover:bg-brand-gold/10 hover:text-brand-gold"
                              >
                                <FontAwesomeIcon
                                  icon={faPen}
                                  className="h-4 w-4"
                                />
                              </button>
                              <button
                                type="button"
                                title="Hapus produk"
                                onClick={() => deleteProductHandler(product)}
                                className="rounded-lg p-2 text-brand-grey transition hover:bg-rose-500/10 hover:text-rose-400"
                              >
                                <FontAwesomeIcon
                                  icon={faTrash}
                                  className="h-4 w-4"
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {productModal.open && (
        <Modal
          title={productModal.editing ? "Edit Produk" : "Tambah Produk"}
          onClose={() => setProductModal(EMPTY_PRODUCT_MODAL)}
        >
          <div className="space-y-4">
            <label className={labelCls}>
              <span>Nama Produk</span>
              <input
                className={inputCls}
                placeholder="cth: Full Face"
                value={productModal.nama}
                onChange={(e) =>
                  setProductModal((m) => ({ ...m, nama: e.target.value }))
                }
              />
            </label>
            <label className={labelCls}>
              <span>Prefix</span>
              <input
                className={inputCls}
                placeholder="cth: FF"
                disabled={Boolean(productModal.editing)}
                value={productModal.prefix}
                onChange={(e) =>
                  setProductModal((m) => ({ ...m, prefix: e.target.value }))
                }
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setProductModal(EMPTY_PRODUCT_MODAL)}
                className="rounded-lg border border-brand-border bg-brand-surface px-4 py-2.5 text-sm font-bold text-brand-grey-light transition hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  productModal.loading || !productModal.nama.trim()
                }
                onClick={submitProduct}
                className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold transition hover:bg-brand-gold hover:text-brand-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {productModal.loading
                  ? "Menyimpan..."
                  : productModal.editing
                    ? "Simpan Perubahan"
                    : "Tambah Produk"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {variantModal.open && (
        <Modal
          title={variantModal.editing ? "Edit Variant" : "Tambah Variant"}
          onClose={() => setVariantModal(EMPTY_VARIANT_MODAL)}
        >
          <div className="space-y-4">
            <label className={labelCls}>
              <span>Produk</span>
              <select
                className={inputCls}
                value={variantModal.productId}
                onChange={(e) =>
                  setVariantModal((m) => ({ ...m, productId: e.target.value }))
                }
              >
                <option value="">Pilih produk</option>
                {products
                  .slice()
                  .sort((a, b) => a.nama.localeCompare(b.nama))
                  .map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.nama}
                    </option>
                  ))}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <SelectRelationOption
                label="Style"
                value={variantModal.styleId}
                options={allStyles}
                onChange={(v) =>
                  setVariantModal((m) => ({ ...m, styleId: v }))
                }
              />
              <SelectRelationOption
                label="Warna"
                value={variantModal.colorId}
                options={allColors}
                onChange={(v) =>
                  setVariantModal((m) => ({ ...m, colorId: v }))
                }
              />
              <SelectSizeOption
                label="Ukuran"
                value={variantModal.sizeId}
                options={allSizes}
                onChange={(v) =>
                  setVariantModal((m) => ({ ...m, sizeId: v }))
                }
              />
            </div>
            <label className={labelCls}>
              <span>Tanggal (opsional)</span>
              <input
                type="date"
                className={inputCls}
                value={variantModal.tanggal}
                onChange={(e) =>
                  setVariantModal((m) => ({ ...m, tanggal: e.target.value }))
                }
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setVariantModal(EMPTY_VARIANT_MODAL)}
                className="rounded-lg border border-brand-border bg-brand-surface px-4 py-2.5 text-sm font-bold text-brand-grey-light transition hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  variantModal.loading ||
                  !variantModal.productId ||
                  !variantModal.styleId ||
                  !variantModal.colorId ||
                  !variantModal.sizeId
                }
                onClick={submitVariant}
                className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold transition hover:bg-brand-gold hover:text-brand-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {variantModal.loading
                  ? "Menyimpan..."
                  : variantModal.editing
                    ? "Simpan Perubahan"
                    : "Tambah Variant"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-brand-grey transition hover:text-white"
            aria-label="Tutup"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SelectRelationOption({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ProductRelation[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={labelCls}>
      <span>{label}</span>
      <select
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Pilih</option>
        {options.map((option) => (
          <option key={option.id} value={String(option.id)}>
            {option.nama}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectSizeOption({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ProductSize[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={labelCls}>
      <span>{label}</span>
      <select
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Pilih</option>
        {options.map((option) => (
          <option key={option.id} value={String(option.id)}>
            {option.nama}
          </option>
        ))}
      </select>
    </label>
  );
}

export default VariantProduk;
