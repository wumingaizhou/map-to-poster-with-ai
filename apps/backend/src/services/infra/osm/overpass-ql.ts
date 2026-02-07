import { bboxToOverpassQLBbox, type BBox } from "./bbox";
function escapeRegexPart(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}
export function createHighwayAllowlist(keys: Iterable<string>): string[] {
  const allowlist: string[] = [];
  const seen = new Set<string>();
  for (const raw of keys) {
    const value = String(raw).trim();
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    allowlist.push(value);
  }
  return allowlist;
}
export type BuildLayeredOverpassQLParams = {
  bbox: BBox;
  highwayAllowlist: readonly string[];
  timeoutSeconds?: number | undefined;
  includeBuildings?: boolean | undefined;
  maxFeaturesPerLayer?: number | undefined;
};
export function buildLayeredOverpassQL(params: BuildLayeredOverpassQLParams): string {
  const bbox = params.bbox;
  const bboxQl = bboxToOverpassQLBbox(bbox);
  const timeoutSeconds = params.timeoutSeconds ?? 25;
  const includeBuildings = params.includeBuildings ?? true;
  const limit = params.maxFeaturesPerLayer;
  const allowlist = createHighwayAllowlist(params.highwayAllowlist);
  const roadsRegex = allowlist.length ? `^(${allowlist.map(escapeRegexPart).join("|")})$` : null;
  const outSuffix = limit ? ` ${limit}` : "";
  const lines: string[] = [];
  lines.push(`[out:json][timeout:${timeoutSeconds}];`);
  // ─── Water ───
  lines.push("(");
  lines.push(`  way["natural"="water"]${bboxQl};`);
  lines.push(`  way["waterway"="riverbank"]${bboxQl};`);
  lines.push(`  way["landuse"="reservoir"]${bboxQl};`);
  lines.push(`  relation["natural"="water"]${bboxQl};`);
  lines.push(`  relation["waterway"="riverbank"]${bboxQl};`);
  lines.push(`  relation["landuse"="reservoir"]${bboxQl};`);
  lines.push(");");
  lines.push(`out geom qt${outSuffix};`);
  // ─── Parks ───
  lines.push("(");
  lines.push(`  way["leisure"="park"]${bboxQl};`);
  lines.push(`  way["leisure"="garden"]${bboxQl};`);
  lines.push(`  relation["leisure"="park"]${bboxQl};`);
  lines.push(`  relation["leisure"="garden"]${bboxQl};`);
  lines.push(`  way["natural"="wood"]${bboxQl};`);
  lines.push(`  relation["natural"="wood"]${bboxQl};`);
  lines.push(`  way["landuse"~"^(grass|forest|meadow)$"]${bboxQl};`);
  lines.push(`  relation["landuse"~"^(grass|forest|meadow)$"]${bboxQl};`);
  lines.push(");");
  lines.push(`out geom qt${outSuffix};`);
  // ─── Buildings ───
  if (includeBuildings) {
    lines.push("(");
    lines.push(`  way["building"]${bboxQl};`);
    lines.push(`  relation["building"]${bboxQl};`);
    lines.push(");");
    lines.push(`out geom qt${outSuffix};`);
  }
  // ─── Roads ───
  if (roadsRegex) {
    lines.push("(");
    lines.push(`  way["highway"~"${roadsRegex}"]${bboxQl};`);
    lines.push(");");
    lines.push(`out tags geom qt${outSuffix};`);
  }
  return lines.join("\n");
}
