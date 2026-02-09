/**
 * X (Twitter) Actor Implementation
 */

import { BaseActor } from '../base/BaseActor';
import { IApiClient } from '../../clients/IApiClient';
import { ILogger } from '../../utils/ILogger';
import { XInput, XOutput, XPost, DateRangeWithItems } from './XInput';
import { DateUtils } from '../../utils/DateUtils';

export class XActor extends BaseActor<XInput, XOutput> {
  private readonly DAYS_PER_RANGE = 3;
  private readonly ACTOR_ID = 'rmyzeijic5nBVm8BG';

  constructor(apifyClient: IApiClient, logger: ILogger) {
    super(apifyClient, logger);
  }

  public getPlatform(): string {
    return 'x';
  }

  protected getActorId(): string {
    return this.ACTOR_ID;
  }

  protected async validateInput(input: XInput): Promise<void> {
    const errors: string[] = [];

    if (!input.keywords || input.keywords.trim().length === 0) {
      errors.push('Keywords are required');
    }

    if (!DateUtils.isValidDate(input.startDate)) {
      errors.push('Invalid start date format (use YYYY-MM-DD)');
    }

    if (!DateUtils.isValidDate(input.endDate)) {
      errors.push('Invalid end date format (use YYYY-MM-DD)');
    }

    if (input.startDate > input.endDate) {
      errors.push('Start date must be before end date');
    }

    if (input.maxItems <= 0) {
      errors.push('Max items must be greater than 0');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  protected async executeScraping(input: XInput): Promise<XOutput> {
    const { keywords, startDate, endDate, maxItems } = input;
    const ranges = this.getDateRanges(startDate, endDate, maxItems);
    const allPosts: XPost[] = [];

    this.logger.info(`Starting X scraping with ${ranges.length} ranges`, {
      totalRanges: ranges.length,
      maxItems,
    });

    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      this.logger.info(`Processing range ${i + 1}/${ranges.length}`, {
        range: `${range.start} → ${range.end}`,
        targetItems: range.targetItems,
      });

      try {
        const posts = await this.scrapeRange(range, keywords);
        allPosts.push(...posts);

        this.logger.info(`Range ${i + 1}/${ranges.length} completed`, {
          collectedPosts: posts.length,
          totalPosts: allPosts.length,
        });
      } catch (error) {
        this.logger.error(`Failed to scrape range ${i + 1}`, error as Error);
        // Continue with next range
      }

      // Small delay between ranges
      if (i < ranges.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return {
      posts: allPosts,
      metadata: {
        keywords,
        startDate,
        endDate,
        totalRanges: ranges.length,
        collectedAt: new Date().toISOString(),
      },
    };
  }

  protected transformData(rawData: any): XOutput {
    // Data is already transformed in executeScraping
    return rawData;
  }

  private getDateRanges(startDate: string, endDate: string, totalMaxItems: number): DateRangeWithItems[] {
    const ranges: DateRangeWithItems[] = [];
    const tempRanges: Array<{ start: string; end: string }> = [];
    
    const start = DateUtils.parseDate(startDate);
    const end = DateUtils.parseDate(endDate);
    let currentStart = new Date(start);

    // Generate date ranges (3 days each)
    while (currentStart <= end) {
      const rangeEnd = new Date(currentStart);
      rangeEnd.setDate(rangeEnd.getDate() + this.DAYS_PER_RANGE - 1);

      if (rangeEnd > end) {
        rangeEnd.setTime(end.getTime());
      }

      tempRanges.push({
        start: DateUtils.formatDate(currentStart),
        end: DateUtils.formatDate(rangeEnd),
      });

      currentStart = new Date(rangeEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }

    // Distribute items across ranges
    const totalRanges = tempRanges.length;
    const baseItemsPerRange = Math.floor(totalMaxItems / totalRanges);
    const remainder = totalMaxItems % totalRanges;

    for (let i = 0; i < tempRanges.length; i++) {
      const targetItems = baseItemsPerRange + (i < remainder ? 1 : 0);
      ranges.push({
        ...tempRanges[i],
        targetItems,
      });
    }

    return ranges;
  }

  private async scrapeRange(
    range: DateRangeWithItems,
    keywords: string
  ): Promise<XPost[]> {
    const nextDayAfterEnd = new Date(range.end);
    nextDayAfterEnd.setDate(nextDayAfterEnd.getDate() + 1);
    const untilDate = DateUtils.formatDate(nextDayAfterEnd);

    const input = {
      searchTerms: [`${keywords} since:${range.start} until:${untilDate}`],
      sortBy: 'Top',
      maxItems: range.targetItems,
      minRetweets: 0,
      minLikes: 0,
      minReplies: 0,
      onlyVerifiedUsers: false,
      onlyBuleVerifiedUsers: false,
      onlyImage: false,
      onlyVideo: false,
      onlyQuote: false,
      onlyReply: false,
    };

    const run = await this.apifyClient.call(this.getActorId(), input);
    const { items } = await this.apifyClient.listItems(run.defaultDatasetId);
    
    const posts = items as XPost[];
    const validPosts = this.filterInvalidPosts(posts);

    // Trim to target if we got more than needed
    return validPosts.slice(0, range.targetItems);
  }

  private isInvalidPost(post: XPost): boolean {
    const id = post.id as string | number | null | undefined;
    return id === 0 || id === '0' || id === '0000000000000000000' || id === null || id === undefined;
  }

  private filterInvalidPosts(posts: XPost[]): XPost[] {
    return posts.filter(post => !this.isInvalidPost(post));
  }
}
