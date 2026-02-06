import { BaseError, type ErrorMetadata } from "@/shared/errors";
import { httpStatus } from "@/config";
export type ApiClientErrorKind = "NETWORK" | "TIMEOUT" | "ABORT" | "HTTP" | "PARSE" | "VALIDATION";
export abstract class ApiClientError extends BaseError {
  abstract readonly kind: ApiClientErrorKind;
  readonly code: string;
  protected constructor(
    message: string,
    kind: ApiClientErrorKind,
    cause?: unknown,
    options?: { recoverable?: boolean; metadata?: ErrorMetadata }
  ) {
    super(message, options?.recoverable ?? true, { module: "api-client", ...options?.metadata }, cause);
    this.code = `API_${kind}_ERROR`;
  }
}
export class ApiNetworkError extends ApiClientError {
  readonly kind = "NETWORK" as const;
  constructor(message: string, cause?: unknown) {
    super(message, "NETWORK", cause);
  }
}
export class ApiTimeoutError extends ApiClientError {
  readonly kind = "TIMEOUT" as const;
  constructor(message: string, cause?: unknown) {
    super(message, "TIMEOUT", cause);
  }
}
export class ApiAbortError extends ApiClientError {
  readonly kind = "ABORT" as const;
  constructor(message: string, cause?: unknown) {
    super(message, "ABORT", cause, { recoverable: true });
  }
}
export class ApiParseError extends ApiClientError {
  readonly kind = "PARSE" as const;
  constructor(message: string, cause?: unknown) {
    super(message, "PARSE", cause, { recoverable: false });
  }
}
export class ApiHttpError extends ApiClientError {
  readonly kind = "HTTP" as const;
  readonly status: number;
  readonly responseBody?: unknown;
  constructor(params: { status: number; message: string; responseBody?: unknown; cause?: unknown }) {
    const recoverable = ApiHttpError.isRecoverableStatus(params.status);
    super(params.message, "HTTP", params.cause, {
      recoverable,
      metadata: { operation: "http", details: { status: params.status } }
    });
    this.status = params.status;
    this.responseBody = params.responseBody;
  }
  private static isRecoverableStatus(status: number): boolean {
    if (status >= httpStatus.SERVER_ERROR_MIN) {
      return true;
    }
    return status === httpStatus.REQUEST_TIMEOUT || status === httpStatus.TOO_MANY_REQUESTS;
  }
}
export class ApiValidationError extends ApiClientError {
  readonly kind = "VALIDATION" as const;
  readonly validationErrors: Array<{
    code: string;
    message: string;
    path: (string | number)[];
  }>;
  readonly responseBody?: unknown;
  constructor(
    message: string,
    errors: Array<{ code: string; message: string; path: (string | number)[] }>,
    responseBody?: unknown
  ) {
    super(message, "VALIDATION", undefined, { recoverable: false });
    this.validationErrors = errors;
    this.responseBody = responseBody;
  }
}
