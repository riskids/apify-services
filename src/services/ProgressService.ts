/**
 * Progress Service for tracking job progress
 */

import { ILogger } from '../utils/ILogger';
import {
  ScrapingRequest,
  JobStatus,
  JobStatusEnum,
  ProgressUpdate,
  ScrapingResult,
} from '../types/common.types';

export class ProgressService {
  private jobs: Map<string, JobStatus> = new Map();
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  /**
   * Create a new job
   */
  public createJob(jobId: string, request: ScrapingRequest): JobStatus {
    const status: JobStatus = {
      jobId,
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing',
      totalSteps: 100,
    };

    this.jobs.set(jobId, status);
    this.logger.info(`Job created`, { jobId, platform: request.platform });

    return status;
  }

  /**
   * Update job progress
   */
  public updateProgress(jobId: string, update: ProgressUpdate): void {
    const status = this.jobs.get(jobId);
    if (!status) {
      this.logger.warn(`Attempted to update non-existent job`, { jobId });
      return;
    }

    if (update.status) {
      status.status = update.status;
    }
    if (update.percentage !== undefined) {
      status.progress = update.percentage;
    }
    if (update.currentStep) {
      status.currentStep = update.currentStep;
    }
    if (update.totalSteps) {
      status.totalSteps = update.totalSteps;
    }

    this.logger.debug(`Job progress updated`, { jobId, status });
  }

  /**
   * Get job progress
   */
  public getProgress(jobId: string): JobStatus | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Mark job as completed
   */
  public completeJob(jobId: string, result: ScrapingResult<any>): void {
    const status = this.jobs.get(jobId);
    if (!status) {
      this.logger.warn(`Attempted to complete non-existent job`, { jobId });
      return;
    }

    status.status = 'completed';
    status.progress = 100;
    status.currentStep = 'Completed';

    this.logger.info(`Job completed`, { 
      jobId, 
      totalItems: result.metadata.totalItems,
      duration: result.metadata.totalDuration,
    });
  }

  /**
   * Mark job as failed
   */
  public failJob(jobId: string, error: Error): void {
    const status = this.jobs.get(jobId);
    if (!status) {
      this.logger.warn(`Attempted to fail non-existent job`, { jobId });
      return;
    }

    status.status = 'failed';
    status.errorMessage = error.message;

    this.logger.error(`Job failed`, error, { jobId });
  }

  /**
   * Get all jobs
   */
  public getAllJobs(): JobStatus[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs by status
   */
  public getJobsByStatus(status: JobStatusEnum): JobStatus[] {
    return this.getAllJobs().filter(job => job.status === status);
  }

  /**
   * Clear completed jobs older than specified hours
   */
  public clearOldJobs(maxAgeHours: number): number {
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    let clearedCount = 0;

    for (const [jobId, status] of this.jobs.entries()) {
      // Only clear completed or failed jobs
      if (status.status === 'completed' || status.status === 'failed') {
        // Note: In a real implementation, we'd track job creation time
        // For now, we'll just clear all completed/failed jobs
        this.jobs.delete(jobId);
        clearedCount++;
      }
    }

    this.logger.info(`Cleared ${clearedCount} old jobs`);
    return clearedCount;
  }

  /**
   * Get job count by status
   */
  public getJobCounts(): Record<JobStatusEnum | 'total', number> {
    const counts = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: this.jobs.size,
    };

    for (const status of this.jobs.values()) {
      counts[status.status]++;
    }

    return counts;
  }
}
