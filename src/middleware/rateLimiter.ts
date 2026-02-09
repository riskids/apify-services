/**
 * Rate Limiter Middleware
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: {
        message: options.message || 'Too many requests, please try again later',
        code: 'RATE_LIMIT',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use IP address as key
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: {
          message: options.message || 'Too many requests, please try again later',
          code: 'RATE_LIMIT',
        },
      });
    },
  });
}

// Default rate limiter
export const defaultRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
});

// Strict rate limiter for scraping endpoints
export const scrapingRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 scraping requests per hour
  message: 'Too many scraping requests, please try again later',
});
