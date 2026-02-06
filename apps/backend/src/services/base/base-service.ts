import { Logger } from "pino";
import { createLogger } from "../../utils/logger";
export abstract class BaseService {
  protected readonly serviceName: string;
  protected readonly logger: Logger;
  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logger = createLogger(`Service:${serviceName}`);
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
