/**
 * Queue Service for managing concurrent job execution
 */

import { ScrapingJob, JobStatusEnum, QueueStats } from '../types/common.types';
import { ScrapingService } from './ScrapingService';
import { ILogger } from '../utils/ILogger';

interface QueueItem {
  job: ScrapingJob;
  priority: number;
  enqueuedAt: Date;
}

export class QueueService {
  private queue: QueueItem[] = [];
  private runningJobs: Map<string, ScrapingJob> = new Map();
  private maxConcurrent: number;
  private isProcessing: boolean = false;
  private isPaused: boolean = false;
  private scrapingService: ScrapingService | null = null;
  private logger: ILogger;

  constructor(maxConcurrent: number, logger: ILogger) {
    this.maxConcurrent = maxConcurrent;
    this.logger = logger;
  }

  /**
   * Set the scraping service (needed for circular dependency)
   */
  public setScrapingService(service: ScrapingService): void {
    this.scrapingService = service;
  }

  /**
   * Add a job to the queue
   */
  public async addJob(job: ScrapingJob): Promise<void> {
    const priority = this.getPriorityValue(job.request.options?.priority || 'normal');
    
    const item: QueueItem = {
      job,
      priority,
      enqueuedAt: new Date(),
    };

    // Insert in priority order (higher priority first)
    const insertIndex = this.queue.findIndex(i => i.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    this.logger.info(`Job added to queue`, { 
      jobId: job.id, 
      priority: job.request.options?.priority || 'normal',
      queuePosition: insertIndex === -1 ? this.queue.length : insertIndex + 1,
    });

    // Try to process next job
    this.processNext();
  }

  /**
   * Process the next job in queue
   */
  public async processNext(): Promise<void> {
    if (this.isProcessing || this.isPaused || !this.scrapingService) {
      return;
    }

    if (this.runningJobs.size >= this.maxConcurrent) {
      this.logger.debug(`Max concurrent jobs reached (${this.maxConcurrent})`);
      return;
    }

    const item = this.queue.shift();
    if (!item) {
      return;
    }

    this.isProcessing = true;
    const { job } = item;

    try {
      this.runningJobs.set(job.id, job);
      this.logger.info(`Starting job execution`, { jobId: job.id });

      // Execute job
      await this.scrapingService.executeJob(job);

      this.logger.info(`Job execution completed`, { jobId: job.id });
    } catch (error) {
      this.logger.error(`Job execution failed`, error as Error, { jobId: job.id });
    } finally {
      this.runningJobs.delete(job.id);
      this.isProcessing = false;

      // Process next job
      this.processNext();
    }
  }

  /**
   * Pause the queue
   */
  public pause(): void {
    this.isPaused = true;
    this.logger.info(`Queue paused`);
  }

  /**
   * Resume the queue
   */
  public resume(): void {
    this.isPaused = false;
    this.logger.info(`Queue resumed`);
    this.processNext();
  }

  /**
   * Clear all pending jobs
   */
  public clear(): void {
    const clearedCount = this.queue.length;
    this.queue = [];
    this.logger.info(`Queue cleared`, { clearedCount });
  }

  /**
   * Cancel a specific job
   */
  public cancelJob(jobId: string): boolean {
    const index = this.queue.findIndex(item => item.job.id === jobId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.logger.info(`Job cancelled in queue`, { jobId });
      return true;
    }
    return false;
  }

  /**
   * Get queue statistics
   */
  public getStats(): QueueStats {
    return {
      totalJobs: this.queue.length + this.runningJobs.size,
      pendingJobs: this.queue.length,
      runningJobs: this.runningJobs.size,
      completedJobs: 0, // Tracked by ProgressService
      failedJobs: 0, // Tracked by ProgressService
    };
  }

  /**
   * Check if a job is running
   */
  public isRunning(jobId: string): boolean {
    return this.runningJobs.has(jobId);
  }

  /**
   * Get running jobs
   */
  public getRunningJobs(): ScrapingJob[] {
    return Array.from(this.runningJobs.values());
  }

  /**
   * Get pending jobs
   */
  public getPendingJobs(): ScrapingJob[] {
    return this.queue.map(item => item.job);
  }

  /**
   * Update max concurrent jobs
   */
  public setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
    this.logger.info(`Max concurrent jobs updated`, { maxConcurrent: max });
    this.processNext();
  }

  /**
   * Get priority value (higher = more important)
   */
  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'high':
        return 3;
      case 'normal':
        return 2;
      case 'low':
        return 1;
      default:
        return 2;
    }
  }
}
