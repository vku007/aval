/**
 * HTTP Request abstraction (framework-agnostic)
 */
export interface HttpRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  params: Record<string, string>;
  body?: unknown;
  requestId: string;
}

/**
 * HTTP Response builder
 */
export class HttpResponse {
  constructor(
    public readonly statusCode: number,
    public readonly body?: unknown,
    public readonly headers: Record<string, string> = {}
  ) {}

  withHeader(key: string, value: string): HttpResponse {
    return new HttpResponse(this.statusCode, this.body, { ...this.headers, [key]: value });
  }

  withETag(etag: string | undefined): HttpResponse {
    if (!etag) return this;
    return this.withHeader('etag', etag.startsWith('"') ? etag : `"${etag}"`);
  }

  withLocation(location: string): HttpResponse {
    return this.withHeader('location', location);
  }

  static ok(body?: unknown): HttpResponse {
    return new HttpResponse(200, body);
  }

  static created(body?: unknown): HttpResponse {
    return new HttpResponse(201, body);
  }

  static noContent(): HttpResponse {
    return new HttpResponse(204);
  }

  static notModified(): HttpResponse {
    return new HttpResponse(304);
  }

  static badRequest(body?: unknown): HttpResponse {
    return new HttpResponse(400, body);
  }

  static notFound(body?: unknown): HttpResponse {
    return new HttpResponse(404, body);
  }

  static conflict(body?: unknown): HttpResponse {
    return new HttpResponse(409, body);
  }

  static preconditionFailed(body?: unknown): HttpResponse {
    return new HttpResponse(412, body);
  }

  static internalServerError(body?: unknown): HttpResponse {
    return new HttpResponse(500, body);
  }
}

