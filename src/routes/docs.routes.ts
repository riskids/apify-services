/**
 * Swagger Documentation Routes
 */

import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger';

export function createDocsRouter(): Router {
  const router = Router();

  // Serve Swagger UI
  router.use('/', swaggerUi.serve);
  router.get('/', swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Apify Services API Documentation',
  }));

  // Serve raw OpenAPI spec
  router.get('/json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  return router;
}
