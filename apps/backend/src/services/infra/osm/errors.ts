export type OverpassErrorCode =
  | "OVERPASS_HTTP_ERROR"
  | "OVERPASS_RATE_LIMITED"
  | "OVERPASS_NETWORK_ERROR"
  | "OVERPASS_BAD_RESPONSE"
  | "OVERPASS_TIMEOUT";
export type OverpassClientErrorParams = {
  code: OverpassErrorCode;
  message: string;
  retriable: boolean;
  endpoint: string;
  status?: number;
  cause?: unknown;
};
export class OverpassClientError extends Error {
  public readonly code: OverpassErrorCode;
  public readonly retriable: boolean;
  public readonly endpoint: string;
  public readonly status?: number;
  constructor(params: OverpassClientErrorParams) {
    super(params.message, params.cause !== undefined ? { cause: params.cause } : undefined);
    this.name = "OverpassClientError";
    this.code = params.code;
    this.retriable = params.retriable;
    this.endpoint = params.endpoint;
    if (params.status !== undefined) {
      this.status = params.status;
    }
  }
}
export type BBoxValidationErrorCode = "BBOX_INVALID";
export class BBoxValidationError extends Error {
  public readonly code: BBoxValidationErrorCode = "BBOX_INVALID";
  public readonly bbox?: unknown;
  constructor(message: string, options?: { bbox?: unknown; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "BBoxValidationError";
    if (options?.bbox !== undefined) {
      this.bbox = options.bbox;
    }
  }
}
