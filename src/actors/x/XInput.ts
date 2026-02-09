/**
 * X (Twitter) input/output interfaces
 */

export interface XInput {
  keywords: string;
  startDate: string;
  endDate: string;
  maxItems: number;
}

export interface XOutput {
  posts: XPost[];
  metadata: XMetadata;
}

export interface XMetadata {
  keywords: string;
  startDate: string;
  endDate: string;
  totalRanges: number;
  collectedAt: string;
}

export interface XPost {
  id: string;
  text: string;
  url: string;
  createdAt: string;
  author?: {
    userName: string;
    name: string;
  };
  [key: string]: unknown;
}

export interface DateRangeWithItems {
  start: string;
  end: string;
  targetItems: number;
}
