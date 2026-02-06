import { Router } from "express";
export abstract class BaseRouter {
  public readonly router: Router;
  protected readonly basePath: string;
  constructor(basePath: string) {
    this.router = Router();
    this.basePath = basePath;
    this.initializeRoutes();
  }
  protected abstract initializeRoutes(): void;
  public getBasePath(): string {
    return this.basePath;
  }
}
