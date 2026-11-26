import { ApplicationError } from './ApplicationError.js';

export class ValidationError extends ApplicationError {
  constructor(message: string, public readonly field?: string, code: string = 'VALIDATION_ERROR') {
    super(message, 400, code);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      field: this.field
    };
  }
}

