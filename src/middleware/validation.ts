/**
 * Validation Middleware
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ILogger } from '../utils/ILogger';

export type ValidationSchema = {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
};

export class ValidationMiddleware {
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  /**
   * Validate request against schema
   */
  public validateRequest(schema: ValidationSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const errors: string[] = [];

      // Validate body
      if (schema.body) {
        const { error } = schema.body.validate(req.body, { abortEarly: false });
        if (error) {
          errors.push(...error.details.map(d => d.message));
        }
      }

      // Validate query
      if (schema.query) {
        const { error } = schema.query.validate(req.query, { abortEarly: false });
        if (error) {
          errors.push(...error.details.map(d => `Query: ${d.message}`));
        }
      }

      // Validate params
      if (schema.params) {
        const { error } = schema.params.validate(req.params, { abortEarly: false });
        if (error) {
          errors.push(...error.details.map(d => `Params: ${d.message}`));
        }
      }

      if (errors.length > 0) {
        this.logger.warn(`Validation failed`, { errors, path: req.path });
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: errors,
          },
        });
        return;
      }

      next();
    };
  }
}

// Common validation schemas
export const scrapingRequestSchema = {
  body: Joi.object({
    platform: Joi.string().valid('x', 'reddit').required(),
    config: Joi.object({
      keywords: Joi.string(),
      startDate: Joi.string().isoDate(),
      endDate: Joi.string().isoDate(),
      dateLimit: Joi.string().isoDate(),
      maxItems: Joi.number().integer().min(1).max(10000),
      totalLimit: Joi.number().integer().min(0),
      sortBy: Joi.string().valid('new', 'hot', 'top'),
    }).required(),
    options: Joi.object({
      priority: Joi.string().valid('low', 'normal', 'high'),
      callbackUrl: Joi.string().uri(),
      webhookUrl: Joi.string().uri(),
    }),
  }),
};

export const jobIdParamSchema = {
  params: Joi.object({
    jobId: Joi.string().uuid().required(),
  }),
};

export const listJobsQuerySchema = {
  query: Joi.object({
    platform: Joi.string().valid('x', 'reddit'),
    status: Joi.string().valid('pending', 'running', 'completed', 'failed', 'cancelled'),
    limit: Joi.number().integer().min(1).max(100),
  }),
};
