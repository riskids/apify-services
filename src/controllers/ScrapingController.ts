/**
 * Scraping Controller
 */

import { Request, Response } from 'express';
import { IScrapingService } from '../services/IScrapingService';
import { ILogger } from '../utils/ILogger';
import { ScrapingRequest } from '../types/common.types';
import { ApiError, ValidationError } from '../dto/ErrorResponse';

export class ScrapingController {
  private scrapingService: IScrapingService;
  private logger: ILogger;

  constructor(scrapingService: IScrapingService, logger: ILogger) {
    this.scrapingService = scrapingService;
    this.logger = logger;
  }

  /**
   * Start scraping job
   * POST /api/scrape
   */
  public async startScraping(req: Request, res: Response): Promise<void> {
    try {
      const request: ScrapingRequest = req.body;

      // Validate request
      if (!request.platform) {
        throw new ValidationError('Platform is required');
      }

      if (!request.config) {
        throw new ValidationError('Config is required');
      }

      // Start job
      const job = await this.scrapingService.startJob(request);

      this.logger.info(`Scraping job started`, { jobId: job.id, platform: job.platform });

      res.status(201).json({
        success: true,
        jobId: job.id,
        status: job.status,
        message: 'Scraping job started successfully',
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * Get job status
   * GET /api/scrape/:jobId
   */
  public async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      const status = await this.scrapingService.getJobStatus(jobId);

      res.status(200).json({
        success: true,
        jobId,
        status: status.status,
        progress: status.progress,
        currentStep: status.currentStep,
        errorMessage: status.errorMessage,
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * Get job results
   * GET /api/scrape/:jobId/results
   */
  public async getJobResults(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      const results = await this.scrapingService.getJobResults(jobId);

      res.status(200).json({
        success: true,
        jobId,
        metadata: results.metadata,
        data: results.data,
        statistics: results.statistics,
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * Cancel job
   * DELETE /api/scrape/:jobId
   */
  public async cancelJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      await this.scrapingService.cancelJob(jobId);

      res.status(200).json({
        success: true,
        message: 'Job cancelled successfully',
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * List jobs
   * GET /api/scrape/jobs
   */
  public async listJobs(req: Request, res: Response): Promise<void> {
    try {
      const { platform, status, limit } = req.query;

      const filters: any = {};
      if (platform) filters.platform = platform as string;
      if (status) filters.status = status as string;
      if (limit) filters.limit = parseInt(limit as string, 10);

      const jobs = await this.scrapingService.listJobs(filters);

      res.status(200).json({
        success: true,
        jobs,
        count: jobs.length,
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error, res: Response): void {
    this.logger.error('Controller error', error);

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      });
      return;
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}
