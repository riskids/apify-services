/**
 * Sync Controller
 * For synchronous scraping operations
 */

import { Request, Response } from 'express';
import { IScrapingService } from '../services/IScrapingService';
import { ILogger } from '../utils/ILogger';
import { ApiError, ValidationError } from '../dto/ErrorResponse';

export class SyncController {
  private scrapingService: IScrapingService;
  private logger: ILogger;

  constructor(scrapingService: IScrapingService, logger: ILogger) {
    this.scrapingService = scrapingService;
    this.logger = logger;
  }

  /**
   * Synchronously scrape X (Twitter) data
   * POST /api/sync/x
   * 
   * Waits for scraping to complete and returns results directly.
   * No job is created - this is a blocking operation.
   */
  public async scrapeXSync(req: Request, res: Response): Promise<void> {
    try {
      const { config, options } = req.body;

      // Validate config
      if (!config) {
        throw new ValidationError('Config is required');
      }

      if (!config.keywords) {
        throw new ValidationError('Keywords are required');
      }

      if (!config.startDate || !config.endDate) {
        throw new ValidationError('Start date and end date are required');
      }

      if (!config.maxItems || config.maxItems <= 0) {
        throw new ValidationError('Max items must be greater than 0');
      }

      // Construct scraping request for X platform
      const request = {
        platform: 'x',
        config: {
          keywords: config.keywords,
          startDate: config.startDate,
          endDate: config.endDate,
          maxItems: config.maxItems,
        },
        options: options,
      };

      this.logger.info(`Starting synchronous X scraping via /sync/x endpoint`, { 
        config: request.config 
      });

      // Execute synchronous scraping
      const result = await this.scrapingService.scrapeXSync(request);

      this.logger.info(`Synchronous X scraping completed`, { 
        totalItems: result.metadata.totalItems,
        duration: result.metadata.totalDuration 
      });

      res.status(200).json({
        success: true,
        metadata: result.metadata,
        data: result.data,
        statistics: result.statistics,
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * Synchronously scrape Google Maps data
   * POST /api/sync/google-maps
   * 
   * Waits for scraping to complete and returns results directly.
   * No job is created - this is a blocking operation.
   */
  public async scrapeGoogleMapsSync(req: Request, res: Response): Promise<void> {
    try {
      const { config, options } = req.body;

      // Validate config
      if (!config) {
        throw new ValidationError('Config is required');
      }

      if (!config.location) {
        throw new ValidationError('Location is required');
      }

      if (!config.maxResults || config.maxResults <= 0) {
        throw new ValidationError('Max results must be greater than 0');
      }

      // Validate searchStringsArray if provided
      if (config.searchStringsArray && !Array.isArray(config.searchStringsArray)) {
        throw new ValidationError('searchStringsArray must be an array');
      }

      if (config.searchStringsArray && config.searchStringsArray.some((item: any) => typeof item !== 'string')) {
        throw new ValidationError('searchStringsArray must contain only strings');
      }

      // Construct scraping request for Google Maps platform
      const request = {
        platform: 'google-maps',
        config: {
          location: config.location,
          maxResults: config.maxResults,
          searchStringsArray: config.searchStringsArray,
          language: config.language,
        },
        options: options,
      };

      this.logger.info(`Starting synchronous Google Maps scraping via /sync/google-maps endpoint`, { 
        config: request.config 
      });

      // Execute synchronous scraping
      const result = await this.scrapingService.scrapeGoogleMapsSync(request);

      this.logger.info(`Synchronous Google Maps scraping completed`, { 
        totalItems: result.metadata.totalItems,
        duration: result.metadata.totalDuration 
      });

      res.status(200).json({
        success: true,
        metadata: result.metadata,
        data: result.data,
        statistics: result.statistics,
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * Synchronously scrape Leads Finder data
   * POST /api/sync/leads-finder
   * 
   * Waits for scraping to complete and returns results directly.
   * No job is created - this is a blocking operation.
   */
  public async scrapeLeadsFinderSync(req: Request, res: Response): Promise<void> {
    try {
      const { config, options } = req.body;

      // Validate config
      if (!config) {
        throw new ValidationError('Config is required');
      }

      if (!config.keywords) {
        throw new ValidationError('Keywords are required');
      }

      // Construct scraping request for Leads Finder platform
      const request = {
        platform: 'leads-finder',
        config: {
          keywords: config.keywords,
          location: config.location,
          industry: config.industry,
          maxResults: config.maxResults || 100,
        },
        options: options,
      };

      this.logger.info(`Starting synchronous Leads Finder scraping via /sync/leads-finder endpoint`, { 
        config: request.config 
      });

      // Execute synchronous scraping
      const result = await this.scrapingService.scrapeLeadsFinderSync(request);

      this.logger.info(`Synchronous Leads Finder scraping completed`, { 
        totalItems: result.metadata.totalItems,
        duration: result.metadata.totalDuration 
      });

      res.status(200).json({
        success: true,
        metadata: result.metadata,
        data: result.data,
        statistics: result.statistics,
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error, res: Response): void {
    this.logger.error('Sync controller error', error);

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
