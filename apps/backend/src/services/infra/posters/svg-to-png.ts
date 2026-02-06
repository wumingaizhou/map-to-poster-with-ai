import { Resvg } from "@resvg/resvg-js";
import { ServiceUnavailableError } from "../../../errors/app-error";
import { getResvgFontRuntime } from "./resvg-font-cache";
export async function rasterizeSvgToPng(params: { svg: string; widthPx: number; heightPx: number }): Promise<Buffer> {
  const { svg, widthPx, heightPx } = params;
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx <= 0 || heightPx <= 0) {
    throw new ServiceUnavailableError("Invalid PNG size");
  }
  try {
    const fontRuntime = await getResvgFontRuntime();
    const svgWithSize = overrideSvgSize(svg, widthPx, heightPx);
    const resvg = new Resvg(svgWithSize, {
      font: {
        ...fontRuntime
      }
    });
    const result = resvg.render();
    return result.asPng();
  } catch {
    throw new ServiceUnavailableError("Failed to rasterize SVG to PNG");
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
