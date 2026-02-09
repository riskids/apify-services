/**
 * Logging Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ILogger } from '../utils/ILogger';

interface RequestInfo {
  method: string;
  path: string;
  query: any;
  headers: any;
  ip: string;
  requestId: string;
}

export class LoggingMiddleware {
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  /**
   * Log request and response
   */
  public logRequest(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    // Attach request ID to request
    (req as any).requestId = requestId;

    // Log request
    const requestInfo = this.getRequestInfo(req, requestId);
    this.logger.info(`Request started`, requestInfo);

    // Capture response finish
    const originalEnd = res.end.bind(res);
    res.end = (...args: any[]) => {
      res.end = originalEnd;
      res.end(...args);

      const duration = Date.now() - startTime;
      
      this.logger.info(`Request completed`, {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    };

    next();
  }

  /**
   * Get request info
   */
  private getRequestInfo(req: Request, requestId: string): RequestInfo {
    return {
      method: req.method,
      path: req.path,
      query: req.query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'accept': req.headers['accept'],
      },
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      requestId,
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
