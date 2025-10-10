import { ApplicationError } from './ApplicationError.js';

export class UnsupportedMediaTypeError extends ApplicationError {
  constructor(message: string = 'Content-Type must be application/json') {
    super(message, 415, 'UNSUPPORTED_MEDIA_TYPE');
  }
}

