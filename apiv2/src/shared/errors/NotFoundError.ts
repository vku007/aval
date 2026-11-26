import { ApplicationError } from './ApplicationError.js';

export class NotFoundError extends ApplicationError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

