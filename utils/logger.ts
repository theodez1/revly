// Logger utility for consistent logging across the app

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  private formatMessage(message: string): string {
    return this.prefix ? `[${this.prefix}] ${message}` : message;
  }

  debug(message: string, ...args: any[]) {
    if (__DEV__) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: any[]) {
    console.info(this.formatMessage(message), ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(this.formatMessage(message), ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(this.formatMessage(message), ...args);
  }

  /**
   * Generic log method used across the app.
   * Defaults to `info` level to always be visible in production.
   */
  log(message: string, ...args: any[]) {
    this.info(message, ...args);
  }
}

export default new Logger('App');
export { Logger };

