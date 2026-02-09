/**
 * Main Scraping Service
 */

import { IScrapingService } from './IScrapingService';
import { IScrapingRepository } from '../repositories/IScrapingRepository';
import { ActorRegistry } from '../actors/ActorRegistry';
import { ProgressService } from './ProgressService';
import { QueueService } from './QueueService';
import { ILogger } from '../utils/ILogger';
import {
  ScrapingRequest,
  ScrapingJob,
  JobStatus,
  ScrapingResult,
  JobFilters,
  JobStatusEnum,
  ProgressUpdate,
} from '../types/common.types';
import { v4 as uuidv4 } from 'uuid';

export class ScrapingService implements IScrapingService {
  private actorRegistry: ActorRegistry;
  private progressService: ProgressService;
  private queueService: QueueService;
  private repository: IScrapingRepository;
  private logger: ILogger;

  constructor(dependencies: {
    actorRegistry: ActorRegistry;
    progressService: ProgressService;
    queueService: QueueService;
    repository: IScrapingRepository;
    logger: ILogger;
  }) {
    this.actorRegistry = dependencies.actorRegistry;
    this.progressService = dependencies.progressService;
    this.queueService = dependencies.queueService;
    this.repository = dependencies.repository;
    this.logger = dependencies.logger;

    // Set up circular dependency
    this.queueService.setScrapingService(this);
  }

  /**
   * Start a new scraping job
   */
  public async startJob(request: ScrapingRequest): Promise<ScrapingJob> {
    const jobId = uuidv4();
    const createdAt = new Date();

    this.logger.info(`Starting new job`, { jobId, platform: request.platform });

    // Validate platform
    if (!this.actorRegistry.isRegistered(request.platform)) {
      throw new Error(`Platform '${request.platform}' is not supported`);
    }

    // Create job
    const job: ScrapingJob = {
      id: jobId,
      platform: request.platform,
      request,
      status: 'pending',
      progress: {
        percentage: 0,
        currentStep: 'Initializing',
        totalSteps: 100,
      },
      createdAt,
    };

    // Initialize progress tracking
    this.progressService.createJob(jobId, request);

    // Add to queue
    await this.queueService.addJob(job);

    this.logger.info(`Job created and queued`, { jobId });

    return job;
  }

  /**
   * Get job status
   */
  public async getJobStatus(jobId: string): Promise<JobStatus> {
    const status = this.progressService.getProgress(jobId);

    if (!status) {
      throw new Error(`Job ${jobId} not found`);
    }

    return status;
  }

  /**
   * Get job results
   */
  public async getJobResults(jobId: string): Promise<ScrapingResult<any>> {
    const output = await this.repository.load(jobId);

    if (!output) {
      throw new Error(`Results for job ${jobId} not found`);
    }

    const status = this.progressService.getProgress(jobId);
    
    if (status?.status !== 'completed') {
      throw new Error(`Job ${jobId} is not completed. Current status: ${status?.status}`);
    }

    return {
      metadata: output.metadata,
      data: output.data,
      statistics: {
        totalItems: output.data.length || 0,
        duration: output.metadata.totalDuration || 0,
        successRate: 100,
      },
    };
  }

  /**
   * Cancel a running job
   */
  public async cancelJob(jobId: string): Promise<void> {
    const status = this.progressService.getProgress(jobId);

    if (!status) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (status.status === 'completed' || status.status === 'failed') {
      throw new Error(`Job ${jobId} is already ${status.status}`);
    }

    // Try to cancel in queue first
    const cancelledInQueue = this.queueService.cancelJob(jobId);

    if (!cancelledInQueue && this.queueService.isRunning(jobId)) {
      // Job is running - can't really stop it, just mark as cancelled
      this.logger.warn(`Job is running, marking as cancelled`, { jobId });
    }

    // Cancel job in progress service
    this.progressService.failJob(jobId, new Error('Job cancelled by user'));

    this.logger.info(`Job cancelled`, { jobId });
  }

  /**
   * List all jobs
   */
  public async listJobs(filters?: JobFilters): Promise<ScrapingJob[]> {
    const statuses = this.progressService.getAllJobs();
    const jobs: ScrapingJob[] = [];

    for (const status of statuses) {
      try {
        const output = await this.repository.load(status.jobId);
        
        const job: ScrapingJob = {
          id: status.jobId,
          platform: status.jobId, // Will be populated from request
          request: { platform: '', config: {} },
          status: status.status,
          progress: {
            percentage: status.progress,
            currentStep: status.currentStep,
            totalSteps: status.totalSteps,
          },
          createdAt: new Date(),
          result: output ? {
            metadata: output.metadata,
            data: output.data,
            statistics: {
              totalItems: output.data.length || 0,
              duration: output.metadata.totalDuration || 0,
              successRate: 100,
            },
          } : undefined,
        };

        jobs.push(job);
      } catch (error) {
        this.logger.warn(`Failed to load job details`, { jobId: status.jobId, error });
      }
    }

    let filteredJobs = jobs;

    if (filters?.platform) {
      filteredJobs = filteredJobs.filter(job => job.platform === filters.platform);
    }

    if (filters?.status) {
      filteredJobs = filteredJobs.filter(job => job.status === filters.status);
    }

    if (filters?.limit) {
      filteredJobs = filteredJobs.slice(0, filters.limit);
    }

    return filteredJobs;
  }

  /**
   * Execute job (called by queue service)
   */
  public async executeJob(job: ScrapingJob): Promise<void> {
    const { id, platform, request } = job;

    try {
      // Update status to running
      this.progressService.updateProgress(id, {
        status: 'running',
        currentStep: 'Starting scraping',
        percentage: 10,
      });

      // Get actor
      const actor = this.actorRegistry.get(platform);

      // Execute scraping
      const result = await actor.execute(request.config);

      // Set job ID in metadata
      result.metadata.jobId = id;

      // Update status to completed
      this.progressService.updateProgress(id, {
        status: 'completed',
        currentStep: 'Completed',
        percentage: 100,
      });

      this.progressService.completeJob(id, result);

      // Save results
      await this.repository.save(id, {
        metadata: result.metadata,
        data: result.data,
      });

      this.logger.info(`Job completed successfully`, { jobId: id });
    } catch (error) {
      // Update status to failed
      this.progressService.failJob(id, error as Error);

      this.logger.error(`Job failed`, error as Error, { jobId: id });

      throw error;
    }
  }

  /**
   * Get queue stats
   */
  public getQueueStats() {
    return this.queueService.getStats();
  }

  /**
   * Get progress service (for advanced usage)
   */
  public getProgressService(): ProgressService {
    return this.progressService;
  }

  /**
   * Get queue service (for advanced usage)
   */
  public getQueueService(): QueueService {
    return this.queueService;
  }
}
