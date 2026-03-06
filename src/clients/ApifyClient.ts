/**
 * Apify Client Wrapper with retry logic and token rotation
 */

import { ApifyClient as ApifyClientLib } from 'apify-client';
import { IApiClient, RunResult, Dataset, ItemList, ListOptions } from './IApiClient';
import { TokenManager } from './TokenManager';
import { ILogger } from '../utils/ILogger';

export class ApifyClient implements IApiClient {
  private client!: ApifyClientLib;
  private tokenManager: TokenManager;
  private logger: ILogger;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1500;
  private readonly TOKEN_ROTATION_DELAY = 3000; // 3 detik delay setelah rotasi token
  private isHandlingTokenExhaustion: boolean = false;

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
      
      if (!dataset) {
        throw new Error(`Dataset ${datasetId} not found`);
      }
      
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
   * Protected against concurrent token exhaustion
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

        // Try to extract error message from various formats
        const errorInfo = this.extractErrorInfo(error);
        this.logger.warn(`Error in ${context}, attempt ${attempt}/${this.MAX_RETRIES}`, {
          attempt,
          error: errorInfo.message,
          statusCode: errorInfo.statusCode,
          isTokenExhausted: this.isTokenExhaustedError(error),
        });

        // Check if it's a token exhausted error
        if (this.isTokenExhaustedError(error)) {
          // Circuit breaker: cegah multiple concurrent token exhaustion handling
          if (this.isHandlingTokenExhaustion) {
            this.logger.warn(`Token exhaustion already being handled, waiting...`, { attempt });
            // Tunggu sampai token rotation selesai
            await new Promise(resolve => setTimeout(resolve, this.TOKEN_ROTATION_DELAY));
            
            // Reinitialize client (token mungkin sudah di-rotate oleh thread lain)
            try {
              this.initializeClient();
            } catch (e) {
              // Token mungkin sudah habis
            }
            continue;
          }

          this.isHandlingTokenExhaustion = true;
          
          try {
            this.logger.warn(`Token exhausted for ${context}, rotating...`, { attempt });
            // Wait longer after token rotation to prevent rapid removal
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 7000) + 3000));

            const rotated = await this.tokenManager.handleTokenExhausted();
            
            if (!rotated) {
              throw new Error('All Apify tokens have been exhausted. Please add more tokens.');
            }

            // Reinitialize client with new token
            this.initializeClient();
            
            // Wait longer after token rotation to prevent rapid removal
            // await new Promise(resolve => setTimeout(resolve, this.TOKEN_ROTATION_DELAY));
          } finally {
            this.isHandlingTokenExhaustion = false;
          }
          continue;
        }

        // If not a token error and not the last attempt, retry
        if (attempt < this.MAX_RETRIES) {
          this.logger.warn(`Retrying ${context}...`, {
            attempt,
            error: errorInfo.message,
          });
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    throw lastError || new Error(`Operation failed after ${this.MAX_RETRIES} attempts`);
  }

  /**
   * Extract error information from various error formats
   */
  private extractErrorInfo(error: any): { message: string; statusCode?: number } {
    if (!error) {
      return { message: 'Unknown error' };
    }

    // Handle direct Error object
    if (error.message) {
      // Check if it's an Apify API error with response body
      if (error.response && error.response.data) {
        const responseData = error.response.data;
        return {
          message: responseData.message || responseData.error || error.message,
          statusCode: error.response.status || error.statusCode,
        };
      }

      // Check if message contains JSON (like the Apify services format: {"attempt":2,"error":"..."})
      if (error.message.includes('"error":')) {
        try {
          // Try to extract JSON from the error message (might have prefix/suffix text)
          const jsonMatch = error.message.match(/\{[\s\S]*"error"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            // Handle Apify Services format with attempt and error fields
            if (parsed.error) {
              return {
                message: parsed.error,
                statusCode: parsed.statusCode || error.statusCode,
              };
            }
          }
        } catch (e) {
          // Not JSON, use as-is
        }
      }

      return {
        message: error.message,
        statusCode: error.statusCode,
      };
    }

    return { message: String(error) };
  }

  /**
   * Check if error is a token exhausted error (403/402)
   */
  private isTokenExhaustedError(error: any): boolean {
    if (!error) return false;
    
    const errorMsg = error.message?.toLowerCase() || '';
    const errorStack = error.stack?.toLowerCase() || '';
    const statusCode = error.statusCode;
    const combinedMsg = errorMsg + ' ' + errorStack;

    // Handle Apify Services JSON error format: {"attempt":2,"error":"...exceed your remaining usage..."}
    // The error message might contain JSON with error field
    if (errorMsg.includes('"error":') || statusCode === 401) {
      try {
        // Try to extract JSON from the error message (might have prefix/suffix text)
        const jsonMatch = errorMsg.match(/\{[\s\S]*"error"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.error) {
            const parsedErrorMsg = parsed.error.toLowerCase();
            return (
              parsedErrorMsg.includes('exceed your remaining usage') ||
              parsedErrorMsg.includes('exceed your remaining') ||
              parsedErrorMsg.includes('insufficient usage') ||
              parsedErrorMsg.includes('not enough usage') ||
              parsedErrorMsg.includes('upgrade to a paid plan') ||
              parsedErrorMsg.includes('quota exceeded') ||
              parsedErrorMsg.includes('token is not valid') ||
              parsedErrorMsg.includes('payment required')
            );
          }
        }
      } catch (e) {
        // Not valid JSON, continue with other checks
      }
    }

    return (
      statusCode === 401 ||
      statusCode === 403 ||
      statusCode === 402 ||
      combinedMsg.includes('403') ||
      combinedMsg.includes('402') ||
      combinedMsg.includes('forbidden') ||
      combinedMsg.includes('quota exceeded') ||
      combinedMsg.includes('limit exceeded') ||
      combinedMsg.includes('payment required') ||
      combinedMsg.includes('exceed your remaining usage') ||
      combinedMsg.includes('exceed your remaining') ||
      combinedMsg.includes('insufficient usage') ||
      combinedMsg.includes('not enough usage') ||
      combinedMsg.includes('upgrade to a paid plan')
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
