/**
 * Application Constants
 */

export const APP_NAME = 'Apify Services';
export const APP_VERSION = '1.0.0';

// API
export const API_PREFIX = '/api';
export const API_VERSION = 'v1';

// Job Status
export const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

// Platforms
export const PLATFORMS = {
  X: 'x',
  REDDIT: 'reddit',
} as const;

// Actor IDs
export const ACTOR_IDS = {
  X: 'rmyzeijic5nBVm8BG',
  REDDIT: 'macrocosmos/reddit-scraper',
} as const;

// Default Values
export const DEFAULTS = {
  MAX_ITEMS: 100,
  TOTAL_LIMIT: 0, // 0 = unlimited
  SORT_BY: 'new',
  DAYS_PER_RANGE: 3,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1500,
} as const;

// Error Codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT: 'RATE_LIMIT',
  TOKENS_EXHAUSTED: 'TOKENS_EXHAUSTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
