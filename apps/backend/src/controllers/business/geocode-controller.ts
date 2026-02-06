import type { Request, Response } from "express";
import { BaseController } from "../base/base-controller";
import { GeocodeUseCase } from "../../usecases/business/geocode/geocode-usecase";
export class GeocodeController extends BaseController {
  constructor(private readonly geocodeUseCase: GeocodeUseCase) {
    super("GeocodeController");
  }
  async geocode(req: Request, res: Response): Promise<Response> {
    const locationQuery = (req.body as { locationQuery: string }).locationQuery;
    const result = await this.geocodeUseCase.execute({ locationQuery });
    res.setHeader("Cache-Control", "no-store");
    return this.success(res, result);
  }
}
