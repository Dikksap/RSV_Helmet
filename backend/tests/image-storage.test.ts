import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

let testDirectory = "";
let saveOptimizedImage: typeof import("../src/lib/imageStorage.js").saveOptimizedImage;
let resolveStoredImagePath: typeof import("../src/lib/imageStorage.js").resolveStoredImagePath;
let removeStoredImage: typeof import("../src/lib/imageStorage.js").removeStoredImage;
let InvalidImageError: typeof import("../src/lib/imageStorage.js").InvalidImageError;

beforeAll(async () => {
  testDirectory = await mkdtemp(path.join(os.tmpdir(), "rsv-images-"));
  process.env.UPLOADS_DIR = testDirectory;
  const imageStorage = await import("../src/lib/imageStorage.js");
  saveOptimizedImage = imageStorage.saveOptimizedImage;
  resolveStoredImagePath = imageStorage.resolveStoredImagePath;
  removeStoredImage = imageStorage.removeStoredImage;
  InvalidImageError = imageStorage.InvalidImageError;
});

afterAll(async () => {
  await rm(testDirectory, { recursive: true, force: true });
  delete process.env.UPLOADS_DIR;
});

describe("image storage", () => {
  it("normalizes valid images to bounded WebP files", async () => {
    const png = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: "#0077cc",
      },
    }).png().toBuffer();

    const storedPath = await saveOptimizedImage(png, "items");
    const storedBuffer = await readFile(resolveStoredImagePath(storedPath));
    const metadata = await sharp(storedBuffer).metadata();

    expect(storedPath).toMatch(/^items\/[0-9a-f-]+\.webp$/);
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(675);
    await removeStoredImage(storedPath);
  });

  it("rejects data that is not a supported image", async () => {
    await expect(saveOptimizedImage(Buffer.from("<svg></svg>"), "avatars"))
      .rejects.toBeInstanceOf(InvalidImageError);
  });

  it("rejects stored paths outside the upload folders", () => {
    expect(() => resolveStoredImagePath("../private/file.webp")).toThrow("Path gambar tersimpan tidak valid");
  });
});
