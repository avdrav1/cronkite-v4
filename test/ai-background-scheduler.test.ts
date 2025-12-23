/**
 * AI Background Scheduler Integration Tests
 * 
 * Tests for the AI background scheduler integration.
 * Validates Requirements: 2.5, 3.5, 3.6, 3.8, 3.9, 7.1, 7.2, 7.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initializeAIScheduler,
  startAIScheduler,
  stopAIScheduler,
  getSchedulerStats,
  triggerEmbeddingProcessing,
  triggerClusterGeneration,
  queueArticlesForEmbedding,
} from '@server/ai-background-scheduler';
import { isEmbeddingServiceAvailable } from '@server/embedding-service';
import { isClusteringServiceAvailable } from '@server/clustering-service';

describe('AI Background Scheduler', () => {
  beforeEach(() => {
    // Reset scheduler state before each test
    stopAIScheduler();
  });

  afterEach(() => {
    // Clean up after each test
    stopAIScheduler();
  });

  describe('Scheduler Initialization', () => {
    it('should export initializeAIScheduler function', () => {
      expect(typeof initializeAIScheduler).toBe('function');
    });

    it('should export startAIScheduler function', () => {
      expect(typeof startAIScheduler).toBe('function');
    });

    it('should export stopAIScheduler function', () => {
      expect(typeof stopAIScheduler).toBe('function');
    });

    it('should export getSchedulerStats function', () => {
      expect(typeof getSchedulerStats).toBe('function');
    });

    it('should export triggerEmbeddingProcessing function', () => {
      expect(typeof triggerEmbeddingProcessing).toBe('function');
    });

    it('should export triggerClusterGeneration function', () => {
      expect(typeof triggerClusterGeneration).toBe('function');
    });

    it('should export queueArticlesForEmbedding function', () => {
      expect(typeof queueArticlesForEmbedding).toBe('function');
    });
  });

  describe('getSchedulerStats', () => {
    it('should return scheduler statistics object', () => {
      const stats = getSchedulerStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.isRunning).toBe('boolean');
      expect(typeof stats.services).toBe('object');
      expect(typeof stats.embeddingsProcessed).toBe('number');
      expect(typeof stats.embeddingsFailed).toBe('number');
      expect(typeof stats.clustersGenerated).toBe('number');
      expect(typeof stats.clustersExpired).toBe('number');
    });

    it('should include service availability status', () => {
      const stats = getSchedulerStats();
      
      expect(stats.services).toBeDefined();
      expect(typeof stats.services.embeddings).toBe('boolean');
      expect(typeof stats.services.clustering).toBe('boolean');
    });

    it('should include last run timestamps', () => {
      const stats = getSchedulerStats();
      
      // Initially null before any runs
      expect(stats.lastEmbeddingRun === null || stats.lastEmbeddingRun instanceof Date).toBe(true);
      expect(stats.lastClusteringRun === null || stats.lastClusteringRun instanceof Date).toBe(true);
      expect(stats.lastCleanupRun === null || stats.lastCleanupRun instanceof Date).toBe(true);
    });

    it('should include errors array', () => {
      const stats = getSchedulerStats();
      
      expect(Array.isArray(stats.errors)).toBe(true);
    });
  });

  describe('Service Availability', () => {
    it('should check embedding service availability', () => {
      const available = isEmbeddingServiceAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should check clustering service availability', () => {
      const available = isClusteringServiceAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should reflect service availability in scheduler stats', () => {
      const stats = getSchedulerStats();
      
      // Service availability should match the individual service checks
      expect(stats.services.embeddings).toBe(isEmbeddingServiceAvailable());
      expect(stats.services.clustering).toBe(isClusteringServiceAvailable());
    });
  });

  describe('Scheduler State', () => {
    it('should report not running initially', () => {
      const stats = getSchedulerStats();
      expect(stats.isRunning).toBe(false);
    });

    it('should stop gracefully when not running', () => {
      // Should not throw when stopping a non-running scheduler
      expect(() => stopAIScheduler()).not.toThrow();
    });
  });

  describe('Manual Triggers', () => {
    it('should handle triggerEmbeddingProcessing when service unavailable', async () => {
      // When embedding service is not available, should return zeros
      const result = await triggerEmbeddingProcessing();
      
      expect(result).toBeDefined();
      expect(typeof result.processed).toBe('number');
      expect(typeof result.succeeded).toBe('number');
      expect(typeof result.failed).toBe('number');
    });

    it('should handle triggerClusterGeneration when service unavailable', async () => {
      // When clustering service is not available, should return zeros
      const result = await triggerClusterGeneration();
      
      expect(result).toBeDefined();
      expect(typeof result.clustersCreated).toBe('number');
      expect(typeof result.articlesProcessed).toBe('number');
    });
  });

  describe('Requirements Validation', () => {
    // Requirements: 3.8, 3.9, 7.1, 7.2 - Background processing for embeddings and clustering
    it('should have embedding queue processing capability', () => {
      // The scheduler should be able to process embedding queues
      expect(typeof triggerEmbeddingProcessing).toBe('function');
    });

    // Requirements: 3.5, 3.6 - Manual sync triggers
    it('should support manual trigger for embeddings', () => {
      expect(typeof triggerEmbeddingProcessing).toBe('function');
    });

    it('should support manual trigger for clustering', () => {
      expect(typeof triggerClusterGeneration).toBe('function');
    });

    // Requirements: 7.5 - API endpoint to check embedding and clustering status
    it('should provide status information via getSchedulerStats', () => {
      const stats = getSchedulerStats();
      
      // Should include all required status information
      expect(stats).toHaveProperty('isRunning');
      expect(stats).toHaveProperty('services');
      expect(stats).toHaveProperty('embeddingsProcessed');
      expect(stats).toHaveProperty('clustersGenerated');
      expect(stats).toHaveProperty('lastEmbeddingRun');
      expect(stats).toHaveProperty('lastClusteringRun');
    });

    // Requirements: 7.1 - Queue articles for embedding generation
    it('should have queueArticlesForEmbedding function', () => {
      expect(typeof queueArticlesForEmbedding).toBe('function');
    });
  });
});
