import { describe, it, expect } from 'vitest';
import { cleanupConfig } from '../server/config';

describe('Cleanup Configuration', () => {
  describe('Default Values', () => {
    it('should have correct default articles per feed', () => {
      expect(cleanupConfig.defaultArticlesPerFeed).toBe(100);
    });

    it('should have correct default unread age days', () => {
      expect(cleanupConfig.defaultUnreadAgeDays).toBe(30);
    });

    it('should have correct batch size', () => {
      expect(cleanupConfig.deleteBatchSize).toBe(500);
    });

    it('should have correct cleanup timeout', () => {
      expect(cleanupConfig.cleanupTimeoutMs).toBe(30000);
    });

    it('should have correct scheduled cleanup cron', () => {
      expect(cleanupConfig.scheduledCleanupCron).toBe('0 2 * * *');
    });
  });

  describe('Min/Max Ranges', () => {
    it('should have correct min articles per feed', () => {
      expect(cleanupConfig.minArticlesPerFeed).toBe(50);
    });

    it('should have correct max articles per feed', () => {
      expect(cleanupConfig.maxArticlesPerFeed).toBe(500);
    });

    it('should have correct min unread age days', () => {
      expect(cleanupConfig.minUnreadAgeDays).toBe(7);
    });

    it('should have correct max unread age days', () => {
      expect(cleanupConfig.maxUnreadAgeDays).toBe(90);
    });
  });

  describe('Configuration Validation', () => {
    it('should have default articles per feed within valid range', () => {
      expect(cleanupConfig.defaultArticlesPerFeed).toBeGreaterThanOrEqual(
        cleanupConfig.minArticlesPerFeed
      );
      expect(cleanupConfig.defaultArticlesPerFeed).toBeLessThanOrEqual(
        cleanupConfig.maxArticlesPerFeed
      );
    });

    it('should have default unread age days within valid range', () => {
      expect(cleanupConfig.defaultUnreadAgeDays).toBeGreaterThanOrEqual(
        cleanupConfig.minUnreadAgeDays
      );
      expect(cleanupConfig.defaultUnreadAgeDays).toBeLessThanOrEqual(
        cleanupConfig.maxUnreadAgeDays
      );
    });

    it('should have positive batch size', () => {
      expect(cleanupConfig.deleteBatchSize).toBeGreaterThan(0);
    });

    it('should have positive timeout', () => {
      expect(cleanupConfig.cleanupTimeoutMs).toBeGreaterThan(0);
    });

    it('should have valid cron expression format', () => {
      // Basic validation: should have 5 parts (minute hour day month weekday)
      const cronParts = cleanupConfig.scheduledCleanupCron.split(' ');
      expect(cronParts).toHaveLength(5);
    });
  });

  describe('Type Safety', () => {
    it('should export cleanupConfig as const', () => {
      // TypeScript will enforce this at compile time
      // This test just verifies the values are accessible
      expect(cleanupConfig).toBeDefined();
      expect(typeof cleanupConfig.defaultArticlesPerFeed).toBe('number');
      expect(typeof cleanupConfig.defaultUnreadAgeDays).toBe('number');
      expect(typeof cleanupConfig.minArticlesPerFeed).toBe('number');
      expect(typeof cleanupConfig.maxArticlesPerFeed).toBe('number');
      expect(typeof cleanupConfig.minUnreadAgeDays).toBe('number');
      expect(typeof cleanupConfig.maxUnreadAgeDays).toBe('number');
      expect(typeof cleanupConfig.deleteBatchSize).toBe('number');
      expect(typeof cleanupConfig.cleanupTimeoutMs).toBe('number');
      expect(typeof cleanupConfig.scheduledCleanupCron).toBe('string');
    });
  });
});
