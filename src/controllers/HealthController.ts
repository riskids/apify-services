/**
 * Health Controller
 */

import { Request, Response } from 'express';
import { ILogger } from '../utils/ILogger';
import { HealthStatus } from '../types/common.types';
import { TokenManager } from '../clients/TokenManager';

export class HealthController {
  private logger: ILogger;
  private tokenManager: TokenManager;

  constructor(logger: ILogger, tokenManager: TokenManager) {
    this.logger = logger;
    this.tokenManager = tokenManager;
  }

  /**
   * Health check endpoint
   * GET /api/health
   */
  public async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.checkDependencies();

      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        success: true,
        ...healthStatus,
      });
    } catch (error) {
      this.logger.error('Health check failed', error as Error);
      
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          api: false,
          apify: false,
        },
        error: (error as Error).message,
      });
    }
  }

  /**
   * Check all dependencies
   */
  private async checkDependencies(): Promise<HealthStatus> {
    const tokenCount = this.tokenManager.getTokenCount();
    const hasTokens = tokenCount > 0;

    const services = {
      api: true,
      apify: hasTokens,
    };

    const allHealthy = Object.values(services).every(s => s);
    const someHealthy = Object.values(services).some(s => s);

    return {
      status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services,
      details: {
        availableTokens: tokenCount,
      },
    };
  }

  /**
   * Readiness check
   * GET /api/health/ready
   */
  public async readinessCheck(req: Request, res: Response): Promise<void> {
    const tokenCount = this.tokenManager.getTokenCount();
    
    if (tokenCount === 0) {
      res.status(503).json({
        success: false,
        ready: false,
        message: 'No Apify tokens available',
      });
      return;
    }

    res.status(200).json({
      success: true,
      ready: true,
      tokensAvailable: tokenCount,
    });
  }

  /**
   * Liveness check
   * GET /api/health/live
   */
  public async livenessCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      alive: true,
      timestamp: new Date().toISOString(),
    });
  }
}
