export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}
export class ValidationError extends AppError {
  constructor(message: string = "Validation failed") {
    super(message, 400, "VALIDATION_ERROR");
  }
}
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}
export class AuthTokenMissingError extends AppError {
  constructor(message: string = "Missing authorization token") {
    super(message, 401, "AUTH_TOKEN_MISSING");
  }
}
export class AuthTokenInvalidError extends AppError {
  constructor(message: string = "Invalid authorization token") {
    super(message, 401, "AUTH_TOKEN_INVALID");
  }
}
export class AuthTokenExpiredError extends AppError {
  constructor(message: string = "Authorization token expired") {
    super(message, 401, "AUTH_TOKEN_EXPIRED");
  }
}
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}
export class TooManyRequestsError extends AppError {
  constructor(message: string = "Too many requests", code?: string) {
    super(message, 429, code || "TOO_MANY_REQUESTS");
  }
}
export class BusinessError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 422, code || "BUSINESS_ERROR");
  }
}
export class TimeoutError extends AppError {
  constructor(message: string = "Request timeout") {
    super(message, 408, "TIMEOUT");
  }
}
export class ServiceUnavailableError extends AppError {
  constructor(message: string = "Service unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}
export class ThemeNotFoundError extends AppError {
  constructor(message: string = "Theme not found") {
    super(message, 404, "THEME_NOT_FOUND");
  }
}
export class ThemeOverrideInvalidError extends AppError {
  constructor(message: string = "Theme override invalid") {
    super(message, 422, "THEME_OVERRIDE_INVALID");
  }
}
