import type { HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import { HttpResponse as Response } from '../../infrastructure/http/HttpTypes.js';
import type { EditorSessionService } from '../../application/services/EditorSessionService.js';

export class EditorSessionController {
  constructor(private readonly openSession: () => Promise<EditorSessionService>) {}

  async open(): Promise<HttpResponse> {
    const service = await this.openSession();
    const issued = service.issue();
    return Response.noContent().withCookies(issued.cookies).withCacheControl('private, no-store');
  }
}
