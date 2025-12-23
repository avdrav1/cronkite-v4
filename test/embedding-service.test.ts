/**
 * Embedding Service Unit Tests
 * 
 * Tests for the embedding service implementation.
 * Validates Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  MAX_BATCH_SIZE,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAYS,
  generateContentHash,
  prepareEmbeddingInput,
  needsEmbeddingUpdate,
  generateEmbeddingsBatch,
  isEmbeddingServiceAvailable,
} from '@server/embedding-service';

describe('Embedding Service', () => {
  describe('Constants', () => {
    it('should have correct embedding dimensions (1536)', () => {
      // Property 1: Embedding Dimension Invariant
      expect(EMBEDDING_DIMENSIONS).toBe(1536);
    });

    it('should use text-embedding-3-small model', () => {
      expect(EMBEDDING_MODEL).toBe('text-embedding-3-small');
    });

    it('should have max batch size of 100', () => {
      // Property 4: Batch Size Limit
      expect(MAX_BATCH_SIZE).toBe(100);
    });

    it('should have max retry attempts of 3', () => {
      expect(MAX_RETRY_ATTEMPTS).toBe(3);
    });

    it('should have exponential backoff delays', () => {
      // Property 19: Exponential Backoff Retry Pattern
      expect(RETRY_DELAYS).toEqual([1000, 2000, 4000]);
    });
  });

  describe('generateContentHash', () => {
    it('should generate consistent hash for same content', () => {
      const hash1 = generateContentHash('Test Title', 'Test Excerpt');
      const hash2 = generateContentHash('Test Title', 'Test Excerpt');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const hash1 = generateContentHash('Title 1', 'Excerpt 1');
      const hash2 = generateContentHash('Title 2', 'Excerpt 2');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle null excerpt', () => {
      const hash = generateContentHash('Test Title', null);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should handle undefined excerpt', () => {
      const hash = generateContentHash('Test Title', undefined);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should generate same hash for null and undefined excerpt', () => {
      const hash1 = generateContentHash('Test Title', null);
      const hash2 = generateContentHash('Test Title', undefined);
      expect(hash1).toBe(hash2);
    });
  });

  describe('prepareEmbeddingInput', () => {
    it('should concatenate title and excerpt with separator', () => {
      // Property 2: Embedding Input Format Consistency
      const input = prepareEmbeddingInput('Test Title', 'Test Excerpt');
      expect(input).toBe('Test Title\n\nTest Excerpt');
    });

    it('should return only title when excerpt is null', () => {
      const input = prepareEmbeddingInput('Test Title', null);
      expect(input).toBe('Test Title');
    });

    it('should return only title when excerpt is undefined', () => {
      const input = prepareEmbeddingInput('Test Title', undefined);
      expect(input).toBe('Test Title');
    });

    it('should return only title when excerpt is empty string', () => {
      const input = prepareEmbeddingInput('Test Title', '');
      expect(input).toBe('Test Title');
    });

    it('should trim whitespace from title and excerpt', () => {
      const input = prepareEmbeddingInput('  Test Title  ', '  Test Excerpt  ');
      expect(input).toBe('Test Title\n\nTest Excerpt');
    });
  });

  describe('needsEmbeddingUpdate', () => {
    it('should return true when no embedding exists', () => {
      const article = {
        title: 'Test',
        excerpt: 'Test excerpt',
        embedding: null,
        content_hash: null,
        embedding_status: 'pending' as const,
      };
      expect(needsEmbeddingUpdate(article)).toBe(true);
    });

    it('should return true when embedding status is pending', () => {
      const article = {
        title: 'Test',
        excerpt: 'Test excerpt',
        embedding: '[0.1, 0.2]',
        content_hash: 'somehash',
        embedding_status: 'pending' as const,
      };
      expect(needsEmbeddingUpdate(article)).toBe(true);
    });

    it('should return true when embedding status is failed', () => {
      const article = {
        title: 'Test',
        excerpt: 'Test excerpt',
        embedding: null,
        content_hash: 'somehash',
        embedding_status: 'failed' as const,
      };
      expect(needsEmbeddingUpdate(article)).toBe(true);
    });

    it('should return true when content hash is missing', () => {
      const article = {
        title: 'Test',
        excerpt: 'Test excerpt',
        embedding: '[0.1, 0.2]',
        content_hash: null,
        embedding_status: 'completed' as const,
      };
      expect(needsEmbeddingUpdate(article)).toBe(true);
    });

    it('should return true when content has changed', () => {
      // Property 3: Embedding Idempotence on Unchanged Content
      const article = {
        title: 'New Title',
        excerpt: 'New excerpt',
        embedding: '[0.1, 0.2]',
        content_hash: generateContentHash('Old Title', 'Old excerpt'),
        embedding_status: 'completed' as const,
      };
      expect(needsEmbeddingUpdate(article)).toBe(true);
    });

    it('should return false when content has not changed', () => {
      // Property 3: Embedding Idempotence on Unchanged Content
      const title = 'Test Title';
      const excerpt = 'Test excerpt';
      const article = {
        title,
        excerpt,
        embedding: '[0.1, 0.2]',
        content_hash: generateContentHash(title, excerpt),
        embedding_status: 'completed' as const,
      };
      expect(needsEmbeddingUpdate(article)).toBe(false);
    });
  });

  describe('isEmbeddingServiceAvailable', () => {
    const originalEnv = process.env.OPENAI_API_KEY;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.OPENAI_API_KEY = originalEnv;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    });

    it('should return false when API key is not set', () => {
      delete process.env.OPENAI_API_KEY;
      expect(isEmbeddingServiceAvailable()).toBe(false);
    });

    it('should return true when API key is set', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      expect(isEmbeddingServiceAvailable()).toBe(true);
    });
  });

  describe('generateEmbeddingsBatch', () => {
    it('should enforce batch size limit', async () => {
      // Property 4: Batch Size Limit
      // Create more than MAX_BATCH_SIZE articles
      const articles = Array.from({ length: MAX_BATCH_SIZE + 10 }, (_, i) => ({
        id: `article-${i}`,
        title: `Title ${i}`,
        excerpt: `Excerpt ${i}`,
        content_hash: null,
      }));

      // Without API key, all will fail but batch size should be enforced
      delete process.env.OPENAI_API_KEY;
      
      const result = await generateEmbeddingsBatch(articles);
      
      // Should only process MAX_BATCH_SIZE articles
      expect(result.failed.length).toBe(MAX_BATCH_SIZE);
      expect(result.successful.length).toBe(0);
    });

    it('should return all failed when OpenAI client is not available', async () => {
      delete process.env.OPENAI_API_KEY;
      
      const articles = [
        { id: 'article-1', title: 'Title 1', excerpt: 'Excerpt 1', content_hash: null },
        { id: 'article-2', title: 'Title 2', excerpt: 'Excerpt 2', content_hash: null },
      ];

      const result = await generateEmbeddingsBatch(articles);
      
      expect(result.successful.length).toBe(0);
      expect(result.failed.length).toBe(2);
      expect(result.failed[0].error).toBe('OpenAI client not available');
      expect(result.totalTokens).toBe(0);
    });

    it('should handle empty batch', async () => {
      const result = await generateEmbeddingsBatch([]);
      
      expect(result.successful.length).toBe(0);
      expect(result.failed.length).toBe(0);
      expect(result.totalTokens).toBe(0);
    });
  });
});
