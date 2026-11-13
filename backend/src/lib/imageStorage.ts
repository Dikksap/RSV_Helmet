import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import sharp from "sharp";
import type { Request, Response, NextFunction, RequestHandler } from "express";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;
const uploadsDirectory = path.resolve(process.env.UPLOADS_DIR ?? "uploads");

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageError";
  }
}

const imageParser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new UnsupportedImageTypeError());
      return;
    }
    callback(null, true);
  },
}).single("image");

class UnsupportedImageTypeError extends Error {}

export const receiveImage: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  imageParser(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof UnsupportedImageTypeError) {
      res.status(415).json({ message: "Format gambar harus JPEG, PNG, atau WebP" });
      return;
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ message: "Ukuran gambar maksimal 5 MB" });
      return;
    }
    if (error instanceof multer.MulterError) {
      res.status(400).json({ message: "Unggahan gambar tidak valid" });
      return;
    }
    console.error("Gagal membaca unggahan gambar:", error);
    res.status(500).json({ message: "Gagal membaca unggahan gambar" });
  });
};

export async function saveOptimizedImage(
  buffer: Buffer,
  directory: "avatars" | "items",
): Promise<string> {
  const image = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS });
  let optimized: Buffer;
  try {
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
      throw new InvalidImageError("Format gambar tidak didukung");
    }
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
      throw new InvalidImageError("Dimensi gambar terlalu besar atau tidak valid");
    }
    optimized = await image
      .rotate()
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError("File bukan gambar yang valid atau dimensinya terlalu besar");
  }
  const relativePath = `${directory}/${randomUUID()}.webp`;
  const absolutePath = path.join(uploadsDirectory, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, optimized, { flag: "wx" });
  return relativePath;
}

export function resolveStoredImagePath(relativePath: string): string {
  if (!/^(avatars|items)\/[0-9a-f-]+\.webp$/i.test(relativePath)) {
    throw new Error("Path gambar tersimpan tidak valid");
  }
  const absolutePath = path.resolve(uploadsDirectory, relativePath);
  if (!absolutePath.startsWith(`${uploadsDirectory}${path.sep}`)) {
    throw new Error("Path gambar berada di luar direktori unggahan");
  }
  return absolutePath;
}

export async function removeStoredImage(relativePath: string | null | undefined): Promise<void> {
  if (!relativePath) return;
  await rm(resolveStoredImagePath(relativePath), { force: true });
}
