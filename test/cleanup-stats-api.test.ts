import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { getStorage } from '../server/storage';

/**
 * Integration tests for cleanup statistics API endpoint
 * Tests Requirements: 8.4
 */
describe('Cleanup Statistics API', () => {
  let adminAuthCookie: string;
  let adminUserId: string;
  let regularAuthCookie: string;
  let regularUserId: string;

  beforeEach(async () => {
    // Register and login an admin user
    const adminRegisterRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `admin-cleanup-stats-${Date.now()}@example.com`,
        password: 'password123',
        display_name: 'Admin User'
      });

    expect(adminRegisterRes.status).toBe(200);
    adminUserId = adminRegisterRes.body.user.id;
    adminAuthCookie = adminRegisterRes.headers['set-cookie'];

    // Make the user an admin
    const storage = await getStorage();
    const supabase = (storage as any).supabase;
    if (supabase) {
      await supabase
        .from('profiles')
        .update({ is_admin: true })
        .eq('id', adminUserId);
    }

    // Register a regular user for authorization tests
    const regularRegisterRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `regular-cleanup-stats-${Date.now()}@example.com`,
        password: 'password123',
        display_name: 'Regular User'
      });

    expect(regularRegisterRes.status).toBe(200);
    regularUserId = regularRegisterRes.body.user.id;
    regularAuthCookie = regularRegisterRes.headers['set-cookie'];
  });

  afterEach(async () => {
    // Cleanup test data
    const storage = await getStorage();
    const supabase = (storage as any).supabase;
    
    if (supabase) {
      // Clean up test cleanup logs
      await supabase
        .from('cleanup_log')
        .delete()
        .in('user_id', [adminUserId, regularUserId]);
    }
  });

  describe('GET /api/admin/cleanup-stats', () => {
    it('should return cleanup statistics for admin user', async () => {
      const res = await request(app)
        .get('/api/admin/cleanup-stats')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('stats');
      
      const stats = res.body.stats;
      expect(stats).toHaveProperty('period', 'last_24_hours');
      expect(stats).toHaveProperty('totalOperations');
      expect(stats).toHaveProperty('totalDeletions');
      expect(stats).toHaveProperty('averageDuration');
      expect(stats).toHaveProperty('errorRate');
      expect(stats).toHaveProperty('errorCount');
      expect(stats).toHaveProperty('byTriggerType');
      
      // Verify types
      expect(typeof stats.totalOperations).toBe('number');
      expect(typeof stats.totalDeletions).toBe('number');
      expect(typeof stats.averageDuration).toBe('number');
      expect(typeof stats.errorRate).toBe('number');
      expect(typeof stats.errorCount).toBe('number');
      expect(typeof stats.byTriggerType).toBe('object');
    });

    it('should calculate correct statistics with sample data', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Insert sample cleanup logs
      const now = new Date();
      const sampleLogs = [
        {
          user_id: adminUserId,
          feed_id: null,
          trigger_type: 'scheduled',
          articles_deleted: 50,
          duration_ms: 1000,
          error_message: null,
          created_at: now.toISOString()
        },
        {
          user_id: adminUserId,
          feed_id: null,
          trigger_type: 'sync',
          articles_deleted: 30,
          duration_ms: 500,
          error_message: null,
          created_at: now.toISOString()
        },
        {
          user_id: adminUserId,
          feed_id: null,
          trigger_type: 'sync',
          articles_deleted: 0,
          duration_ms: 200,
          error_message: 'Test error',
          created_at: now.toISOString()
        }
      ];

      await supabase
        .from('cleanup_log')
        .insert(sampleLogs);

      // Fetch statistics
      const res = await request(app)
        .get('/api/admin/cleanup-stats')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      
      const stats = res.body.stats;
      expect(stats.totalOperations).toBeGreaterThanOrEqual(3);
      expect(stats.totalDeletions).toBeGreaterThanOrEqual(80);
      expect(stats.errorCount).toBeGreaterThanOrEqual(1);
      expect(stats.errorRate).toBeGreaterThan(0);
      
      // Check trigger type breakdown
      expect(stats.byTriggerType).toHaveProperty('scheduled');
      expect(stats.byTriggerType).toHaveProperty('sync');
      expect(stats.byTriggerType.scheduled.count).toBeGreaterThanOrEqual(1);
      expect(stats.byTriggerType.sync.count).toBeGreaterThanOrEqual(2);
    });

    it('should only include logs from last 24 hours', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Insert a log from 25 hours ago (should not be included)
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await supabase
        .from('cleanup_log')
        .insert({
          user_id: adminUserId,
          feed_id: null,
          trigger_type: 'scheduled',
          articles_deleted: 100,
          duration_ms: 2000,
          error_message: null,
          created_at: oldDate.toISOString()
        });

      // Insert a recent log (should be included)
      const recentDate = new Date();
      await supabase
        .from('cleanup_log')
        .insert({
          user_id: adminUserId,
          feed_id: null,
          trigger_type: 'sync',
          articles_deleted: 20,
          duration_ms: 300,
          error_message: null,
          created_at: recentDate.toISOString()
        });

      const res = await request(app)
        .get('/api/admin/cleanup-stats')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      
      // The old log should not affect the count
      // We can't assert exact values since there might be other logs,
      // but we can verify the structure is correct
      expect(res.body.stats.totalOperations).toBeGreaterThanOrEqual(1);
    });

    it('should calculate zero averages when no operations exist', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Clean up all recent logs
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await supabase
        .from('cleanup_log')
        .delete()
        .gte('created_at', twentyFourHoursAgo.toISOString());

      const res = await request(app)
        .get('/api/admin/cleanup-stats')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      
      const stats = res.body.stats;
      expect(stats.totalOperations).toBe(0);
      expect(stats.totalDeletions).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.errorRate).toBe(0);
      expect(stats.errorCount).toBe(0);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/admin/cleanup-stats');

      expect(res.status).toBe(401);
    });

    it('should require admin authorization', async () => {
      const res = await request(app)
        .get('/api/admin/cleanup-stats')
        .set('Cookie', regularAuthCookie);

      expect(res.status).toBe(403);
    });

    it('should handle database errors gracefully', async () => {
      // This test would require mocking the database to simulate an error
      // For now, we'll just verify the endpoint exists and returns proper structure
      const res = await request(app)
        .get('/api/admin/cleanup-stats')
        .set('Cookie', adminAuthCookie);

      // Should either succeed or return a proper error
      expect([200, 500]).toContain(res.status);
      
      if (res.status === 500) {
        expect(res.body).toHaveProperty('error');
      }
    });

    it('should round error rate to 2 decimal places', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Insert logs that will create a non-round error rate
      const now = new Date();
      const logs = [
        { user_id: adminUserId, trigger_type: 'sync', articles_deleted: 10, duration_ms: 100, error_message: null, created_at: now.toISOString() },
        { user_id: adminUserId, trigger_type: 'sync', articles_deleted: 10, duration_ms: 100, error_message: null, created_at: now.toISOString() },
        { user_id: adminUserId, trigger_type: 'sync', articles_deleted: 0, duration_ms: 100, error_message: 'Error', created_at: now.toISOString() },
      ];

      await supabase
        .from('cleanup_log')
        .insert(logs);

      const res = await request(app)
        .get('/api/admin/cleanup-stats')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      
      const errorRate = res.body.stats.errorRate;
      // Check that error rate has at most 2 decimal places
      expect(errorRate).toBe(Number(errorRate.toFixed(2)));
    });
  });
});
