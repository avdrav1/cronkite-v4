import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ArticleCleanupService } from '../server/article-cleanup-service';
import type { IStorage } from '../server/storage';
import type { UserSettings } from '@shared/schema';

describe('ArticleCleanupService', () => {
  let cleanupService: ArticleCleanupService;
  let mockStorage: IStorage;

  beforeEach(() => {
    // Create a mock storage implementation
    mockStorage = {
      getUserSettings: vi.fn(),
      getProtectedArticles: vi.fn(),
      getArticlesWithComments: vi.fn(),
    } as unknown as IStorage;

    cleanupService = new ArticleCleanupService(mockStorage);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getCleanupSettings', () => {
    it('should return user settings when available', async () => {
      const mockSettings: Partial<UserSettings> = {
        articles_per_feed: 150,
        unread_article_age_days: 45,
        enable_auto_cleanup: true,
      };

      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings as UserSettings);

      const result = await cleanupService.getCleanupSettings('user-1');

      expect(result).toEqual({
        articlesPerFeed: 150,
        unreadAgeDays: 45,
        enableAutoCleanup: true,
      });
    });

    it('should return defaults when user settings are not available', async () => {
      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(undefined);

      const result = await cleanupService.getCleanupSettings('user-1');

      expect(result).toEqual({
        articlesPerFeed: 100, // default
        unreadAgeDays: 30, // default
        enableAutoCleanup: true,
      });
    });

    it('should return defaults when getUserSettings throws error', async () => {
      vi.mocked(mockStorage.getUserSettings).mockRejectedValue(new Error('Database error'));

      const result = await cleanupService.getCleanupSettings('user-1');

      expect(result).toEqual({
        articlesPerFeed: 100,
        unreadAgeDays: 30,
        enableAutoCleanup: true,
      });
    });
  });

  describe('getProtectedArticleIds', () => {
    it('should return protected article IDs from starred and read articles', async () => {
      const starredAndReadIds = ['article-1', 'article-2', 'article-3'];
      const commentedIds = ['article-4', 'article-5'];

      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue(starredAndReadIds);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue(commentedIds);

      const result = await cleanupService.getProtectedArticleIds({
        userId: 'user-1',
      });

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(5);
      expect(result.has('article-1')).toBe(true);
      expect(result.has('article-2')).toBe(true);
      expect(result.has('article-3')).toBe(true);
      expect(result.has('article-4')).toBe(true);
      expect(result.has('article-5')).toBe(true);
    });

    it('should handle overlapping article IDs (article is both starred and commented)', async () => {
      const starredAndReadIds = ['article-1', 'article-2'];
      const commentedIds = ['article-2', 'article-3']; // article-2 appears in both

      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue(starredAndReadIds);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue(commentedIds);

      const result = await cleanupService.getProtectedArticleIds({
        userId: 'user-1',
      });

      expect(result.size).toBe(3); // Should deduplicate article-2
      expect(result.has('article-1')).toBe(true);
      expect(result.has('article-2')).toBe(true);
      expect(result.has('article-3')).toBe(true);
    });

    it('should pass feedId to storage methods when provided', async () => {
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);

      await cleanupService.getProtectedArticleIds({
        userId: 'user-1',
        feedId: 'feed-1',
      });

      expect(mockStorage.getProtectedArticles).toHaveBeenCalledWith('user-1', 'feed-1');
      expect(mockStorage.getArticlesWithComments).toHaveBeenCalledWith('feed-1');
    });

    it('should return empty set when storage methods throw errors', async () => {
      vi.mocked(mockStorage.getProtectedArticles).mockRejectedValue(new Error('Database error'));
      vi.mocked(mockStorage.getArticlesWithComments).mockRejectedValue(new Error('Database error'));

      const result = await cleanupService.getProtectedArticleIds({
        userId: 'user-1',
      });

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should return empty set when no protected articles exist', async () => {
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);

      const result = await cleanupService.getProtectedArticleIds({
        userId: 'user-1',
      });

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('getArticlesExceedingFeedLimit', () => {
    beforeEach(() => {
      // Add getArticlesByFeedId to mock storage
      mockStorage.getArticlesByFeedId = vi.fn();
    });

    it('should return empty array when article count is within limit', async () => {
      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: new Date('2024-01-03') },
        { id: 'article-2', feed_id: 'feed-1', published_at: new Date('2024-01-02') },
        { id: 'article-3', feed_id: 'feed-1', published_at: new Date('2024-01-01') },
      ];

      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);

      // Access private method for testing
      const result = await (cleanupService as any).getArticlesExceedingFeedLimit(
        'user-1',
        'feed-1',
        5, // limit is 5, we only have 3 articles
        new Set() // no protected articles
      );

      expect(result).toEqual([]);
    });

    it('should return article IDs beyond the limit, keeping most recent', async () => {
      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: new Date('2024-01-05') },
        { id: 'article-2', feed_id: 'feed-1', published_at: new Date('2024-01-04') },
        { id: 'article-3', feed_id: 'feed-1', published_at: new Date('2024-01-03') },
        { id: 'article-4', feed_id: 'feed-1', published_at: new Date('2024-01-02') },
        { id: 'article-5', feed_id: 'feed-1', published_at: new Date('2024-01-01') },
      ];

      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);

      const result = await (cleanupService as any).getArticlesExceedingFeedLimit(
        'user-1',
        'feed-1',
        3, // limit is 3
        new Set() // no protected articles
      );

      // Should delete the 2 oldest articles (article-4 and article-5)
      expect(result).toEqual(['article-4', 'article-5']);
    });

    it('should exclude protected articles from count and deletion', async () => {
      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: new Date('2024-01-05') },
        { id: 'article-2', feed_id: 'feed-1', published_at: new Date('2024-01-04') }, // protected
        { id: 'article-3', feed_id: 'feed-1', published_at: new Date('2024-01-03') },
        { id: 'article-4', feed_id: 'feed-1', published_at: new Date('2024-01-02') },
        { id: 'article-5', feed_id: 'feed-1', published_at: new Date('2024-01-01') },
      ];

      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);

      const protectedIds = new Set(['article-2']);

      const result = await (cleanupService as any).getArticlesExceedingFeedLimit(
        'user-1',
        'feed-1',
        3, // limit is 3 unprotected articles
        protectedIds
      );

      // Should keep article-1, article-3, article-4 (3 most recent unprotected)
      // Should delete article-5 (oldest unprotected)
      // article-2 is protected and not counted
      expect(result).toEqual(['article-5']);
    });

    it('should handle all articles being protected', async () => {
      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: new Date('2024-01-03') },
        { id: 'article-2', feed_id: 'feed-1', published_at: new Date('2024-01-02') },
        { id: 'article-3', feed_id: 'feed-1', published_at: new Date('2024-01-01') },
      ];

      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);

      const protectedIds = new Set(['article-1', 'article-2', 'article-3']);

      const result = await (cleanupService as any).getArticlesExceedingFeedLimit(
        'user-1',
        'feed-1',
        1, // limit is 1, but all are protected
        protectedIds
      );

      // Should not delete any protected articles
      expect(result).toEqual([]);
    });

    it('should return empty array when getArticlesByFeedId throws error', async () => {
      vi.mocked(mockStorage.getArticlesByFeedId).mockRejectedValue(new Error('Database error'));

      const result = await (cleanupService as any).getArticlesExceedingFeedLimit(
        'user-1',
        'feed-1',
        3,
        new Set()
      );

      expect(result).toEqual([]);
    });

    it('should handle empty feed (no articles)', async () => {
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue([]);

      const result = await (cleanupService as any).getArticlesExceedingFeedLimit(
        'user-1',
        'feed-1',
        3,
        new Set()
      );

      expect(result).toEqual([]);
    });

    it('should handle exactly at limit boundary', async () => {
      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: new Date('2024-01-03') },
        { id: 'article-2', feed_id: 'feed-1', published_at: new Date('2024-01-02') },
        { id: 'article-3', feed_id: 'feed-1', published_at: new Date('2024-01-01') },
      ];

      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);

      const result = await (cleanupService as any).getArticlesExceedingFeedLimit(
        'user-1',
        'feed-1',
        3, // exactly at limit
        new Set()
      );

      expect(result).toEqual([]);
    });
  });

  describe('getArticlesExceedingAgeThreshold', () => {
    beforeEach(() => {
      // Add getArticlesByFeedId to mock storage
      mockStorage.getArticlesByFeedId = vi.fn();
    });

    it('should return empty array when all articles are within age threshold', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: recentDate, created_at: recentDate },
        { id: 'article-2', feed_id: 'feed-1', published_at: recentDate, created_at: recentDate },
        { id: 'article-3', feed_id: 'feed-1', published_at: recentDate, created_at: recentDate },
      ];

      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);

      // Access private method for testing
      const result = await (cleanupService as any).getArticlesExceedingAgeThreshold(
        'user-1',
        'feed-1',
        30, // 30 days threshold
        new Set()
      );

      expect(result).toEqual([]);
    });

    it('should return article IDs older than age threshold', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
        { id: 'article-2', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
        { id: 'article-3', feed_id: 'feed-1', published_at: recentDate, created_at: recentDate },
      ];

      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);

      const result = await (cleanupService as any).getArticlesExceedingAgeThreshold(
        'user-1',
        'feed-1',
        30, // 30 days threshold
        new Set()
      );

      expect(result).toHaveLength(2);
      expect(result).toContain('article-1');
      expect(result).toContain('article-2');
      expect(result).not.toContain('article-3');
    });

    it('should exclude protected articles from deletion', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
        { id: 'article-2', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
        { id: 'article-3', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
      ];

      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);

      const protectedIds = new Set(['article-2']); // article-2 is protected

      const result = await (cleanupService as any).getArticlesExceedingAgeThreshold(
        'user-1',
        'feed-1',
        30,
        protectedIds
      );

      expect(result).toHaveLength(2);
      expect(result).toContain('article-1');
      expect(result).not.toContain('article-2'); // Protected article excluded
      expect(result).toContain('article-3');
    });

    it('should handle articles without published_at using created_at', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: null, created_at: oldDate },
        { id: 'article-2', feed_id: 'feed-1', published_at: null, created_at: oldDate },
      ];

      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);

      const result = await (cleanupService as any).getArticlesExceedingAgeThreshold(
        'user-1',
        'feed-1',
        30,
        new Set()
      );

      expect(result).toHaveLength(2);
      expect(result).toContain('article-1');
      expect(result).toContain('article-2');
    });

    it('should return empty array when all articles are protected', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
        { id: 'article-2', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
      ];

      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);

      const protectedIds = new Set(['article-1', 'article-2']); // All protected

      const result = await (cleanupService as any).getArticlesExceedingAgeThreshold(
        'user-1',
        'feed-1',
        30,
        protectedIds
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when getArticlesByFeedId throws error', async () => {
      vi.mocked(mockStorage.getArticlesByFeedId).mockRejectedValue(new Error('Database error'));

      const result = await (cleanupService as any).getArticlesExceedingAgeThreshold(
        'user-1',
        'feed-1',
        30,
        new Set()
      );

      expect(result).toEqual([]);
    });

    it('should handle empty feed (no articles)', async () => {
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue([]);

      const result = await (cleanupService as any).getArticlesExceedingAgeThreshold(
        'user-1',
        'feed-1',
        30,
        new Set()
      );

      expect(result).toEqual([]);
    });

    it('should handle exactly at age threshold boundary', async () => {
      const now = new Date();
      const exactlyAtThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Exactly 30 days ago
      const justOverThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000 - 1000); // Just over 30 days

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: exactlyAtThreshold, created_at: exactlyAtThreshold },
        { id: 'article-2', feed_id: 'feed-1', published_at: justOverThreshold, created_at: justOverThreshold },
      ];

      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);

      const result = await (cleanupService as any).getArticlesExceedingAgeThreshold(
        'user-1',
        'feed-1',
        30,
        new Set()
      );

      // Only article-2 (just over threshold) should be deleted
      // article-1 (exactly at threshold) is not deleted (uses < comparison)
      expect(result).toHaveLength(1);
      expect(result).toContain('article-2');
    });
  });

  describe('cleanupFeedArticles', () => {
    beforeEach(() => {
      // Add all required methods to mock storage
      mockStorage.getArticlesByFeedId = vi.fn();
      mockStorage.batchDeleteArticles = vi.fn();
      mockStorage.logCleanup = vi.fn();
    });

    it('should skip cleanup when auto-cleanup is disabled', async () => {
      const mockSettings: Partial<UserSettings> = {
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: false, // Disabled
      };

      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings as UserSettings);
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupFeedArticles('user-1', 'feed-1');

      expect(result.articlesDeleted).toBe(0);
      expect(result.error).toBeUndefined();
      expect(mockStorage.batchDeleteArticles).not.toHaveBeenCalled();
      expect(mockStorage.logCleanup).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          feedId: 'feed-1',
          articlesDeleted: 0,
        })
      );
    });

    it('should successfully cleanup articles using both strategies', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago

      const mockSettings: Partial<UserSettings> = {
        articles_per_feed: 3,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      };

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: new Date('2024-01-05'), created_at: new Date('2024-01-05') },
        { id: 'article-2', feed_id: 'feed-1', published_at: new Date('2024-01-04'), created_at: new Date('2024-01-04') },
        { id: 'article-3', feed_id: 'feed-1', published_at: new Date('2024-01-03'), created_at: new Date('2024-01-03') },
        { id: 'article-4', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate }, // Old article
        { id: 'article-5', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate }, // Old article
      ];

      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings as UserSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(2);
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupFeedArticles('user-1', 'feed-1');

      expect(result.articlesDeleted).toBe(2);
      expect(result.error).toBeUndefined();
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledWith(
        expect.arrayContaining(['article-4', 'article-5'])
      );
      expect(mockStorage.logCleanup).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          feedId: 'feed-1',
          articlesDeleted: 2,
          triggerType: 'sync',
        })
      );
    });

    it('should protect starred and read articles from deletion', async () => {
      const now = new Date();
      const recentDate1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const recentDate2 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); // 6 days ago
      const recentDate3 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const recentDate4 = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000); // 8 days ago

      const mockSettings: Partial<UserSettings> = {
        articles_per_feed: 2,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      };

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: recentDate1, created_at: recentDate1 },
        { id: 'article-2', feed_id: 'feed-1', published_at: recentDate2, created_at: recentDate2 }, // Protected
        { id: 'article-3', feed_id: 'feed-1', published_at: recentDate3, created_at: recentDate3 },
        { id: 'article-4', feed_id: 'feed-1', published_at: recentDate4, created_at: recentDate4 },
      ];

      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings as UserSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue(['article-2']); // article-2 is protected
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(1);
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupFeedArticles('user-1', 'feed-1');

      expect(result.articlesDeleted).toBe(1);
      expect(result.error).toBeUndefined();
      // Should delete article-4 (oldest unprotected), keep article-1, article-3 (most recent unprotected)
      // article-2 is protected and not counted
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledWith(['article-4']);
    });

    it('should handle cleanup errors gracefully and continue', async () => {
      const mockSettings: Partial<UserSettings> = {
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      };

      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings as UserSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockRejectedValue(new Error('Database error'));
      vi.mocked(mockStorage.getArticlesWithComments).mockRejectedValue(new Error('Database error'));
      // When getProtectedArticleIds fails, it returns empty set and continues
      // When getArticlesByFeedId fails, the strategy methods return empty arrays
      mockStorage.getArticlesByFeedId = vi.fn().mockRejectedValue(new Error('Database error'));
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupFeedArticles('user-1', 'feed-1');

      // The cleanup completes successfully with 0 deletions because errors are handled gracefully
      expect(result.articlesDeleted).toBe(0);
      expect(result.error).toBeUndefined(); // No error because sub-methods handle their own errors
      expect(mockStorage.logCleanup).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          feedId: 'feed-1',
          articlesDeleted: 0,
        })
      );
    });

    it('should combine both per-feed limit and age-based strategies', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago

      const mockSettings: Partial<UserSettings> = {
        articles_per_feed: 5, // Keep 5 most recent
        unread_article_age_days: 30, // Delete articles older than 30 days
        enable_auto_cleanup: true,
      };

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: new Date('2024-01-10'), created_at: new Date('2024-01-10') },
        { id: 'article-2', feed_id: 'feed-1', published_at: new Date('2024-01-09'), created_at: new Date('2024-01-09') },
        { id: 'article-3', feed_id: 'feed-1', published_at: new Date('2024-01-08'), created_at: new Date('2024-01-08') },
        { id: 'article-4', feed_id: 'feed-1', published_at: new Date('2024-01-07'), created_at: new Date('2024-01-07') },
        { id: 'article-5', feed_id: 'feed-1', published_at: new Date('2024-01-06'), created_at: new Date('2024-01-06') },
        { id: 'article-6', feed_id: 'feed-1', published_at: new Date('2024-01-05'), created_at: new Date('2024-01-05') }, // Exceeds limit
        { id: 'article-7', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate }, // Old article
        { id: 'article-8', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate }, // Old article
      ];

      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings as UserSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(3);
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupFeedArticles('user-1', 'feed-1');

      expect(result.articlesDeleted).toBe(3);
      expect(result.error).toBeUndefined();
      // Should delete: article-6 (exceeds limit), article-7 and article-8 (old)
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledWith(
        expect.arrayContaining(['article-6', 'article-7', 'article-8'])
      );
    });

    it('should handle no articles to delete', async () => {
      const now = new Date();
      const recentDate1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const recentDate2 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); // 6 days ago

      const mockSettings: Partial<UserSettings> = {
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      };

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: recentDate1, created_at: recentDate1 },
        { id: 'article-2', feed_id: 'feed-1', published_at: recentDate2, created_at: recentDate2 },
      ];

      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings as UserSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupFeedArticles('user-1', 'feed-1');

      expect(result.articlesDeleted).toBe(0);
      expect(result.error).toBeUndefined();
      // batchDeleteArticles is not called when no articles need deletion (early return)
      expect(mockStorage.batchDeleteArticles).not.toHaveBeenCalled();
    });
  });

  describe('batchDeleteArticles', () => {
    beforeEach(() => {
      // Add batchDeleteArticles to mock storage
      mockStorage.batchDeleteArticles = vi.fn();
    });

    it('should return 0 when given empty array', async () => {
      const result = await (cleanupService as any).batchDeleteArticles([]);

      expect(result).toBe(0);
      expect(mockStorage.batchDeleteArticles).not.toHaveBeenCalled();
    });

    it('should delete articles in a single batch when count is below batch size', async () => {
      const articleIds = ['article-1', 'article-2', 'article-3'];
      
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(3);

      const result = await (cleanupService as any).batchDeleteArticles(articleIds);

      expect(result).toBe(3);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledTimes(1);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledWith(articleIds);
    });

    it('should delete articles in multiple batches when count exceeds batch size', async () => {
      // Create 1200 article IDs (should be split into 3 batches of 500, 500, 200)
      const articleIds = Array.from({ length: 1200 }, (_, i) => `article-${i}`);
      
      // Mock each batch deletion to return the batch size
      vi.mocked(mockStorage.batchDeleteArticles)
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(200);

      const result = await (cleanupService as any).batchDeleteArticles(articleIds);

      expect(result).toBe(1200);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledTimes(3);
      
      // Verify batch sizes
      expect(mockStorage.batchDeleteArticles).toHaveBeenNthCalledWith(1, articleIds.slice(0, 500));
      expect(mockStorage.batchDeleteArticles).toHaveBeenNthCalledWith(2, articleIds.slice(500, 1000));
      expect(mockStorage.batchDeleteArticles).toHaveBeenNthCalledWith(3, articleIds.slice(1000, 1200));
    });

    it('should continue with remaining batches if one batch fails', async () => {
      // Create 1200 article IDs
      const articleIds = Array.from({ length: 1200 }, (_, i) => `article-${i}`);
      
      // Mock second batch to fail, but first and third succeed
      vi.mocked(mockStorage.batchDeleteArticles)
        .mockResolvedValueOnce(500) // First batch succeeds
        .mockRejectedValueOnce(new Error('Database error')) // Second batch fails
        .mockResolvedValueOnce(200); // Third batch succeeds

      const result = await (cleanupService as any).batchDeleteArticles(articleIds);

      // Should return total of successful batches (500 + 200 = 700)
      expect(result).toBe(700);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledTimes(3);
    });

    it('should handle all batches failing gracefully', async () => {
      const articleIds = Array.from({ length: 1000 }, (_, i) => `article-${i}`);
      
      // Mock all batches to fail
      vi.mocked(mockStorage.batchDeleteArticles)
        .mockRejectedValue(new Error('Database error'));

      const result = await (cleanupService as any).batchDeleteArticles(articleIds);

      expect(result).toBe(0);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledTimes(2); // 2 batches of 500
    });

    it('should handle exactly batch size boundary (500 articles)', async () => {
      const articleIds = Array.from({ length: 500 }, (_, i) => `article-${i}`);
      
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(500);

      const result = await (cleanupService as any).batchDeleteArticles(articleIds);

      expect(result).toBe(500);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledTimes(1);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledWith(articleIds);
    });

    it('should handle exactly 2x batch size boundary (1000 articles)', async () => {
      const articleIds = Array.from({ length: 1000 }, (_, i) => `article-${i}`);
      
      vi.mocked(mockStorage.batchDeleteArticles)
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(500);

      const result = await (cleanupService as any).batchDeleteArticles(articleIds);

      expect(result).toBe(1000);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledTimes(2);
    });

    it('should handle single article deletion', async () => {
      const articleIds = ['article-1'];
      
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(1);

      const result = await (cleanupService as any).batchDeleteArticles(articleIds);

      expect(result).toBe(1);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledTimes(1);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledWith(['article-1']);
    });

    it('should handle partial batch deletion (storage returns less than requested)', async () => {
      const articleIds = ['article-1', 'article-2', 'article-3'];
      
      // Storage might return less if some articles don't exist
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(2);

      const result = await (cleanupService as any).batchDeleteArticles(articleIds);

      expect(result).toBe(2);
    });

    it('should handle large batch count (5000 articles = 10 batches)', async () => {
      const articleIds = Array.from({ length: 5000 }, (_, i) => `article-${i}`);
      
      // Mock all 10 batches to succeed
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(500);

      const result = await (cleanupService as any).batchDeleteArticles(articleIds);

      expect(result).toBe(5000);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledTimes(10);
    });
  });

  describe('cleanupUserArticles', () => {
    beforeEach(() => {
      // Add all required methods to mock storage
      mockStorage.getUserFeeds = vi.fn();
      mockStorage.getArticlesByFeedId = vi.fn();
      mockStorage.batchDeleteArticles = vi.fn();
      mockStorage.logCleanup = vi.fn();
    });

    it('should return 0 when user has no feeds', async () => {
      vi.mocked(mockStorage.getUserFeeds).mockResolvedValue([]);

      const result = await cleanupService.cleanupUserArticles('user-1');

      expect(result.articlesDeleted).toBe(0);
      expect(result.error).toBeUndefined();
      expect(mockStorage.getArticlesByFeedId).not.toHaveBeenCalled();
    });

    it('should cleanup all feeds for a user and aggregate results', async () => {
      const mockFeeds = [
        { id: 'feed-1', title: 'Feed 1', user_id: 'user-1' },
        { id: 'feed-2', title: 'Feed 2', user_id: 'user-1' },
        { id: 'feed-3', title: 'Feed 3', user_id: 'user-1' },
      ];

      const now = new Date();
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago

      const mockSettings: Partial<UserSettings> = {
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      };

      // Mock feed 1 articles (2 old articles to delete)
      const feed1Articles = [
        { id: 'article-1-1', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
        { id: 'article-1-2', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
      ];

      // Mock feed 2 articles (3 old articles to delete)
      const feed2Articles = [
        { id: 'article-2-1', feed_id: 'feed-2', published_at: oldDate, created_at: oldDate },
        { id: 'article-2-2', feed_id: 'feed-2', published_at: oldDate, created_at: oldDate },
        { id: 'article-2-3', feed_id: 'feed-2', published_at: oldDate, created_at: oldDate },
      ];

      // Mock feed 3 articles (no old articles)
      const feed3Articles = [
        { id: 'article-3-1', feed_id: 'feed-3', published_at: now, created_at: now },
      ];

      vi.mocked(mockStorage.getUserFeeds).mockResolvedValue(mockFeeds as any);
      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings as UserSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      
      // Mock getArticlesByFeedId to return different articles for each feed
      // Each feed is queried twice (once for per-feed limit, once for age-based)
      vi.mocked(mockStorage.getArticlesByFeedId)
        .mockResolvedValueOnce(feed1Articles as any) // feed-1 per-feed limit
        .mockResolvedValueOnce(feed1Articles as any) // feed-1 age-based
        .mockResolvedValueOnce(feed2Articles as any) // feed-2 per-feed limit
        .mockResolvedValueOnce(feed2Articles as any) // feed-2 age-based
        .mockResolvedValueOnce(feed3Articles as any) // feed-3 per-feed limit
        .mockResolvedValueOnce(feed3Articles as any); // feed-3 age-based
      
      // Mock batch deletions
      vi.mocked(mockStorage.batchDeleteArticles)
        .mockResolvedValueOnce(2) // feed-1: 2 deleted
        .mockResolvedValueOnce(3); // feed-2: 3 deleted
        // feed-3: no deletion (no old articles)
      
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupUserArticles('user-1');

      expect(result.articlesDeleted).toBe(5); // 2 + 3 + 0
      expect(result.error).toBeUndefined();
      expect(mockStorage.getUserFeeds).toHaveBeenCalledWith('user-1');
      // getArticlesByFeedId is called twice per feed (once for per-feed limit, once for age-based)
      expect(mockStorage.getArticlesByFeedId).toHaveBeenCalledTimes(6); // 3 feeds * 2 calls each
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledTimes(2); // Only feed-1 and feed-2 had articles to delete
    });

    it('should continue with remaining feeds if one feed cleanup fails', async () => {
      const mockFeeds = [
        { id: 'feed-1', title: 'Feed 1', user_id: 'user-1' },
        { id: 'feed-2', title: 'Feed 2', user_id: 'user-1' },
        { id: 'feed-3', title: 'Feed 3', user_id: 'user-1' },
      ];

      const now = new Date();
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

      const mockSettings: Partial<UserSettings> = {
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      };

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
      ];

      vi.mocked(mockStorage.getUserFeeds).mockResolvedValue(mockFeeds as any);
      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings as UserSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      
      // Mock feed-1 succeeds (2 calls), feed-2 fails (1 call), feed-3 succeeds (2 calls)
      vi.mocked(mockStorage.getArticlesByFeedId)
        .mockResolvedValueOnce(mockArticles as any) // feed-1 per-feed limit
        .mockResolvedValueOnce(mockArticles as any) // feed-1 age-based
        .mockRejectedValueOnce(new Error('Database error')) // feed-2 per-feed limit fails
        .mockResolvedValueOnce(mockArticles as any) // feed-3 per-feed limit
        .mockResolvedValueOnce(mockArticles as any); // feed-3 age-based
      
      vi.mocked(mockStorage.batchDeleteArticles)
        .mockResolvedValueOnce(1) // feed-1
        .mockResolvedValueOnce(1); // feed-3
      
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupUserArticles('user-1');

      // Should still delete articles from feed-1 and feed-3 despite feed-2 failure
      expect(result.articlesDeleted).toBe(2); // 1 + 1
      expect(result.error).toBeUndefined(); // Individual feed errors don't propagate
      // getArticlesByFeedId is called twice per feed (once for per-feed limit, once for age-based)
      // feed-1: 2 calls (both succeed), feed-2: 2 calls (first fails, second succeeds), feed-3: 2 calls (both succeed)
      expect(mockStorage.getArticlesByFeedId).toHaveBeenCalledTimes(6);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledTimes(2);
    });

    it('should handle all feeds failing gracefully', async () => {
      const mockFeeds = [
        { id: 'feed-1', title: 'Feed 1', user_id: 'user-1' },
        { id: 'feed-2', title: 'Feed 2', user_id: 'user-1' },
      ];

      vi.mocked(mockStorage.getUserFeeds).mockResolvedValue(mockFeeds as any);
      vi.mocked(mockStorage.getUserSettings).mockResolvedValue({
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      } as UserSettings);
      
      // All feeds fail
      vi.mocked(mockStorage.getProtectedArticles).mockRejectedValue(new Error('Database error'));
      vi.mocked(mockStorage.getArticlesWithComments).mockRejectedValue(new Error('Database error'));
      vi.mocked(mockStorage.getArticlesByFeedId).mockRejectedValue(new Error('Database error'));
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupUserArticles('user-1');

      expect(result.articlesDeleted).toBe(0);
      expect(result.error).toBeUndefined(); // Individual feed errors don't propagate
    });

    it('should handle getUserFeeds throwing error', async () => {
      vi.mocked(mockStorage.getUserFeeds).mockRejectedValue(new Error('Database error'));

      const result = await cleanupService.cleanupUserArticles('user-1');

      expect(result.articlesDeleted).toBe(0);
      expect(result.error).toBe('Database error');
      expect(mockStorage.getArticlesByFeedId).not.toHaveBeenCalled();
    });

    it('should handle single feed cleanup', async () => {
      const mockFeeds = [
        { id: 'feed-1', title: 'Feed 1', user_id: 'user-1' },
      ];

      const now = new Date();
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

      const mockSettings: Partial<UserSettings> = {
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      };

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
        { id: 'article-2', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
      ];

      vi.mocked(mockStorage.getUserFeeds).mockResolvedValue(mockFeeds as any);
      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings as UserSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(2);
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupUserArticles('user-1');

      expect(result.articlesDeleted).toBe(2);
      expect(result.error).toBeUndefined();
      expect(mockStorage.getUserFeeds).toHaveBeenCalledWith('user-1');
      // getArticlesByFeedId is called twice per feed (once for per-feed limit, once for age-based)
      expect(mockStorage.getArticlesByFeedId).toHaveBeenCalledTimes(2);
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledTimes(1);
    });

    it('should handle feeds with auto-cleanup disabled', async () => {
      const mockFeeds = [
        { id: 'feed-1', title: 'Feed 1', user_id: 'user-1' },
        { id: 'feed-2', title: 'Feed 2', user_id: 'user-1' },
      ];

      const mockSettings: Partial<UserSettings> = {
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: false, // Disabled
      };

      vi.mocked(mockStorage.getUserFeeds).mockResolvedValue(mockFeeds as any);
      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings as UserSettings);
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupUserArticles('user-1');

      expect(result.articlesDeleted).toBe(0);
      expect(result.error).toBeUndefined();
      // cleanupFeedArticles is called but skips cleanup due to disabled setting
      expect(mockStorage.getArticlesByFeedId).not.toHaveBeenCalled();
      expect(mockStorage.batchDeleteArticles).not.toHaveBeenCalled();
    });

    it('should track duration correctly', async () => {
      const mockFeeds = [
        { id: 'feed-1', title: 'Feed 1', user_id: 'user-1' },
      ];

      vi.mocked(mockStorage.getUserFeeds).mockResolvedValue(mockFeeds as any);
      vi.mocked(mockStorage.getUserSettings).mockResolvedValue({
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      } as UserSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue([]);
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupUserArticles('user-1');

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe('number');
    });

    it('should handle large number of feeds (10 feeds)', async () => {
      const mockFeeds = Array.from({ length: 10 }, (_, i) => ({
        id: `feed-${i}`,
        title: `Feed ${i}`,
        user_id: 'user-1',
      }));

      const now = new Date();
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

      const mockSettings: Partial<UserSettings> = {
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      };

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: oldDate, created_at: oldDate },
      ];

      vi.mocked(mockStorage.getUserFeeds).mockResolvedValue(mockFeeds as any);
      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings as UserSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(1);
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupUserArticles('user-1');

      expect(result.articlesDeleted).toBe(10); // 1 article per feed
      expect(result.error).toBeUndefined();
      // getArticlesByFeedId is called twice per feed (once for per-feed limit, once for age-based)
      expect(mockStorage.getArticlesByFeedId).toHaveBeenCalledTimes(20); // 10 feeds * 2 calls each
      expect(mockStorage.batchDeleteArticles).toHaveBeenCalledTimes(10);
    });
  });

  describe('cleanupAllUsers', () => {
    beforeEach(() => {
      // Add all required methods to mock storage
      mockStorage.getUsersWithFeeds = vi.fn();
      mockStorage.getUserFeeds = vi.fn();
      mockStorage.getUserSettings = vi.fn();
      mockStorage.getProtectedArticles = vi.fn();
      mockStorage.getArticlesWithComments = vi.fn();
      mockStorage.getArticlesByFeedId = vi.fn();
      mockStorage.batchDeleteArticles = vi.fn();
      mockStorage.logCleanup = vi.fn();
    });

    it('should return 0 when no users have feeds', async () => {
      vi.mocked(mockStorage.getUsersWithFeeds).mockResolvedValue([]);

      const result = await cleanupService.cleanupAllUsers();

      expect(result.usersProcessed).toBe(0);
      expect(result.totalDeleted).toBe(0);
      expect(mockStorage.getUsersWithFeeds).toHaveBeenCalled();
    });

    it('should process all users with feeds', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      
      const mockFeeds = [
        { id: 'feed-1', title: 'Feed 1', user_id: 'user-1' },
        { id: 'feed-2', title: 'Feed 2', user_id: 'user-1' },
      ];

      const mockSettings = {
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      } as UserSettings;

      vi.mocked(mockStorage.getUsersWithFeeds).mockResolvedValue(userIds);
      vi.mocked(mockStorage.getUserFeeds).mockResolvedValue(mockFeeds as any);
      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue([]);
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(0);
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupAllUsers();

      expect(result.usersProcessed).toBe(3);
      expect(result.totalDeleted).toBe(0);
      expect(mockStorage.getUsersWithFeeds).toHaveBeenCalled();
      expect(mockStorage.getUserFeeds).toHaveBeenCalledTimes(3); // Once per user
    });

    it('should aggregate articles deleted across all users', async () => {
      const userIds = ['user-1', 'user-2'];
      
      const mockFeedsUser1 = [
        { id: 'feed-1', title: 'Feed 1', user_id: 'user-1' },
      ];

      const mockFeedsUser2 = [
        { id: 'feed-2', title: 'Feed 2', user_id: 'user-2' },
      ];

      const mockArticles = [
        { id: 'article-1', feed_id: 'feed-1', published_at: new Date('2020-01-01') },
        { id: 'article-2', feed_id: 'feed-1', published_at: new Date('2020-01-02') },
        { id: 'article-3', feed_id: 'feed-2', published_at: new Date('2020-01-03') },
      ];

      const mockSettings = {
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      } as UserSettings;

      vi.mocked(mockStorage.getUsersWithFeeds).mockResolvedValue(userIds);
      
      // Mock getUserFeeds to return different feeds for each user
      vi.mocked(mockStorage.getUserFeeds).mockImplementation(async (userId: string) => {
        if (userId === 'user-1') return mockFeedsUser1 as any;
        if (userId === 'user-2') return mockFeedsUser2 as any;
        return [];
      });

      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue(mockArticles as any);
      
      // Mock batchDeleteArticles to return the number of articles deleted
      vi.mocked(mockStorage.batchDeleteArticles).mockImplementation(async (ids: string[]) => ids.length);
      
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupAllUsers();

      expect(result.usersProcessed).toBe(2);
      expect(result.totalDeleted).toBe(6); // 3 articles per feed * 2 feeds
      expect(mockStorage.getUsersWithFeeds).toHaveBeenCalled();
      expect(mockStorage.getUserFeeds).toHaveBeenCalledTimes(2);
    });

    it('should continue processing users if one user fails', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      
      const mockFeeds = [
        { id: 'feed-1', title: 'Feed 1', user_id: 'user-1' },
      ];

      const mockSettings = {
        articles_per_feed: 100,
        unread_article_age_days: 30,
        enable_auto_cleanup: true,
      } as UserSettings;

      vi.mocked(mockStorage.getUsersWithFeeds).mockResolvedValue(userIds);
      
      // Mock getUserFeeds to fail for user-2
      vi.mocked(mockStorage.getUserFeeds).mockImplementation(async (userId: string) => {
        if (userId === 'user-2') {
          throw new Error('Database error');
        }
        return mockFeeds as any;
      });

      vi.mocked(mockStorage.getUserSettings).mockResolvedValue(mockSettings);
      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue([]);
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(0);
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupAllUsers();

      // Should process user-1 and user-3, skip user-2
      expect(result.usersProcessed).toBe(2);
      expect(result.totalDeleted).toBe(0);
      expect(mockStorage.getUsersWithFeeds).toHaveBeenCalled();
      expect(mockStorage.getUserFeeds).toHaveBeenCalledTimes(3); // Attempted for all 3 users
    });

    it('should handle getUsersWithFeeds throwing error', async () => {
      vi.mocked(mockStorage.getUsersWithFeeds).mockRejectedValue(new Error('Database error'));

      const result = await cleanupService.cleanupAllUsers();

      expect(result.usersProcessed).toBe(0);
      expect(result.totalDeleted).toBe(0);
      expect(mockStorage.getUsersWithFeeds).toHaveBeenCalled();
    });

    it('should process users with different cleanup settings', async () => {
      const userIds = ['user-1', 'user-2'];
      
      const mockFeeds = [
        { id: 'feed-1', title: 'Feed 1', user_id: 'user-1' },
      ];

      const mockSettingsUser1 = {
        articles_per_feed: 50,
        unread_article_age_days: 7,
        enable_auto_cleanup: true,
      } as UserSettings;

      const mockSettingsUser2 = {
        articles_per_feed: 200,
        unread_article_age_days: 60,
        enable_auto_cleanup: true,
      } as UserSettings;

      vi.mocked(mockStorage.getUsersWithFeeds).mockResolvedValue(userIds);
      vi.mocked(mockStorage.getUserFeeds).mockResolvedValue(mockFeeds as any);
      
      // Mock getUserSettings to return different settings for each user
      vi.mocked(mockStorage.getUserSettings).mockImplementation(async (userId: string) => {
        if (userId === 'user-1') return mockSettingsUser1;
        if (userId === 'user-2') return mockSettingsUser2;
        return undefined;
      });

      vi.mocked(mockStorage.getProtectedArticles).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesWithComments).mockResolvedValue([]);
      vi.mocked(mockStorage.getArticlesByFeedId).mockResolvedValue([]);
      vi.mocked(mockStorage.batchDeleteArticles).mockResolvedValue(0);
      vi.mocked(mockStorage.logCleanup).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupAllUsers();

      expect(result.usersProcessed).toBe(2);
      expect(result.totalDeleted).toBe(0);
      expect(mockStorage.getUserSettings).toHaveBeenCalledWith('user-1');
      expect(mockStorage.getUserSettings).toHaveBeenCalledWith('user-2');
    });
  });
});
