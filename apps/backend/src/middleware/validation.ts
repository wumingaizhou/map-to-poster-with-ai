import { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodSchema, ZodError } from "zod";
interface ValidationErrorDetail {
  field: string;
  message: string;
}
interface ValidationErrorResponse {
  success: false;
  error: {
    message: string;
    code: "VALIDATION_ERROR";
    details: ValidationErrorDetail[];
  };
  timestamp: string;
}
interface ValidationSource {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}
export function validate(schema: ZodSchema<ValidationSource>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params
    });
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      const response: ValidationErrorResponse = {
        success: false,
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: errors
        },
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    if (result.data.body !== undefined) {
      req.body = result.data.body;
    }
    if (result.data.query !== undefined) {
      Object.defineProperty(req, "query", {
        value: result.data.query,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
    if (result.data.params !== undefined) {
      Object.defineProperty(req, "params", {
        value: result.data.params,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
    next();
  };
}
function formatZodErrors(error: ZodError): ValidationErrorDetail[] {
  return error.errors.map(err => ({
    field: err.path.join("."),
    message: err.message
  }));
}
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      const response: ValidationErrorResponse = {
        success: false,
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: errors
        },
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    req.body = result.data;
    next();
  };
}
export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      const response: ValidationErrorResponse = {
        success: false,
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: errors
        },
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    Object.defineProperty(req, "query", {
      value: result.data,
      writable: true,
      enumerable: true,
      configurable: true
    });
    next();
  };
}
export function validateParams<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      const response: ValidationErrorResponse = {
        success: false,
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: errors
        },
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    Object.defineProperty(req, "params", {
      value: result.data,
      writable: true,
      enumerable: true,
      configurable: true
    });
    next();
  };
}
