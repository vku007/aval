import { ApplicationError } from './ApplicationError.js';

export class PreconditionRequiredError extends ApplicationError {
  constructor(message: string = 'Precondition required (If-Match header missing)') {
    super(message, 428, 'PRECONDITION_REQUIRED');
  }
}

