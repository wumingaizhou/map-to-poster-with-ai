import { Worker } from "worker_threads";
import { createHash, randomUUID } from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { AppError, ServiceUnavailableError } from "../../../errors/app-error";
import { createLogger } from "../../../utils/logger";
import { config } from "../../../config/env";
import type {
  CreateSessionTaskParams,
  IterateStyleTaskParams,
  WorkerTaskMessage,
  WorkerResultMessage
} from "./poster-worker";
export type { CreateSessionTaskParams, IterateStyleTaskParams };
const log = createLogger("PosterWorkerPool");
type PendingTask = {
  resolve: (png: Buffer) => void;
  reject: (err: Error) => void;
  slotIndex: number;
};
type WorkerSlot = {
  worker: Worker;
  activeTasks: number;
  ready: boolean;
  readyPromise: Promise<void>;
  readyResolve: () => void;
  readyReject: (err: Error) => void;
};
function compileWorkerDev(tsPath: string): string {
  const req = createRequire(import.meta.url);
  const { buildSync } = req("esbuild") as typeof import("esbuild");
  const outPath = path.join(path.dirname(tsPath), ".poster-worker", "poster-worker.dev.mjs");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  buildSync({
    entryPoints: [tsPath],
    outfile: outPath,
    format: "esm",
    platform: "node",
    bundle: true,
    packages: "external",
    sourcemap: true
  });
  return outPath;
}
function resolveWorkerPath(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = path.dirname(thisFile);
  const jsPath = path.join(thisDir, "poster-worker.js");
  if (fs.existsSync(jsPath)) return jsPath;
  const tsPath = path.join(thisDir, "poster-worker.ts");
  if (fs.existsSync(tsPath)) return compileWorkerDev(tsPath);

  // Fallback for mastra dev environment where output is in .mastra/output
  // Try to find the source file relative to the project root
  // Assuming .mastra/output is 2 levels deep from project root (apps/backend)
  const fallbackTsPath = path.resolve(thisDir, "../../src/services/infra/posters/poster-worker.ts");
  if (fs.existsSync(fallbackTsPath)) return compileWorkerDev(fallbackTsPath);

  throw new Error(`Worker script not found. Searched:\n  ${jsPath}\n  ${tsPath}\n  ${fallbackTsPath}`);
}
function reconstructError(serialized: { message: string; statusCode: number; code?: string }): AppError {
  return new AppError(serialized.message, serialized.statusCode, serialized.code);
}
export class PosterWorkerPool {
  private readonly slots: WorkerSlot[] = [];
  private readonly pending = new Map<string, PendingTask>();
  private readonly workerPath: string;
  private readonly poolSize: number;
  private readonly memoryLimitMb: number;
  private terminated = false;
  constructor() {
    this.workerPath = resolveWorkerPath();
    this.poolSize = config.posters.workerPoolSize;
    this.memoryLimitMb = config.posters.workerMemoryLimitMb;
  }
  async init(): Promise<void> {
    for (let i = 0; i < this.poolSize; i++) {
      this.spawnWorkerAt(i);
    }
    await Promise.all(this.slots.map((_, i) => this.waitForSlotReady(i, 10_000)));
    log.info(
      { poolSize: this.poolSize, memoryLimitMb: this.memoryLimitMb, workerPath: this.workerPath },
      "Worker pool initialized"
    );
  }
  async execute(params: CreateSessionTaskParams | IterateStyleTaskParams): Promise<Buffer> {
    if (this.terminated) {
      throw new ServiceUnavailableError("Worker pool has been terminated");
    }
    await this.waitForAnyReady(30_000);
    const affinitySlotIndex = this.getAffinitySlotIndex(params);
    const slotIndex = this.pickSlotIndex(affinitySlotIndex);
    const slot = this.slots[slotIndex]!;
    const taskId = randomUUID();
    const message: WorkerTaskMessage = { taskId, ...params };
    slot.activeTasks++;
    return new Promise<Buffer>((resolve, reject) => {
      this.pending.set(taskId, { resolve, reject, slotIndex });
      try {
        slot.worker.postMessage(message);
      } catch (err) {
        this.pending.delete(taskId);
        slot.activeTasks--;
        const error = err instanceof Error ? err : new Error(String(err));
        reject(error);
      }
    });
  }
  async terminate(): Promise<void> {
    this.terminated = true;
    if (this.slots.length === 0) return;
    if (this.pending.size === 0) {
      await Promise.all(this.slots.map(s => s.worker.terminate()));
      this.slots.length = 0;
      log.info("All workers terminated (idle)");
      return;
    }
    log.info({ pendingTasks: this.pending.size }, "Waiting for pending tasks before terminating workers");
    await new Promise<void>(resolve => {
      const checkDone = () => {
        if (this.pending.size === 0) {
          clearInterval(interval);
          clearTimeout(timeout);
          resolve();
        }
      };
      const interval = setInterval(checkDone, 100);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        log.warn("Force terminating workers due to shutdown timeout");
        this.rejectAllPending(new ServiceUnavailableError("Worker terminated due to shutdown"));
        resolve();
      }, 10_000);
      timeout.unref?.();
      checkDone();
    });
    await Promise.all(this.slots.map(s => s.worker.terminate()));
    this.slots.length = 0;
    log.info("All workers terminated");
  }
  private spawnWorkerAt(index: number): void {
    if (this.terminated) {
      throw new ServiceUnavailableError("Worker pool has been terminated");
    }
    let readyResolve!: () => void;
    let readyReject!: (err: Error) => void;
    const readyPromise = new Promise<void>((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
    });
    const worker = new Worker(this.workerPath, {
      resourceLimits: {
        maxOldGenerationSizeMb: this.memoryLimitMb
      }
    });
    const slot: WorkerSlot = {
      worker,
      activeTasks: 0,
      ready: false,
      readyPromise,
      readyResolve,
      readyReject
    };
    this.slots[index] = slot;
    worker.on("message", (msg: WorkerResultMessage | { type: string }) => {
      if ("type" in msg && msg.type === "ready") {
        slot.ready = true;
        slot.readyResolve();
        return;
      }
      const result = msg as WorkerResultMessage;
      const task = this.pending.get(result.taskId);
      if (!task) return;
      this.pending.delete(result.taskId);
      if (slot.activeTasks > 0) slot.activeTasks--;
      if (result.success) {
        const png = Buffer.isBuffer(result.png) ? result.png : Buffer.from(result.png);
        task.resolve(png);
      } else {
        task.reject(reconstructError(result.error));
      }
    });
    worker.on("error", (err: Error) => {
      log.error({ error: err.message, slotIndex: index }, "Worker error");
    });
    worker.on("exit", (code: number) => {
      log.warn({ exitCode: code, slotIndex: index }, "Worker exited");
      if (!slot.ready) {
        slot.readyReject(new ServiceUnavailableError("Poster worker exited during startup"));
      }
      slot.ready = false;
      this.rejectSlotPending(index, new ServiceUnavailableError("Poster worker crashed unexpectedly"));
      if (!this.terminated) {
        log.info({ slotIndex: index }, "Respawning worker");
        this.spawnWorkerAt(index);
      }
    });
  }
  private getAffinitySlotIndex(params: CreateSessionTaskParams | IterateStyleTaskParams): number | undefined {
    if (this.slots.length <= 1) return undefined;
    const signature = stableStringify(params);
    const hash = createHash("sha1").update(signature).digest().readUInt32BE(0);
    return hash % this.slots.length;
  }
  private pickSlotIndex(preferredIndex?: number): number {
    if (preferredIndex !== undefined) {
      const preferred = this.slots[preferredIndex];
      if (preferred?.ready) {
        return preferredIndex;
      }
    }
    let bestIndex = -1;
    let bestTasks = Infinity;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i]!;
      if (!slot.ready) continue;
      if (slot.activeTasks < bestTasks) {
        bestTasks = slot.activeTasks;
        bestIndex = i;
      }
    }
    if (bestIndex === -1) {
      throw new ServiceUnavailableError("No ready workers available");
    }
    return bestIndex;
  }
  private rejectSlotPending(slotIndex: number, error: Error): void {
    for (const [taskId, task] of this.pending) {
      if (task.slotIndex === slotIndex) {
        task.reject(error);
        this.pending.delete(taskId);
      }
    }
  }
  private rejectAllPending(error: Error): void {
    for (const [taskId, task] of this.pending) {
      task.reject(error);
      this.pending.delete(taskId);
    }
  }
  private async waitForSlotReady(index: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    while (true) {
      if (this.terminated) {
        throw new ServiceUnavailableError("Worker pool has been terminated");
      }
      const slot = this.slots[index]!;
      if (slot.ready) return;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new ServiceUnavailableError("Poster worker did not become ready in time");
      }
      try {
        await withTimeout(slot.readyPromise, remaining);
        return;
      } catch {
        continue;
      }
    }
  }
  private async waitForAnyReady(timeoutMs: number): Promise<void> {
    if (this.terminated) {
      throw new ServiceUnavailableError("Worker pool has been terminated");
    }
    if (this.slots.length === 0) {
      throw new ServiceUnavailableError("Worker pool not initialized");
    }
    if (this.slots.some(s => s.ready)) return;
    const deadline = Date.now() + Math.max(0, timeoutMs);
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new ServiceUnavailableError("No workers became ready in time");
      }
      try {
        await withTimeout(Promise.race(this.slots.map(s => s.readyPromise)), remaining);
        return;
      } catch {
        if (this.terminated) {
          throw new ServiceUnavailableError("Worker pool has been terminated");
        }
        if (this.slots.some(s => s.ready)) return;
        continue;
      }
    }
  }
}
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    return Promise.reject(new Error("Timeout"));
  }
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout"));
    }, timeoutMs);
    timeout.unref?.();
    promise.then(
      value => {
        clearTimeout(timeout);
        resolve(value);
      },
      err => {
        clearTimeout(timeout);
        reject(err);
      }
    );
  });
}
function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
