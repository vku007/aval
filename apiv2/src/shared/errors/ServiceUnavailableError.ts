import { ApplicationError } from './ApplicationError.js';

export class ServiceUnavailableError extends ApplicationError {
  constructor(message = 'Service unavailable') {
    super(message, 503, 'service_unavailable');
  }
}
