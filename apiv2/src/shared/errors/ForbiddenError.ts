import { ApplicationError } from './ApplicationError.js';

/**
 * 403 Forbidden Error
 * Thrown when user is authenticated but lacks permission
 */
export class ForbiddenError extends ApplicationError {
  constructor(message: string = 'Access forbidden', code?: string) {
    super(message, 403, code);
    this.name = 'ForbiddenError';
  }
}

