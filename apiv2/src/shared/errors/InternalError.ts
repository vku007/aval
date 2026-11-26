import { ApplicationError } from './ApplicationError.js';

export class InternalError extends ApplicationError {
  constructor(message: string, code?: string) {
    super(message, 500, code);
    this.name = 'InternalError';
  }
}
