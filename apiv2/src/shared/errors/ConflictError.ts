import { ApplicationError } from './ApplicationError.js';

export class ConflictError extends ApplicationError {
  constructor(
    message: string = 'Resource already exists',
    public readonly gameId?: string,
    code: string = 'CONFLICT'
  ) {
    super(message, 409, code);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.gameId ? { gameId: this.gameId } : {})
    };
  }
}

