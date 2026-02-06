import { parentPort } from "worker_threads";
import { config } from "../../../config/env";
import { ThemeNotFoundError, ServiceUnavailableError } from "../../../errors/app-error";
import type { PosterCategory } from "../../../types/posters/poster-category";
import type { AiThemeOverride } from "../../../types/posters/ai-theme-override";
import type { BBox } from "../osm/bbox";
import { getOsmLayeredGeoJsonWithCache } from "../osm/osm-layered-geojson-with-cache";
import { createHighwayAllowlist } from "../osm/overpass-ql";
import { PosterSvgRenderer, type PosterTextContent } from "../poster-svg-renderer/poster-svg-renderer";
import { PosterThemeRepository } from "../theme/poster-theme-repository";
import { ThemeOverrideService } from "../../business/theme-override-service";
import { rasterizeSvgToPng } from "./svg-to-png";
import { getResvgFontRuntime } from "./resvg-font-cache";
export type CreateSessionTaskParams = {
  taskType: "createSession";
  bbox: BBox;
  placeKey: string;
  baseThemeId: string;
  category: PosterCategory;
  displayName: string;
  pngDpi: number;
};
export type IterateStyleTaskParams = {
  taskType: "iterateStyle";
  bbox: BBox;
  placeKey: string;
  baseThemeId: string;
  category: PosterCategory;
  displayName: string;
  aiThemeOverride: AiThemeOverride;
  pngDpi: number;
};
export type WorkerTaskMessage = { taskId: string } & (CreateSessionTaskParams | IterateStyleTaskParams);
export type WorkerResultMessage =
  | { taskId: string; success: true; png: Buffer }
  | { taskId: string; success: false; error: { message: string; statusCode: number; code?: string } };
const themeRepository = new PosterThemeRepository();
const themeOverrideService = new ThemeOverrideService();
const svgRenderer = new PosterSvgRenderer({ projectionMode: config.posters.projectionMode });
function deriveText(displayName: string, bbox: BBox): PosterTextContent {
  const parts = displayName
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const title = parts[0] ?? displayName.trim();
  const subtitle = parts.slice(1).join(", ");
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const coords = `${centerLat.toFixed(4)}°, ${centerLon.toFixed(4)}°`;
  return { title, subtitle, coords, attribution: "Map data from OpenStreetMap" };
}
function serializeError(err: unknown): { message: string; statusCode: number; code?: string } {
  if (err && typeof err === "object" && "statusCode" in err) {
    const e = err as { message?: string; statusCode?: number; code?: string };
    const code = typeof e.code === "string" ? e.code : undefined;
    return {
      message: typeof e.message === "string" ? e.message : "Poster generation failed",
      statusCode: typeof e.statusCode === "number" ? e.statusCode : 500,
      ...(code !== undefined ? { code } : {})
    };
  }
  if (err && typeof err === "object" && "name" in err && (err as any).name === "OverpassClientError") {
    const e = err as { message?: string; code?: string };
    const code = typeof e.code === "string" ? e.code : undefined;
    return {
      message: typeof e.message === "string" ? e.message : "Overpass request failed",
      statusCode: 503,
      ...(code !== undefined ? { code } : {})
    };
  }
  const message = err instanceof Error ? err.message : "Poster generation failed";
  return { message, statusCode: 503, code: "SERVICE_UNAVAILABLE" };
}
async function handleCreateSession(params: CreateSessionTaskParams): Promise<Buffer> {
  const baseTheme = await themeRepository.getThemeById(params.baseThemeId);
  if (baseTheme.category !== params.category) {
    throw new ThemeNotFoundError("Theme category mismatch");
  }
  const finalTheme = themeOverrideService.resolveSystemTheme(baseTheme);
  const highwayAllowlist = createHighwayAllowlist(Object.keys(finalTheme.layers.roads.mapping));
  const includeBuildings = finalTheme.layers.buildings.enabled;
  const layered = await getOsmLayeredGeoJsonWithCache({
    placeKey: params.placeKey,
    bbox: params.bbox,
    highwayAllowlist,
    includeBuildings
  });
  const text = deriveText(params.displayName, params.bbox);
  const svg = await svgRenderer.render({ bbox: params.bbox, layers: layered, theme: finalTheme, text });
  const widthPx = Math.round(finalTheme.page.widthIn * params.pngDpi);
  const heightPx = Math.round(finalTheme.page.heightIn * params.pngDpi);
  return rasterizeSvgToPng({ svg, widthPx, heightPx });
}
async function handleIterateStyle(params: IterateStyleTaskParams): Promise<Buffer> {
  const baseTheme = await themeRepository.getThemeById(params.baseThemeId);
  if (baseTheme.category !== params.category) {
    throw new ThemeNotFoundError("Theme category mismatch");
  }
  const finalTheme = themeOverrideService.applyOverride(baseTheme, params.aiThemeOverride);
  const highwayAllowlist = createHighwayAllowlist(Object.keys(finalTheme.layers.roads.mapping));
  const includeBuildings = finalTheme.layers.buildings.enabled;
  const layered = await getOsmLayeredGeoJsonWithCache({
    placeKey: params.placeKey,
    bbox: params.bbox,
    highwayAllowlist,
    includeBuildings
  });
  const text = deriveText(params.displayName, params.bbox);
  const svg = await svgRenderer.render({ bbox: params.bbox, layers: layered, theme: finalTheme, text });
  const widthPx = Math.round(finalTheme.page.widthIn * params.pngDpi);
  const heightPx = Math.round(finalTheme.page.heightIn * params.pngDpi);
  return rasterizeSvgToPng({ svg, widthPx, heightPx });
}
if (!parentPort) {
  throw new Error("poster-worker.ts must be run as a Worker Thread");
}
const port = parentPort;
async function init(): Promise<void> {
  await getResvgFontRuntime();
  await themeRepository.getThemeById("system-roadNetwork-v1").catch(() => {});
  port.postMessage({ type: "ready" });
}
port.on("message", async (msg: WorkerTaskMessage) => {
  const { taskId, taskType } = msg;
  try {
    let png: Buffer;
    if (taskType === "createSession") {
      png = await handleCreateSession(msg);
    } else if (taskType === "iterateStyle") {
      png = await handleIterateStyle(msg);
    } else {
      throw new ServiceUnavailableError(`Unknown task type: ${taskType}`);
    }
    const result: WorkerResultMessage = { taskId, success: true, png };
    port.postMessage(result);
  } catch (err) {
    const result: WorkerResultMessage = { taskId, success: false, error: serializeError(err) };
    port.postMessage(result);
  }
});
void init();
