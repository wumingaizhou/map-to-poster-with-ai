export type ErrorLevel = "error" | "warning" | "info" | "success";
export enum ErrorCategory {
  NETWORK = "network",
  BUSINESS = "business",
  SYSTEM = "system",
  VALIDATION = "validation",
  UNKNOWN = "unknown"
}
export interface FormattedError {
  level: ErrorLevel;
  category: ErrorCategory;
  message: string;
  code?: string;
  recoverable: boolean;
  originalError?: unknown;
}
export interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  customMessage?: string;
  level?: ErrorLevel;
  duration?: number;
}
export interface ToastOptions {
  message: string;
  level: ErrorLevel;
  duration?: number;
  closable?: boolean;
  keepAliveOnHover?: boolean;
}
