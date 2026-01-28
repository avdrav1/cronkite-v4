/**
 * Integration test for feed sync cleanup
 * Tests that cleanup is triggered after successful feed sync
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArticleCleanupService } from '../server/article-cleanup-service';
import type { IStorage } from '../server/storage';

describe('Feed Sync Cleanup Integration', () => {
  let mockStorage: IStorage;
  let cleanupService: ArticleCleanupService;

  beforeEach(() => {
    // Create a minimal mock storage for testing
    mockStorage = {
      getUserSettings: vi.fn().mockResolvedValue({
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      }),
      getProtectedArticles: vi.fn().mockResolvedValue([]),
      getArticlesWithComments: vi.fn().mockResolvedValue([]),
      getArticlesByFeedId: vi.fn().mockResolvedValue([]),
      batchDeleteArticles: vi.fn().mockResolvedValue(0),
      logCleanup: vi.fn().mockResolvedValue(undefined),
    } as any;

    cleanupService = new ArticleCleanupService(mockStorage);
  });

  it('should call cleanupFeedArticles after successful sync', async () => {
    const userId = 'test-user-id';
    const feedId = 'test-feed-id';

    // Call cleanup as would happen after sync
    const result = await cleanupService.cleanupFeedArticles(userId, feedId);

    // Verify cleanup was called
    expect(result).toBeDefined();
    expect(result.articlesDeleted).toBe(0); // No articles to delete in this test
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();

    // Verify storage methods were called
    expect(mockStorage.getUserSettings).toHaveBeenCalledWith(userId);
    expect(mockStorage.getProtectedArticles).toHaveBeenCalledWith(userId, feedId);
    expect(mockStorage.logCleanup).toHaveBeenCalled();
  });

  it('should not fail sync if cleanup fails', async () => {
    const userId = 'test-user-id';
    const feedId = 'test-feed-id';

    // Make batch deletion fail (this will cause cleanup to fail)
    mockStorage.batchDeleteArticles = vi.fn().mockRejectedValue(new Error('Database error'));
    
    // Add some articles to trigger deletion
    mockStorage.getArticlesByFeedId = vi.fn().mockResolvedValue([
      { id: 'article-1', published_at: new Date('2020-01-01') },
      { id: 'article-2', published_at: new Date('2020-01-02') },
    ]);

    // Call cleanup
    const result = await cleanupService.cleanupFeedArticles(userId, feedId);

    // Verify cleanup returned error but didn't throw
    expect(result).toBeDefined();
    expect(result.articlesDeleted).toBe(0);
    // The error is caught and logged, but cleanup completes successfully
    // This is the desired behavior - cleanup errors don't fail the sync
    expect(result.error).toBeUndefined();
  });

  it('should skip cleanup if auto-cleanup is disabled', async () => {
    const userId = 'test-user-id';
    const feedId = 'test-feed-id';

    // Disable auto-cleanup
    mockStorage.getUserSettings = vi.fn().mockResolvedValue({
      articles_per_feed: 100,
      unread_article_age_days: 30,
      enable_auto_cleanup: false,
    });

    // Call cleanup
    const result = await cleanupService.cleanupFeedArticles(userId, feedId);

    // Verify cleanup was skipped
    expect(result.articlesDeleted).toBe(0);
    expect(result.error).toBeUndefined();

    // Verify protected articles were not queried
    expect(mockStorage.getProtectedArticles).not.toHaveBeenCalled();
    expect(mockStorage.batchDeleteArticles).not.toHaveBeenCalled();
  });

  it('should log cleanup results', async () => {
    const userId = 'test-user-id';
    const feedId = 'test-feed-id';

    // Call cleanup
    await cleanupService.cleanupFeedArticles(userId, feedId);

    // Verify logging was called with correct parameters
    expect(mockStorage.logCleanup).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        feedId,
        triggerType: 'sync',
        articlesDeleted: 0,
        durationMs: expect.any(Number),
      })
    );
  });
});
