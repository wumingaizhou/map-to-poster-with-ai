import { getCurrentScope, onScopeDispose } from "vue";
interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}
type IdleRequestCallback = (deadline: IdleDeadline) => void;
interface IdleCallbackOptions {
  timeout?: number;
  fallbackDelay?: number;
}
interface ScheduledTask {
  cancel: () => void;
}
type HandleType = "idle" | "timeout";
function getIdleCallbackAPI() {
  const win = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  const requestIdleCallback = win.requestIdleCallback?.bind(win);
  const cancelIdleCallback = win.cancelIdleCallback?.bind(win);
  return {
    requestIdleCallback,
    cancelIdleCallback,
    isSupported: typeof requestIdleCallback === "function"
  };
}
export function useIdleCallback() {
  const idleAPI = getIdleCallbackAPI();
  const activeHandles = new Map<number, { handleId: number; handleType: HandleType }>();
  let taskIdCounter = 0;
  function scheduleIdleTask(callback: () => void | Promise<void>, options?: IdleCallbackOptions): ScheduledTask {
    const { timeout = 1000, fallbackDelay = 100 } = options ?? {};
    const taskId = ++taskIdCounter;
    let handleId: number;
    let handleType: HandleType;
    const execute = () => {
      activeHandles.delete(taskId);
      void callback();
    };
    if (idleAPI.isSupported && idleAPI.requestIdleCallback) {
      handleType = "idle";
      handleId = idleAPI.requestIdleCallback(execute, { timeout });
    } else {
      handleType = "timeout";
      handleId = window.setTimeout(execute, fallbackDelay);
    }
    activeHandles.set(taskId, { handleId, handleType });
    return {
      cancel: () => {
        const handle = activeHandles.get(taskId);
        if (!handle) return;
        if (handle.handleType === "idle" && idleAPI.cancelIdleCallback) {
          idleAPI.cancelIdleCallback(handle.handleId);
        } else {
          window.clearTimeout(handle.handleId);
        }
        activeHandles.delete(taskId);
      }
    };
  }
  function cancelAll() {
    for (const [, handle] of activeHandles) {
      if (handle.handleType === "idle" && idleAPI.cancelIdleCallback) {
        idleAPI.cancelIdleCallback(handle.handleId);
      } else {
        window.clearTimeout(handle.handleId);
      }
    }
    activeHandles.clear();
  }
  if (getCurrentScope()) {
    onScopeDispose(cancelAll);
  }
  return {
    scheduleIdleTask,
    cancelAll
  };
}
