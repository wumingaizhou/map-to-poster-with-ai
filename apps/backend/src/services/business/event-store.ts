import { config } from "../../config/env";
import { TooManyRequestsError } from "../../errors/app-error";
import { createLogger } from "../../utils/logger";
const log = createLogger("EventStore");
export interface EventHistoryItem {
  id: string;
  event: unknown;
  timestamp: number;
}
export type EventListener = (event: unknown) => void;
interface SessionData {
  listeners: Set<EventListener>;
  history: EventHistoryItem[];
  lastActivityAt: number;
}
export class EventStore {
  private sessions = new Map<string, SessionData>();
  private readonly historyLimit: number;
  private readonly maxSessions: number;
  private readonly sessionTtl: number;
  private readonly cleanupInterval: number;
  private cleanupTimer: NodeJS.Timeout | null = null;
  constructor(options?: {
    historyLimit?: number;
    maxSessions?: number;
    sessionTtl?: number;
    cleanupInterval?: number;
  }) {
    this.historyLimit = options?.historyLimit ?? config.eventStore.historyLimit;
    this.maxSessions = options?.maxSessions ?? config.eventStore.maxSessions;
    this.sessionTtl = options?.sessionTtl ?? config.eventStore.sessionTtl;
    this.cleanupInterval = options?.cleanupInterval ?? config.eventStore.cleanupInterval;
    this.startCleanupTimer();
  }
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.cleanupInterval);
    this.cleanupTimer.unref();
  }
  public stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessionIds: string[] = [];
    for (const [sessionId, data] of this.sessions) {
      if (data.listeners.size === 0 && now - data.lastActivityAt > this.sessionTtl) {
        expiredSessionIds.push(sessionId);
      }
    }
    for (const sessionId of expiredSessionIds) {
      this.sessions.delete(sessionId);
    }
    if (expiredSessionIds.length > 0) {
      log.info(
        {
          expiredCount: expiredSessionIds.length,
          remainingSessions: this.sessions.size
        },
        "Expired sessions cleaned up"
      );
    }
  }
  private evictLruSessions(options?: { protectedSessionIds?: Set<string> }): {
    evictedCount: number;
    trimmedToMax: boolean;
    evictableCount: number;
  } {
    if (this.sessions.size <= this.maxSessions) {
      return { evictedCount: 0, trimmedToMax: true, evictableCount: 0 };
    }
    const protectedSessionIds = options?.protectedSessionIds ?? new Set<string>();
    const totalBefore = this.sessions.size;
    const evictableSessions: Array<{ sessionId: string; lastActivityAt: number }> = [];
    for (const [sessionId, data] of this.sessions) {
      if (data.listeners.size === 0 && !protectedSessionIds.has(sessionId)) {
        evictableSessions.push({ sessionId, lastActivityAt: data.lastActivityAt });
      }
    }
    evictableSessions.sort((a, b) => a.lastActivityAt - b.lastActivityAt);
    const evictCount = totalBefore - this.maxSessions;
    const toEvict = evictableSessions.slice(0, evictCount);
    for (const { sessionId } of toEvict) {
      this.sessions.delete(sessionId);
    }
    if (toEvict.length > 0) {
      log.info(
        {
          evictedCount: toEvict.length,
          remainingSessions: this.sessions.size,
          maxSessions: this.maxSessions
        },
        "LRU session eviction completed"
      );
    }
    return {
      evictedCount: toEvict.length,
      trimmedToMax: this.sessions.size <= this.maxSessions,
      evictableCount: evictableSessions.length
    };
  }
  private getOrCreateSession(sessionKey: string): SessionData {
    let session = this.sessions.get(sessionKey);
    if (!session) {
      session = {
        listeners: new Set(),
        history: [],
        lastActivityAt: Date.now()
      };
      this.sessions.set(sessionKey, session);
      const eviction = this.evictLruSessions({ protectedSessionIds: new Set([sessionKey]) });
      if (!eviction.trimmedToMax) {
        this.sessions.delete(sessionKey);
        const activeSessions = Array.from(this.sessions.values()).filter(v => v.listeners.size > 0).length;
        log.warn(
          {
            attemptedSessionKey: sessionKey,
            totalSessions: this.sessions.size,
            activeSessions,
            maxSessions: this.maxSessions,
            evictableCount: eviction.evictableCount
          },
          "EventStore at capacity; rejecting new session"
        );
        throw new TooManyRequestsError(
          "Event store is at capacity, please retry later",
          "EVENT_STORE_SESSION_LIMIT_EXCEEDED"
        );
      }
    }
    return session;
  }
  ensureSession(sessionKey: string): void {
    this.getOrCreateSession(sessionKey);
  }
  private touchSession(sessionKey: string): void {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.lastActivityAt = Date.now();
    }
  }
  addListener(sessionKey: string, callback: EventListener): void {
    const session = this.getOrCreateSession(sessionKey);
    session.listeners.add(callback);
    this.touchSession(sessionKey);
  }
  subscribeWithReplay(
    sessionKey: string,
    callback: EventListener,
    options?: { lastEventId?: string }
  ): { missedEvents: Array<{ id: string; event: unknown }>; unsubscribe: () => void } {
    const session = this.getOrCreateSession(sessionKey);
    const lastEventId = options?.lastEventId;
    const missedEvents = lastEventId
      ? this.getEventsSince(sessionKey, lastEventId)
      : session.history.map(h => ({ id: h.id, event: h.event }));
    session.listeners.add(callback);
    this.touchSession(sessionKey);
    const unsubscribe = () => {
      this.removeListener(sessionKey, callback);
      this.touchSession(sessionKey);
    };
    return { missedEvents, unsubscribe };
  }
  removeListener(sessionKey: string, callback: EventListener): void {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.listeners.delete(callback);
    }
  }
  notifyListeners(sessionKey: string, event: unknown): string {
    const session = this.getOrCreateSession(sessionKey);
    this.touchSession(sessionKey);
    const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const eventWithId =
      event !== null && typeof event === "object"
        ? { ...(event as object), _eventId: eventId }
        : { event, _eventId: eventId };
    this.addToHistory(sessionKey, eventId, eventWithId);
    if (session.listeners.size > 0) {
      session.listeners.forEach(callback => {
        try {
          callback(eventWithId);
        } catch (error) {
          log.error({ error, sessionKey }, "Error in event listener");
        }
      });
    }
    return eventId;
  }
  private addToHistory(sessionKey: string, eventId: string, event: unknown): void {
    const session = this.sessions.get(sessionKey);
    if (!session) return;
    session.history.push({
      id: eventId,
      event,
      timestamp: Date.now()
    });
    if (session.history.length > this.historyLimit) {
      session.history.shift();
    }
  }
  getEventsSince(sessionKey: string, lastEventId: string): Array<{ id: string; event: unknown }> {
    const session = this.sessions.get(sessionKey);
    if (!session) return [];
    const history = session.history;
    const startIndex = history.findIndex(h => h.id === lastEventId);
    if (startIndex === -1) {
      log.warn(
        { sessionKey, lastEventId, historySize: history.length },
        "lastEventId not found in history, client should perform full resync"
      );
      return [];
    }
    return history.slice(startIndex + 1).map(h => ({ id: h.id, event: h.event }));
  }
  hasListeners(sessionKey: string): boolean {
    const session = this.sessions.get(sessionKey);
    return !!session && session.listeners.size > 0;
  }
  clearSession(sessionKey: string): void {
    this.sessions.delete(sessionKey);
  }
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    maxSessions: number;
    sessionTtl: number;
  } {
    let activeSessions = 0;
    for (const [, data] of this.sessions) {
      if (data.listeners.size > 0) {
        activeSessions++;
      }
    }
    return {
      totalSessions: this.sessions.size,
      activeSessions,
      maxSessions: this.maxSessions,
      sessionTtl: this.sessionTtl
    };
  }
}
export const eventStore = new EventStore();
