/**
 * Registry for managing available actors
 */

import { BaseActor } from './base/BaseActor';

export class ActorRegistry {
  private actors: Map<string, BaseActor<any, any>> = new Map();

  /**
   * Register an actor
   */
  public register(actor: BaseActor<any, any>): void {
    this.actors.set(actor.getPlatform(), actor);
  }

  /**
   * Get actor by platform name
   */
  public get(platform: string): BaseActor<any, any> {
    const actor = this.actors.get(platform);
    if (!actor) {
      throw new Error(`Actor for platform '${platform}' not found`);
    }
    return actor;
  }

  /**
   * Get all registered actors
   */
  public getAll(): BaseActor<any, any>[] {
    return Array.from(this.actors.values());
  }

  /**
   * Check if platform is registered
   */
  public isRegistered(platform: string): boolean {
    return this.actors.has(platform);
  }

  /**
   * Get list of registered platforms
   */
  public getPlatforms(): string[] {
    return Array.from(this.actors.keys());
  }

  /**
   * Unregister an actor
   */
  public unregister(platform: string): boolean {
    return this.actors.delete(platform);
  }

  /**
   * Clear all registered actors
   */
  public clear(): void {
    this.actors.clear();
  }
}
