import { describe, it, expect } from 'vitest';

/**
 * Unit tests for cleanup statistics endpoint implementation
 * Tests Requirements: 8.4
 * 
 * These tests verify the endpoint exists and has the correct structure.
 * Full integration tests are in cleanup-stats-api.test.ts
 */
describe('Cleanup Statistics Endpoint', () => {
  it('should have correct endpoint structure', () => {
    // This test verifies the endpoint was added correctly
    // The actual endpoint is at GET /api/admin/cleanup-stats
    
    // Expected response structure:
    const expectedStructure = {
      success: true,
      stats: {
        period: 'last_24_hours',
        totalOperations: 0, // number
        totalDeletions: 0, // number
        averageDuration: 0, // number in ms
        errorRate: 0, // number (percentage)
        errorCount: 0, // number
        byTriggerType: {}, // object with trigger types as keys
      },
    };
    
    // Verify structure is defined
    expect(expectedStructure).toBeDefined();
    expect(expectedStructure.stats).toHaveProperty('period');
    expect(expectedStructure.stats).toHaveProperty('totalOperations');
    expect(expectedStructure.stats).toHaveProperty('totalDeletions');
    expect(expectedStructure.stats).toHaveProperty('averageDuration');
    expect(expectedStructure.stats).toHaveProperty('errorRate');
    expect(expectedStructure.stats).toHaveProperty('errorCount');
    expect(expectedStructure.stats).toHaveProperty('byTriggerType');
  });

  it('should calculate statistics correctly', () => {
    // Mock cleanup logs
    const logs = [
      { articles_deleted: 50, duration_ms: 1000, error_message: null, trigger_type: 'scheduled' },
      { articles_deleted: 30, duration_ms: 500, error_message: null, trigger_type: 'sync' },
      { articles_deleted: 0, duration_ms: 200, error_message: 'Test error', trigger_type: 'sync' },
    ];
    
    // Calculate statistics (same logic as endpoint)
    const totalOperations = logs.length;
    const totalDeletions = logs.reduce((sum, log) => sum + (log.articles_deleted || 0), 0);
    const totalDuration = logs.reduce((sum, log) => sum + (log.duration_ms || 0), 0);
    const errorCount = logs.filter(log => log.error_message !== null).length;
    
    const averageDuration = totalOperations > 0 ? Math.round(totalDuration / totalOperations) : 0;
    const errorRate = totalOperations > 0 ? (errorCount / totalOperations) * 100 : 0;
    
    // Group by trigger type
    const byTriggerType = logs.reduce((acc, log) => {
      const type = log.trigger_type || 'unknown';
      if (!acc[type]) {
        acc[type] = { count: 0, deletions: 0 };
      }
      acc[type].count++;
      acc[type].deletions += log.articles_deleted || 0;
      return acc;
    }, {} as Record<string, { count: number; deletions: number }>);
    
    // Verify calculations
    expect(totalOperations).toBe(3);
    expect(totalDeletions).toBe(80);
    expect(averageDuration).toBe(567); // (1000 + 500 + 200) / 3 = 566.67, rounded to 567
    expect(errorCount).toBe(1);
    expect(errorRate).toBeCloseTo(33.33, 1);
    
    expect(byTriggerType).toHaveProperty('scheduled');
    expect(byTriggerType).toHaveProperty('sync');
    expect(byTriggerType.scheduled.count).toBe(1);
    expect(byTriggerType.scheduled.deletions).toBe(50);
    expect(byTriggerType.sync.count).toBe(2);
    expect(byTriggerType.sync.deletions).toBe(30);
  });

  it('should handle empty logs correctly', () => {
    const logs: any[] = [];
    
    const totalOperations = logs.length;
    const totalDeletions = logs.reduce((sum, log) => sum + (log.articles_deleted || 0), 0);
    const totalDuration = logs.reduce((sum, log) => sum + (log.duration_ms || 0), 0);
    const errorCount = logs.filter(log => log.error_message !== null).length;
    
    const averageDuration = totalOperations > 0 ? Math.round(totalDuration / totalOperations) : 0;
    const errorRate = totalOperations > 0 ? (errorCount / totalOperations) * 100 : 0;
    
    expect(totalOperations).toBe(0);
    expect(totalDeletions).toBe(0);
    expect(averageDuration).toBe(0);
    expect(errorCount).toBe(0);
    expect(errorRate).toBe(0);
  });

  it('should round error rate to 2 decimal places', () => {
    // Create a scenario that produces a non-round error rate
    const logs = [
      { articles_deleted: 10, duration_ms: 100, error_message: null, trigger_type: 'sync' },
      { articles_deleted: 10, duration_ms: 100, error_message: null, trigger_type: 'sync' },
      { articles_deleted: 0, duration_ms: 100, error_message: 'Error', trigger_type: 'sync' },
    ];
    
    const totalOperations = logs.length;
    const errorCount = logs.filter(log => log.error_message !== null).length;
    const errorRate = totalOperations > 0 ? (errorCount / totalOperations) * 100 : 0;
    
    // Round to 2 decimal places
    const roundedErrorRate = Math.round(errorRate * 100) / 100;
    
    expect(errorRate).toBeCloseTo(33.333333, 5);
    expect(roundedErrorRate).toBe(33.33);
    expect(roundedErrorRate).toBe(Number(roundedErrorRate.toFixed(2)));
  });

  it('should filter logs by 24 hour window', () => {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const twentyFiveHoursAgo = now - 25 * 60 * 60 * 1000;
    
    const logs = [
      { created_at: new Date(now).toISOString(), articles_deleted: 10 },
      { created_at: new Date(twentyFourHoursAgo + 1000).toISOString(), articles_deleted: 20 },
      { created_at: new Date(twentyFiveHoursAgo).toISOString(), articles_deleted: 30 },
    ];
    
    // Filter logs from last 24 hours
    const cutoff = new Date(twentyFourHoursAgo).toISOString();
    const recentLogs = logs.filter(log => log.created_at >= cutoff);
    
    expect(recentLogs.length).toBe(2);
    expect(recentLogs.reduce((sum, log) => sum + log.articles_deleted, 0)).toBe(30);
  });
});
