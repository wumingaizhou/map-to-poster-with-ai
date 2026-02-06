import type { MessageApi } from "naive-ui";
import { toastConfig } from "@/config";
import { BaseError } from "@/shared/errors";
import type { ErrorLevel, ErrorCategory, FormattedError, ErrorHandlerOptions, ToastOptions } from "./types";
import { ErrorCategory as ErrorCategoryEnum } from "./types";
class ToastService {
  private messageApi: MessageApi | null = null;
  init(api: MessageApi): void {
    this.messageApi = api;
  }
  show(options: ToastOptions): void {
    if (!this.messageApi) {
      console.warn("ToastService未初始化，无法显示Toast");
      return;
    }
    const {
      message,
      level,
      duration = toastConfig.defaultDurationMs,
      closable = true,
      keepAliveOnHover = true
    } = options;
    const messageOptions = {
      duration,
      closable,
      keepAliveOnHover
    };
    switch (level) {
      case "error":
        this.messageApi.error(message, messageOptions);
        break;
      case "warning":
        this.messageApi.warning(message, messageOptions);
        break;
      case "info":
        this.messageApi.info(message, messageOptions);
        break;
      default:
        this.messageApi.info(message, messageOptions);
    }
  }
  error(message: string, duration?: number): void {
    this.show({ message, level: "error", duration });
  }
  warning(message: string, duration?: number): void {
    this.show({ message, level: "warning", duration });
  }
  info(message: string, duration?: number): void {
    this.show({ message, level: "info", duration });
  }
}
export const toastService = new ToastService();
export function formatError(error: unknown, customMessage?: string): FormattedError {
  if (error instanceof BaseError) {
    return {
      level: "error",
      category: categorizeError(error),
      message: customMessage || error.message,
      code: error.code,
      recoverable: error.recoverable,
      originalError: error
    };
  }
  if (error instanceof Error) {
    return {
      level: "error",
      category: categorizeError(error),
      message: customMessage || error.message,
      recoverable: true,
      originalError: error
    };
  }
  if (typeof error === "string") {
    return {
      level: "error",
      category: ErrorCategoryEnum.UNKNOWN,
      message: customMessage || error,
      recoverable: true,
      originalError: error
    };
  }
  return {
    level: "error",
    category: ErrorCategoryEnum.UNKNOWN,
    message: customMessage || "发生未知错误",
    recoverable: true,
    originalError: error
  };
}
function categorizeError(error: Error): ErrorCategory {
  const errorName = error.name.toLowerCase();
  const errorMessage = error.message.toLowerCase();
  if (
    errorName.includes("network") ||
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("连接")
  ) {
    return ErrorCategoryEnum.NETWORK;
  }
  if (
    errorName.includes("validation") ||
    errorMessage.includes("validation") ||
    errorMessage.includes("invalid") ||
    errorMessage.includes("验证")
  ) {
    return ErrorCategoryEnum.VALIDATION;
  }
  if (error instanceof BaseError) {
    return ErrorCategoryEnum.BUSINESS;
  }
  if (errorName.includes("system") || errorName.includes("internal") || errorMessage.includes("系统")) {
    return ErrorCategoryEnum.SYSTEM;
  }
  return ErrorCategoryEnum.UNKNOWN;
}
export function handleError(error: unknown, options: ErrorHandlerOptions = {}): void {
  const {
    showToast = true,
    logToConsole = true,
    customMessage,
    level,
    duration = toastConfig.defaultDurationMs
  } = options;
  const formattedError = formatError(error, customMessage);
  if (logToConsole) {
    const logLevel = level || formattedError.level;
    const logMessage = `[${formattedError.category}] ${formattedError.message}`;
    if (logLevel === "error") {
      console.error(logMessage, formattedError.originalError);
    } else if (logLevel === "warning") {
      console.warn(logMessage, formattedError.originalError);
    } else {
      console.info(logMessage, formattedError.originalError);
    }
  }
  if (showToast) {
    toastService.show({
      message: formattedError.message,
      level: level || formattedError.level,
      duration
    });
  }
}
export type { ErrorLevel, ErrorCategory, FormattedError, ErrorHandlerOptions, ToastOptions };
export { ErrorCategory as ErrorCategoryEnum } from "./types";
