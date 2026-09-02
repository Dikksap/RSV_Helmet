import { useEffect, useMemo, useState } from "react";
import {
  createProduct,
  createProductVariant,
  deleteProduct,
  deleteProductVariant,
  getProducts,
  updateProduct,
  updateProductVariantDate,
  type Product,
  type ProductVariant,
} from "../api/products";
import { getStyles, getColors, getSizes, type MasterStyle, type MasterColor, type MasterSize } from "../api/masterData";
import { VariantHeader } from "../components/VariantProduk/VariantHeader";
import { VariantTabs } from "../components/VariantProduk/VariantTabs";
import { VariantFilters } from "../components/VariantProduk/VariantFilters";
import { VariantTable } from "../components/VariantProduk/VariantTable";
import { ProductTable } from "../components/VariantProduk/ProductTable";
import { ProductModal } from "../components/VariantProduk/ProductModal";
import { VariantModal } from "../components/VariantProduk/VariantModal";
import { VariantImportModal } from "../components/VariantProduk/VariantImportModal";
import { EMPTY_PRODUCT_MODAL, EMPTY_VARIANT_MODAL, FILTER_RESET } from "../components/VariantProduk/constants";
import { flattenVariants, uniqueBy } from "../components/VariantProduk/utils";
import type { ProductModalState, Tab, VariantModalState } from "../components/VariantProduk/types";

/**
 * CRUD implementation sesuai dokumen API:
 *  GET    /api/products                       -> getProducts()
 *  GET    /api/products/:id                   -> getProduct() (unused di list, tapi tersedia)
 *  POST   /api/products                       -> createProduct({nama,prefix})
 *  PUT    /api/products/:id                   -> updateProduct(id,{nama})
 *  DELETE /api/products/:id                   -> deleteProduct(id)
 *  GET    /api/products/:id/variants          -> getProductVariants(productId) (data sudah include di GET /products)
 *  POST   /api/products/:id/variants          -> createProductVariant(productId,{styleId,colorId,sizeId,tanggal})
 *  PATCH  /api/products/:id/variants/:variantId -> updateProductVariantDate(productId,variantId,{tanggal})
 *  DELETE /api/products/:id/variants/:variantId -> deleteProductVariant(productId,variantId)
 *
 * Side-effects Cache & WebSocket ditangani backend (Redis TTL 60s, broadcast product.created etc)
 * Error mapping: 400 validasi, 404 tidak ditemukan, 409 duplicate kombinasi, 500 server
 */

function VariantProduk() {
  const [products, setProducts] = useState<Product[]>([]);
  const [masterStyles, setMasterStyles] = useState<MasterStyle[]>([]);
  const [masterColors, setMasterColors] = useState<MasterColor[]>([]);
  const [masterSizes, setMasterSizes] = useState<MasterSize[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("variant");
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [styleFilter, setStyleFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [productModal, setProductModal] = useState<ProductModalState>(EMPTY_PRODUCT_MODAL);
  const [variantModal, setVariantModal] = useState<VariantModalState>(EMPTY_VARIANT_MODAL);
  const [importOpen, setImportOpen] = useState(false);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const [data, s, c, z] = await Promise.all([
        getProducts(), // GET /api/products — cache Redis products:all 60s
        getStyles().catch(() => [] as MasterStyle[]),
        getColors().catch(() => [] as MasterColor[]),
        getSizes().catch(() => [] as MasterSize[]),
      ]);
      setProducts(data);
      setMasterStyles(s);
      setMasterColors(c);
      setMasterSizes(z);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Variant belum dapat dimuat. Pastikan server API aktif.");
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void loadProducts();
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
  };

  const allRows = useMemo(() => flattenVariants(products), [products]);

  // pakai master data asli jika tersedia, fallback ke derived dari variants (untuk filter)
  const allStyles = useMemo(
    () => (masterStyles.length > 0 ? [...masterStyles].sort((a, b) => a.nama.localeCompare(b.nama)) : uniqueBy(products.flatMap((p) => p.variants.map((v) => v.style))).sort((a, b) => a.nama.localeCompare(b.nama))),
    [masterStyles, products],
  );
  const allColors = useMemo(
    () => (masterColors.length > 0 ? [...masterColors].sort((a, b) => a.nama.localeCompare(b.nama)) : uniqueBy(products.flatMap((p) => p.variants.map((v) => v.color))).sort((a, b) => a.nama.localeCompare(b.nama))),
    [masterColors, products],
  );
  const allSizes = useMemo(
    () => (masterSizes.length > 0 ? [...masterSizes].sort((a, b) => a.urutan - b.urutan) : uniqueBy(products.flatMap((p) => p.variants.map((v) => v.size))).sort((a, b) => a.urutan - b.urutan)),
    [masterSizes, products],
  );

  const productOptions = useMemo(
    () => uniqueBy(allRows.map((row) => ({ id: row.variant.productId, nama: row.productName }))).sort((a, b) => a.nama.localeCompare(b.nama)),
    [allRows],
  );

  const styleOptions = useMemo(() => {
    const scoped = productFilter ? allRows.filter((row) => String(row.variant.productId) === productFilter) : allRows;
    return uniqueBy(scoped.map((row) => row.variant.style)).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [allRows, productFilter]);

  const colorOptions = useMemo(() => {
    let scoped = allRows;
    if (productFilter) scoped = scoped.filter((row) => String(row.variant.productId) === productFilter);
    if (styleFilter) scoped = scoped.filter((row) => String(row.variant.styleId) === styleFilter);
    return uniqueBy(scoped.map((row) => row.variant.color)).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [allRows, productFilter, styleFilter]);

  const sizeOptions = useMemo(() => {
    let scoped = allRows;
    if (productFilter) scoped = scoped.filter((row) => String(row.variant.productId) === productFilter);
    if (styleFilter) scoped = scoped.filter((row) => String(row.variant.styleId) === styleFilter);
    if (colorFilter) scoped = scoped.filter((row) => String(row.variant.colorId) === colorFilter);
    return uniqueBy(scoped.map((row) => row.variant.size)).sort((a, b) => a.urutan - b.urutan);
  }, [allRows, productFilter, styleFilter, colorFilter]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allRows
      .filter((row) => {
        const { variant } = row;
        if (productFilter && String(variant.productId) !== productFilter) return false;
        if (styleFilter && String(variant.styleId) !== styleFilter) return false;
        if (colorFilter && String(variant.colorId) !== colorFilter) return false;
        if (sizeFilter && String(variant.sizeId) !== sizeFilter) return false;
        if (!query) return true;
        const values = [variant.kodeVariant ?? "", row.productName, variant.style.nama, variant.color.nama, variant.size.nama];
        return values.some((v) => v.toLowerCase().includes(query));
      })
      .sort((a, b) => a.productName.localeCompare(b.productName) || a.variant.size.urutan - b.variant.size.urutan);
  }, [allRows, search, productFilter, styleFilter, colorFilter, sizeFilter]);

  const hasActiveFilters = Boolean(search || productFilter || styleFilter || colorFilter || sizeFilter);

  const handleResetFilters = () => {
    setSearch("");
    setProductFilter(FILTER_RESET.product);
    setStyleFilter(FILTER_RESET.style);
    setColorFilter(FILTER_RESET.color);
    setSizeFilter(FILTER_RESET.size);
  };

  // ── Product CRUD ──────────────────────────────────────────────
  const openCreateProduct = () => setProductModal({ ...EMPTY_PRODUCT_MODAL, open: true });
  const openEditProduct = (product: Product) =>
    setProductModal({ open: true, editing: product, nama: product.nama, prefix: product.prefix, loading: false });

  const submitProduct = async () => {
    const nama = productModal.nama.trim();
    const prefix = productModal.prefix.trim();
    if (!nama) {
      window.alert("Field 'nama' wajib diisi (400).");
      return;
    }
    if (!productModal.editing && !prefix) {
      window.alert("Field 'prefix' wajib diisi (400).");
      return;
    }
    setProductModal((m) => ({ ...m, loading: true }));
    try {
      if (productModal.editing) {
        // PUT /api/products/:id  body: {nama}
        await updateProduct(productModal.editing.id, { nama });
        flash("Produk berhasil diperbarui.");
      } else {
        // POST /api/products  body: {nama,prefix} -> invalidates products:all, broadcast product.created
        await createProduct({ nama, prefix });
        flash("Produk berhasil dibuat.");
      }
      setProductModal(EMPTY_PRODUCT_MODAL);
      await loadProducts();
    } catch (e) {
      setProductModal((m) => ({ ...m, loading: false }));
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan produk (500).");
    }
  };

  const deleteProductHandler = async (product: Product) => {
    if (!window.confirm(`Hapus produk "${product.nama}" beserta seluruh variannya? (cascade delete)`)) return;
    try {
      // DELETE /api/products/:id -> invalidates products:all, products:{id}, products:{id}:variants
      await deleteProduct(product.id);
      flash("Produk berhasil dihapus.");
      await loadProducts();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal menghapus produk.");
    }
  };

  // ── Variant CRUD (nested /products/:id/variants) ─────────────
  const openCreateVariant = () => setVariantModal({ ...EMPTY_VARIANT_MODAL, open: true });
  const openEditVariant = (variant: ProductVariant) =>
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

  const submitVariant = async () => {
    const productId = Number(variantModal.productId);
    const styleId = Number(variantModal.styleId);
    const colorId = Number(variantModal.colorId);
    const sizeId = Number(variantModal.sizeId);
    const tanggal = variantModal.tanggal || undefined; // ISO date opsional

    // Edit mode: PATCH hanya tanggal sesuai doc
    if (variantModal.editing) {
      if (!Number.isFinite(productId) || !Number.isFinite(variantModal.editing.id)) {
        window.alert("ID produk/variant tidak valid (400).");
        return;
      }
      setVariantModal((m) => ({ ...m, loading: true }));
      try {
        // PATCH /api/products/:id/variants/:variantId  body: {tanggal}
        await updateProductVariantDate(productId, variantModal.editing.id, { tanggal });
        flash("Variant berhasil diperbarui.");
        setVariantModal(EMPTY_VARIANT_MODAL);
        await loadProducts();
      } catch (e) {
        setVariantModal((m) => ({ ...m, loading: false }));
        window.alert(e instanceof Error ? e.message : "Gagal mengupdate variant.");
      }
      return;
    }

    // Create mode: POST /api/products/:id/variants
    if (!productId || !styleId || !colorId || !sizeId) {
      window.alert("Field 'styleId','colorId','sizeId' wajib diisi (400).");
      return;
    }
    setVariantModal((m) => ({ ...m, loading: true }));
    try {
      await createProductVariant(productId, { styleId, colorId, sizeId, tanggal });
      // kodeVariant digenerate backend: <PREFIX><3digit> ex W001
      flash("Variant berhasil ditambahkan.");
      setVariantModal(EMPTY_VARIANT_MODAL);
      await loadProducts();
    } catch (e) {
      setVariantModal((m) => ({ ...m, loading: false }));
      const msg = e instanceof Error ? e.message : "Gagal menambahkan variant.";
      // 409 duplicate kombinasi product/style/color/size -> tampilkan apa adanya
      window.alert(msg);
    }
  };

  const deleteVariantHandler = async (variant: ProductVariant) => {
    if (!window.confirm(`Hapus variant ${variant.kodeVariant ?? "#" + variant.id}?`)) return;
    try {
      // DELETE /api/products/:id/variants/:variantId
      await deleteProductVariant(variant.productId, variant.id);
      flash("Variant berhasil dihapus.");
      await loadProducts();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal menghapus variant.");
    }
  };

  return (
    <div className="space-y-6">
      <VariantHeader onCreateProduct={openCreateProduct} onCreateVariant={openCreateVariant} onImport={() => setImportOpen(true)} />
      <VariantTabs tab={tab} onChange={setTab} totalVarian={allRows.length} totalProduk={products.length} />

      {isLoading && <p className="text-sm text-brand-grey">Memuat variant produk...</p>}
      {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}
      {notice && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</p>}

      {!isLoading && !error && tab === "variant" && (
        <section aria-label="Daftar variant produk" className="space-y-5">
          <VariantFilters
            search={search}
            productFilter={productFilter}
            styleFilter={styleFilter}
            colorFilter={colorFilter}
            sizeFilter={sizeFilter}
            productOptions={productOptions}
            styleOptions={styleOptions}
            colorOptions={colorOptions}
            sizeOptions={sizeOptions}
            rowsLength={rows.length}
            totalVarian={allRows.length}
            hasActiveFilters={hasActiveFilters}
            onSearchChange={setSearch}
            onProductChange={setProductFilter}
            onStyleChange={setStyleFilter}
            onColorChange={setColorFilter}
            onSizeChange={setSizeFilter}
            onReset={handleResetFilters}
          />
          <VariantTable rows={rows} hasActiveFilters={hasActiveFilters} onEdit={openEditVariant} onDelete={deleteVariantHandler} />
        </section>
      )}

      {!isLoading && !error && tab === "produk" && (
        <section aria-label="Daftar produk" className="space-y-5">
          <ProductTable products={products} onEdit={openEditProduct} onDelete={deleteProductHandler} />
        </section>
      )}

      <ProductModal
        state={productModal}
        onClose={() => setProductModal(EMPTY_PRODUCT_MODAL)}
        onChange={(patch) => setProductModal((m) => ({ ...m, ...patch }))}
        onSubmit={submitProduct}
      />
      <VariantModal
        state={variantModal}
        products={products}
        styles={allStyles}
        colors={allColors}
        sizes={allSizes}
        onClose={() => setVariantModal(EMPTY_VARIANT_MODAL)}
        onChange={(patch) => setVariantModal((m) => ({ ...m, ...patch }))}
        onSubmit={submitVariant}
      />
      <VariantImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        products={products}
        styles={masterStyles.length ? masterStyles : (allStyles as Pick<MasterStyle, "id" | "nama">[])}
        colors={masterColors.length ? masterColors : (allColors as Pick<MasterColor, "id" | "nama">[])}
        sizes={masterSizes.length ? masterSizes : (allSizes as Pick<MasterSize, "id" | "nama" | "urutan">[])}
        onImported={() => { void loadProducts(); flash("Import selesai — data dimuat ulang."); }}
      />
    </div>
  );
}

export default VariantProduk;
