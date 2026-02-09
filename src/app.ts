/**
 * Express App Configuration
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ILogger } from './utils/ILogger';
import { createRoutes, RouteDependencies } from './routes';
import { ErrorHandlerMiddleware } from './middleware/errorHandler';
import { LoggingMiddleware } from './middleware/logging';
import { defaultRateLimiter } from './middleware/rateLimiter';
import config from './config/config';

export function createApp(deps: RouteDependencies): Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting
  app.use(defaultRateLimiter);

  // Request logging
  const loggingMiddleware = new LoggingMiddleware(deps.logger);
  app.use(loggingMiddleware.logRequest.bind(loggingMiddleware));

  // Redirect root to API docs
  app.get('/', (req, res) => {
    res.redirect('/api/docs');
  });

  // API routes
  app.use(config.API_PREFIX, createRoutes(deps));

  // Error handling
  const errorHandler = new ErrorHandlerMiddleware(deps.logger);
  app.use(errorHandler.handle.bind(errorHandler));

  return app;
}
