import type { Request, Response } from "express";
import { BaseController } from "../base/base-controller";
import { IssueAnonymousSessionUseCase } from "../../usecases/business/auth/issue-anonymous-session-usecase";
export class AuthController extends BaseController {
  constructor(private readonly issueAnonymousSessionUseCase: IssueAnonymousSessionUseCase) {
    super("AuthController");
  }
  async issueAnonymousSession(req: Request, res: Response): Promise<Response> {
    const resourceId = req.auth?.resourceId;
    const result = await this.issueAnonymousSessionUseCase.execute(resourceId === undefined ? {} : { resourceId });
    res.setHeader("Cache-Control", "no-store");
    return this.success(res, result);
  }
}
