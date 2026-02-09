/**
 * Token Manager for handling multiple Apify tokens
 */

import * as fs from 'fs/promises';
import { ILogger } from '../utils/ILogger';

export class TokenManager {
  private tokens: string[] = [];
  private currentIndex: number = 0;
  private tokenFilePath: string;
  private logger: ILogger;

  constructor(tokenFilePath: string, logger: ILogger) {
    this.tokenFilePath = tokenFilePath;
    this.logger = logger;
  }

  /**
   * Load tokens from file
   */
  public async loadTokens(): Promise<void> {
    try {
      const content = await fs.readFile(this.tokenFilePath, 'utf-8');
      this.tokens = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));

      if (this.tokens.length === 0) {
        throw new Error('No tokens found in token file');
      }

      this.currentIndex = 0;
      this.logger.info(`Loaded ${this.tokens.length} tokens`, {
        firstTokenPreview: this.tokens[0].substring(0, 20),
      });
    } catch (error) {
      this.logger.error('Failed to load tokens', error as Error);
      throw error;
    }
  }

  /**
   * Get current token
   */
  public getCurrentToken(): string {
    if (this.tokens.length === 0) {
      throw new Error('No tokens available. Please load tokens first.');
    }
    return this.tokens[this.currentIndex];
  }

  /**
   * Rotate to next token
   */
  public async rotateToken(): Promise<string> {
    if (this.tokens.length === 0) {
      throw new Error('No tokens available to rotate');
    }

    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
    
    this.logger.info(`Rotated to token ${this.currentIndex + 1}/${this.tokens.length}`, {
      tokenPreview: this.tokens[this.currentIndex].substring(0, 20),
    });

    return this.tokens[this.currentIndex];
  }

  /**
   * Handle token exhaustion (remove current token and rotate to next)
   */
  public async handleTokenExhausted(): Promise<boolean> {
    if (this.tokens.length === 0) {
      return false;
    }

    const exhaustedToken = this.tokens[this.currentIndex];
    this.logger.warn(`Removing exhausted token`, {
      tokenPreview: exhaustedToken.substring(0, 20),
    });

    // Remove current token
    this.tokens.splice(this.currentIndex, 1);

    if (this.tokens.length === 0) {
      await this.saveTokens();
      this.logger.error('All tokens exhausted');
      return false;
    }

    // If we removed the last token, reset index
    if (this.currentIndex >= this.tokens.length) {
      this.currentIndex = 0;
    }

    // Save remaining tokens
    await this.saveTokens();

    this.logger.info(`Switched to new token`, {
      remainingTokens: this.tokens.length,
      tokenPreview: this.tokens[this.currentIndex].substring(0, 20),
    });

    return true;
  }

  /**
   * Save tokens to file
   */
  public async saveTokens(): Promise<void> {
    try {
      const content = this.tokens.join('\n');
      await fs.writeFile(this.tokenFilePath, content, 'utf-8');
      this.logger.debug(`Saved ${this.tokens.length} tokens to file`);
    } catch (error) {
      this.logger.error('Failed to save tokens', error as Error);
      throw error;
    }
  }

  /**
   * Get token count
   */
  public getTokenCount(): number {
    return this.tokens.length;
  }

  /**
   * Add a new token
   */
  public async addToken(token: string): Promise<void> {
    this.tokens.push(token);
    await this.saveTokens();
    this.logger.info(`Added new token, total tokens: ${this.tokens.length}`);
  }
}
