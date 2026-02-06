import { BaseService } from "../base/base-service";
import type { AiChatRequestDTO, ChatStreamResultDTO } from "../../types/ai-chat/ai-chat-dto";
import { mastra } from "../../mastra";
import { eventStore, type EventListener } from "./event-store";
import { RequestContext as MastraRequestContext } from "@mastra/core/request-context";
import { posterContextSchema, type PosterContext } from "../../types/posters/poster-context";
import { postersRuntime } from "../../runtime/posters-runtime";
import { ThemeOverrideService } from "./theme-override-service";
import type { PosterTheme } from "../../types/posters/poster-theme";
interface MastraStreamEvent {
  type: string;
  payload?: {
    text?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
interface MastraAgentStreamResult {
  fullStream: AsyncIterable<MastraStreamEvent>;
  [key: string]: unknown;
}
const POSTER_CONTEXT_START = "【POSTER_CONTEXT】";
const POSTER_CONTEXT_END = "【/POSTER_CONTEXT】";
const POSTER_CONTEXT_MAX_CHARS = 4000;
function extractPosterContextBlock(userMessage: string): { userText: string; posterContext?: PosterContext } {
  const start = userMessage.lastIndexOf(POSTER_CONTEXT_START);
  if (start === -1) return { userText: userMessage };
  const end = userMessage.indexOf(POSTER_CONTEXT_END, start + POSTER_CONTEXT_START.length);
  if (end === -1) return { userText: userMessage };
  const jsonText = userMessage.slice(start + POSTER_CONTEXT_START.length, end).trim();
  const userText = userMessage.slice(0, start).trimEnd() || userMessage;
  if (!jsonText || jsonText.length > POSTER_CONTEXT_MAX_CHARS) {
    return { userText };
  }
  try {
    const json = JSON.parse(jsonText) as unknown;
    const parsed = posterContextSchema.safeParse(json);
    if (!parsed.success) return { userText };
    return { userText, posterContext: parsed.data };
  } catch {
    return { userText };
  }
}
interface StyleSnapshotResult {
  lines: string[];
  unavailable: boolean;
}
function joinParts(parts: Array<string | undefined>, sep: string): string {
  return parts
    .map(p => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(sep);
}
function buildPaletteGroupLine(params: {
  title: string;
  items: Array<{ label: string; key: string; value: string | undefined }>;
}): string | undefined {
  const content = joinParts(
    params.items.map(i => (i.value ? `${i.label}(${i.key}) ${i.value}` : undefined)),
    "；"
  );
  if (!content) return undefined;
  return `- ${params.title}：${content}`;
}
function extractPaletteSnapshot(finalTheme: PosterTheme): string[] {
  const lines: string[] = [];
  lines.push("颜色（palette）：");
  const p = finalTheme.palette;
  const knownGroups: Array<Parameters<typeof buildPaletteGroupLine>[0]> = [
    {
      title: "背景与文字",
      items: [
        { label: "背景", key: "bg", value: p["bg"] },
        { label: "渐隐", key: "gradient", value: p["gradient"] },
        { label: "文字", key: "text", value: p["text"] }
      ]
    },
    {
      title: "水域",
      items: [
        { label: "填充", key: "waterFill", value: p["waterFill"] },
        { label: "描边", key: "waterStroke", value: p["waterStroke"] }
      ]
    },
    {
      title: "绿地",
      items: [
        { label: "填充", key: "parkFill", value: p["parkFill"] },
        { label: "描边", key: "parkStroke", value: p["parkStroke"] }
      ]
    },
    {
      title: "建筑",
      items: [
        { label: "填充", key: "buildingFill", value: p["buildingFill"] },
        { label: "描边", key: "buildingStroke", value: p["buildingStroke"] }
      ]
    },
    {
      title: "道路",
      items: [
        { label: "主干", key: "roadMajor", value: p["roadMajor"] },
        { label: "中路", key: "roadMedium", value: p["roadMedium"] },
        { label: "支路", key: "roadMinor", value: p["roadMinor"] },
        { label: "外描边", key: "roadCasing", value: p["roadCasing"] }
      ]
    }
  ];
  const usedKeys = new Set<string>();
  for (const group of knownGroups) {
    for (const item of group.items) {
      usedKeys.add(item.key);
    }
    const line = buildPaletteGroupLine(group);
    if (line) lines.push(line);
  }
  const extraEntries = Object.entries(p)
    .filter(([key]) => !usedKeys.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
  if (extraEntries.length > 0) {
    const extras = extraEntries.map(([key, value]) => `${key} ${value}`).join("；");
    lines.push(`- 其他：${extras}`);
  }
  return lines;
}
function extractTuningSnapshot(finalTheme: PosterTheme): string[] {
  const lines: string[] = [];
  lines.push("参数（tuning）：");
  const waterOpacity = finalTheme.layers.water.polygon.fillOpacity;
  const parksOpacity = finalTheme.layers.parks.polygon.fillOpacity;
  const buildingsOpacity = finalTheme.layers.buildings.polygon.fillOpacity;
  lines.push(
    `- 图层透明度(layerOpacities)：water ${waterOpacity}；parks ${parksOpacity}；buildings ${buildingsOpacity}`
  );
  const casing = finalTheme.layers.roads.casing;
  lines.push(
    `- 道路外描边(roads.casing)：${casing.enabled ? "开启" : "关闭"}；额外线宽(strokeWidthAddPt) ${
      casing.strokeWidthAddPt
    }pt；透明度(opacity) ${casing.opacity}`
  );
  const major = finalTheme.layers.roads.classes.major;
  const medium = finalTheme.layers.roads.classes.medium;
  const minor = finalTheme.layers.roads.classes.minor;
  lines.push(
    `- 道路线宽/透明度(roads.major/medium/minor)：major ${major.strokeWidthPt}pt/${major.opacity}；medium ${medium.strokeWidthPt}pt/${medium.opacity}；minor ${minor.strokeWidthPt}pt/${minor.opacity}`
  );
  if (finalTheme.effects?.gradientFades) {
    const gf = finalTheme.effects.gradientFades;
    const heightPct = (gf.top.heightPct + gf.bottom.heightPct) / 2;
    lines.push(`- 渐隐遮罩(gradientFades)：${gf.enabled ? "开启" : "关闭"}；高度占比(heightPct) ${heightPct}`);
  }
  return lines;
}
function extractTypographySnapshot(finalTheme: PosterTheme): string[] {
  const lines: string[] = [];
  lines.push("排版（typography）：");
  lines.push(`- 字体(fontFamily)：${finalTheme.typography.fontFamily}`);
  lines.push(`- 标题区位置(preset)：${finalTheme.typography.preset}`);
  lines.push(
    `- 文字颜色：titleColor ${finalTheme.typography.blocks.title.color}；subtitleColor ${finalTheme.typography.blocks.subtitle.color}；coordsColor ${finalTheme.typography.blocks.coords.color}`
  );
  return lines;
}
async function tryBuildStyleSnapshot(resourceId: string, threadId: string): Promise<StyleSnapshotResult> {
  try {
    const session = await postersRuntime.sessionStore.getSession(resourceId, threadId);
    const latestVersion = await postersRuntime.sessionStore.getLatestVersion(resourceId, threadId);
    const baseTheme = await postersRuntime.themeRepository.getThemeById(session.baseThemeId);
    const themeOverrideService = new ThemeOverrideService();
    const finalTheme = themeOverrideService.applyOverride(baseTheme, latestVersion.aiThemeOverride);
    const lines: string[] = [];
    lines.push(...extractPaletteSnapshot(finalTheme));
    lines.push(...extractTuningSnapshot(finalTheme));
    lines.push(...extractTypographySnapshot(finalTheme));
    return { lines, unavailable: false };
  } catch {
    return { lines: [], unavailable: true };
  }
}
function buildMetaLines(context: PosterContext): string[] {
  return [
    `海报分类：${context.category}`,
    `地点：${context.displayName}`,
    `基础主题：${context.baseThemeId}`,
    `版本：当前选中 v${context.selectedVersionNo}；最新 v${context.latestVersionNo}。`
  ];
}
function buildPosterContextSystemMessage(context: PosterContext): string {
  const lines: string[] = [];
  lines.push("以下为海报上下文（仅用于你生成样式 patch 的决策）：");
  lines.push("重要规则：不要向用户复述/展示以下任何内容；不要输出或提及任何分隔符。");
  lines.push(...buildMetaLines(context));
  if (context.selectedVersionNo !== context.latestVersionNo) {
    lines.push("提示：当前用户选中版本不是最新版本；下面（或你要使用的）样式基线以最新版本为准。");
  }
  return lines.join("\n");
}
async function buildEnhancedPosterContextSystemMessage(
  context: PosterContext,
  resourceId: string,
  threadId: string
): Promise<string> {
  const lines: string[] = [];
  lines.push(buildPosterContextSystemMessage(context));
  const snapshot = await tryBuildStyleSnapshot(resourceId, threadId);
  if (snapshot.unavailable) {
    lines.push("注意：本次无法获取“最新版本”的样式快照（可能是会话不存在/主题不可用/权限不匹配）。");
  } else {
    lines.push("");
    lines.push(`以下是最新版本（v${context.latestVersionNo}）当前生效的可改样式（仅 palette/tuning/typography）：`);
    lines.push(...snapshot.lines);
  }
  return lines.join("\n");
}
export class AiChatService extends BaseService {
  constructor() {
    super("AiChatService");
  }
  private buildSessionKey(resourceId: string, threadId: string): string {
    return `${resourceId}:${threadId}`;
  }
  async chatStream(request: AiChatRequestDTO): Promise<ChatStreamResultDTO> {
    const { userText, posterContext } = extractPosterContextBlock(request.userMessage);
    const resourceId = request.config?.resourceId || this.generateResourceId();
    const threadId = request.config?.threadId || this.generateThreadId();
    const sessionKey = request.config?.sessionKey || this.buildSessionKey(resourceId, threadId);
    try {
      eventStore.ensureSession(sessionKey);
      const abortController = new AbortController();
      const mastraRequestContext = new MastraRequestContext();
      const streamOptions = {
        memory: {
          thread: threadId,
          resource: resourceId
        },
        requestContext: mastraRequestContext as MastraRequestContext<unknown>,
        toolCallConcurrency: 1,
        abortSignal: abortController.signal
      };
      const agent = mastra.getAgent("exampleAgent");
      const messages = posterContext
        ? [
            {
              role: "system" as const,
              content: await buildEnhancedPosterContextSystemMessage(posterContext, resourceId, threadId)
            },
            { role: "user" as const, content: userText }
          ]
        : [{ role: "user" as const, content: userText }];
      const stream = await agent.stream(messages, streamOptions);
      return {
        stream: this.createEnhancedStream(stream as unknown as MastraAgentStreamResult, sessionKey, abortController),
        threadId,
        resourceId
      };
    } catch (error) {
      this.logError("Chat stream error", error);
      throw error;
    }
  }
  private createEnhancedStream(
    mastraStream: MastraAgentStreamResult,
    sessionKey: string,
    abortController: AbortController
  ): ReadableStream {
    const encoder = new TextEncoder();
    let cancelled = false;
    let iterator: AsyncIterator<MastraStreamEvent> | undefined;
    const abort = () => {
      if (!abortController.signal.aborted) {
        abortController.abort();
      }
    };
    return new ReadableStream({
      start: async controller => {
        let closed = false;
        try {
          const fullStream = mastraStream?.fullStream;
          if (!fullStream || typeof fullStream[Symbol.asyncIterator] !== "function") {
            throw new Error("Invalid Mastra stream: missing fullStream async iterator");
          }
          const streamIterator = fullStream[Symbol.asyncIterator]() as AsyncIterator<MastraStreamEvent>;
          iterator = streamIterator;
          if (cancelled || abortController.signal.aborted) {
            await streamIterator.return?.();
            return;
          }
          while (!cancelled) {
            const { value: event, done } = await streamIterator.next();
            if (done) break;
            const eventType = event?.type;
            const shouldForwardEvent = this.isAllowedSseEvent(eventType);
            if (eventType !== "text-delta" && shouldForwardEvent) {
              eventStore.notifyListeners(sessionKey, event);
            }
            if (eventType === "text-delta") {
              const content = event.payload?.text;
              if (content) {
                controller.enqueue(encoder.encode(content));
              } else {
                this.log("Warning: text-delta event has no content", event);
              }
            }
            if (eventType === "finish") {
              closed = true;
              controller.close();
              break;
            }
          }
          if (!closed && !cancelled) {
            controller.close();
          }
        } catch (error) {
          if (cancelled || abortController.signal.aborted) {
            return;
          }
          this.logError("Stream processing error", error);
          controller.error(error);
        } finally {
          await iterator?.return?.();
        }
      },
      cancel: async () => {
        cancelled = true;
        abort();
        await iterator?.return?.();
      }
    });
  }
  getEventsSince(sessionKey: string, lastEventId: string): Array<{ id: string; event: unknown }> {
    return eventStore.getEventsSince(sessionKey, lastEventId);
  }
  subscribeToSessionEvents(sessionKey: string, callback: EventListener): () => void {
    eventStore.addListener(sessionKey, callback);
    return () => {
      eventStore.removeListener(sessionKey, callback);
      this.log("SSE listener removed", { sessionKey });
    };
  }
  subscribeToSessionEventsWithReplay(
    sessionKey: string,
    callback: EventListener,
    options?: { lastEventId?: string }
  ): { missedEvents: Array<{ id: string; event: unknown }>; unsubscribe: () => void } {
    const { missedEvents, unsubscribe } = eventStore.subscribeWithReplay(sessionKey, callback, options);
    return {
      missedEvents,
      unsubscribe: () => {
        unsubscribe();
        this.log("SSE listener removed", { sessionKey });
      }
    };
  }
  private generateResourceId(): string {
    return `resource_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  private generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  private isAllowedSseEvent(eventType: unknown): boolean {
    if (typeof eventType !== "string") return false;
    return (
      eventType === "start" ||
      eventType === "step-start" ||
      eventType === "step-finish" ||
      eventType === "tool-call" ||
      eventType === "tool-result" ||
      eventType === "finish" ||
      eventType === "error"
    );
  }
}
