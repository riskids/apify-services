/**
 * Reddit Actor Implementation
 */

import { BaseActor } from '../base/BaseActor';
import { IApiClient } from '../../clients/IApiClient';
import { ILogger } from '../../utils/ILogger';
import { RedditInput, RedditOutput, RedditPost, ApifyRedditPost } from './RedditInput';
import { DateUtils } from '../../utils/DateUtils';
import { FileUtils } from '../../utils/fileUtils';

export class RedditActor extends BaseActor<RedditInput, RedditOutput> {
  private readonly ACTOR_ID = 'macrocosmos/reddit-scraper';
  private subredditFilePath: string;

  constructor(
    apifyClient: IApiClient,
    logger: ILogger,
    subredditFilePath: string = './config/subreddit.txt'
  ) {
    super(apifyClient, logger);
    this.subredditFilePath = subredditFilePath;
  }

  public getPlatform(): string {
    return 'reddit';
  }

  protected getActorId(): string {
    return this.ACTOR_ID;
  }

  protected async validateInput(input: RedditInput): Promise<void> {
    const errors: string[] = [];

    if (!DateUtils.isValidDate(input.dateLimit)) {
      errors.push('Invalid date limit format (use YYYY-MM-DD)');
    }

    if (input.maxItems <= 0) {
      errors.push('Max items must be greater than 0');
    }

    if (input.totalLimit < 0) {
      errors.push('Total limit must be 0 or greater');
    }

    if (!['new', 'hot', 'top'].includes(input.sortBy)) {
      errors.push('Invalid sortBy option (must be new, hot, or top)');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  protected async executeScraping(input: RedditInput): Promise<RedditOutput> {
    const { keywords, dateLimit, maxItems, sortBy, totalLimit } = input;

    // Load subreddits from file
    const subreddits = await this.loadSubreddits();
    
    this.logger.info(`Starting Reddit scraping for ${subreddits.length} subreddits`, {
      keywords: keywords || '(all posts)',
      dateLimit,
      maxItems,
      sortBy,
      totalLimit: totalLimit || 'unlimited',
    });

    const allPosts: RedditPost[] = [];
    let totalCollected = 0;

    // Scrape each subreddit
    for (let i = 0; i < subreddits.length; i++) {
      const subreddit = subreddits[i];

      // Check total limit
      if (totalLimit > 0 && totalCollected >= totalLimit) {
        this.logger.info(`Total limit reached (${totalLimit}), stopping`);
        break;
      }

      this.logger.info(`Scraping r/${subreddit} (${i + 1}/${subreddits.length})`);

      try {
        const posts = await this.scrapeSubreddit(subreddit, input);
        
        // Apply total limit
        const remainingSlots = totalLimit > 0 ? totalLimit - totalCollected : posts.length;
        const postsToAdd = posts.slice(0, remainingSlots);
        
        allPosts.push(...postsToAdd);
        totalCollected += postsToAdd.length;

        this.logger.info(`r/${subreddit}: ${postsToAdd.length} posts collected`, {
          totalPosts: allPosts.length,
        });
      } catch (error) {
        this.logger.error(`Failed to scrape r/${subreddit}`, error as Error);
        // Continue with next subreddit
      }

      // Small delay between subreddits
      if (i < subreddits.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      posts: allPosts,
      metadata: {
        keywords,
        subreddits,
        dateLimit,
        maxItems,
        totalLimit,
        sortBy,
        scrapedAt: new Date().toISOString(),
      },
    };
  }

  protected transformData(rawData: any): RedditOutput {
    // Data is already transformed in executeScraping
    return rawData;
  }

  private async loadSubreddits(): Promise<string[]> {
    try {
      return await FileUtils.readLines(this.subredditFilePath);
    } catch (error) {
      throw new Error(`Failed to load subreddits from ${this.subredditFilePath}`);
    }
  }

  private async scrapeSubreddit(subreddit: string, input: RedditInput): Promise<RedditPost[]> {
    const { keywords, dateLimit, maxItems, sortBy } = input;

    const apifyInput = {
      subreddits: [subreddit],
      sort: sortBy,
      limit: Math.min(maxItems * 2, 100), // Fetch more to account for filtering
      keyword: keywords.trim() || undefined,
    };

    const run = await this.apifyClient.call(this.ACTOR_ID, apifyInput);
    const { items } = await this.apifyClient.listItems(run.defaultDatasetId);

    // Filter posts only (not comments)
    let posts = (items as ApifyRedditPost[]).filter(item => item.dataType === 'post');

    // Filter by date limit
    posts = posts.filter(post => this.isWithinDateLimit(post, dateLimit));

    // Limit to maxItems
    posts = posts.slice(0, maxItems);

    // Convert to internal format
    return posts.map(post => this.convertToInternalFormat(post));
  }

  private isWithinDateLimit(post: ApifyRedditPost, dateLimit: string): boolean {
    const postDate = new Date(post.createdAt);
    const limitDate = new Date(dateLimit);
    limitDate.setHours(0, 0, 0, 0);
    return postDate >= limitDate;
  }

  private convertToInternalFormat(post: ApifyRedditPost): RedditPost {
    return {
      entityType: post.dataType,
      entityId: post.id,
      redditId: post.id,
      permalink: post.url,
      headline: post.title || '',
      textBody: post.body || '',
      mediaBundle: post.media && post.media.length > 0 ? {
        primaryUrl: post.media[0],
        thumbnailUrl: post.media[0],
        isVideo: post.media[0]?.includes('v.redd.it') || false,
      } : undefined,
      authorHandle: post.username,
      communityTag: post.communityName,
      voteScore: post.score,
      commentTotal: post.num_comments || 0,
      createdAt: post.createdAt,
      collectedAt: new Date().toISOString(),
    };
  }
}
