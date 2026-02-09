/**
 * Common type definitions used across the application
 */

export interface ScrapingMetadata {
  platform: string;
  jobId: string;
  scrapedAt: string;
  completedAt?: string;
  totalItems: number;
  totalDuration: number;
}

export interface ScrapingStatistics {
  totalItems: number;
  duration: number;
  successRate: number;
}

export interface ScrapingResult<TOutput> {
  metadata: ScrapingMetadata;
  data: TOutput;
  statistics: ScrapingStatistics;
}

export interface ScrapingOptions {
  priority?: 'low' | 'normal' | 'high';
  callbackUrl?: string;
  webhookUrl?: string;
}

export interface ScrapingRequest {
  platform: string;
  config: any;
  options?: ScrapingOptions;
}

export interface ScrapingResponse {
  success: boolean;
  jobId: string;
  status: JobStatus;
  data?: any;
  error?: ErrorResponse;
}

export interface ScrapingJob {
  id: string;
  platform: string;
  request: ScrapingRequest;
  status: JobStatusEnum;
  progress: ProgressInfo;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: ScrapingResult<any>;
}

export type JobStatusEnum = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobStatus {
  jobId: string;
  status: JobStatusEnum;
  progress: number;
  currentStep: string;
  totalSteps: number;
  errorMessage?: string;
}

export interface ProgressInfo {
  percentage: number;
  currentStep: string;
  totalSteps: number;
}

export interface ProgressUpdate {
  status?: JobStatusEnum;
  percentage?: number;
  currentStep?: string;
  totalSteps?: number;
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: any;
  };
}

export interface JobFilters {
  platform?: string;
  status?: JobStatusEnum;
  limit?: number;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface QueueStats {
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
}

export interface FilterOptions {
  platform?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    api: boolean;
    database?: boolean;
    apify: boolean;
  };
  details?: any;
}
