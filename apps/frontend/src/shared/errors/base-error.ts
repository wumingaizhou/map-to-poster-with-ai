export type ErrorSeverity = "low" | "medium" | "high" | "critical";
export interface ErrorMetadata {
  module?: string;
  operation?: string;
  details?: Record<string, unknown>;
}
export abstract class BaseError extends Error {
  abstract readonly code: string;
  readonly recoverable: boolean;
  readonly metadata?: ErrorMetadata;
  readonly cause?: unknown;
  protected constructor(message: string, recoverable: boolean = true, metadata?: ErrorMetadata, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.recoverable = recoverable;
    this.metadata = metadata;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      metadata: this.metadata,
      stack: this.stack
    };
  }
}
export const ErrorUtils = {
  isBaseError(error: unknown): error is BaseError {
    return error instanceof BaseError;
  },
  getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return "Unknown error";
  },
  getErrorCode(error: unknown, defaultCode: string = "UNKNOWN_ERROR"): string {
    if (ErrorUtils.isBaseError(error)) {
      return error.code;
    }
    return defaultCode;
  },
  isRecoverable(error: unknown, defaultValue: boolean = true): boolean {
    if (ErrorUtils.isBaseError(error)) {
      return error.recoverable;
    }
    return defaultValue;
  }
};
