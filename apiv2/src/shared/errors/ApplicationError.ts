/**
 * Base class for all application errors
 */
export abstract class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      type: 'about:blank',
      title: this.name,
      status: this.statusCode,
      detail: this.message,
      code: this.code
    };
  }
}

