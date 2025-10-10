import { ApplicationError } from './ApplicationError.js';

/**
 * Special error for 304 Not Modified responses
 */
export class NotModifiedError extends ApplicationError {
  constructor(public readonly etag?: string) {
    super('Not Modified', 304, 'NOT_MODIFIED');
  }
}

