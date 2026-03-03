/**
 * Synchronous Scraping Routes
 * For endpoints that wait for scraping to complete before returning
 */

import { Router } from 'express';
import { SyncController } from '../controllers/SyncController';
import { ValidationMiddleware } from '../middleware/validation';
import { xSyncRequestSchema } from '../middleware/validation';
import { scrapingRateLimiter } from '../middleware/rateLimiter';
import { ILogger } from '../utils/ILogger';
import { IScrapingService } from '../services/IScrapingService';

export function createSyncRouter(
  scrapingService: IScrapingService,
  logger: ILogger
): Router {
  const router = Router();
  const controller = new SyncController(scrapingService, logger);
  const validation = new ValidationMiddleware(logger);

  /**
   * @swagger
   * tags:
   *   name: Sync
   *   description: Synchronous scraping operations (waits for completion)
   */

  /**
   * @swagger
   * /sync/x:
   *   post:
   *     summary: Synchronously scrape X (Twitter) data
   *     description: |
   *       Initiates X scraping and waits for completion before returning.
   *       Unlike /scrape endpoint, this does not create a job - it waits 
   *       for the scraping to finish and returns results directly.
   *     tags: [Sync]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - config
   *             properties:
   *               config:
   *                 type: object
   *                 required:
   *                   - keywords
   *                   - startDate
   *                   - endDate
   *                   - maxItems
   *                 properties:
   *                   keywords:
   *                     type: string
   *                     description: Search keywords
   *                   startDate:
   *                     type: string
   *                     format: date
   *                     description: Start date (YYYY-MM-DD)
   *                   endDate:
   *                     type: string
   *                     format: date
   *                     description: End date (YYYY-MM-DD)
   *                   maxItems:
   *                     type: integer
   *                     minimum: 1
   *                     maximum: 10000
   *                     description: Maximum items to scrape
   *               options:
   *                 type: object
   *                 properties:
   *                   priority:
   *                     type: string
   *                     enum: [low, normal, high]
   *           examples:
   *             x_sync_scrape:
   *               summary: X synchronous scraping example
   *               value:
   *                 config:
   *                   keywords: machine learning
   *                   startDate: '2024-01-01'
   *                   endDate: '2024-01-31'
   *                   maxItems: 1000
   *                 options:
   *                   priority: normal
   *     responses:
   *       200:
   *         description: Scraping completed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 metadata:
   *                   type: object
   *                   properties:
   *                     platform:
   *                       type: string
   *                     scrapedAt:
   *                       type: string
   *                       format: date-time
   *                     completedAt:
   *                       type: string
   *                       format: date-time
   *                     totalItems:
   *                       type: integer
   *                     totalDuration:
   *                       type: integer
   *                 data:
   *                   type: object
   *                   properties:
   *                     posts:
   *                       type: array
   *                       items:
   *                         type: object
   *                     metadata:
   *                       type: object
   *                 statistics:
   *                   type: object
   *                   properties:
   *                     totalItems:
   *                       type: integer
   *                     duration:
   *                       type: integer
   *                     successRate:
   *                       type: number
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       429:
   *         $ref: '#/components/responses/TooManyRequests'
   *       500:
   *         $ref: '#/components/responses/InternalError'
   */
  router.post(
    '/x',
    // scrapingRateLimiter,
    validation.validateRequest(xSyncRequestSchema),
    (req, res) => controller.scrapeXSync(req, res)
  );

  return router;
}
