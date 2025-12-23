/**
 * Feed Scheduler Tests
 * 
 * Tests for the feed scheduler service including priority-based scheduling,
 * default priority assignment, and sync-to-embedding pipeline.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSyncIntervalHours,
  calculateNextSyncAt,
  isValidPriority,
  isBreakingNewsSource,
  getDefaultPriority,
  isFeedDueForSync,
  FeedSchedulerManager,
  SyncPipelineManager,
  determineNewFeedPriority,
  type FeedSchedulerStorage,
} from '../server/feed-scheduler';
import type { Feed, FeedPriority, RecommendedFeed } from '../shared/schema';

// Extended mock storage interface with test helper methods
interface MockFeedSchedulerStorage extends FeedSchedulerStorage {
  _addFeed: (feed: Feed) => void;
  _addRecommendedFeed: (feed: RecommendedFeed) => void;
  _setNewArticles: (feedId: string, articleIds: string[]) => void;
  _getEmbeddingQueue: () => string[];
}

// Mock storage implementation for testing
function createMockStorage(): MockFeedSchedulerStorage {
  const feeds = new Map<string, Feed>();
  const recommendedFeeds = new Map<string, RecommendedFeed>();
  const embeddingQueue: string[] = [];
  const newArticles = new Map<string, string[]>();

  return {
    getFeedById: vi.fn(async (feedId: string) => feeds.get(feedId)),
    getUserFeeds: vi.fn(async () => Array.from(feeds.values())),
    getAllActiveFeeds: vi.fn(async () => Array.from(feeds.values()).filter(f => f.status === 'active')),
    getFeedsDueForSync: vi.fn(async (limit = 50) => {
      const now = new Date();
      return Array.from(feeds.values())
        .filter(f => f.status === 'active' && (!f.next_sync_at || new Date(f.next_sync_at) <= now))
        .slice(0, limit);
    }),
    updateFeedPriority: vi.fn(async (feedId: string, priority: FeedPriority) => {
      const feed = feeds.get(feedId);
      if (!feed) throw new Error('Feed not found');
      const updated = { ...feed, sync_priority: priority };
      feeds.set(feedId, updated);
      return updated;
    }),
    updateFeedSchedule: vi.fn(async (feedId: string, updates) => {
      const feed = feeds.get(feedId);
      if (!feed) throw new Error('Feed not found');
      const updated = { ...feed, ...updates };
      feeds.set(feedId, updated);
      return updated;
    }),
    getRecommendedFeedByUrl: vi.fn(async (url: string) => {
      return Array.from(recommendedFeeds.values()).find(f => f.url === url);
    }),
    addToEmbeddingQueue: vi.fn(async (articleIds: string[]) => {
      embeddingQueue.push(...articleIds);
    }),
    getNewArticleIds: vi.fn(async (feedId: string, _since: Date) => {
      return newArticles.get(feedId) || [];
    }),
    // Helper methods for test setup
    _addFeed: (feed: Feed) => feeds.set(feed.id, feed),
    _addRecommendedFeed: (feed: RecommendedFeed) => recommendedFeeds.set(feed.id, feed),
    _setNewArticles: (feedId: string, articleIds: string[]) => newArticles.set(feedId, articleIds),
    _getEmbeddingQueue: () => [...embeddingQueue],
  };
}

// Helper to create a mock feed
function createMockFeed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 'feed-1',
    user_id: 'user-1',
    name: 'Test Feed',
    url: 'https://example.com/feed.xml',
    site_url: 'https://example.com',
    description: 'Test feed description',
    icon_url: null,
    icon_color: null,
    folder_id: null,
    folder_name: null,
    status: 'active',
    priority: 'medium',
    sync_priority: 'medium',
    next_sync_at: null,
    sync_interval_hours: 24,
    custom_polling_interval: null,
    last_fetched_at: null,
    etag: null,
    last_modified: null,
    article_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('Feed Scheduler - Priority Intervals', () => {
  it('should return 1 hour for high priority', () => {
    expect(getSyncIntervalHours('high')).toBe(1);
  });

  it('should return 24 hours for medium priority', () => {
    expect(getSyncIntervalHours('medium')).toBe(24);
  });

  it('should return 168 hours (7 days) for low priority', () => {
    expect(getSyncIntervalHours('low')).toBe(168);
  });
});

describe('Feed Scheduler - Calculate Next Sync', () => {
  it('should calculate next sync based on priority interval', () => {
    const baseTime = new Date('2024-01-01T00:00:00Z');
    
    const highNext = calculateNextSyncAt('high', baseTime);
    expect(highNext.getTime()).toBe(baseTime.getTime() + 1 * 60 * 60 * 1000);
    
    const mediumNext = calculateNextSyncAt('medium', baseTime);
    expect(mediumNext.getTime()).toBe(baseTime.getTime() + 24 * 60 * 60 * 1000);
    
    const lowNext = calculateNextSyncAt('low', baseTime);
    expect(lowNext.getTime()).toBe(baseTime.getTime() + 168 * 60 * 60 * 1000);
  });

  it('should use current time if no base time provided', () => {
    const before = Date.now();
    const next = calculateNextSyncAt('medium', null);
    const after = Date.now();
    
    // Should be approximately 24 hours from now
    expect(next.getTime()).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000);
    expect(next.getTime()).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000);
  });
});

describe('Feed Scheduler - Priority Validation', () => {
  it('should validate correct priority values', () => {
    expect(isValidPriority('high')).toBe(true);
    expect(isValidPriority('medium')).toBe(true);
    expect(isValidPriority('low')).toBe(true);
  });

  it('should reject invalid priority values', () => {
    expect(isValidPriority('invalid')).toBe(false);
    expect(isValidPriority('')).toBe(false);
    expect(isValidPriority('HIGH')).toBe(false);
  });
});

describe('Feed Scheduler - Breaking News Detection', () => {
  it('should detect known breaking news sources', () => {
    expect(isBreakingNewsSource('https://www.nytimes.com/feed.xml')).toBe(true);
    expect(isBreakingNewsSource('https://feeds.bbc.com/news')).toBe(true);
    expect(isBreakingNewsSource('https://rss.cnn.com/rss/edition.rss')).toBe(true);
    expect(isBreakingNewsSource('https://feeds.reuters.com/news')).toBe(true);
    expect(isBreakingNewsSource('https://apnews.com/feed')).toBe(true);
  });

  it('should not detect non-breaking news sources', () => {
    expect(isBreakingNewsSource('https://example.com/feed.xml')).toBe(false);
    expect(isBreakingNewsSource('https://myblog.com/rss')).toBe(false);
  });
});

describe('Feed Scheduler - Default Priority', () => {
  it('should return high priority for breaking news sources', () => {
    expect(getDefaultPriority('https://www.nytimes.com/feed.xml')).toBe('high');
    expect(getDefaultPriority('https://feeds.bbc.com/news')).toBe('high');
  });

  it('should return medium priority for regular sources', () => {
    expect(getDefaultPriority('https://example.com/feed.xml')).toBe('medium');
    expect(getDefaultPriority('https://myblog.com/rss')).toBe('medium');
  });
});

describe('Feed Scheduler - Feed Due For Sync', () => {
  it('should return true if next_sync_at is null', () => {
    const feed = createMockFeed({ next_sync_at: null });
    expect(isFeedDueForSync(feed)).toBe(true);
  });

  it('should return true if next_sync_at is in the past', () => {
    const pastDate = new Date(Date.now() - 1000);
    const feed = createMockFeed({ next_sync_at: pastDate });
    expect(isFeedDueForSync(feed)).toBe(true);
  });

  it('should return false if next_sync_at is in the future', () => {
    const futureDate = new Date(Date.now() + 60000);
    const feed = createMockFeed({ next_sync_at: futureDate });
    expect(isFeedDueForSync(feed)).toBe(false);
  });
});

describe('FeedSchedulerManager', () => {
  let storage: MockFeedSchedulerStorage;
  let scheduler: FeedSchedulerManager;

  beforeEach(() => {
    storage = createMockStorage();
    scheduler = new FeedSchedulerManager(storage);
  });

  it('should get feeds due for sync', async () => {
    const feed1 = createMockFeed({ id: 'feed-1', next_sync_at: null });
    const feed2 = createMockFeed({ 
      id: 'feed-2', 
      next_sync_at: new Date(Date.now() - 1000) 
    });
    const feed3 = createMockFeed({ 
      id: 'feed-3', 
      next_sync_at: new Date(Date.now() + 60000) 
    });
    
    storage._addFeed(feed1);
    storage._addFeed(feed2);
    storage._addFeed(feed3);

    const dueFeeds = await scheduler.getFeedsDueForSync();
    
    expect(dueFeeds.length).toBe(2);
    expect(dueFeeds.map(f => f.id)).toContain('feed-1');
    expect(dueFeeds.map(f => f.id)).toContain('feed-2');
  });

  it('should schedule next sync after successful sync', async () => {
    const feed = createMockFeed({ id: 'feed-1', sync_priority: 'high' });
    storage._addFeed(feed);

    const lastSyncAt = new Date();
    const nextSyncAt = await scheduler.scheduleNextSync('feed-1', lastSyncAt);

    expect(nextSyncAt.getTime()).toBe(lastSyncAt.getTime() + 1 * 60 * 60 * 1000);
    expect(storage.updateFeedSchedule).toHaveBeenCalledWith('feed-1', expect.objectContaining({
      next_sync_at: nextSyncAt,
      sync_interval_hours: 1,
      last_fetched_at: lastSyncAt,
    }));
  });

  it('should update feed priority and recalculate schedule', async () => {
    const feed = createMockFeed({ 
      id: 'feed-1', 
      sync_priority: 'medium',
      last_fetched_at: new Date(),
    });
    storage._addFeed(feed);

    await scheduler.updateFeedPriority('feed-1', 'high');

    expect(storage.updateFeedSchedule).toHaveBeenCalledWith('feed-1', expect.objectContaining({
      sync_priority: 'high',
      sync_interval_hours: 1,
    }));
  });

  it('should reject invalid priority values', async () => {
    const feed = createMockFeed({ id: 'feed-1' });
    storage._addFeed(feed);

    await expect(scheduler.updateFeedPriority('feed-1', 'invalid' as FeedPriority))
      .rejects.toThrow('Invalid priority value');
  });
});

describe('SyncPipelineManager', () => {
  let storage: MockFeedSchedulerStorage;
  let pipeline: SyncPipelineManager;

  beforeEach(() => {
    storage = createMockStorage();
    pipeline = new SyncPipelineManager(storage);
  });

  it('should queue new articles for embedding after sync', async () => {
    const feed = createMockFeed({ id: 'feed-1' });
    storage._addFeed(feed);
    storage._setNewArticles('feed-1', ['article-1', 'article-2', 'article-3']);

    const syncStartTime = new Date();
    const result = await pipeline.onFeedSyncComplete('feed-1', syncStartTime, 3);

    expect(result.embeddingsQueued).toBe(3);
    expect(storage.addToEmbeddingQueue).toHaveBeenCalledWith(
      ['article-1', 'article-2', 'article-3'],
      0
    );
  });

  it('should not queue embeddings if no new articles', async () => {
    const feed = createMockFeed({ id: 'feed-1' });
    storage._addFeed(feed);

    const result = await pipeline.onFeedSyncComplete('feed-1', new Date(), 0);

    expect(result.embeddingsQueued).toBe(0);
    expect(storage.addToEmbeddingQueue).not.toHaveBeenCalled();
  });

  it('should trigger clustering after embedding batch completes', async () => {
    const feed = createMockFeed({ id: 'feed-1' });
    storage._addFeed(feed);
    storage._setNewArticles('feed-1', ['article-1']);

    // First, complete a sync to schedule clustering
    await pipeline.onFeedSyncComplete('feed-1', new Date(), 1);

    // Then complete embedding batch
    const result = await pipeline.onEmbeddingBatchComplete(['article-1']);

    expect(result.clusteringTriggered).toBe(true);
  });

  it('should trigger manual sync for specified feeds', async () => {
    const feed1 = createMockFeed({ id: 'feed-1' });
    const feed2 = createMockFeed({ id: 'feed-2' });
    storage._addFeed(feed1);
    storage._addFeed(feed2);

    const result = await pipeline.triggerManualSync(['feed-1', 'feed-2']);

    expect(result.feedsTriggered).toBe(2);
    expect(result.clusteringScheduled).toBe(true);
    expect(storage.updateFeedSchedule).toHaveBeenCalledTimes(2);
  });
});

describe('determineNewFeedPriority', () => {
  let storage: MockFeedSchedulerStorage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('should inherit priority from recommended feed', async () => {
    const recommendedFeed = {
      id: 'rec-1',
      name: 'Test Recommended',
      url: 'https://example.com/feed.xml',
      default_priority: 'high',
    } as RecommendedFeed;
    storage._addRecommendedFeed(recommendedFeed);

    const priority = await determineNewFeedPriority('https://example.com/feed.xml', storage);

    expect(priority).toBe('high');
  });

  it('should detect breaking news source if not in recommended feeds', async () => {
    const priority = await determineNewFeedPriority('https://www.nytimes.com/feed.xml', storage);

    expect(priority).toBe('high');
  });

  it('should default to medium for regular feeds', async () => {
    const priority = await determineNewFeedPriority('https://myblog.com/feed.xml', storage);

    expect(priority).toBe('medium');
  });
});
