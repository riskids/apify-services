/**
 * Scraping Routes
 */

import { Router } from 'express';
import { ScrapingController } from '../controllers/ScrapingController';
import { ValidationMiddleware } from '../middleware/validation';
import { scrapingRequestSchema, jobIdParamSchema, listJobsQuerySchema } from '../middleware/validation';
import { scrapingRateLimiter } from '../middleware/rateLimiter';
import { ILogger } from '../utils/ILogger';
import { IScrapingService } from '../services/IScrapingService';

export function createScrapingRouter(
  scrapingService: IScrapingService,
  logger: ILogger
): Router {
  const router = Router();
  const controller = new ScrapingController(scrapingService, logger);
  const validation = new ValidationMiddleware(logger);

  /**
   * @swagger
   * tags:
   *   name: Scraping
   *   description: Web scraping operations
   */

  /**
   * @swagger
   * /scrape:
   *   post:
   *     summary: Start a new scraping job
   *     description: Initiates a web scraping job for the specified platform
   *     tags: [Scraping]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ScrapingRequest'
   *           examples:
   *             x_scrape:
   *               summary: X (Twitter) scraping example
   *               value:
   *                 platform: x
   *                 config:
   *                   keywords: machine learning
   *                   startDate: '2024-01-01'
   *                   endDate: '2024-01-31'
   *                   maxItems: 1000
   *                 options:
   *                   priority: normal
   *             reddit_scrape:
   *               summary: Reddit scraping example
   *               value:
   *                 platform: reddit
   *                 config:
   *                   keywords: javascript
   *                   dateLimit: '2024-01-01'
   *                   maxItems: 100
   *                   totalLimit: 1000
   *                   sortBy: new
   *     responses:
   *       201:
   *         description: Scraping job started successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ScrapingResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       429:
   *         $ref: '#/components/responses/TooManyRequests'
   *       500:
   *         $ref: '#/components/responses/InternalError'
   */
  router.post(
    '/',
    scrapingRateLimiter,
    validation.validateRequest(scrapingRequestSchema),
    (req, res) => controller.startScraping(req, res)
  );

  /**
   * @swagger
   * /scrape/jobs:
   *   get:
   *     summary: List all scraping jobs
   *     description: Retrieves a list of all scraping jobs with optional filtering
   *     tags: [Jobs]
   *     parameters:
   *       - in: query
   *         name: platform
   *         schema:
   *           type: string
   *           enum: [x, reddit]
   *         description: Filter by platform
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, running, completed, failed, cancelled]
   *         description: Filter by job status
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *         description: Maximum number of jobs to return
   *     responses:
   *       200:
   *         description: List of jobs retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/JobList'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       500:
   *         $ref: '#/components/responses/InternalError'
   */
  router.get(
    '/jobs',
    validation.validateRequest(listJobsQuerySchema),
    (req, res) => controller.listJobs(req, res)
  );

  /**
   * @swagger
   * /scrape/{jobId}:
   *   get:
   *     summary: Get job status
   *     description: Retrieves the current status of a scraping job
   *     tags: [Jobs]
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The job ID
   *     responses:
   *       200:
   *         description: Job status retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/JobStatus'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/InternalError'
   */
  router.get(
    '/:jobId',
    validation.validateRequest(jobIdParamSchema),
    (req, res) => controller.getJobStatus(req, res)
  );

  /**
   * @swagger
   * /scrape/{jobId}/results:
   *   get:
   *     summary: Get job results
   *     description: Retrieves the results of a completed scraping job
   *     tags: [Jobs]
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The job ID
   *     responses:
   *       200:
   *         description: Job results retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/JobResults'
   *       400:
   *         description: Job is not completed yet
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/InternalError'
   */
  router.get(
    '/:jobId/results',
    validation.validateRequest(jobIdParamSchema),
    (req, res) => controller.getJobResults(req, res)
  );

  /**
   * @swagger
   * /scrape/{jobId}:
   *   delete:
   *     summary: Cancel a job
   *     description: Cancels a pending or running scraping job
   *     tags: [Jobs]
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The job ID
   *     responses:
   *       200:
   *         description: Job cancelled successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       400:
   *         description: Job cannot be cancelled
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/InternalError'
   */
  router.delete(
    '/:jobId',
    validation.validateRequest(jobIdParamSchema),
    (req, res) => controller.cancelJob(req, res)
  );

  return router;
}
