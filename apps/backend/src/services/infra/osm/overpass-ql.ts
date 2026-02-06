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
  timeoutSeconds?: number;
  includeBuildings?: boolean;
};
export function buildLayeredOverpassQL(params: BuildLayeredOverpassQLParams): string {
  const bbox = params.bbox;
  const bboxQl = bboxToOverpassQLBbox(bbox);
  const timeoutSeconds = params.timeoutSeconds ?? 25;
  const includeBuildings = params.includeBuildings ?? true;
  const allowlist = createHighwayAllowlist(params.highwayAllowlist);
  const roadsRegex = allowlist.length ? `^(${allowlist.map(escapeRegexPart).join("|")})$` : null;
  const lines: string[] = [];
  lines.push(`[out:json][timeout:${timeoutSeconds}];`);
  const wayQueries: string[] = [];
  const relationQueries: string[] = [];
  wayQueries.push(`  way["natural"="water"]${bboxQl};`);
  relationQueries.push(`  relation["natural"="water"]${bboxQl};`);
  wayQueries.push(`  way["waterway"="riverbank"]${bboxQl};`);
  relationQueries.push(`  relation["waterway"="riverbank"]${bboxQl};`);
  wayQueries.push(`  way["landuse"="reservoir"]${bboxQl};`);
  relationQueries.push(`  relation["landuse"="reservoir"]${bboxQl};`);
  wayQueries.push(`  way["leisure"="park"]${bboxQl};`);
  wayQueries.push(`  way["leisure"="garden"]${bboxQl};`);
  relationQueries.push(`  relation["leisure"="park"]${bboxQl};`);
  relationQueries.push(`  relation["leisure"="garden"]${bboxQl};`);
  wayQueries.push(`  way["natural"="wood"]${bboxQl};`);
  relationQueries.push(`  relation["natural"="wood"]${bboxQl};`);
  wayQueries.push(`  way["landuse"~"^(grass|forest|meadow)$"]${bboxQl};`);
  relationQueries.push(`  relation["landuse"~"^(grass|forest|meadow)$"]${bboxQl};`);
  if (includeBuildings) {
    wayQueries.push(`  way["building"]${bboxQl};`);
    relationQueries.push(`  relation["building"]${bboxQl};`);
  }
  if (roadsRegex) {
    wayQueries.push(`  way["highway"~"${roadsRegex}"]${bboxQl};`);
  }
  lines.push("(");
  lines.push(...wayQueries);
  lines.push(")->.ways;");
  lines.push("(");
  lines.push(...relationQueries);
  lines.push(")->.rels;");
  lines.push("(.ways;);");
  lines.push("out tags geom qt;");
  lines.push("(.rels;);");
  lines.push("out geom qt;");
  return lines.join("\n");
}
