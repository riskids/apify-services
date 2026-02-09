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
