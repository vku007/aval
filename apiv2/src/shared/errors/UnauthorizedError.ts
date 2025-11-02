import { ApplicationError } from './ApplicationError.js';

/**
 * 401 Unauthorized Error
 * Thrown when authentication is required but missing or invalid
 */
export class UnauthorizedError extends ApplicationError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

