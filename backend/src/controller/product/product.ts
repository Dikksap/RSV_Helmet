import type { Request, Response } from "express";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductVariants,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
} from "../../model/product/product.js";
import { broadcast } from "../../websocket/socket.js";

// =============================================
// GET /api/products - Ambil semua produk
// =============================================

export async function getProductsHandler(_req: Request, res: Response) {
  try {
    const products = await getAllProducts();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data produk", error });
  }
}

// =============================================
// GET /api/products/:id - Ambil produk by ID
// =============================================

export async function getProductDetail(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    const product = await getProductById(id);

    if (!product) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data produk", error });
  }
}

// =============================================
// POST /api/products - Buat produk baru
// =============================================

export async function createProductHandler(req: Request, res: Response) {
  try {
    const { nama, prefix } = req.body;

    if (!nama || !prefix) {
      return res.status(400).json({ message: "Field 'nama', 'prefix' wajib diisi" });
    }

    const product = await createProduct({ nama, prefix });

    void broadcast({
      type: "product.created",
      message: "Produk berhasil dibuat",
      data: product,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: "Gagal membuat produk", error });
  }
}

// =============================================
// PUT /api/products/:id - Update nama produk
// =============================================

export async function updateProductHandler(req: Request, res: Response) {
  try {
    const id   = Number(req.params.id);
    const { nama } = req.body;

    if (!nama) {
      return res.status(400).json({ message: "Field 'nama' wajib diisi" });
    }

    const product = await updateProduct(id, nama);

    void broadcast({
      type: "product.updated",
      message: "Produk berhasil diperbarui",
      data: product,
    });

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengupdate produk", error });
  }
}

// =============================================
// DELETE /api/products/:id - Hapus produk
// (variants ikut terhapus karena onDelete: Cascade)
// =============================================

export async function deleteProductHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    await deleteProduct(id);

    void broadcast({
      type: "product.deleted",
      message: "Produk berhasil dihapus",
      data: { id },
    });

    res.status(200).json({ message: "Produk berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: "Gagal menghapus produk", error });
  }
}

// =============================================
// GET /api/products/:id/variants - Ambil semua variant produk
// =============================================

export async function getProductVariantsHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    const variants = await getProductVariants(id);

    res.status(200).json(variants);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil variant produk", error });
  }
}

// =============================================
// POST /api/products/:id/variants - Tambah variant ke produk
// =============================================

export async function addVariantHandler(req: Request, res: Response) {
  try {
    const productId = Number(req.params.id);
    const { styleId, colorId, sizeId, tanggal } = req.body;

    if (!styleId || !colorId || !sizeId) {
      return res.status(400).json({ message: "Field 'styleId', 'colorId', 'sizeId' wajib diisi" });
    }

    const variant = await createProductVariant(productId, {
      styleId:  Number(styleId),
      colorId:  Number(colorId),
      sizeId:   Number(sizeId),
      tanggal:  tanggal ? new Date(tanggal) : undefined,
    });

    void broadcast({
      type: "variant.created",
      message: "Variant berhasil ditambahkan",
      data: variant,
    });

    res.status(201).json(variant);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Kombinasi style, color, size sudah ada untuk produk ini" });
    }
    res.status(500).json({ message: "Gagal menambahkan variant", error });
  }
}

// =============================================
// PATCH /api/products/:id/variants/:variantId - Update tanggal variant
// =============================================

export async function updateVariantHandler(req: Request, res: Response) {
  try {
    const productId = Number(req.params.id);
    const variantId = Number(req.params.variantId);
    const { tanggal } = req.body;

    const variant = await updateProductVariant(productId, variantId, {
      ...(tanggal && { tanggal: new Date(tanggal) }),
    });

    void broadcast({
      type: "variant.updated",
      message: "Variant berhasil diperbarui",
      data: variant,
    });

    res.status(200).json(variant);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengupdate variant", error });
  }
}

// =============================================
// DELETE /api/products/:id/variants/:variantId - Hapus variant
// =============================================

export async function deleteVariantHandler(req: Request, res: Response) {
  try {
    const productId = Number(req.params.id);
    const variantId = Number(req.params.variantId);

    await deleteProductVariant(productId, variantId);

    void broadcast({
      type: "variant.deleted",
      message: "Variant berhasil dihapus",
      data: { id: variantId },
    });

    res.status(200).json({ message: "Variant berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: "Gagal menghapus variant", error });
  }
}
