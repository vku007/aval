import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import { HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import type { AppConfig } from '../../config/environment.js';

/**
 * CORS middleware
 * Handles preflight OPTIONS requests
 */
export function corsMiddleware(config: AppConfig) {
  return async (request: HttpRequest, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new HttpResponse(204, undefined, {
        'access-control-allow-origin': config.cors.allowedOrigin,
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization,if-match,if-none-match',
        'access-control-max-age': '86400'
      });
    }

    // Continue to next handler
    return next();
  };
}

