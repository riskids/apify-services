/**
 * Configuration Management
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), 'config/.env') });

export interface AppConfig {
  // Server
  port: number;
  nodeEnv: string;

  // Apify
  apifyTokenFilePath: string;

  // Output
  outputDir: string;
  enableDatabaseStorage: boolean;
  databaseUrl?: string;

  // Queue
  maxConcurrentJobs: number;
  jobTimeout: number;

  // Rate Limiting
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;

  // Logging
  logLevel: string;
  logDir: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value || defaultValue!;
}

function getEnvVarAsInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer`);
  }
  return parsed;
}

function getEnvVarAsBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

export const config: AppConfig = {
  // Server
  port: getEnvVarAsInt('PORT', 3000),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),

  // Apify
  apifyTokenFilePath: getEnvVar('APIFY_TOKEN_FILE_PATH', './config/apify-token.txt'),

  // Output
  outputDir: getEnvVar('OUTPUT_DIR', './output'),
  enableDatabaseStorage: getEnvVarAsBool('ENABLE_DATABASE_STORAGE', false),
  databaseUrl: process.env.DATABASE_URL,

  // Queue
  maxConcurrentJobs: getEnvVarAsInt('MAX_CONCURRENT_JOBS', 5),
  jobTimeout: getEnvVarAsInt('JOB_TIMEOUT', 3600000),

  // Rate Limiting
  rateLimitWindowMs: getEnvVarAsInt('RATE_LIMIT_WINDOW_MS', 900000),
  rateLimitMaxRequests: getEnvVarAsInt('RATE_LIMIT_MAX_REQUESTS', 100),

  // Logging
  logLevel: getEnvVar('LOG_LEVEL', 'info'),
  logDir: getEnvVar('LOG_DIR', './logs'),
};

export default config;
