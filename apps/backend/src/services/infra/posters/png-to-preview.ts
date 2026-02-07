import sharp from "sharp";

const PREVIEW_MAX_WIDTH = 800;
const WEBP_QUALITY = 80;

export async function generatePreviewWebp(png: Buffer): Promise<Buffer> {
  return sharp(png)
    .resize({ width: PREVIEW_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
