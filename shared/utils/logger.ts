export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

type Meta = Record<string, unknown>;

class Logger {
  private write(level: LogLevel, message: string, meta?: Meta) {
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    });
    switch (level) {
      case LogLevel.INFO:
        console.info(line);
        break;
      case LogLevel.WARN:
        console.warn(line);
        break;
      case LogLevel.ERROR:
        console.error(line);
        break;
      default:
        console.debug(line);
    }
  }

  info(message: string, meta?: Meta) {
    this.write(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Meta) {
    this.write(LogLevel.WARN, message, meta);
  }

  error(message: string, error?: Error | unknown) {
    const meta =
      error instanceof Error
        ? { error: error.message, stack: error.stack }
        : { error };
    this.write(LogLevel.ERROR, message, meta);
  }
}

export default new Logger();
