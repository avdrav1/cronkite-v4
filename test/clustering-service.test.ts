/**
 * Clustering Service Unit Tests
 * 
 * Tests for the clustering service implementation.
 * Validates Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CLUSTER_SIMILARITY_THRESHOLD,
  SIMILAR_ARTICLES_THRESHOLD,
  MIN_CLUSTER_ARTICLES,
  MIN_CLUSTER_SOURCES,
  MAX_SIMILAR_ARTICLES,
  CLUSTER_EXPIRATION_HOURS,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAYS,
  cosineSimilarity,
  findSimilarByEmbedding,
  findSimilarArticles,
  formClusters,
  calculateRelevanceScore,
  isClusteringServiceAvailable,
  type ArticleWithEmbedding,
  type SimilarityOptions,
} from '@server/clustering-service';

describe('Clustering Service', () => {
  describe('Constants', () => {
    it('should have correct cluster similarity threshold (0.75)', () => {
      // Requirements: 2.1
      expect(CLUSTER_SIMILARITY_THRESHOLD).toBe(0.75);
    });

    it('should have correct similar articles threshold (0.7)', () => {
      // Requirements: 4.2
      expect(SIMILAR_ARTICLES_THRESHOLD).toBe(0.7);
    });

    it('should require minimum 2 articles per cluster', () => {
      // Requirements: 2.2
      expect(MIN_CLUSTER_ARTICLES).toBe(2);
    });

    it('should require minimum 2 sources per cluster', () => {
      // Requirements: 2.2
      expect(MIN_CLUSTER_SOURCES).toBe(2);
    });

    it('should return max 5 similar articles', () => {
      // Requirements: 4.1
      expect(MAX_SIMILAR_ARTICLES).toBe(5);
    });

    it('should expire clusters after 48 hours', () => {
      // Requirements: 2.6
      expect(CLUSTER_EXPIRATION_HOURS).toBe(48);
    });

    it('should have max retry attempts of 3', () => {
      expect(MAX_RETRY_ATTEMPTS).toBe(3);
    });

    it('should have exponential backoff delays', () => {
      // Property 19: Exponential Backoff Retry Pattern
      expect(RETRY_DELAYS).toEqual([1000, 2000, 4000]);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const embedding = [0.5, 0.5, 0.5, 0.5];
      expect(cosineSimilarity(embedding, embedding)).toBeCloseTo(1, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const embedding1 = [1, 0, 0, 0];
      const embedding2 = [-1, 0, 0, 0];
      expect(cosineSimilarity(embedding1, embedding2)).toBeCloseTo(-1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const embedding1 = [1, 0, 0, 0];
      const embedding2 = [0, 1, 0, 0];
      expect(cosineSimilarity(embedding1, embedding2)).toBeCloseTo(0, 5);
    });

    it('should throw error for mismatched dimensions', () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [1, 0, 0, 0];
      expect(() => cosineSimilarity(embedding1, embedding2)).toThrow('Embedding dimensions mismatch');
    });

    it('should return 0 for empty vectors', () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it('should return 0 for zero vectors', () => {
      const zeroVector = [0, 0, 0, 0];
      expect(cosineSimilarity(zeroVector, zeroVector)).toBe(0);
    });

    it('should calculate correct similarity for normalized vectors', () => {
      // Two vectors at 45 degrees should have similarity of ~0.707
      const embedding1 = [1, 0];
      const embedding2 = [Math.SQRT1_2, Math.SQRT1_2];
      expect(cosineSimilarity(embedding1, embedding2)).toBeCloseTo(Math.SQRT1_2, 5);
    });
  });

  describe('findSimilarByEmbedding', () => {
    const createArticle = (
      id: string,
      embedding: number[],
      feedId: string = 'feed-1',
      feedName: string = 'Feed 1'
    ): ArticleWithEmbedding => ({
      id,
      title: `Article ${id}`,
      excerpt: `Excerpt for ${id}`,
      feedId,
      feedName,
      embedding,
      publishedAt: new Date(),
      imageUrl: null,
    });

    it('should find similar articles above threshold', () => {
      const targetEmbedding = [1, 0, 0, 0];
      const articles = [
        createArticle('1', [0.9, 0.1, 0, 0]), // High similarity
        createArticle('2', [0.5, 0.5, 0.5, 0.5]), // Medium similarity
        createArticle('3', [0, 1, 0, 0]), // Low similarity (orthogonal)
      ];

      const options: SimilarityOptions = {
        threshold: 0.8,
        maxResults: 10,
      };

      const results = findSimilarByEmbedding(targetEmbedding, articles, options);
      
      expect(results.length).toBe(1);
      expect(results[0].articleId).toBe('1');
      expect(results[0].similarityScore).toBeGreaterThanOrEqual(0.8);
    });

    it('should exclude specified article IDs', () => {
      const targetEmbedding = [1, 0, 0, 0];
      const articles = [
        createArticle('1', [0.95, 0.05, 0, 0]),
        createArticle('2', [0.9, 0.1, 0, 0]),
      ];

      const options: SimilarityOptions = {
        threshold: 0.5,
        maxResults: 10,
        excludeArticleIds: ['1'],
      };

      const results = findSimilarByEmbedding(targetEmbedding, articles, options);
      
      expect(results.length).toBe(1);
      expect(results[0].articleId).toBe('2');
    });

    it('should filter by feed IDs when specified', () => {
      const targetEmbedding = [1, 0, 0, 0];
      const articles = [
        createArticle('1', [0.95, 0.05, 0, 0], 'feed-1', 'Feed 1'),
        createArticle('2', [0.9, 0.1, 0, 0], 'feed-2', 'Feed 2'),
      ];

      const options: SimilarityOptions = {
        threshold: 0.5,
        maxResults: 10,
        feedIds: ['feed-1'],
      };

      const results = findSimilarByEmbedding(targetEmbedding, articles, options);
      
      expect(results.length).toBe(1);
      expect(results[0].feedId).toBe('feed-1');
    });

    it('should limit results to maxResults', () => {
      const targetEmbedding = [1, 0, 0, 0];
      const articles = Array.from({ length: 10 }, (_, i) => 
        createArticle(`${i}`, [0.9 - i * 0.01, 0.1 + i * 0.01, 0, 0])
      );

      const options: SimilarityOptions = {
        threshold: 0.5,
        maxResults: 3,
      };

      const results = findSimilarByEmbedding(targetEmbedding, articles, options);
      
      expect(results.length).toBe(3);
    });

    it('should sort results by similarity score descending', () => {
      const targetEmbedding = [1, 0, 0, 0];
      const articles = [
        createArticle('1', [0.7, 0.3, 0, 0]),
        createArticle('2', [0.95, 0.05, 0, 0]),
        createArticle('3', [0.8, 0.2, 0, 0]),
      ];

      const options: SimilarityOptions = {
        threshold: 0.5,
        maxResults: 10,
      };

      const results = findSimilarByEmbedding(targetEmbedding, articles, options);
      
      expect(results.length).toBe(3);
      expect(results[0].articleId).toBe('2'); // Highest similarity
      expect(results[1].articleId).toBe('3');
      expect(results[2].articleId).toBe('1'); // Lowest similarity
    });
  });

  describe('findSimilarArticles', () => {
    const createArticle = (
      id: string,
      embedding: number[],
      feedId: string = 'feed-1',
      feedName: string = 'Feed 1'
    ): ArticleWithEmbedding => ({
      id,
      title: `Article ${id}`,
      excerpt: `Excerpt for ${id}`,
      feedId,
      feedName,
      embedding,
      publishedAt: new Date(),
      imageUrl: null,
    });

    it('should exclude source article from results', () => {
      // Requirements: 4.3
      const sourceArticle = createArticle('source', [1, 0, 0, 0]);
      const allArticles = [
        sourceArticle,
        createArticle('1', [0.95, 0.05, 0, 0]),
        createArticle('2', [0.9, 0.1, 0, 0]),
      ];

      const results = findSimilarArticles(sourceArticle, allArticles);
      
      expect(results.every(r => r.articleId !== 'source')).toBe(true);
    });

    it('should use default threshold of 0.7', () => {
      // Requirements: 4.2
      const sourceArticle = createArticle('source', [1, 0, 0, 0]);
      const allArticles = [
        sourceArticle,
        createArticle('1', [0.8, 0.2, 0, 0]), // Above 0.7
        createArticle('2', [0.5, 0.5, 0.5, 0.5]), // Below 0.7
      ];

      const results = findSimilarArticles(sourceArticle, allArticles);
      
      expect(results.every(r => r.similarityScore >= 0.7)).toBe(true);
    });

    it('should return max 5 results by default', () => {
      // Requirements: 4.1
      const sourceArticle = createArticle('source', [1, 0, 0, 0]);
      const allArticles = [
        sourceArticle,
        ...Array.from({ length: 10 }, (_, i) => 
          createArticle(`${i}`, [0.95 - i * 0.01, 0.05 + i * 0.01, 0, 0])
        ),
      ];

      const results = findSimilarArticles(sourceArticle, allArticles);
      
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('formClusters', () => {
    const createArticle = (
      id: string,
      embedding: number[],
      feedName: string = 'Feed 1'
    ): ArticleWithEmbedding => ({
      id,
      title: `Article ${id}`,
      excerpt: `Excerpt for ${id}`,
      feedId: `feed-${feedName.toLowerCase().replace(' ', '-')}`,
      feedName,
      embedding,
      publishedAt: new Date(),
      imageUrl: null,
    });

    it('should return empty array when fewer than MIN_CLUSTER_ARTICLES', () => {
      const articles = [createArticle('1', [1, 0, 0, 0])];
      const clusters = formClusters(articles);
      expect(clusters).toEqual([]);
    });

    it('should form cluster when articles meet similarity threshold', () => {
      // Property 5: Cluster Similarity Threshold
      // Requirements: 2.1
      const articles = [
        createArticle('1', [1, 0, 0, 0], 'Feed A'),
        createArticle('2', [0.95, 0.05, 0, 0], 'Feed B'), // Very similar
      ];

      const clusters = formClusters(articles, 0.75);
      
      expect(clusters.length).toBe(1);
      expect(clusters[0].members.length).toBe(2);
    });

    it('should require minimum 2 different sources', () => {
      // Property 6: Cluster Source Diversity
      // Requirements: 2.2
      const articles = [
        createArticle('1', [1, 0, 0, 0], 'Same Feed'),
        createArticle('2', [0.95, 0.05, 0, 0], 'Same Feed'), // Same source
      ];

      const clusters = formClusters(articles, 0.75);
      
      // Should not form cluster because both articles are from same source
      expect(clusters.length).toBe(0);
    });

    it('should assign each article to at most one cluster', () => {
      // Property 7: Article Single-Cluster Assignment
      // Requirements: 2.4
      const articles = [
        createArticle('1', [1, 0, 0, 0], 'Feed A'),
        createArticle('2', [0.95, 0.05, 0, 0], 'Feed B'),
        createArticle('3', [0.9, 0.1, 0, 0], 'Feed C'),
        createArticle('4', [0, 1, 0, 0], 'Feed D'), // Different topic
        createArticle('5', [0.05, 0.95, 0, 0], 'Feed E'), // Similar to article 4
      ];

      const clusters = formClusters(articles, 0.75);
      
      // Collect all assigned article IDs
      const assignedIds = new Set<string>();
      for (const cluster of clusters) {
        for (const member of cluster.members) {
          // Each article should only appear once
          expect(assignedIds.has(member.id)).toBe(false);
          assignedIds.add(member.id);
        }
      }
    });

    it('should not form cluster when similarity is below threshold', () => {
      const articles = [
        createArticle('1', [1, 0, 0, 0], 'Feed A'),
        createArticle('2', [0, 1, 0, 0], 'Feed B'), // Orthogonal - similarity = 0
      ];

      const clusters = formClusters(articles, 0.75);
      
      expect(clusters.length).toBe(0);
    });

    it('should calculate average similarity for cluster', () => {
      const articles = [
        createArticle('1', [1, 0, 0, 0], 'Feed A'),
        createArticle('2', [0.95, 0.05, 0, 0], 'Feed B'),
        createArticle('3', [0.9, 0.1, 0, 0], 'Feed C'),
      ];

      const clusters = formClusters(articles, 0.75);
      
      if (clusters.length > 0) {
        expect(clusters[0].avgSimilarity).toBeGreaterThan(0);
        expect(clusters[0].avgSimilarity).toBeLessThanOrEqual(1);
      }
    });

    it('should track unique sources in cluster', () => {
      const articles = [
        createArticle('1', [1, 0, 0, 0], 'Feed A'),
        createArticle('2', [0.95, 0.05, 0, 0], 'Feed B'),
        createArticle('3', [0.9, 0.1, 0, 0], 'Feed A'), // Same as article 1
      ];

      const clusters = formClusters(articles, 0.75);
      
      if (clusters.length > 0) {
        expect(clusters[0].sources.size).toBe(2); // Feed A and Feed B
      }
    });
  });

  describe('calculateRelevanceScore', () => {
    it('should calculate relevance as articleCount × sourceCount', () => {
      // Property 8: Cluster Relevance Score Sorting
      // Requirements: 2.7
      expect(calculateRelevanceScore(5, 3)).toBe(15);
      expect(calculateRelevanceScore(2, 2)).toBe(4);
      expect(calculateRelevanceScore(10, 5)).toBe(50);
    });

    it('should return 0 when either count is 0', () => {
      expect(calculateRelevanceScore(0, 5)).toBe(0);
      expect(calculateRelevanceScore(5, 0)).toBe(0);
      expect(calculateRelevanceScore(0, 0)).toBe(0);
    });
  });

  describe('isClusteringServiceAvailable', () => {
    const originalEnv = process.env.ANTHROPIC_API_KEY;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.ANTHROPIC_API_KEY = originalEnv;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    });

    it('should return false when API key is not set', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(isClusteringServiceAvailable()).toBe(false);
    });

    it('should return true when API key is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      expect(isClusteringServiceAvailable()).toBe(true);
    });
  });
});
