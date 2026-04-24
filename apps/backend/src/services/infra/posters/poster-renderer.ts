import { ThemeNotFoundError } from "../../../errors/app-error";
import { createLogger } from "../../../utils/logger";
import type { PosterCategory } from "../../../types/posters/poster-category";
import type { AiThemeOverride } from "../../../types/posters/ai-theme-override";
import type { BBox } from "../osm/bbox";
import { getOsmLayeredGeoJsonWithCache } from "../osm/osm-layered-geojson-with-cache";
import { createHighwayAllowlist } from "../osm/overpass-ql";
import { PosterSvgRenderer, type PosterTextContent } from "../poster-svg-renderer/poster-svg-renderer";
import { ThemeOverrideService } from "../../business/theme-override-service";
import { PosterThemeRepository } from "../theme/poster-theme-repository";
import { rasterizeSvgToPng } from "./svg-to-png";
import { getResvgFontRuntime } from "./resvg-font-cache";
import { KeyedLock } from "./keyed-lock";
import { config } from "../../../config/env";

export type CreateSessionRenderParams = {
  bbox: BBox;
  placeKey: string;
  baseThemeId: string;
  category: PosterCategory;
  displayName: string;
  pngDpi: number;
};

export type IterateStyleRenderParams = {
  bbox: BBox;
  placeKey: string;
  baseThemeId: string;
  category: PosterCategory;
  displayName: string;
  aiThemeOverride: AiThemeOverride;
  pngDpi: number;
};

const GLOBAL_RENDER_LOCK_KEY = "poster-render";

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

export class PosterRenderer {
  private readonly lock = new KeyedLock();
  private readonly svgRenderer = new PosterSvgRenderer({ projectionMode: config.posters.projectionMode });
  private readonly log = createLogger("PosterRenderer");

  constructor(
    private readonly themeRepository: PosterThemeRepository,
    private readonly themeOverrideService: ThemeOverrideService
  ) {}

  async warmup(): Promise<void> {
    await getResvgFontRuntime();
    await this.themeRepository.getThemeById("system-roadNetwork-v1");
  }

  async createSessionPng(params: CreateSessionRenderParams): Promise<Buffer> {
    return this.lock.runExclusive(GLOBAL_RENDER_LOCK_KEY, async () => {
      const baseTheme = await this.themeRepository.getThemeById(params.baseThemeId);
      if (baseTheme.category !== params.category) {
        throw new ThemeNotFoundError("Theme category mismatch");
      }
      const finalTheme = this.themeOverrideService.resolveSystemTheme(baseTheme);
      return this.renderPng({
        bbox: params.bbox,
        placeKey: params.placeKey,
        displayName: params.displayName,
        pngDpi: params.pngDpi,
        finalTheme
      });
    });
  }

  async iterateStylePng(params: IterateStyleRenderParams): Promise<Buffer> {
    return this.lock.runExclusive(GLOBAL_RENDER_LOCK_KEY, async () => {
      const baseTheme = await this.themeRepository.getThemeById(params.baseThemeId);
      if (baseTheme.category !== params.category) {
        throw new ThemeNotFoundError("Theme category mismatch");
      }
      const finalTheme = this.themeOverrideService.applyOverride(baseTheme, params.aiThemeOverride);
      return this.renderPng({
        bbox: params.bbox,
        placeKey: params.placeKey,
        displayName: params.displayName,
        pngDpi: params.pngDpi,
        finalTheme
      });
    });
  }

  private async renderPng(params: {
    bbox: BBox;
    placeKey: string;
    displayName: string;
    pngDpi: number;
    finalTheme: Awaited<ReturnType<PosterThemeRepository["getThemeById"]>>;
  }): Promise<Buffer> {
    const { bbox, placeKey, displayName, pngDpi, finalTheme } = params;
    const highwayAllowlist = createHighwayAllowlist(Object.keys(finalTheme.layers.roads.mapping));
    const includeBuildings = finalTheme.layers.buildings.enabled;
    const layered = await getOsmLayeredGeoJsonWithCache({
      placeKey,
      bbox,
      highwayAllowlist,
      includeBuildings,
      maxFeaturesPerLayer: config.posters.maxFeaturesPerLayer
    });
    this.log.info(
      {
        place: displayName,
        water: layered.water.features.length,
        parks: layered.parks.features.length,
        buildings: layered.buildings.features.length,
        roads: layered.roads.features.length
      },
      "OSM layer feature counts"
    );
    const text = deriveText(displayName, bbox);
    const svg = await this.svgRenderer.render({ bbox, layers: layered, theme: finalTheme, text });
    this.log.info({ place: displayName, svgSizeKB: Math.round(svg.length / 1024) }, "SVG generated");
    const widthPx = Math.round(finalTheme.page.widthIn * pngDpi);
    const heightPx = Math.round(finalTheme.page.heightIn * pngDpi);
    return rasterizeSvgToPng({ svg, widthPx, heightPx });
  }
}
