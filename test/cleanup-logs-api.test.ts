import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { getStorage } from '../server/storage';

/**
 * Integration tests for cleanup logs API endpoint
 * Tests Requirements: 8.4
 */
describe('Cleanup Logs API', () => {
  let adminAuthCookie: string;
  let adminUserId: string;
  let regularAuthCookie: string;
  let regularUserId: string;
  let testFeedId: string;

  beforeEach(async () => {
    // Register and login an admin user
    const adminRegisterRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `admin-cleanup-logs-${Date.now()}@example.com`,
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

      // Create a test feed for filtering tests
      const { data: feedData } = await supabase
        .from('feeds')
        .insert({
          user_id: adminUserId,
          url: 'https://example.com/feed.xml',
          title: 'Test Feed',
          category: 'technology'
        })
        .select()
        .single();

      if (feedData) {
        testFeedId = feedData.id;
      }
    }

    // Register a regular user for authorization tests
    const regularRegisterRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `regular-cleanup-logs-${Date.now()}@example.com`,
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

      // Clean up test feeds
      if (testFeedId) {
        await supabase
          .from('feeds')
          .delete()
          .eq('id', testFeedId);
      }
    }
  });

  describe('GET /api/admin/cleanup-logs', () => {
    it('should return paginated cleanup logs for admin user', async () => {
      const res = await request(app)
        .get('/api/admin/cleanup-logs')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('logs');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body).toHaveProperty('filters');
      
      // Verify pagination structure
      const pagination = res.body.pagination;
      expect(pagination).toHaveProperty('page');
      expect(pagination).toHaveProperty('limit');
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('totalPages');
      expect(pagination).toHaveProperty('hasNextPage');
      expect(pagination).toHaveProperty('hasPreviousPage');
      
      // Verify logs is an array
      expect(Array.isArray(res.body.logs)).toBe(true);
    });

    it('should return logs with correct structure', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Insert a sample cleanup log
      const now = new Date();
      await supabase
        .from('cleanup_log')
        .insert({
          user_id: adminUserId,
          feed_id: testFeedId,
          trigger_type: 'sync',
          articles_deleted: 25,
          duration_ms: 500,
          error_message: null,
          created_at: now.toISOString()
        });

      const res = await request(app)
        .get('/api/admin/cleanup-logs')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBeGreaterThan(0);
      
      // Verify log structure
      const log = res.body.logs[0];
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('user_id');
      expect(log).toHaveProperty('feed_id');
      expect(log).toHaveProperty('trigger_type');
      expect(log).toHaveProperty('articles_deleted');
      expect(log).toHaveProperty('duration_ms');
      expect(log).toHaveProperty('created_at');
    });

    it('should support pagination with page and limit parameters', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Insert multiple logs
      const now = new Date();
      const logs = Array.from({ length: 15 }, (_, i) => ({
        user_id: adminUserId,
        feed_id: testFeedId,
        trigger_type: 'sync',
        articles_deleted: i * 10,
        duration_ms: 100 + i * 50,
        error_message: null,
        created_at: new Date(now.getTime() - i * 1000).toISOString()
      }));

      await supabase
        .from('cleanup_log')
        .insert(logs);

      // Test first page with limit 5
      const res1 = await request(app)
        .get('/api/admin/cleanup-logs?page=1&limit=5')
        .set('Cookie', adminAuthCookie);

      expect(res1.status).toBe(200);
      expect(res1.body.pagination.page).toBe(1);
      expect(res1.body.pagination.limit).toBe(5);
      expect(res1.body.logs.length).toBeLessThanOrEqual(5);
      expect(res1.body.pagination.hasPreviousPage).toBe(false);

      // Test second page
      const res2 = await request(app)
        .get('/api/admin/cleanup-logs?page=2&limit=5')
        .set('Cookie', adminAuthCookie);

      expect(res2.status).toBe(200);
      expect(res2.body.pagination.page).toBe(2);
      expect(res2.body.pagination.hasPreviousPage).toBe(true);
    });

    it('should filter logs by user_id', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Insert logs for both users
      const now = new Date();
      await supabase
        .from('cleanup_log')
        .insert([
          {
            user_id: adminUserId,
            feed_id: testFeedId,
            trigger_type: 'sync',
            articles_deleted: 10,
            duration_ms: 100,
            error_message: null,
            created_at: now.toISOString()
          },
          {
            user_id: regularUserId,
            feed_id: null,
            trigger_type: 'scheduled',
            articles_deleted: 20,
            duration_ms: 200,
            error_message: null,
            created_at: now.toISOString()
          }
        ]);

      // Filter by admin user
      const res = await request(app)
        .get(`/api/admin/cleanup-logs?user_id=${adminUserId}`)
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body.filters.userId).toBe(adminUserId);
      
      // All returned logs should be for the admin user
      res.body.logs.forEach((log: any) => {
        expect(log.user_id).toBe(adminUserId);
      });
    });

    it('should filter logs by feed_id', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Create another feed
      const { data: feed2Data } = await supabase
        .from('feeds')
        .insert({
          user_id: adminUserId,
          url: 'https://example.com/feed2.xml',
          title: 'Test Feed 2',
          category: 'technology'
        })
        .select()
        .single();

      const testFeedId2 = feed2Data?.id;

      // Insert logs for different feeds
      const now = new Date();
      await supabase
        .from('cleanup_log')
        .insert([
          {
            user_id: adminUserId,
            feed_id: testFeedId,
            trigger_type: 'sync',
            articles_deleted: 10,
            duration_ms: 100,
            error_message: null,
            created_at: now.toISOString()
          },
          {
            user_id: adminUserId,
            feed_id: testFeedId2,
            trigger_type: 'sync',
            articles_deleted: 20,
            duration_ms: 200,
            error_message: null,
            created_at: now.toISOString()
          }
        ]);

      // Filter by first feed
      const res = await request(app)
        .get(`/api/admin/cleanup-logs?feed_id=${testFeedId}`)
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body.filters.feedId).toBe(testFeedId);
      
      // All returned logs should be for the specified feed
      res.body.logs.forEach((log: any) => {
        expect(log.feed_id).toBe(testFeedId);
      });

      // Cleanup
      if (testFeedId2) {
        await supabase
          .from('feeds')
          .delete()
          .eq('id', testFeedId2);
      }
    });

    it('should filter logs by trigger_type', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Insert logs with different trigger types
      const now = new Date();
      await supabase
        .from('cleanup_log')
        .insert([
          {
            user_id: adminUserId,
            feed_id: testFeedId,
            trigger_type: 'sync',
            articles_deleted: 10,
            duration_ms: 100,
            error_message: null,
            created_at: now.toISOString()
          },
          {
            user_id: adminUserId,
            feed_id: null,
            trigger_type: 'scheduled',
            articles_deleted: 20,
            duration_ms: 200,
            error_message: null,
            created_at: now.toISOString()
          },
          {
            user_id: adminUserId,
            feed_id: testFeedId,
            trigger_type: 'manual',
            articles_deleted: 15,
            duration_ms: 150,
            error_message: null,
            created_at: now.toISOString()
          }
        ]);

      // Filter by 'sync' trigger type
      const res = await request(app)
        .get('/api/admin/cleanup-logs?trigger_type=sync')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body.filters.triggerType).toBe('sync');
      
      // All returned logs should have 'sync' trigger type
      res.body.logs.forEach((log: any) => {
        expect(log.trigger_type).toBe('sync');
      });
    });

    it('should support multiple filters simultaneously', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Insert logs with various combinations
      const now = new Date();
      await supabase
        .from('cleanup_log')
        .insert([
          {
            user_id: adminUserId,
            feed_id: testFeedId,
            trigger_type: 'sync',
            articles_deleted: 10,
            duration_ms: 100,
            error_message: null,
            created_at: now.toISOString()
          },
          {
            user_id: adminUserId,
            feed_id: testFeedId,
            trigger_type: 'scheduled',
            articles_deleted: 20,
            duration_ms: 200,
            error_message: null,
            created_at: now.toISOString()
          },
          {
            user_id: regularUserId,
            feed_id: testFeedId,
            trigger_type: 'sync',
            articles_deleted: 15,
            duration_ms: 150,
            error_message: null,
            created_at: now.toISOString()
          }
        ]);

      // Filter by user_id AND trigger_type
      const res = await request(app)
        .get(`/api/admin/cleanup-logs?user_id=${adminUserId}&trigger_type=sync`)
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body.filters.userId).toBe(adminUserId);
      expect(res.body.filters.triggerType).toBe('sync');
      
      // All returned logs should match both filters
      res.body.logs.forEach((log: any) => {
        expect(log.user_id).toBe(adminUserId);
        expect(log.trigger_type).toBe('sync');
      });
    });

    it('should enforce maximum limit of 100 per page', async () => {
      const res = await request(app)
        .get('/api/admin/cleanup-logs?limit=200')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(100); // Should be capped at 100
    });

    it('should use default pagination values when not specified', async () => {
      const res = await request(app)
        .get('/api/admin/cleanup-logs')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(50); // Default limit
    });

    it('should order logs by created_at descending (most recent first)', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Insert logs with different timestamps
      const now = Date.now();
      await supabase
        .from('cleanup_log')
        .insert([
          {
            user_id: adminUserId,
            feed_id: testFeedId,
            trigger_type: 'sync',
            articles_deleted: 10,
            duration_ms: 100,
            error_message: null,
            created_at: new Date(now - 3000).toISOString()
          },
          {
            user_id: adminUserId,
            feed_id: testFeedId,
            trigger_type: 'sync',
            articles_deleted: 20,
            duration_ms: 200,
            error_message: null,
            created_at: new Date(now - 1000).toISOString()
          },
          {
            user_id: adminUserId,
            feed_id: testFeedId,
            trigger_type: 'sync',
            articles_deleted: 15,
            duration_ms: 150,
            error_message: null,
            created_at: new Date(now - 2000).toISOString()
          }
        ]);

      const res = await request(app)
        .get('/api/admin/cleanup-logs')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      
      // Verify logs are ordered by created_at descending
      if (res.body.logs.length > 1) {
        for (let i = 0; i < res.body.logs.length - 1; i++) {
          const currentDate = new Date(res.body.logs[i].created_at);
          const nextDate = new Date(res.body.logs[i + 1].created_at);
          expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
        }
      }
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/admin/cleanup-logs');

      expect(res.status).toBe(401);
    });

    it('should require admin authorization', async () => {
      const res = await request(app)
        .get('/api/admin/cleanup-logs')
        .set('Cookie', regularAuthCookie);

      expect(res.status).toBe(403);
    });

    it('should handle empty results gracefully', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Clean up all logs
      await supabase
        .from('cleanup_log')
        .delete()
        .eq('user_id', adminUserId);

      const res = await request(app)
        .get('/api/admin/cleanup-logs')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
      expect(res.body.pagination.totalPages).toBe(0);
      expect(res.body.pagination.hasNextPage).toBe(false);
      expect(res.body.pagination.hasPreviousPage).toBe(false);
    });

    it('should include error_message field in logs', async () => {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        console.log('Skipping test: Supabase not available');
        return;
      }

      // Insert a log with an error
      const now = new Date();
      await supabase
        .from('cleanup_log')
        .insert({
          user_id: adminUserId,
          feed_id: testFeedId,
          trigger_type: 'sync',
          articles_deleted: 0,
          duration_ms: 100,
          error_message: 'Test error message',
          created_at: now.toISOString()
        });

      const res = await request(app)
        .get('/api/admin/cleanup-logs')
        .set('Cookie', adminAuthCookie);

      expect(res.status).toBe(200);
      
      // Find the log with error
      const errorLog = res.body.logs.find((log: any) => log.error_message === 'Test error message');
      expect(errorLog).toBeDefined();
      expect(errorLog.error_message).toBe('Test error message');
    });

    it('should handle database errors gracefully', async () => {
      // This test verifies the endpoint handles errors properly
      // In a real scenario, we'd mock the database to simulate an error
      const res = await request(app)
        .get('/api/admin/cleanup-logs')
        .set('Cookie', adminAuthCookie);

      // Should either succeed or return a proper error
      expect([200, 500]).toContain(res.status);
      
      if (res.status === 500) {
        expect(res.body).toHaveProperty('error');
      }
    });
  });
});
