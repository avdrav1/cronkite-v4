/**
 * Unit tests for Article Cleanup Logging
 * Tests Requirements: 3.3, 8.1, 8.2, 8.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArticleCleanupService } from '../server/article-cleanup-service';
import type { IStorage } from '../server/storage';

describe('Article Cleanup Logging', () => {
  let mockStorage: IStorage;
  let cleanupService: ArticleCleanupService;

  beforeEach(() => {
    // Create a minimal mock storage with just the methods we need
    mockStorage = {
      logCleanup: vi.fn().mockResolvedValue(undefined),
      getUserSettings: vi.fn().mockResolvedValue({
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      }),
      getProtectedArticles: vi.fn().mockResolvedValue([]),
      getArticlesWithComments: vi.fn().mockResolvedValue([]),
      getArticlesByFeedId: vi.fn().mockResolvedValue([]),
      batchDeleteArticles: vi.fn().mockResolvedValue(0),
    } as unknown as IStorage;

    cleanupService = new ArticleCleanupService(mockStorage);
  });

  describe('logCleanup', () => {
    it('should call storage.logCleanup with correct parameters', async () => {
      // Access the private method through reflection for testing
      const logCleanup = (cleanupService as any).logCleanup.bind(cleanupService);

      const logData = {
        userId: 'user-123',
        feedId: 'feed-456',
        triggerType: 'sync',
        articlesDeleted: 10,
        durationMs: 1500,
      };

      await logCleanup(logData);

      expect(mockStorage.logCleanup).toHaveBeenCalledWith({
        userId: 'user-123',
        feedId: 'feed-456',
        triggerType: 'sync',
        articlesDeleted: 10,
        durationMs: 1500,
        errorMessage: undefined,
      });
    });

    it('should include error message when provided', async () => {
      const logCleanup = (cleanupService as any).logCleanup.bind(cleanupService);

      const logData = {
        userId: 'user-123',
        feedId: 'feed-456',
        triggerType: 'sync',
        articlesDeleted: 0,
        durationMs: 500,
        error: 'Database connection failed',
      };

      await logCleanup(logData);

      expect(mockStorage.logCleanup).toHaveBeenCalledWith({
        userId: 'user-123',
        feedId: 'feed-456',
        triggerType: 'sync',
        articlesDeleted: 0,
        durationMs: 500,
        errorMessage: 'Database connection failed',
      });
    });

    it('should handle logging errors gracefully without throwing', async () => {
      // Make logCleanup throw an error
      mockStorage.logCleanup = vi.fn().mockRejectedValue(new Error('Database error'));

      const logCleanup = (cleanupService as any).logCleanup.bind(cleanupService);

      const logData = {
        userId: 'user-123',
        feedId: 'feed-456',
        triggerType: 'sync',
        articlesDeleted: 5,
        durationMs: 1000,
      };

      // Should not throw - logging errors should be caught
      await expect(logCleanup(logData)).resolves.toBeUndefined();
    });

    it('should log without feedId for user-wide cleanup', async () => {
      const logCleanup = (cleanupService as any).logCleanup.bind(cleanupService);

      const logData = {
        userId: 'user-123',
        triggerType: 'scheduled',
        articlesDeleted: 50,
        durationMs: 5000,
      };

      await logCleanup(logData);

      expect(mockStorage.logCleanup).toHaveBeenCalledWith({
        userId: 'user-123',
        feedId: undefined,
        triggerType: 'scheduled',
        articlesDeleted: 50,
        durationMs: 5000,
        errorMessage: undefined,
      });
    });

    it('should log all required fields', async () => {
      const logCleanup = (cleanupService as any).logCleanup.bind(cleanupService);

      const logData = {
        userId: 'user-789',
        feedId: 'feed-abc',
        triggerType: 'manual',
        articlesDeleted: 25,
        durationMs: 2500,
        error: 'Partial failure',
      };

      await logCleanup(logData);

      const call = (mockStorage.logCleanup as any).mock.calls[0][0];
      
      // Verify all required fields are present
      expect(call).toHaveProperty('userId', 'user-789');
      expect(call).toHaveProperty('feedId', 'feed-abc');
      expect(call).toHaveProperty('triggerType', 'manual');
      expect(call).toHaveProperty('articlesDeleted', 25);
      expect(call).toHaveProperty('durationMs', 2500);
      expect(call).toHaveProperty('errorMessage', 'Partial failure');
    });
  });
});
