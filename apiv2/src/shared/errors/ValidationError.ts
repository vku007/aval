import { ApplicationError } from './ApplicationError.js';

export class ValidationError extends ApplicationError {
  constructor(message: string, public readonly field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }

  toJSON() {
    return {
      ...super.toJSON(),
      field: this.field
    };
  }
}

