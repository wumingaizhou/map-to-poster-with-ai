import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createLogger } from "../../utils/logger";

const log = createLogger("FeedbackService");

export interface FeedbackDTO {
  type: "suggestion" | "bug" | "other";
  content: string;
  contact: string;
}

const TYPE_LABELS: Record<string, string> = {
  suggestion: "功能建议",
  bug: "问题反馈",
  other: "其他"
};

export class FeedbackService {
  private readonly feedbackDir: string;

  constructor(feedbackDir?: string) {
    this.feedbackDir = feedbackDir ?? join(process.cwd(), "poster-assets", "feedback");
  }

  async submitFeedback(dto: FeedbackDTO): Promise<void> {
    await mkdir(this.feedbackDir, { recursive: true });

    const now = new Date();
    const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const time = now.toTimeString().slice(0, 8).replace(/:/g, ""); // HHmmss
    const id = randomBytes(3).toString("hex"); // 6 char random id
    const filename = `${date}_${time}_${id}.txt`;

    const timeStr = `${date} ${now.toTimeString().slice(0, 8)}`;
    const lines = [`类型: ${TYPE_LABELS[dto.type] ?? dto.type}`, `时间: ${timeStr}`];
    if (dto.contact) {
      lines.push(`联系方式: ${dto.contact}`);
    }
    lines.push("", "详细描述:", dto.content);

    const filepath = join(this.feedbackDir, filename);
    await writeFile(filepath, lines.join("\n"), "utf-8");

    log.info({ filename }, "Feedback saved");
  }
}
