import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { getStorage } from '../server/storage';
import { cleanupConfig } from '../server/config';

/**
 * Integration tests for cleanup settings API endpoints
 * Tests Requirements: 5.1, 5.2, 5.3
 */
describe('Cleanup Settings API', () => {
  let authCookie: string;
  let userId: string;

  beforeEach(async () => {
    // Register and login a test user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `test-cleanup-${Date.now()}@example.com`,
        password: 'password123',
        display_name: 'Test User'
      });

    expect(registerRes.status).toBe(200);
    userId = registerRes.body.user.id;
    authCookie = registerRes.headers['set-cookie'];
  });

  afterEach(async () => {
    // Cleanup test data
    const storage = await getStorage();
    if (userId) {
      // Note: In a real test, we'd clean up the user
      // For now, we'll just let the in-memory storage reset
    }
  });

  describe('GET /api/users/cleanup-settings', () => {
    it('should return default cleanup settings for new user', async () => {
      const res = await request(app)
        .get('/api/users/cleanup-settings')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('settings');
      expect(res.body.settings).toEqual({
        articles_per_feed: cleanupConfig.defaultArticlesPerFeed,
        unread_article_age_days: cleanupConfig.defaultUnreadAgeDays,
        enable_auto_cleanup: true
      });
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/users/cleanup-settings');

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/users/cleanup-settings', () => {
    it('should update cleanup settings with valid values', async () => {
      const newSettings = {
        articles_per_feed: 150,
        unread_article_age_days: 45,
        enable_auto_cleanup: false
      };

      const res = await request(app)
        .put('/api/users/cleanup-settings')
        .set('Cookie', authCookie)
        .send(newSettings);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('settings');
      expect(res.body.settings).toEqual(newSettings);

      // Verify settings were persisted
      const getRes = await request(app)
        .get('/api/users/cleanup-settings')
        .set('Cookie', authCookie);

      expect(getRes.status).toBe(200);
      expect(getRes.body.settings).toEqual(newSettings);
    });

    it('should update partial settings', async () => {
      const partialSettings = {
        articles_per_feed: 200
      };

      const res = await request(app)
        .put('/api/users/cleanup-settings')
        .set('Cookie', authCookie)
        .send(partialSettings);

      expect(res.status).toBe(200);
      expect(res.body.settings.articles_per_feed).toBe(200);
      expect(res.body.settings.unread_article_age_days).toBe(cleanupConfig.defaultUnreadAgeDays);
      expect(res.body.settings.enable_auto_cleanup).toBe(true);
    });

    it('should reject articles_per_feed below minimum', async () => {
      const invalidSettings = {
        articles_per_feed: 49 // Below minimum of 50
      };

      const res = await request(app)
        .put('/api/users/cleanup-settings')
        .set('Cookie', authCookie)
        .send(invalidSettings);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
      expect(res.body).toHaveProperty('details');
    });

    it('should reject articles_per_feed above maximum', async () => {
      const invalidSettings = {
        articles_per_feed: 501 // Above maximum of 500
      };

      const res = await request(app)
        .put('/api/users/cleanup-settings')
        .set('Cookie', authCookie)
        .send(invalidSettings);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
    });

    it('should reject unread_article_age_days below minimum', async () => {
      const invalidSettings = {
        unread_article_age_days: 6 // Below minimum of 7
      };

      const res = await request(app)
        .put('/api/users/cleanup-settings')
        .set('Cookie', authCookie)
        .send(invalidSettings);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
    });

    it('should reject unread_article_age_days above maximum', async () => {
      const invalidSettings = {
        unread_article_age_days: 91 // Above maximum of 90
      };

      const res = await request(app)
        .put('/api/users/cleanup-settings')
        .set('Cookie', authCookie)
        .send(invalidSettings);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
    });

    it('should accept boundary values', async () => {
      // Test minimum values
      const minSettings = {
        articles_per_feed: cleanupConfig.minArticlesPerFeed,
        unread_article_age_days: cleanupConfig.minUnreadAgeDays
      };

      const minRes = await request(app)
        .put('/api/users/cleanup-settings')
        .set('Cookie', authCookie)
        .send(minSettings);

      expect(minRes.status).toBe(200);
      expect(minRes.body.settings.articles_per_feed).toBe(cleanupConfig.minArticlesPerFeed);
      expect(minRes.body.settings.unread_article_age_days).toBe(cleanupConfig.minUnreadAgeDays);

      // Test maximum values
      const maxSettings = {
        articles_per_feed: cleanupConfig.maxArticlesPerFeed,
        unread_article_age_days: cleanupConfig.maxUnreadAgeDays
      };

      const maxRes = await request(app)
        .put('/api/users/cleanup-settings')
        .set('Cookie', authCookie)
        .send(maxSettings);

      expect(maxRes.status).toBe(200);
      expect(maxRes.body.settings.articles_per_feed).toBe(cleanupConfig.maxArticlesPerFeed);
      expect(maxRes.body.settings.unread_article_age_days).toBe(cleanupConfig.maxUnreadAgeDays);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .put('/api/users/cleanup-settings')
        .send({ articles_per_feed: 100 });

      expect(res.status).toBe(401);
    });

    it('should reject non-integer values', async () => {
      const invalidSettings = {
        articles_per_feed: 100.5 // Must be integer
      };

      const res = await request(app)
        .put('/api/users/cleanup-settings')
        .set('Cookie', authCookie)
        .send(invalidSettings);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
    });

    it('should reject invalid enable_auto_cleanup type', async () => {
      const invalidSettings = {
        enable_auto_cleanup: 'yes' // Must be boolean
      };

      const res = await request(app)
        .put('/api/users/cleanup-settings')
        .set('Cookie', authCookie)
        .send(invalidSettings);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
    });
  });
});
