import { Request, Response, NextFunction, RequestHandler } from "express";
import { AppError } from "../errors/app-error";
import { createLogger } from "../utils/logger";
import { config } from "../config/env";
const log = createLogger("ErrorHandler");
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
    recoverable?: boolean;
  };
  timestamp: string;
}
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
export function globalErrorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    return;
  }
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: err.message,
        ...(err.code && { code: err.code })
      },
      timestamp: new Date().toISOString()
    };
    res.status(err.statusCode).json(response);
    return;
  }
  log.error(
    {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method
    },
    "Unexpected error"
  );
  const message = config.isProduction ? "Internal server error" : err.message;
  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      code: "INTERNAL_ERROR"
    },
    timestamp: new Date().toISOString()
  };
  res.status(500).json(response);
}
