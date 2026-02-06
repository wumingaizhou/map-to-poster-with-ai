import { UnexpectedServiceError, type BusinessError } from "./business-error-base";
import { ApiClientError } from "../../api-client/errors";
export interface ErrorContext {
  operation?: string;
  metadata?: Record<string, unknown>;
}
export interface ErrorLoggerOptions {
  logToConsole?: boolean;
  onError?: (error: Error, context?: ErrorContext) => void;
}
export abstract class DataService {
  protected readonly errorLoggerOptions: ErrorLoggerOptions;
  constructor(options?: ErrorLoggerOptions) {
    this.errorLoggerOptions = {
      logToConsole: true,
      ...options
    };
  }
  protected toBusinessError(error: unknown, context?: ErrorContext): BusinessError {
    this.logError(error, context);
    if (this.isBusinessError(error)) {
      return error;
    }
    const domainError = this.mapToDomainError(error, context);
    if (domainError) {
      return domainError;
    }
    if (error instanceof ApiClientError) {
      return this.mapApiClientError(error, context);
    }
    if (error instanceof Error) {
      return this.unexpected(error.message, error);
    }
    return this.unexpected(String(error), error);
  }
  protected mapToDomainError(_error: unknown, _context?: ErrorContext): BusinessError | null {
    return null;
  }
  protected mapApiClientError(error: ApiClientError, context?: ErrorContext): BusinessError {
    const operation = context?.operation ?? "operation";
    const message = `${operation} failed: ${error.message}`;
    return this.unexpected(message, error);
  }
  protected unexpected(message: string, cause?: unknown): BusinessError {
    return new UnexpectedServiceError(message, cause);
  }
  protected isBusinessError(error: unknown): error is BusinessError {
    return (
      error instanceof Error &&
      "code" in error &&
      "recoverable" in error &&
      typeof (error as BusinessError).code === "string" &&
      typeof (error as BusinessError).recoverable === "boolean"
    );
  }
  protected logError(error: unknown, context?: ErrorContext): void {
    const { logToConsole, onError } = this.errorLoggerOptions;
    if (logToConsole) {
      const contextInfo = context?.operation ? ` [${context.operation}]` : "";
      console.error(`[DataService]${contextInfo} Error:`, error);
    }
    if (onError && error instanceof Error) {
      onError(error, context);
    }
  }
}
