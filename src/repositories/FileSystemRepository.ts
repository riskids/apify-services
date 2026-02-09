/**
 * File System Repository Implementation
 */

import { IScrapingRepository, ScrapingOutput } from './IScrapingRepository';
import { ILogger } from '../utils/ILogger';
import { FileUtils } from '../utils/fileUtils';
import { FilterOptions } from '../types/common.types';
import * as path from 'path';

export class FileSystemRepository implements IScrapingRepository {
  private outputDir: string;
  private logger: ILogger;

  constructor(outputDir: string, logger: ILogger) {
    this.outputDir = outputDir;
    this.logger = logger;
  }

  /**
   * Save scraping results to file
   */
  public async save(jobId: string, data: ScrapingOutput): Promise<void> {
    const filePath = this.getFilePath(jobId);
    
    try {
      await FileUtils.writeJson(filePath, data);
      this.logger.info(`Results saved to file`, { jobId, filePath });
    } catch (error) {
      this.logger.error(`Failed to save results`, error as Error, { jobId });
      throw error;
    }
  }

  /**
   * Load scraping results from file
   */
  public async load(jobId: string): Promise<ScrapingOutput | null> {
    const filePath = this.getFilePath(jobId);
    
    try {
      if (!(await FileUtils.fileExists(filePath))) {
        return null;
      }

      const data = await FileUtils.readJson<ScrapingOutput>(filePath);
      this.logger.debug(`Results loaded from file`, { jobId });
      return data;
    } catch (error) {
      this.logger.error(`Failed to load results`, error as Error, { jobId });
      throw error;
    }
  }

  /**
   * Check if job results exist
   */
  public async exists(jobId: string): Promise<boolean> {
    const filePath = this.getFilePath(jobId);
    return FileUtils.fileExists(filePath);
  }

  /**
   * Delete job results
   */
  public async delete(jobId: string): Promise<void> {
    const filePath = this.getFilePath(jobId);
    
    try {
      if (await FileUtils.fileExists(filePath)) {
        await FileUtils.deleteFile(filePath);
        this.logger.info(`Results deleted`, { jobId });
      }
    } catch (error) {
      this.logger.error(`Failed to delete results`, error as Error, { jobId });
      throw error;
    }
  }

  /**
   * List results with filters
   */
  public async list(filters?: FilterOptions): Promise<ScrapingOutput[]> {
    try {
      const files = await FileUtils.listFiles(this.outputDir, '\\.json$');
      const results: ScrapingOutput[] = [];

      for (const file of files) {
        try {
          const data = await FileUtils.readJson<ScrapingOutput>(file);
          
          // Apply filters
          if (filters?.platform && data.metadata.platform !== filters.platform) {
            continue;
          }

          results.push(data);
        } catch (error) {
          this.logger.warn(`Failed to read file`, { file, error });
        }
      }

      // Apply limit and offset
      let filtered = results;
      if (filters?.offset) {
        filtered = filtered.slice(filters.offset);
      }
      if (filters?.limit) {
        filtered = filtered.slice(0, filters.limit);
      }

      return filtered;
    } catch (error) {
      this.logger.error(`Failed to list results`, error as Error);
      throw error;
    }
  }

  /**
   * Get file path for job
   */
  private getFilePath(jobId: string): string {
    return path.join(this.outputDir, `${jobId}.json`);
  }
}
