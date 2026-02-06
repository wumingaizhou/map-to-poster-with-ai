import { BaseError, type ErrorMetadata } from "@/shared/errors";
export abstract class BusinessError extends BaseError {
  readonly code: string;
  protected constructor(
    message: string,
    code: string,
    recoverable: boolean = true,
    metadata?: ErrorMetadata,
    cause?: unknown
  ) {
    super(message, recoverable, metadata, cause);
    this.code = code;
  }
}
export type { BusinessError as IBusinessError };
export class UnexpectedServiceError extends BusinessError {
  constructor(message: string, cause?: unknown) {
    super(message, "UNEXPECTED_SERVICE_ERROR", true, { module: "api", operation: "unexpected" }, cause);
  }
}
