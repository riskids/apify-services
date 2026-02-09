/**
 * Health Routes
 */

import { Router } from 'express';
import { HealthController } from '../controllers/HealthController';
import { ILogger } from '../utils/ILogger';
import { TokenManager } from '../clients/TokenManager';

export function createHealthRouter(
  logger: ILogger,
  tokenManager: TokenManager
): Router {
  const router = Router();
  const controller = new HealthController(logger, tokenManager);

  /**
   * @swagger
   * tags:
   *   name: Health
   *   description: Health and status checks
   */

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Health check
   *     description: Returns the overall health status of the API and its dependencies
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy or degraded
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthStatus'
   *             examples:
   *               healthy:
   *                 summary: Healthy response
   *                 value:
   *                   success: true
   *                   status: healthy
   *                   timestamp: '2024-01-15T10:00:00Z'
   *                   services:
   *                     api: true
   *                     apify: true
   *                   details:
   *                     availableTokens: 3
   *               degraded:
   *                 summary: Degraded response
   *                 value:
   *                   success: true
   *                   status: degraded
   *                   timestamp: '2024-01-15T10:00:00Z'
   *                   services:
   *                     api: true
   *                     apify: false
   *                   details:
   *                     availableTokens: 0
   *       503:
   *         description: Service is unhealthy
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthStatus'
   */
  router.get('/', (req, res) => controller.healthCheck(req, res));

  /**
   * @swagger
   * /health/ready:
   *   get:
   *     summary: Readiness check
   *     description: Checks if the service is ready to accept requests (has valid tokens)
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is ready
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 ready:
   *                   type: boolean
   *                 tokensAvailable:
   *                   type: integer
   *             example:
   *               success: true
   *               ready: true
   *               tokensAvailable: 3
   *       503:
   *         description: Service is not ready
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 ready:
   *                   type: boolean
   *                 message:
   *                   type: string
   *             example:
   *               success: false
   *               ready: false
   *               message: No Apify tokens available
   */
  router.get('/ready', (req, res) => controller.readinessCheck(req, res));

  /**
   * @swagger
   * /health/live:
   *   get:
   *     summary: Liveness check
   *     description: Checks if the service is alive (basic heartbeat)
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is alive
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 alive:
   *                   type: boolean
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *             example:
   *               success: true
   *               alive: true
   *               timestamp: '2024-01-15T10:00:00Z'
   */
  router.get('/live', (req, res) => controller.livenessCheck(req, res));

  return router;
}
