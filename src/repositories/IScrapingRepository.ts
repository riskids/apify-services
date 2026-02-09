/**
 * Scraping Repository Interface
 */

import { ScrapingMetadata } from '../types/common.types';
import { FilterOptions } from '../types/common.types';

export interface ScrapingOutput {
  metadata: ScrapingMetadata;
  data: any;
}

export interface IScrapingRepository {
  /**
   * Save scraping results
   */
  save(jobId: string, data: ScrapingOutput): Promise<void>;

  /**
   * Load scraping results by job ID
   */
  load(jobId: string): Promise<ScrapingOutput | null>;

  /**
   * Check if job results exist
   */
  exists(jobId: string): Promise<boolean>;

  /**
   * Delete job results
   */
  delete(jobId: string): Promise<void>;

  /**
   * List results with filters
   */
  list(filters?: FilterOptions): Promise<ScrapingOutput[]>;
}
