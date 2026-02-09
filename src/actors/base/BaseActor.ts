/**
 * Abstract base class for all actors
 */

import { IApiClient } from '../../clients/IApiClient';
import { ILogger } from '../../utils/ILogger';
import { ScrapingResult, ScrapingMetadata, ScrapingStatistics } from '../../types/common.types';

export abstract class BaseActor<TInput, TOutput> {
  protected apifyClient: IApiClient;
  protected logger: ILogger;

  constructor(apifyClient: IApiClient, logger: ILogger) {
    this.apifyClient = apifyClient;
    this.logger = logger;
  }

  /**
   * Main entry point for scraping
   */
  public async execute(input: TInput): Promise<ScrapingResult<TOutput>> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting scrape for ${this.getPlatform()}`, { input });

      // Validate input
      await this.validateInput(input);

      // Execute platform-specific scraping
      const rawData = await this.executeScraping(input);

      // Transform data to standard format
      const transformedData = this.transformData(rawData);

      // Create result with metadata
      const metadata: ScrapingMetadata = {
        platform: this.getPlatform(),
        jobId: '', // Will be set by service layer
        scrapedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalItems: Array.isArray(transformedData) ? transformedData.length : 
                    (transformedData as any).posts?.length || 0,
        totalDuration: Date.now() - startTime,
      };

      const statistics: ScrapingStatistics = {
        totalItems: metadata.totalItems,
        duration: metadata.totalDuration,
        successRate: 100,
      };

      const result: ScrapingResult<TOutput> = {
        metadata,
        data: transformedData,
        statistics,
      };

      this.logger.info(`Scraping completed for ${this.getPlatform()}`, {
        totalItems: metadata.totalItems,
        duration: metadata.totalDuration,
      });

      return result;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Get platform name
   */
  public abstract getPlatform(): string;

  /**
   * Get Apify actor ID
   */
  protected abstract getActorId(): string;

  /**
   * Validate input parameters
   */
  protected abstract validateInput(input: TInput): Promise<void>;

  /**
   * Execute platform-specific scraping
   */
  protected abstract executeScraping(input: TInput): Promise<TOutput>;

  /**
   * Transform raw API data to standard format
   */
  protected abstract transformData(rawData: any): TOutput;

  /**
   * Handle errors
   */
  protected handleError(error: Error): void {
    this.logger.error(`Error in ${this.getPlatform()} actor`, error);
  }
}
