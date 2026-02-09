/**
 * Winston-based logger implementation
 */

import winston from 'winston';
import { ILogger, LogLevel } from './ILogger';
import * as path from 'path';
import * as fs from 'fs/promises';

export class Logger implements ILogger {
  private logger: winston.Logger;
  private logDir: string;

  constructor(level: LogLevel = LogLevel.INFO, logDir: string = './logs') {
    this.logDir = logDir;
    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'apify-services' },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        // File transports
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
        }),
      ],
    });

    // Ensure log directory exists
    this.ensureDirectory();
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  public error(message: string, error?: Error, meta?: any): void {
    this.logger.error(message, { error: error?.message, stack: error?.stack, ...meta });
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
}

// Singleton instance for default usage
let defaultLogger: Logger | null = null;

export function getDefaultLogger(): ILogger {
  if (!defaultLogger) {
    const logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
    const logDir = process.env.LOG_DIR || './logs';
    defaultLogger = new Logger(logLevel, logDir);
  }
  return defaultLogger;
}
