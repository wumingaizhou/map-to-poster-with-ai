import { Worker } from "worker_threads";
import { randomUUID } from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { AppError, ServiceUnavailableError } from "../../../errors/app-error";
import { createLogger } from "../../../utils/logger";
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
  throw new Error(`Worker script not found. Searched:\n  ${jsPath}\n  ${tsPath}`);
}
function reconstructError(serialized: { message: string; statusCode: number; code?: string }): AppError {
  return new AppError(serialized.message, serialized.statusCode, serialized.code);
}
export class PosterWorkerPool {
  private worker: Worker | null = null;
  private readonly pending = new Map<string, PendingTask>();
  private readonly workerPath: string;
  private terminated = false;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((err: Error) => void) | null = null;
  constructor() {
    this.workerPath = resolveWorkerPath();
  }
  async init(): Promise<void> {
    await this.ensureReady(10_000);
    log.info({ workerPath: this.workerPath }, "Worker pool initialized");
  }
  async execute(params: CreateSessionTaskParams | IterateStyleTaskParams): Promise<Buffer> {
    if (this.terminated) {
      throw new ServiceUnavailableError("Worker pool has been terminated");
    }
    await this.ensureReady(30_000);
    const taskId = randomUUID();
    const message: WorkerTaskMessage = { taskId, ...params };
    return new Promise<Buffer>((resolve, reject) => {
      const worker = this.worker;
      if (!worker) {
        reject(new ServiceUnavailableError("Poster worker is not available"));
        return;
      }
      this.pending.set(taskId, { resolve, reject });
      try {
        worker.postMessage(message);
      } catch (err) {
        this.pending.delete(taskId);
        const error = err instanceof Error ? err : new Error(String(err));
        reject(error);
      }
    });
  }
  async terminate(): Promise<void> {
    this.terminated = true;
    const worker = this.worker;
    if (!worker) return;
    if (this.pending.size === 0) {
      await worker.terminate();
      this.worker = null;
      log.info("Worker terminated (idle)");
      return;
    }
    log.info({ pendingTasks: this.pending.size }, "Waiting for pending tasks before terminating worker");
    await new Promise<void>(resolve => {
      const checkDone = () => {
        if (this.pending.size === 0) {
          resolve();
        }
      };
      const interval = setInterval(checkDone, 100);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        log.warn("Force terminating worker due to shutdown timeout");
        this.rejectAllPending(new ServiceUnavailableError("Worker terminated due to shutdown"));
        resolve();
      }, 10_000);
      timeout.unref?.();
      checkDone();
    });
    await worker.terminate();
    this.worker = null;
    log.info("Worker terminated");
  }
  private spawnWorker(): void {
    if (this.terminated) {
      throw new ServiceUnavailableError("Worker pool has been terminated");
    }
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    const worker = new Worker(this.workerPath);
    this.worker = worker;
    worker.on("message", (msg: WorkerResultMessage | { type: string }) => {
      if ("type" in msg && msg.type === "ready") {
        this.readyResolve?.();
        this.readyResolve = null;
        this.readyReject = null;
        return;
      }
      const result = msg as WorkerResultMessage;
      const task = this.pending.get(result.taskId);
      if (!task) return;
      this.pending.delete(result.taskId);
      if (result.success) {
        const png = Buffer.isBuffer(result.png) ? result.png : Buffer.from(result.png);
        task.resolve(png);
      } else {
        task.reject(reconstructError(result.error));
      }
    });
    worker.on("error", (err: Error) => {
      log.error({ error: err.message }, "Worker error");
    });
    worker.on("exit", (code: number) => {
      log.warn({ exitCode: code }, "Worker exited");
      this.readyReject?.(new ServiceUnavailableError("Poster worker exited during startup"));
      this.readyResolve = null;
      this.readyReject = null;
      this.rejectAllPending(new ServiceUnavailableError("Poster worker crashed unexpectedly"));
      this.worker = null;
      if (!this.terminated) {
        log.info("Respawning worker");
        this.spawnWorker();
      }
    });
  }
  private rejectAllPending(error: Error): void {
    for (const [taskId, task] of this.pending) {
      task.reject(error);
      this.pending.delete(taskId);
    }
  }
  private async ensureReady(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    while (true) {
      if (this.terminated) {
        throw new ServiceUnavailableError("Worker pool has been terminated");
      }
      if (!this.worker) {
        this.spawnWorker();
      }
      const readyPromise = this.readyPromise;
      if (!readyPromise) return;
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        throw new ServiceUnavailableError("Poster worker did not become ready in time");
      }
      try {
        await withTimeout(readyPromise, remainingMs);
        return;
      } catch {
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
