/**
 * Route Aggregation
 */

import { Router } from 'express';
import { createScrapingRouter } from './scraping.routes';
import { createHealthRouter } from './health.routes';
import { createDocsRouter } from './docs.routes';
import { ILogger } from '../utils/ILogger';
import { IScrapingService } from '../services/IScrapingService';
import { TokenManager } from '../clients/TokenManager';

export interface RouteDependencies {
  scrapingService: IScrapingService;
  logger: ILogger;
  tokenManager: TokenManager;
}

export function createRoutes(deps: RouteDependencies): Router {
  const router = Router();

  // API Documentation
  router.use('/docs', createDocsRouter());

  // Health routes
  router.use('/health', createHealthRouter(deps.logger, deps.tokenManager));

  // Scraping routes
  router.use('/scrape', createScrapingRouter(deps.scrapingService, deps.logger));

  // 404 handler
  router.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        message: `Route ${req.method} ${req.path} not found`,
        code: 'NOT_FOUND',
      },
    });
  });

  return router;
}
