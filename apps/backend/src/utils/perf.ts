import { monitorEventLoopDelay } from "perf_hooks";
const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelay.enable();
function bytesToMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}
function nsToMs(ns: number): number {
  return Math.round((ns / 1e6) * 100) / 100;
}
export function getEventLoopDelayMetrics(): {
  minMs: number;
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p99Ms: number;
  maxMs: number;
} {
  return {
    minMs: nsToMs(eventLoopDelay.min),
    meanMs: nsToMs(eventLoopDelay.mean),
    p50Ms: nsToMs(eventLoopDelay.percentile(50)),
    p90Ms: nsToMs(eventLoopDelay.percentile(90)),
    p99Ms: nsToMs(eventLoopDelay.percentile(99)),
    maxMs: nsToMs(eventLoopDelay.max)
  };
}
export function getMemoryMetrics(): {
  rssMb: number;
  heapTotalMb: number;
  heapUsedMb: number;
  externalMb: number;
  arrayBuffersMb: number;
} {
  const mem = process.memoryUsage();
  return {
    rssMb: bytesToMb(mem.rss),
    heapTotalMb: bytesToMb(mem.heapTotal),
    heapUsedMb: bytesToMb(mem.heapUsed),
    externalMb: bytesToMb(mem.external),
    arrayBuffersMb: bytesToMb(mem.arrayBuffers)
  };
}
