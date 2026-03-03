/**
 * Token Manager for handling multiple Apify tokens
 * Thread-safe with mutex locking for concurrent operations
 */

import * as fs from 'fs/promises';
import { ILogger } from '../utils/ILogger';

export class TokenManager {
  private tokens: string[] = [];
  private currentIndex: number = 0;
  private tokenFilePath: string;
  private logger: ILogger;
  private lock: boolean = false;
  private lockQueue: Array<() => void> = [];
  private lastTokenRemovalTime: number = 0;
  private readonly TOKEN_REMOVAL_COOLDOWN_MS = 5000; // 5 detik cooldown

  constructor(tokenFilePath: string, logger: ILogger) {
    this.tokenFilePath = tokenFilePath;
    this.logger = logger;
  }

  /**
   * Acquire lock for thread-safe operations
   */
  private async acquireLock(): Promise<void> {
    if (this.lock) {
      return new Promise((resolve) => {
        this.lockQueue.push(resolve);
      });
    }
    this.lock = true;
  }

  /**
   * Release lock
   */
  private releaseLock(): void {
    this.lock = false;
    const next = this.lockQueue.shift();
    if (next) {
      next();
    }
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
   * Thread-safe with mutex locking
   */
  public async rotateToken(): Promise<string> {
    await this.acquireLock();
    
    try {
      if (this.tokens.length === 0) {
        throw new Error('No tokens available to rotate');
      }

      this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
      
      this.logger.info(`Rotated to token ${this.currentIndex + 1}/${this.tokens.length}`, {
        tokenPreview: this.tokens[this.currentIndex].substring(0, 20),
      });

      return this.tokens[this.currentIndex];
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Handle token exhaustion (remove current token and rotate to next)
   * Thread-safe with mutex locking + cooldown protection
   */
  public async handleTokenExhausted(): Promise<boolean> {
    await this.acquireLock();
    
    try {
      if (this.tokens.length === 0) {
        return false;
      }

      const exhaustedToken = this.tokens[this.currentIndex];
      
      // Double-check: jika token sudah dihapus oleh thread lain, skip
      if (!this.tokens.includes(exhaustedToken)) {
        this.logger.warn(`Token already removed by another request`, {
          tokenPreview: exhaustedToken.substring(0, 20),
        });
        // Cukup rotate ke token berikutnya
        this.currentIndex = this.currentIndex % this.tokens.length;
        return this.tokens.length > 0;
      }

      // Cooldown protection: cegah penghapusan token terlalu cepat
      const now = Date.now();
      const timeSinceLastRemoval = now - this.lastTokenRemovalTime;
      if (timeSinceLastRemoval < this.TOKEN_REMOVAL_COOLDOWN_MS) {
        const waitTime = this.TOKEN_REMOVAL_COOLDOWN_MS - timeSinceLastRemoval;
        this.logger.warn(`Token removal cooldown active, waiting ${waitTime}ms`, {
          tokenPreview: exhaustedToken.substring(0, 20),
        });
        // Release lock selama wait untuk tidak block thread lain
        this.releaseLock();
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Re-acquire lock dan coba lagi
        return this.handleTokenExhausted();
      }

      this.logger.warn(`Removing exhausted token`, {
        tokenPreview: exhaustedToken.substring(0, 20),
        remainingBeforeRemoval: this.tokens.length,
      });

      // Remove current token
      const removedIndex = this.currentIndex;
      this.tokens.splice(removedIndex, 1);
      this.lastTokenRemovalTime = Date.now();

      if (this.tokens.length === 0) {
        await this.saveTokensInternal();
        this.logger.error('All tokens exhausted');
        return false;
      }

      // Jika kita menghapus token terakhir, reset index ke 0
      if (this.currentIndex >= this.tokens.length) {
        this.currentIndex = 0;
      }

      // Save remaining tokens
      await this.saveTokensInternal();

      this.logger.info(`Switched to new token`, {
        remainingTokens: this.tokens.length,
        currentIndex: this.currentIndex,
        tokenPreview: this.tokens[this.currentIndex].substring(0, 20),
      });

      return true;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Save tokens to file
   * Thread-safe with mutex locking
   */
  public async saveTokens(): Promise<void> {
    await this.acquireLock();
    
    try {
      const content = this.tokens.join('\n');
      await fs.writeFile(this.tokenFilePath, content, 'utf-8');
      this.logger.debug(`Saved ${this.tokens.length} tokens to file`);
    } catch (error) {
      this.logger.error('Failed to save tokens', error as Error);
      throw error;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Get token count
   * Thread-safe read
   */
  public getTokenCount(): number {
    return this.tokens.length;
  }

  /**
   * Add a new token
   * Thread-safe with mutex locking
   */
  public async addToken(token: string): Promise<void> {
    await this.acquireLock();
    
    try {
      this.tokens.push(token);
      await this.saveTokensInternal();
      this.logger.info(`Added new token, total tokens: ${this.tokens.length}`);
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Internal save without locking (untuk digunakan dalam method yang sudah punya lock)
   */
  private async saveTokensInternal(): Promise<void> {
    const content = this.tokens.join('\n');
    await fs.writeFile(this.tokenFilePath, content, 'utf-8');
    this.logger.debug(`Saved ${this.tokens.length} tokens to file`);
  }
}
