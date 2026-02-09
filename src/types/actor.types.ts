/**
 * Actor-related type definitions
 */

import { ScrapingResult } from './common.types';

export interface IValidator<T> {
  validate(input: T): Promise<void>;
}

export interface IDataTransformer<TInput, TOutput> {
  transform(input: TInput): TOutput;
}

export interface IActor {
  getPlatform(): string;
  execute(input: any): Promise<ScrapingResult<any>>;
}

export interface ActorConfig {
  actorId: string;
  platform: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ActorInput {
  [key: string]: any;
}

export interface ActorOutput {
  [key: string]: any;
}
