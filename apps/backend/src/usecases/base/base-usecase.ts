import { Logger } from "pino";
import { createLogger } from "../../utils/logger";
export abstract class BaseUseCase<TInput, TOutput> {
  protected readonly useCaseName: string;
  protected readonly logger: Logger;
  constructor(useCaseName: string) {
    this.useCaseName = useCaseName;
    this.logger = createLogger(`UseCase:${useCaseName}`);
  }
  abstract execute(input: TInput): Promise<TOutput>;
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
