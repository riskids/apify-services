/**
 * Server Entry Point
 */

import { createApp } from './app';
import { Logger } from './utils/logger';
import { ILogger, LogLevel } from './utils/ILogger';
import { TokenManager } from './clients/TokenManager';
import { ApifyClient } from './clients/ApifyClient';
import { ActorRegistry } from './actors/ActorRegistry';
import { XActor } from './actors/x/XActor';
import { RedditActor } from './actors/reddit/RedditActor';
import { ScrapingService } from './services/ScrapingService';
import { ProgressService } from './services/ProgressService';
import { QueueService } from './services/QueueService';
import { FileSystemRepository } from './repositories/FileSystemRepository';
import config from './config/config';

async function bootstrap() {
  // Initialize logger
  const logger: ILogger = new Logger(
    config.logLevel as LogLevel,
    config.logDir
  );

  logger.info(`Starting ${config.nodeEnv} server...`);

  try {
    // Initialize token manager
    const tokenManager = new TokenManager(config.apifyTokenFilePath, logger);
    await tokenManager.loadTokens();

    // Initialize Apify client
    const apifyClient = new ApifyClient(tokenManager, logger);

    // Initialize actor registry
    const actorRegistry = new ActorRegistry();
    actorRegistry.register(new XActor(apifyClient, logger));
    actorRegistry.register(new RedditActor(apifyClient, logger, './config/subreddit.txt'));

    logger.info(`Registered ${actorRegistry.getPlatforms().length} actors`, {
      platforms: actorRegistry.getPlatforms(),
    });

    // Initialize services
    const progressService = new ProgressService(logger);
    const queueService = new QueueService(config.maxConcurrentJobs, logger);
    const repository = new FileSystemRepository(config.outputDir, logger);

    const scrapingService = new ScrapingService({
      actorRegistry,
      progressService,
      queueService,
      repository,
      logger,
    });

    // Create Express app
    const app = createApp({
      scrapingService,
      logger,
      tokenManager,
    });

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port}`, {
        port: config.port,
        env: config.nodeEnv,
      });
    });

    // Graceful shutdown
    const shutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Run bootstrap
bootstrap();
