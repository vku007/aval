import { ApplicationError } from './ApplicationError.js';

export class RateLimitError extends ApplicationError {
  constructor(message: string = 'Too many requests. Please try again later.') {
    super(message, 429, 'RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}
