/**
 * Scraping Service Interface
 */

import {
  ScrapingRequest,
  ScrapingJob,
  JobStatus,
  ScrapingResult,
  JobFilters,
} from '../types/common.types';

export interface IScrapingService {
  /**
   * Start a new scraping job
   */
  startJob(request: ScrapingRequest): Promise<ScrapingJob>;

  /**
   * Start a synchronous scraping job for X platform
   * waits for completion and returns results directly
   */
  scrapeXSync(request: ScrapingRequest): Promise<ScrapingResult<any>>;

  /**
   * Start a synchronous scraping job for Google Maps
   * waits for completion and returns results directly
   */
  scrapeGoogleMapsSync(request: ScrapingRequest): Promise<ScrapingResult<any>>;

  /**
   * Start a synchronous scraping job for Leads Finder
   * waits for completion and returns results directly
   */
  scrapeLeadsFinderSync(request: ScrapingRequest): Promise<ScrapingResult<any>>;

  /**
   * Get job status
   */
  getJobStatus(jobId: string): Promise<JobStatus>;

  /**
   * Get job results
   */
  getJobResults(jobId: string): Promise<ScrapingResult<any>>;

  /**
   * Cancel a running job
   */
  cancelJob(jobId: string): Promise<void>;

  /**
   * List all jobs with optional filters
   */
  listJobs(filters?: JobFilters): Promise<ScrapingJob[]>;
}
