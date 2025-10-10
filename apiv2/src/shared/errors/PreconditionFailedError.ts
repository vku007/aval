import { ApplicationError } from './ApplicationError.js';

export class PreconditionFailedError extends ApplicationError {
  constructor(message: string = 'Precondition failed (ETag mismatch)') {
    super(message, 412, 'PRECONDITION_FAILED');
  }
}

