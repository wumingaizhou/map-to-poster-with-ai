import { Response } from "express";
import { Logger } from "pino";
import { createLogger } from "../../utils/logger";
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  timestamp: string;
}
export abstract class BaseController {
  protected readonly controllerName: string;
  protected readonly logger: Logger;
  constructor(controllerName: string) {
    this.controllerName = controllerName;
    this.logger = createLogger(`Controller:${controllerName}`);
  }
  protected success<T>(res: Response, data: T, statusCode: number = 200): Response {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };
    return res.status(statusCode).json(response);
  }
  protected created<T>(res: Response, data: T): Response {
    return this.success(res, data, 201);
  }
  protected noContent(res: Response): Response {
    return res.status(204).send();
  }
  protected log(message: string, data?: Record<string, unknown>): void {
    if (data) {
      this.logger.info(data, message);
    } else {
      this.logger.info(message);
    }
  }
  protected logError(message: string, error?: unknown): void {
    this.logger.error({ error }, message);
  }
}
