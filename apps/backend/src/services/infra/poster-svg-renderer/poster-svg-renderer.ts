import type { BBox } from "../osm/bbox";
import type { GeoJsonFeatureCollection, OsmLayeredGeoJson } from "../osm/geojson";
import type { PosterTheme } from "../../../types/posters/poster-theme";
import { featureToSvgPath } from "./geojson-to-svg-path";
import { resolvePosterFontFamily } from "./poster-fonts";
import { createLinearProjector } from "./linear";
import { createWebMercatorProjector } from "./web-mercator";
export type PosterTextContent = {
  title: string;
  subtitle: string;
  coords: string;
  attribution: string;
};
export type PosterProjectionMode = "webmercator" | "linear";
function escapeXmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
function svgAttr(name: string, value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return ` ${name}="${String(value)}"`;
}
function getTags(feature: any): Record<string, string> {
  const props = feature?.properties;
  if (!props || typeof props !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (k === "id" || k === "type" || k === "tags") continue;
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
function renderPolygonLayer(options: {
  collection: GeoJsonFeatureCollection;
  style: {
    fill: string;
    fillOpacity: number;
    stroke: string | null;
    strokeOpacity: number;
    strokeWidthPt: number;
  };
  project: (lon: number, lat: number) => { x: number; y: number };
}): string {
  const { collection, style, project } = options;
  const out: string[] = [];
  const stroke = style.stroke && style.strokeWidthPt > 0 && style.strokeOpacity > 0 ? style.stroke : null;
  for (const feature of collection.features) {
    const d = featureToSvgPath(feature, project);
    if (!d) continue;
    out.push(
      `<path${svgAttr("d", d)} fill="${style.fill}" fill-opacity="${style.fillOpacity}"${
        stroke
          ? ` stroke="${stroke}" stroke-opacity="${style.strokeOpacity}" stroke-width="${style.strokeWidthPt}"`
          : ` stroke="none"`
      } fill-rule="evenodd" />`
    );
  }
  return out.join("\n");
}
type RoadClass = "major" | "medium" | "minor";
function classifyRoad(feature: any, theme: PosterTheme): RoadClass {
  const tags = getTags(feature);
  const highway = typeof tags.highway === "string" ? tags.highway : "";
  const mapped = highway ? theme.layers.roads.mapping[highway] : undefined;
  return (mapped ?? theme.layers.roads.defaultClass) as RoadClass;
}
function renderRoadsLayer(options: {
  collection: GeoJsonFeatureCollection;
  theme: PosterTheme;
  project: (lon: number, lat: number) => { x: number; y: number };
}): string {
  const { collection, theme, project } = options;
  const lineCap = theme.layers.roads.lineCap;
  const lineJoin = theme.layers.roads.lineJoin;
  const byClass: Record<RoadClass, string[]> = { major: [], medium: [], minor: [] };
  for (const feature of collection.features) {
    const d = featureToSvgPath(feature, project);
    if (!d) continue;
    const cls = classifyRoad(feature, theme);
    byClass[cls].push(d);
  }
  const out: string[] = [];
  const classes: RoadClass[] = ["major", "medium", "minor"];
  for (const cls of classes) {
    const paths = byClass[cls];
    if (paths.length === 0) continue;
    const style = theme.layers.roads.classes[cls];
    const casing = theme.layers.roads.casing;
    const combinedD = paths.join(" ");
    if (casing.enabled) {
      const casingWidth = style.strokeWidthPt + casing.strokeWidthAddPt;
      out.push(
        `<path${svgAttr("d", combinedD)} fill="none" stroke="${casing.stroke}" stroke-opacity="${casing.opacity}" stroke-width="${casingWidth}" stroke-linecap="${lineCap}" stroke-linejoin="${lineJoin}" />`
      );
    }
    out.push(
      `<path${svgAttr("d", combinedD)} fill="none" stroke="${style.stroke}" stroke-opacity="${style.opacity}" stroke-width="${style.strokeWidthPt}" stroke-linecap="${lineCap}" stroke-linejoin="${lineJoin}" />`
    );
  }
  return out.join("\n");
}
function renderGradientFades(theme: PosterTheme): { zIndex: number; defs: string; shapes: string } | null {
  const fades = theme.effects?.gradientFades;
  if (!fades || !fades.enabled) return null;
  const vb = theme.page.viewBox;
  const width = vb.width;
  const height = vb.height;
  const color = fades.color;
  const topHeight = height * fades.top.heightPct;
  const bottomHeight = height * fades.bottom.heightPct;
  if (topHeight <= 0 && bottomHeight <= 0) return null;
  const topId = "gradientFadeTop";
  const bottomId = "gradientFadeBottom";
  const cornerOpacityScale = 0.35;
  const cornerTopSize = Math.min(width, topHeight);
  const cornerBottomSize = Math.min(width, bottomHeight);
  const cornerTopLeftId = "gradientFadeCornerTopLeft";
  const cornerTopRightId = "gradientFadeCornerTopRight";
  const cornerBottomLeftId = "gradientFadeCornerBottomLeft";
  const cornerBottomRightId = "gradientFadeCornerBottomRight";
  const defsParts: string[] = [];
  if (topHeight > 0) {
    defsParts.push(
      `<linearGradient id="${topId}" gradientUnits="userSpaceOnUse" x1="0" y1="${vb.y}" x2="0" y2="${vb.y + topHeight}">`,
      `<stop offset="0" stop-color="${color}" stop-opacity="${fades.top.fromOpacity}" />`,
      `<stop offset="1" stop-color="${color}" stop-opacity="${fades.top.toOpacity}" />`,
      `</linearGradient>`
    );
  }
  if (bottomHeight > 0) {
    defsParts.push(
      `<linearGradient id="${bottomId}" gradientUnits="userSpaceOnUse" x1="0" y1="${vb.y + height}" x2="0" y2="${vb.y + height - bottomHeight}">`,
      `<stop offset="0" stop-color="${color}" stop-opacity="${fades.bottom.fromOpacity}" />`,
      `<stop offset="1" stop-color="${color}" stop-opacity="${fades.bottom.toOpacity}" />`,
      `</linearGradient>`
    );
  }
  if (cornerTopSize > 0) {
    const cornerOpacity = fades.top.fromOpacity * cornerOpacityScale;
    defsParts.push(
      `<radialGradient id="${cornerTopLeftId}" gradientUnits="userSpaceOnUse" cx="${vb.x}" cy="${vb.y}" r="${cornerTopSize}">`,
      `<stop offset="0" stop-color="${color}" stop-opacity="${cornerOpacity}" />`,
      `<stop offset="1" stop-color="${color}" stop-opacity="0" />`,
      `</radialGradient>`,
      `<radialGradient id="${cornerTopRightId}" gradientUnits="userSpaceOnUse" cx="${vb.x + width}" cy="${vb.y}" r="${cornerTopSize}">`,
      `<stop offset="0" stop-color="${color}" stop-opacity="${cornerOpacity}" />`,
      `<stop offset="1" stop-color="${color}" stop-opacity="0" />`,
      `</radialGradient>`
    );
  }
  if (cornerBottomSize > 0) {
    const cornerOpacity = fades.bottom.fromOpacity * cornerOpacityScale;
    defsParts.push(
      `<radialGradient id="${cornerBottomLeftId}" gradientUnits="userSpaceOnUse" cx="${vb.x}" cy="${vb.y + height}" r="${cornerBottomSize}">`,
      `<stop offset="0" stop-color="${color}" stop-opacity="${cornerOpacity}" />`,
      `<stop offset="1" stop-color="${color}" stop-opacity="0" />`,
      `</radialGradient>`,
      `<radialGradient id="${cornerBottomRightId}" gradientUnits="userSpaceOnUse" cx="${vb.x + width}" cy="${vb.y + height}" r="${cornerBottomSize}">`,
      `<stop offset="0" stop-color="${color}" stop-opacity="${cornerOpacity}" />`,
      `<stop offset="1" stop-color="${color}" stop-opacity="0" />`,
      `</radialGradient>`
    );
  }
  const defs = defsParts.join("\n");
  const shapesParts: string[] = [];
  if (topHeight > 0) {
    shapesParts.push(`<rect x="${vb.x}" y="${vb.y}" width="${width}" height="${topHeight}" fill="url(#${topId})" />`);
  }
  if (bottomHeight > 0) {
    shapesParts.push(
      `<rect x="${vb.x}" y="${vb.y + height - bottomHeight}" width="${width}" height="${bottomHeight}" fill="url(#${bottomId})" />`
    );
  }
  if (cornerTopSize > 0) {
    shapesParts.push(
      `<rect x="${vb.x}" y="${vb.y}" width="${cornerTopSize}" height="${cornerTopSize}" fill="url(#${cornerTopLeftId})" />`,
      `<rect x="${vb.x + width - cornerTopSize}" y="${vb.y}" width="${cornerTopSize}" height="${cornerTopSize}" fill="url(#${cornerTopRightId})" />`
    );
  }
  if (cornerBottomSize > 0) {
    shapesParts.push(
      `<rect x="${vb.x}" y="${vb.y + height - cornerBottomSize}" width="${cornerBottomSize}" height="${cornerBottomSize}" fill="url(#${cornerBottomLeftId})" />`,
      `<rect x="${vb.x + width - cornerBottomSize}" y="${vb.y + height - cornerBottomSize}" width="${cornerBottomSize}" height="${cornerBottomSize}" fill="url(#${cornerBottomRightId})" />`
    );
  }
  const shapes = shapesParts.join("\n");
  return { zIndex: fades.zIndex, defs, shapes };
}
const ATTRIBUTION_STYLE = {
  fontFamily: "Roboto Light, Roboto, sans-serif",
  fontWeight: 600,
  fontSizePt: 12,
  color: "#666666",
  opacity: 1.0
} as const;
function renderTypography(theme: PosterTheme, text: PosterTextContent, fontFamily: string): string {
  const vb = theme.page.viewBox;
  const preset = theme.typography.preset;
  const layout = theme.typography.layouts[preset];
  const blocks: Array<{ key: keyof PosterTextContent; text: string }> = [
    { key: "title", text: text.title },
    { key: "subtitle", text: text.subtitle },
    { key: "coords", text: text.coords },
    { key: "attribution", text: text.attribution }
  ];
  const out: string[] = [];
  for (const b of blocks) {
    const def = (theme.typography.blocks as any)[b.key];
    if (!def?.enabled) continue;
    const pos = (layout as any)[b.key];
    if (!pos) continue;
    const x = vb.x + pos.xPct * vb.width;
    const y = vb.y + (1 - pos.yPct) * vb.height;
    const anchor = pos.anchor;
    const raw = b.text ?? "";
    const transformed = def.transform === "uppercase" ? raw.toUpperCase() : raw;
    const isAttribution = b.key === "attribution";
    const useFontFamily = isAttribution ? ATTRIBUTION_STYLE.fontFamily : fontFamily;
    const useFontWeight = isAttribution ? ATTRIBUTION_STYLE.fontWeight : def.fontWeight;
    const useFontSize = isAttribution ? ATTRIBUTION_STYLE.fontSizePt : def.fontSizePt;
    const useColor = isAttribution ? ATTRIBUTION_STYLE.color : def.color;
    const useOpacity = isAttribution ? ATTRIBUTION_STYLE.opacity : def.opacity;
    out.push(
      [
        "<text",
        svgAttr("x", x),
        svgAttr("y", y),
        ` text-anchor="${anchor}"`,
        ` font-family="${escapeXmlText(useFontFamily)}"`,
        ` font-weight="${useFontWeight}"`,
        ` font-size="${useFontSize}"`,
        !isAttribution && def.letterSpacingPt !== undefined ? ` letter-spacing="${def.letterSpacingPt}"` : "",
        ` fill="${useColor}"`,
        ` fill-opacity="${useOpacity}"`,
        ">",
        escapeXmlText(transformed),
        "</text>"
      ].join("")
    );
  }
  return out.join("\n");
}
function renderDivider(theme: PosterTheme): { zIndex: number; shape: string } | null {
  const divider = theme.decorations?.divider;
  if (!divider || !divider.enabled) return null;
  const vb = theme.page.viewBox;
  const preset = theme.typography.preset;
  const layout = divider.layouts[preset];
  const y = vb.y + (1 - layout.yPct) * vb.height;
  const x1 = vb.x + layout.x1Pct * vb.width;
  const x2 = vb.x + layout.x2Pct * vb.width;
  const shape = `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${divider.stroke}" stroke-opacity="${divider.strokeOpacity}" stroke-width="${divider.strokeWidthPt}" />`;
  return { zIndex: divider.zIndex, shape };
}
export class PosterSvgRenderer {
  private readonly projectionMode: PosterProjectionMode;
  constructor(options?: { projectionMode?: PosterProjectionMode }) {
    this.projectionMode = options?.projectionMode ?? "webmercator";
  }
  async render(params: {
    bbox: BBox;
    layers: OsmLayeredGeoJson;
    theme: PosterTheme;
    text: PosterTextContent;
  }): Promise<string> {
    const fontFamily = resolvePosterFontFamily(params.theme.typography.fontFamily).fontFamily;
    return renderPosterSvg({
      bbox: params.bbox,
      layers: params.layers,
      theme: params.theme,
      text: params.text,
      fontFamily,
      projectionMode: this.projectionMode
    });
  }
}
function renderPosterSvg(options: {
  bbox: BBox;
  layers: OsmLayeredGeoJson;
  theme: PosterTheme;
  text: PosterTextContent;
  fontFamily: string;
  projectionMode: PosterProjectionMode;
}): string {
  const { bbox, layers, theme, text, fontFamily, projectionMode } = options;
  const vb = theme.page.viewBox;
  const project = projectionMode === "linear" ? createLinearProjector(bbox, vb) : createWebMercatorProjector(bbox, vb);
  const defs: string[] = [];
  const gradient = renderGradientFades(theme);
  if (gradient) defs.push(gradient.defs);
  const background = `<rect x="${vb.x}" y="${vb.y}" width="${vb.width}" height="${vb.height}" fill="${theme.background.fill}" />`;
  type Drawable = { zIndex: number; order: number; svg: string };
  const drawables: Drawable[] = [];
  let order = 0;
  if (theme.layers.water.enabled) {
    drawables.push({
      zIndex: theme.layers.water.zIndex,
      order: order++,
      svg: renderPolygonLayer({ collection: layers.water, style: theme.layers.water.polygon, project })
    });
  }
  if (theme.layers.parks.enabled) {
    drawables.push({
      zIndex: theme.layers.parks.zIndex,
      order: order++,
      svg: renderPolygonLayer({ collection: layers.parks, style: theme.layers.parks.polygon, project })
    });
  }
  if (theme.layers.buildings.enabled) {
    drawables.push({
      zIndex: theme.layers.buildings.zIndex,
      order: order++,
      svg: renderPolygonLayer({ collection: layers.buildings, style: theme.layers.buildings.polygon, project })
    });
  }
  if (theme.layers.roads.enabled) {
    drawables.push({
      zIndex: theme.layers.roads.zIndex,
      order: order++,
      svg: renderRoadsLayer({ collection: layers.roads, theme, project })
    });
  }
  if (gradient) {
    drawables.push({ zIndex: gradient.zIndex, order: order++, svg: gradient.shapes });
  }
  const typography = renderTypography(theme, text, fontFamily);
  if (typography) {
    const maxUnderTextZ = Math.max(
      0,
      ...(theme.layers.water.enabled ? [theme.layers.water.zIndex] : []),
      ...(theme.layers.parks.enabled ? [theme.layers.parks.zIndex] : []),
      ...(theme.layers.buildings.enabled ? [theme.layers.buildings.zIndex] : []),
      ...(theme.layers.roads.enabled ? [theme.layers.roads.zIndex] : []),
      ...(gradient ? [gradient.zIndex] : [])
    );
    drawables.push({ zIndex: maxUnderTextZ + 1, order: order++, svg: typography });
  }
  const divider = renderDivider(theme);
  if (divider) {
    drawables.push({ zIndex: divider.zIndex, order: order++, svg: divider.shape });
  }
  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${theme.page.widthIn}in" height="${theme.page.heightIn}in" viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}">`
  );
  if (defs.length) parts.push(`<defs>\n${defs.join("\n")}\n</defs>`);
  parts.push(background);
  drawables.sort((a, b) => a.zIndex - b.zIndex || a.order - b.order);
  const svgShapes = drawables
    .map(d => d.svg)
    .filter(Boolean)
    .join("\n");
  if (svgShapes) parts.push(svgShapes);
  parts.push("</svg>");
  return parts.join("\n");
}
