import { reconnectStrategyDefaults } from "@/config";

export interface ReconnectStrategyConfig {
  baseDelay: number;
  maxDelay: number;
  maxAttempts: number;
  jitterFactor?: number;
}

export interface IReconnectStrategy {
  nextDelay(): number;
  canRetry(): boolean;
  reset(): void;
  readonly attempts: number;
  readonly maxAttempts: number;
}

export const DEFAULT_RECONNECT_CONFIG: Required<ReconnectStrategyConfig> = {
  ...reconnectStrategyDefaults
};

export class ExponentialBackoffStrategy implements IReconnectStrategy {
  private _attempts = 0;
  private readonly config: Required<ReconnectStrategyConfig>;

  constructor(config?: Partial<ReconnectStrategyConfig>) {
    this.config = { ...DEFAULT_RECONNECT_CONFIG, ...config };
  }

  nextDelay(): number {
    const { baseDelay, maxDelay, jitterFactor } = this.config;

    const exponentialDelay = baseDelay * Math.pow(2, this._attempts);

    const jitter = (Math.random() * 2 - 1) * jitterFactor * baseDelay;

    const delay = Math.min(exponentialDelay + jitter, maxDelay);

    this._attempts++;

    return Math.max(0, delay);
  }

  peekDelay(): number {
    const { baseDelay, maxDelay, jitterFactor } = this.config;
    const exponentialDelay = baseDelay * Math.pow(2, this._attempts);
    const jitter = (Math.random() * 2 - 1) * jitterFactor * baseDelay;
    return Math.max(0, Math.min(exponentialDelay + jitter, maxDelay));
  }

  canRetry(): boolean {
    const { maxAttempts } = this.config;
    return maxAttempts === 0 || this._attempts < maxAttempts;
  }

  reset(): void {
    this._attempts = 0;
  }

  get attempts(): number {
    return this._attempts;
  }

  get maxAttempts(): number {
    return this.config.maxAttempts;
  }

  formatAttempts(): string {
    const { maxAttempts } = this.config;
    return `${this._attempts}/${maxAttempts === 0 ? "∞" : maxAttempts}`;
  }
}

export function createReconnectStrategy(config?: Partial<ReconnectStrategyConfig>): ExponentialBackoffStrategy {
  return new ExponentialBackoffStrategy(config);
}
