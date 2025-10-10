import { ApplicationError } from './ApplicationError.js';

export class PayloadTooLargeError extends ApplicationError {
  constructor(message: string = 'Payload too large') {
    super(message, 413, 'PAYLOAD_TOO_LARGE');
  }
}

