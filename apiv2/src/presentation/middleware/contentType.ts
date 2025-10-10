import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import type { HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import { UnsupportedMediaTypeError } from '../../shared/errors/index.js';

/**
 * Content-Type validation middleware
 * Ensures mutation requests have application/json
 */
export function contentTypeMiddleware() {
  return async (request: HttpRequest, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    // Only validate for mutation methods
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers['content-type']?.toLowerCase();
      
      if (!contentType || !contentType.includes('application/json')) {
        throw new UnsupportedMediaTypeError();
      }
    }

    return next();
  };
}

