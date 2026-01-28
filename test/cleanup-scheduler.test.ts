import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CleanupScheduler } from '../server/cleanup-scheduler';
import { ArticleCleanupService } from '../server/article-cleanup-service';

describe('CleanupScheduler', () => {
  let cleanupScheduler: CleanupScheduler;
  let mockCleanupService: ArticleCleanupService;

  beforeEach(() => {
    // Create a mock cleanup service
    mockCleanupService = {
      cleanupAllUsers: vi.fn(),
    } as unknown as ArticleCleanupService;

    cleanupScheduler = new CleanupScheduler(mockCleanupService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('runScheduledCleanup', () => {
    it('should successfully run cleanup and return results', async () => {
      const mockResult = {
        usersProcessed: 10,
        totalDeleted: 500,
      };

      vi.mocked(mockCleanupService.cleanupAllUsers).mockResolvedValue(mockResult);

      const result = await cleanupScheduler.runScheduledCleanup();

      expect(result.usersProcessed).toBe(10);
      expect(result.totalDeleted).toBe(500);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockCleanupService.cleanupAllUsers).toHaveBeenCalledTimes(1);
    });

    it('should prevent concurrent execution', async () => {
      const mockResult = {
        usersProcessed: 5,
        totalDeleted: 100,
      };

      // Mock a slow cleanup operation
      vi.mocked(mockCleanupService.cleanupAllUsers).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockResult), 100))
      );

      // Start first cleanup
      const firstCleanup = cleanupScheduler.runScheduledCleanup();

      // Try to start second cleanup while first is running
      const secondCleanup = await cleanupScheduler.runScheduledCleanup();

      // Second cleanup should return immediately with zero results
      expect(secondCleanup.usersProcessed).toBe(0);
      expect(secondCleanup.totalDeleted).toBe(0);
      expect(secondCleanup.durationMs).toBe(0);

      // Wait for first cleanup to complete
      const firstResult = await firstCleanup;
      expect(firstResult.usersProcessed).toBe(5);
      expect(firstResult.totalDeleted).toBe(100);

      // cleanupAllUsers should only be called once (by first cleanup)
      expect(mockCleanupService.cleanupAllUsers).toHaveBeenCalledTimes(1);
    });

    it('should release lock after successful cleanup', async () => {
      const mockResult = {
        usersProcessed: 3,
        totalDeleted: 50,
      };

      vi.mocked(mockCleanupService.cleanupAllUsers).mockResolvedValue(mockResult);

      // Run first cleanup
      const firstResult = await cleanupScheduler.runScheduledCleanup();
      expect(firstResult.usersProcessed).toBe(3);

      // Run second cleanup after first completes
      const secondResult = await cleanupScheduler.runScheduledCleanup();
      expect(secondResult.usersProcessed).toBe(3);

      // Both cleanups should succeed
      expect(mockCleanupService.cleanupAllUsers).toHaveBeenCalledTimes(2);
    });

    it('should release lock even when cleanup fails', async () => {
      vi.mocked(mockCleanupService.cleanupAllUsers).mockRejectedValue(
        new Error('Database error')
      );

      // First cleanup should fail
      await expect(cleanupScheduler.runScheduledCleanup()).rejects.toThrow('Database error');

      // Second cleanup should be able to run (lock was released)
      vi.mocked(mockCleanupService.cleanupAllUsers).mockResolvedValue({
        usersProcessed: 5,
        totalDeleted: 100,
      });

      const secondResult = await cleanupScheduler.runScheduledCleanup();
      expect(secondResult.usersProcessed).toBe(5);
      expect(secondResult.totalDeleted).toBe(100);

      // Both cleanups should have been attempted
      expect(mockCleanupService.cleanupAllUsers).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup errors and re-throw', async () => {
      const error = new Error('Cleanup failed');
      vi.mocked(mockCleanupService.cleanupAllUsers).mockRejectedValue(error);

      await expect(cleanupScheduler.runScheduledCleanup()).rejects.toThrow('Cleanup failed');
      expect(mockCleanupService.cleanupAllUsers).toHaveBeenCalledTimes(1);
    });

    it('should return zero results when no users are processed', async () => {
      const mockResult = {
        usersProcessed: 0,
        totalDeleted: 0,
      };

      vi.mocked(mockCleanupService.cleanupAllUsers).mockResolvedValue(mockResult);

      const result = await cleanupScheduler.runScheduledCleanup();

      expect(result.usersProcessed).toBe(0);
      expect(result.totalDeleted).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should track duration correctly', async () => {
      const mockResult = {
        usersProcessed: 10,
        totalDeleted: 500,
      };

      // Mock a cleanup that takes some time
      vi.mocked(mockCleanupService.cleanupAllUsers).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockResult), 50))
      );

      const result = await cleanupScheduler.runScheduledCleanup();

      expect(result.durationMs).toBeGreaterThanOrEqual(50);
      expect(result.durationMs).toBeLessThan(200); // Should complete quickly
    });

    it('should handle large numbers of users and articles', async () => {
      const mockResult = {
        usersProcessed: 1000,
        totalDeleted: 50000,
      };

      vi.mocked(mockCleanupService.cleanupAllUsers).mockResolvedValue(mockResult);

      const result = await cleanupScheduler.runScheduledCleanup();

      expect(result.usersProcessed).toBe(1000);
      expect(result.totalDeleted).toBe(50000);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Concurrent execution prevention', () => {
    it('should handle multiple concurrent attempts gracefully', async () => {
      const mockResult = {
        usersProcessed: 5,
        totalDeleted: 100,
      };

      // Mock a slow cleanup operation
      vi.mocked(mockCleanupService.cleanupAllUsers).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockResult), 100))
      );

      // Start multiple cleanups concurrently
      const cleanups = [
        cleanupScheduler.runScheduledCleanup(),
        cleanupScheduler.runScheduledCleanup(),
        cleanupScheduler.runScheduledCleanup(),
      ];

      const results = await Promise.all(cleanups);

      // Only one should have actually run
      const successfulCleanups = results.filter(r => r.usersProcessed > 0);
      const skippedCleanups = results.filter(r => r.usersProcessed === 0);

      expect(successfulCleanups).toHaveLength(1);
      expect(skippedCleanups).toHaveLength(2);
      expect(mockCleanupService.cleanupAllUsers).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should handle Error instances with message and stack', async () => {
      const error = new Error('Database connection failed');
      error.stack = 'Error: Database connection failed\n    at ...';
      
      vi.mocked(mockCleanupService.cleanupAllUsers).mockRejectedValue(error);

      await expect(cleanupScheduler.runScheduledCleanup()).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(mockCleanupService.cleanupAllUsers).mockRejectedValue('String error');

      await expect(cleanupScheduler.runScheduledCleanup()).rejects.toBe('String error');
    });
  });
});
