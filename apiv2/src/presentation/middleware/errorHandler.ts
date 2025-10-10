import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import { HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import { ApplicationError } from '../../shared/errors/index.js';
import type { Logger } from '../../shared/logging/Logger.js';

/**
 * Global error handler middleware
 * Converts errors to RFC 7807 problem+json responses
 */
export function errorHandler(logger: Logger, corsOrigin: string) {
  return (error: Error, request: HttpRequest): HttpResponse => {
    // Handle known application errors
    if (error instanceof ApplicationError) {
      logger.warn('Application error', {
        error: error.name,
        status: error.statusCode,
        message: error.message,
        path: request.path
      });

      return new HttpResponse(
        error.statusCode,
        error.toJSON(),
        {
          'content-type': 'application/problem+json',
          'access-control-allow-origin': corsOrigin
        }
      );
    }

    // Handle unknown errors
    logger.error('Unhandled error', {
      error: error.name,
      message: error.message,
      stack: error.stack,
      path: request.path
    });

    return new HttpResponse(
      500,
      {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
        instance: request.path
      },
      {
        'content-type': 'application/problem+json',
        'access-control-allow-origin': corsOrigin
      }
    );
  };
}

