/**
 * Scraping Request DTOs
 */

import { ScrapingOptions } from '../types/common.types';

export interface CreateScrapingRequestDto {
  platform: string;
  config: {
    keywords?: string;
    startDate?: string;
    endDate?: string;
    dateLimit?: string;
    maxItems?: number;
    totalLimit?: number;
    sortBy?: 'new' | 'hot' | 'top';
    [key: string]: any;
  };
  options?: ScrapingOptions;
}

export interface ScrapingResponseDto {
  success: boolean;
  jobId: string;
  status: string;
  message?: string;
  error?: {
    message: string;
    code: string;
  };
}

export interface JobStatusResponseDto {
  success: boolean;
  jobId: string;
  status: string;
  progress: number;
  currentStep: string;
  errorMessage?: string;
}

export interface JobResultsResponseDto {
  success: boolean;
  jobId: string;
  metadata: {
    platform: string;
    scrapedAt: string;
    completedAt?: string;
    totalItems: number;
    totalDuration: number;
  };
  data: any;
  statistics: {
    totalItems: number;
    duration: number;
    successRate: number;
  };
}

export interface ListJobsResponseDto {
  success: boolean;
  jobs: any[];
  count: number;
}
