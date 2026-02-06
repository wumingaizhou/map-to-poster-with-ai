export interface TimeoutControllerOptions {
  timeoutMs: number;
  parentSignal?: AbortSignal;
}
export interface TimeoutControllerResult {
  signal: AbortSignal;
  timeoutController: AbortController;
  clearTimeoutTimer: () => void;
  cleanup: () => void;
  isTimedOut: () => boolean;
}
export function createTimeoutController(options: TimeoutControllerOptions): TimeoutControllerResult {
  const { timeoutMs, parentSignal } = options;
  const timeoutController = new AbortController();
  const mergedController = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => timeoutController.abort(), timeoutMs);
  let cleaned = false;
  const handleAbort = () => mergedController.abort();
  timeoutController.signal.addEventListener("abort", handleAbort, { once: true });
  parentSignal?.addEventListener("abort", handleAbort, { once: true });
  const clearTimeoutTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearTimeoutTimer();
    timeoutController.signal.removeEventListener("abort", handleAbort);
    parentSignal?.removeEventListener("abort", handleAbort);
  };
  mergedController.signal.addEventListener("abort", cleanup, { once: true });
  return {
    signal: mergedController.signal,
    timeoutController,
    clearTimeoutTimer,
    cleanup,
    isTimedOut: () => timeoutController.signal.aborted
  };
}
