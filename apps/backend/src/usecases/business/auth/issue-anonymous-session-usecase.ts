import { BaseUseCase } from "../../../usecases/base/base-usecase";
import { AuthService, type AnonymousSessionResultDTO } from "../../../services/business/auth-service";
export class IssueAnonymousSessionUseCase extends BaseUseCase<{ resourceId?: string }, AnonymousSessionResultDTO> {
  constructor(private readonly authService: AuthService) {
    super("IssueAnonymousSession");
  }
  async execute(input: { resourceId?: string }): Promise<AnonymousSessionResultDTO> {
    const result = await this.authService.issueAnonymousSession(input.resourceId);
    this.log("Anonymous session issued", { expiresAt: result.expiresAt });
    return result;
  }
}
