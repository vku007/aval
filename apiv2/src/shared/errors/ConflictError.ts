import { ApplicationError } from './ApplicationError.js';

export class ConflictError extends ApplicationError {
  constructor(message: string = 'Resource already exists', public readonly gameId?: string) {
    super(message, 409, 'CONFLICT');
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.gameId ? { gameId: this.gameId } : {})
    };
  }
}

