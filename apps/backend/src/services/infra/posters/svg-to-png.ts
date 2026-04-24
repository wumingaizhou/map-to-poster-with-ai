import { Resvg } from "@resvg/resvg-js";
import { ServiceUnavailableError } from "../../../errors/app-error";
import { getResvgFontRuntime } from "./resvg-font-cache";

const SAFE_RENDER_PIXEL_LIMIT = 18_000_000;
const ESTIMATED_RENDER_MEMORY_LIMIT_MB = 256;
const ESTIMATED_BYTES_PER_PIXEL = 12;

export async function rasterizeSvgToPng(params: { svg: string; widthPx: number; heightPx: number }): Promise<Buffer> {
  const { svg, widthPx, heightPx } = params;
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx <= 0 || heightPx <= 0) {
    throw new ServiceUnavailableError("Invalid PNG size");
  }
  try {
    assertRenderWithinSafeBudget(widthPx, heightPx);
    const fontRuntime = await getResvgFontRuntime();
    const svgWithSize = overrideSvgSize(svg, widthPx, heightPx);
    const resvg = new Resvg(svgWithSize, {
      font: {
        ...fontRuntime
      }
    });
    const result = resvg.render();
    return result.asPng();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }
    throw new ServiceUnavailableError("Failed to rasterize SVG to PNG");
  }
}

function assertRenderWithinSafeBudget(widthPx: number, heightPx: number): void {
  const pixelCount = widthPx * heightPx;
  if (!Number.isFinite(pixelCount) || pixelCount <= 0) {
    throw new ServiceUnavailableError("Invalid render dimensions");
  }
  const estimatedMemoryMb = (pixelCount * ESTIMATED_BYTES_PER_PIXEL) / (1024 * 1024);
  if (pixelCount > SAFE_RENDER_PIXEL_LIMIT || estimatedMemoryMb > ESTIMATED_RENDER_MEMORY_LIMIT_MB) {
    throw new ServiceUnavailableError("Poster render exceeds safe memory budget");
  }
}

function overrideSvgSize(svg: string, widthPx: number, heightPx: number): string {
  const match = svg.match(/<svg\b[^>]*>/);
  if (!match) return svg;
  const originalTag = match[0];
  let updatedTag = originalTag.replace(/\swidth="[^"]*"/, "").replace(/\sheight="[^"]*"/, "");
  updatedTag = updatedTag.replace("<svg", `<svg width="${widthPx}" height="${heightPx}"`);
  return svg.replace(originalTag, updatedTag);
}
