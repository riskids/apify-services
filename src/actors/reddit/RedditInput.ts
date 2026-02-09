/**
 * Reddit input/output interfaces
 */

export interface RedditInput {
  keywords: string;
  dateLimit: string;
  maxItems: number;
  totalLimit: number;
  sortBy: 'new' | 'hot' | 'top';
}

export interface RedditOutput {
  posts: RedditPost[];
  metadata: RedditMetadata;
}

export interface RedditMetadata {
  keywords: string;
  subreddits: string[];
  dateLimit: string;
  maxItems: number;
  totalLimit: number;
  sortBy: string;
  scrapedAt: string;
}

export interface RedditPost {
  entityType: string;
  entityId: string;
  redditId: string;
  permalink: string;
  headline: string;
  textBody?: string;
  mediaBundle?: MediaBundle;
  authorHandle: string;
  communityTag: string;
  voteScore: number;
  commentTotal: number;
  createdAt: string;
  collectedAt: string;
}

export interface MediaBundle {
  primaryUrl?: string;
  thumbnailUrl?: string;
  isVideo?: boolean;
}

export interface ApifyRedditPost {
  url: string;
  id: string;
  title: string;
  body: string;
  username: string;
  communityName: string;
  dataType: 'post' | 'comment';
  parentId: string | null;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  createdAt: string;
  isNsfw: boolean;
  media: string[];
}
