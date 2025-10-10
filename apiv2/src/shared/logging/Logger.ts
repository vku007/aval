export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Structured logger with context support
 */
export class Logger {
  private context: LogContext = {};

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...this.context,
        ...data
      };
      console.log(JSON.stringify(logEntry));
    } catch (err) {
      // Fallback to simple logging if JSON.stringify fails
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Failed to log',
        error: String(err)
      }));
    }
  }
}

