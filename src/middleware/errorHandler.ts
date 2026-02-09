/**
 * Global Error Handler Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ILogger } from '../utils/ILogger';
import { ApiError, ErrorResponse } from '../dto/ErrorResponse';

export class ErrorHandlerMiddleware {
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  /**
   * Handle errors
   */
  public handle(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    this.logger.error('Unhandled error', error, {
      path: req.path,
      method: req.method,
    });

    const errorResponse = this.getErrorResponse(error);

    if (error instanceof ApiError) {
      res.status(error.statusCode).json(errorResponse);
    } else {
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get error response
   */
  private getErrorResponse(error: Error): ErrorResponse {
    if (error instanceof ApiError) {
      return {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      };
    }

    // Check for known error types
    if (this.isValidationError(error)) {
      return {
        success: false,
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR',
        },
      };
    }

    if (this.isNotFoundError(error)) {
      return {
        success: false,
        error: {
          message: error.message,
          code: 'NOT_FOUND',
        },
      };
    }

    // Default to internal error
    return {
      success: false,
      error: {
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
    };
  }

  /**
   * Check if error is a validation error
   */
  private isValidationError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('validation') ||
      msg.includes('invalid') ||
      msg.includes('required')
    );
  }

  /**
   * Check if error is a not found error
   */
  private isNotFoundError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('not found') ||
      msg.includes('does not exist') ||
      msg.includes('cannot find')
    );
  }
}
