/**
 * Similar Articles Service Tests
 * 
 * Tests for the similar articles search functionality.
 * Validates Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 * Property 12: Similar Articles Search Constraints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  findSimilarArticlesFromList,
  getCachedSimilarArticles,
  cacheSimilarArticles,
  invalidateSimilarArticlesCache,
  invalidateUserSimilarArticlesCache,
  cleanupExpiredCache,
  getCacheStats,
  MIN_SIMILARITY_THRESHOLD,
  MAX_RESULTS,
  SIMILARITY_CACHE_TTL_MS,
} from '../server/similar-articles-service';
import type { ArticleWithEmbedding, SimilarArticle } from '../server/clustering-service';

// Helper to create mock articles with embeddings
function createMockArticle(
  id: string,
  feedId: string,
  feedName: string,
  embedding: number[]
): ArticleWithEmbedding {
  return {
    id,
    title: `Article ${id}`,
    excerpt: `Excerpt for article ${id}`,
    feedId,
    feedName,
    embedding,
    publishedAt: new Date(),
    imageUrl: null,
  };
}

// Helper to create a normalized embedding vector
function createNormalizedEmbedding(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return values.map(v => v / magnitude);
}

describe('Similar Articles Service', () => {
  describe('findSimilarArticlesFromList', () => {
    it('should return empty array when no articles match threshold', () => {
      // Create orthogonal embeddings (similarity = 0)
      const sourceArticle = createMockArticle(
        'source',
        'feed1',
        'Feed 1',
        createNormalizedEmbedding([1, 0, 0])
      );
      
      const otherArticle = createMockArticle(
        'other',
        'feed2',
        'Feed 2',
        createNormalizedEmbedding([0, 1, 0])
      );
      
      const result = findSimilarArticlesFromList(
        sourceArticle,
        [sourceArticle, otherArticle],
        { threshold: MIN_SIMILARITY_THRESHOLD }
      );
      
      expect(result).toHaveLength(0);
    });

    it('should return similar articles above threshold (Property 12b)', () => {
      // Create similar embeddings (high cosine similarity)
      const sourceArticle = createMockArticle(
        'source',
        'feed1',
        'Feed 1',
        createNormalizedEmbedding([1, 0.1, 0])
      );
      
      const similarArticle = createMockArticle(
        'similar',
        'feed2',
        'Feed 2',
        createNormalizedEmbedding([1, 0.15, 0]) // Very similar
      );
      
      const result = findSimilarArticlesFromList(
        sourceArticle,
        [sourceArticle, similarArticle],
        { threshold: 0.9 }
      );
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(a => a.similarityScore >= 0.9)).toBe(true);
    });

    it('should exclude source article from results (Property 12c)', () => {
      const sourceArticle = createMockArticle(
        'source',
        'feed1',
        'Feed 1',
        createNormalizedEmbedding([1, 0, 0])
      );
      
      const result = findSimilarArticlesFromList(
        sourceArticle,
        [sourceArticle],
        { threshold: 0 } // Accept any similarity
      );
      
      expect(result.find(a => a.articleId === 'source')).toBeUndefined();
    });

    it('should limit results to maxResults (Property 12a)', () => {
      const sourceArticle = createMockArticle(
        'source',
        'feed1',
        'Feed 1',
        createNormalizedEmbedding([1, 0, 0])
      );
      
      // Create 10 similar articles
      const similarArticles = Array.from({ length: 10 }, (_, i) =>
        createMockArticle(
          `similar-${i}`,
          `feed${i}`,
          `Feed ${i}`,
          createNormalizedEmbedding([1, 0.01 * i, 0])
        )
      );
      
      const result = findSimilarArticlesFromList(
        sourceArticle,
        [sourceArticle, ...similarArticles],
        { threshold: 0.9, maxResults: 5 }
      );
      
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should filter by feedIds when provided (Property 12d)', () => {
      const sourceArticle = createMockArticle(
        'source',
        'feed1',
        'Feed 1',
        createNormalizedEmbedding([1, 0, 0])
      );
      
      const allowedFeedArticle = createMockArticle(
        'allowed',
        'feed2',
        'Feed 2',
        createNormalizedEmbedding([1, 0.01, 0])
      );
      
      const excludedFeedArticle = createMockArticle(
        'excluded',
        'feed3',
        'Feed 3',
        createNormalizedEmbedding([1, 0.02, 0])
      );
      
      const result = findSimilarArticlesFromList(
        sourceArticle,
        [sourceArticle, allowedFeedArticle, excludedFeedArticle],
        { threshold: 0.9, feedIds: ['feed1', 'feed2'] }
      );
      
      expect(result.find(a => a.feedId === 'feed3')).toBeUndefined();
    });

    it('should sort results by similarity score descending', () => {
      const sourceArticle = createMockArticle(
        'source',
        'feed1',
        'Feed 1',
        createNormalizedEmbedding([1, 0, 0])
      );
      
      const lessSimilar = createMockArticle(
        'less-similar',
        'feed2',
        'Feed 2',
        createNormalizedEmbedding([1, 0.3, 0])
      );
      
      const moreSimilar = createMockArticle(
        'more-similar',
        'feed3',
        'Feed 3',
        createNormalizedEmbedding([1, 0.1, 0])
      );
      
      const result = findSimilarArticlesFromList(
        sourceArticle,
        [sourceArticle, lessSimilar, moreSimilar],
        { threshold: 0.8 }
      );
      
      if (result.length >= 2) {
        expect(result[0].similarityScore).toBeGreaterThanOrEqual(result[1].similarityScore);
      }
    });

    it('should exclude articles in excludeArticleIds', () => {
      const sourceArticle = createMockArticle(
        'source',
        'feed1',
        'Feed 1',
        createNormalizedEmbedding([1, 0, 0])
      );
      
      const excludedArticle = createMockArticle(
        'excluded',
        'feed2',
        'Feed 2',
        createNormalizedEmbedding([1, 0.01, 0])
      );
      
      const includedArticle = createMockArticle(
        'included',
        'feed3',
        'Feed 3',
        createNormalizedEmbedding([1, 0.02, 0])
      );
      
      const result = findSimilarArticlesFromList(
        sourceArticle,
        [sourceArticle, excludedArticle, includedArticle],
        { threshold: 0.9, excludeArticleIds: ['excluded'] }
      );
      
      expect(result.find(a => a.articleId === 'excluded')).toBeUndefined();
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      // Clear cache before each test
      cleanupExpiredCache();
    });

    it('should cache similar articles results', () => {
      const userId = 'user1';
      const articleId = 'article1';
      const similarArticles: SimilarArticle[] = [
        {
          articleId: 'similar1',
          title: 'Similar Article 1',
          feedName: 'Feed 1',
          feedId: 'feed1',
          similarityScore: 0.85,
          publishedAt: new Date(),
          imageUrl: null,
        },
      ];
      
      cacheSimilarArticles(userId, articleId, similarArticles);
      
      const cached = getCachedSimilarArticles(userId, articleId);
      expect(cached).not.toBeNull();
      expect(cached?.similarArticles).toEqual(similarArticles);
    });

    it('should return null for non-existent cache entries', () => {
      const cached = getCachedSimilarArticles('nonexistent', 'nonexistent');
      expect(cached).toBeNull();
    });

    it('should invalidate cache for specific article', () => {
      const userId = 'user1';
      const articleId = 'article1';
      const similarArticles: SimilarArticle[] = [];
      
      cacheSimilarArticles(userId, articleId, similarArticles);
      expect(getCachedSimilarArticles(userId, articleId)).not.toBeNull();
      
      invalidateSimilarArticlesCache(articleId);
      expect(getCachedSimilarArticles(userId, articleId)).toBeNull();
    });

    it('should invalidate all cache entries for a user', () => {
      const userId = 'user1';
      
      cacheSimilarArticles(userId, 'article1', []);
      cacheSimilarArticles(userId, 'article2', []);
      cacheSimilarArticles('user2', 'article3', []);
      
      invalidateUserSimilarArticlesCache(userId);
      
      expect(getCachedSimilarArticles(userId, 'article1')).toBeNull();
      expect(getCachedSimilarArticles(userId, 'article2')).toBeNull();
      expect(getCachedSimilarArticles('user2', 'article3')).not.toBeNull();
    });

    it('should provide cache statistics', () => {
      cacheSimilarArticles('user1', 'article1', []);
      cacheSimilarArticles('user2', 'article2', []);
      
      const stats = getCacheStats();
      expect(stats.totalEntries).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Constants', () => {
    it('should have correct similarity threshold', () => {
      expect(MIN_SIMILARITY_THRESHOLD).toBe(0.7);
    });

    it('should have correct max results', () => {
      expect(MAX_RESULTS).toBe(5);
    });

    it('should have correct cache TTL (1 hour)', () => {
      expect(SIMILARITY_CACHE_TTL_MS).toBe(60 * 60 * 1000);
    });
  });
});
