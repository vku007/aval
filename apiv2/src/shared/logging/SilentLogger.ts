import { Logger } from './Logger.js';

export class SilentLogger extends Logger {
  info(_message: string, _data?: Record<string, unknown>): void {}

  warn(_message: string, _data?: Record<string, unknown>): void {}

  error(_message: string, _data?: Record<string, unknown>): void {}

  debug(_message: string, _data?: Record<string, unknown>): void {}
}
