import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import { config } from "../config/env";
import { createLogger } from "../utils/logger";
const log = createLogger("RateLimit");
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}
function createRateLimiter(options: RateLimitConfig): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    handler: (req, res, _next, optionsUsed) => {
      log.warn(
        {
          ip: req.ip,
          path: req.path,
          limit: optionsUsed.max,
          windowMs: optionsUsed.windowMs
        },
        "Rate limit exceeded"
      );
      res.status(429).json({
        success: false,
        error: {
          message: options.message,
          code: "RATE_LIMIT_EXCEEDED"
        },
        timestamp: new Date().toISOString()
      });
    }
  });
}
export const sseLimiter = createRateLimiter({
  windowMs: config.rateLimit.sse.windowMs,
  max: config.rateLimit.sse.max,
  message: "Too many SSE connection attempts, please try again later"
});
export const aiChatLimiter = createRateLimiter({
  windowMs: config.rateLimit.aiChat.windowMs,
  max: config.rateLimit.aiChat.max,
  message: "Too many AI chat requests, please try again later"
});
export const authSessionLimiter = createRateLimiter({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  message: "Too many session requests, please try again later"
});
