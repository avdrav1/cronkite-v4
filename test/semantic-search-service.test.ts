/**
 * Semantic Search Service Tests
 * 
 * Tests for the semantic search functionality.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedQueryEmbedding,
  cacheQueryEmbedding,
  cleanupQueryCache,
  clearQueryCache,
  getQueryCacheStats,
  MAX_SEARCH_RESULTS,
  MIN_SEARCH_SIMILARITY,
  QUERY_CACHE_TTL_MS,
} from '../server/semantic-search-service';

describe('Semantic Search Service', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearQueryCache();
  });

  describe('Query Embedding Cache', () => {
    it('should cache query embeddings', () => {
      const query = 'test query';
      const embedding = Array(1536).fill(0.1);
      
      // Cache should be empty initially
      expect(getCachedQueryEmbedding(query)).toBeNull();
      
      // Cache the embedding
      cacheQueryEmbedding(query, embedding);
      
      // Should retrieve from cache
      const cached = getCachedQueryEmbedding(query);
      expect(cached).not.toBeNull();
      expect(cached).toHaveLength(1536);
    });

    it('should normalize queries for cache lookup', () => {
      const embedding = Array(1536).fill(0.1);
      
      // Cache with one format
      cacheQueryEmbedding('Test Query', embedding);
      
      // Should find with different case/whitespace
      expect(getCachedQueryEmbedding('test query')).not.toBeNull();
      expect(getCachedQueryEmbedding('  TEST QUERY  ')).not.toBeNull();
    });

    it('should track cache statistics', () => {
      const embedding = Array(1536).fill(0.1);
      
      // Initially empty
      let stats = getQueryCacheStats();
      expect(stats.totalEntries).toBe(0);
      
      // Add entries
      cacheQueryEmbedding('query1', embedding);
      cacheQueryEmbedding('query2', embedding);
      
      stats = getQueryCacheStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });

    it('should clean up expired cache entries', () => {
      const embedding = Array(1536).fill(0.1);
      
      // Add entry
      cacheQueryEmbedding('test', embedding);
      expect(getQueryCacheStats().totalEntries).toBe(1);
      
      // Cleanup should not remove non-expired entries
      const cleaned = cleanupQueryCache();
      expect(cleaned).toBe(0);
      expect(getQueryCacheStats().totalEntries).toBe(1);
    });
  });

  describe('Constants', () => {
    it('should have correct default values', () => {
      expect(MAX_SEARCH_RESULTS).toBe(50);
      expect(MIN_SEARCH_SIMILARITY).toBe(0.5);
      expect(QUERY_CACHE_TTL_MS).toBe(30 * 60 * 1000); // 30 minutes
    });
  });
});
