/**
 * Apify Client Wrapper with retry logic and token rotation
 */

import { ApifyClient as ApifyClientLib } from 'apify-client';
import { IApiClient, RunResult, Dataset, ItemList, ListOptions } from './IApiClient';
import { TokenManager } from './TokenManager';
import { ILogger } from '../utils/ILogger';

export class ApifyClient implements IApiClient {
  private client: ApifyClientLib;
  private tokenManager: TokenManager;
  private logger: ILogger;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1500;

  constructor(tokenManager: TokenManager, logger: ILogger) {
    this.tokenManager = tokenManager;
    this.logger = logger;
    this.initializeClient();
  }

  /**
   * Call Apify actor with input
   */
  public async call(actorId: string, input: any): Promise<RunResult> {
    return this.executeWithRetry(async () => {
      const token = this.tokenManager.getCurrentToken();
      this.logger.debug(`Calling actor ${actorId}`, { tokenPreview: token.substring(0, 20) });

      const run = await this.client.actor(actorId).call(input);
      
      return {
        defaultDatasetId: run.defaultDatasetId,
        id: run.id,
        status: run.status,
      };
    }, actorId);
  }

  /**
   * Get dataset by ID
   */
  public async getDataset(datasetId: string): Promise<Dataset> {
    return this.executeWithRetry(async () => {
      const dataset = await this.client.dataset(datasetId).get();
      
      return {
        id: dataset.id,
        itemCount: dataset.itemCount,
      };
    }, 'dataset');
  }

  /**
   * List items from dataset
   */
  public async listItems(datasetId: string, options?: ListOptions): Promise<ItemList> {
    return this.executeWithRetry(async () => {
      const result = await this.client.dataset(datasetId).listItems(options);
      
      return {
        items: result.items,
        total: result.total,
        offset: result.offset,
        count: result.count,
      };
    }, `dataset:${datasetId}`);
  }

  /**
   * Execute operation with retry logic and token rotation
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if it's a 403 error (token exhausted)
        if (this.isTokenExhaustedError(error)) {
          this.logger.warn(`Token exhausted for ${context}, rotating...`, { attempt });

          const rotated = await this.tokenManager.handleTokenExhausted();
          
          if (!rotated) {
            throw new Error('All Apify tokens have been exhausted. Please add more tokens.');
          }

          // Reinitialize client with new token
          this.initializeClient();
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
          continue;
        }

        // If not a token error and not the last attempt, retry
        if (attempt < this.MAX_RETRIES) {
          this.logger.warn(`Error in ${context}, retrying...`, {
            attempt,
            error: lastError.message,
          });
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    throw lastError || new Error(`Operation failed after ${this.MAX_RETRIES} attempts`);
  }

  /**
   * Check if error is a token exhausted error (403)
   */
  private isTokenExhaustedError(error: any): boolean {
    if (!error) return false;
    
    const errorMsg = error.message?.toLowerCase() || '';
    const statusCode = error.statusCode;

    return (
      statusCode === 403 ||
      errorMsg.includes('403') ||
      errorMsg.includes('forbidden') ||
      errorMsg.includes('quota exceeded') ||
      errorMsg.includes('limit exceeded') ||
      errorMsg.includes('payment required')
    );
  }

  /**
   * Initialize Apify client with current token
   */
  private initializeClient(): void {
    const token = this.tokenManager.getCurrentToken();
    this.client = new ApifyClientLib({ token });
  }
}
