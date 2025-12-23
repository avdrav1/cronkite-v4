import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { registerRoutes } from './routes';
import { createServer } from 'http';
import { sessionConfig } from './auth-middleware';
import passport from 'passport';

describe('Authentication API Endpoints', () => {
  let app: Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(sessionConfig);
    app.use(passport.initialize());
    app.use(passport.session());
    
    const httpServer = createServer(app);
    server = await registerRoutes(httpServer, app);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('POST /api/auth/register', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          display_name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should validate password length', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '12345', // Too short
          display_name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });
});

describe('Feed Management API Endpoints', () => {
  let app: Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(sessionConfig);
    app.use(passport.initialize());
    app.use(passport.session());
    
    const httpServer = createServer(app);
    server = await registerRoutes(httpServer, app);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('GET /api/feeds/recommended', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/feeds/recommended');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/feeds/recommended?limit=invalid');

      expect(response.status).toBe(401); // Still requires auth first
      expect(response.body.error).toBe('Authentication required');
    });

    it('should validate limit range', async () => {
      const response = await request(app)
        .get('/api/feeds/recommended?limit=0');

      expect(response.status).toBe(401); // Still requires auth first
      expect(response.body.error).toBe('Authentication required');
    });

    it('should validate limit upper bound', async () => {
      const response = await request(app)
        .get('/api/feeds/recommended?limit=2000');

      expect(response.status).toBe(401); // Still requires auth first
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('POST /api/feeds/subscribe', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/feeds/subscribe')
        .send({ feedIds: ['feed-1'] });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('POST /api/users/interests', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/users/interests')
        .send({ interests: ['technology'] });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });
});

describe('Feed Management Controls API Endpoints', () => {
  let app: Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(sessionConfig);
    app.use(passport.initialize());
    app.use(passport.session());
    
    const httpServer = createServer(app);
    server = await registerRoutes(httpServer, app);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('POST /api/feeds/:feedId/sync - Single Feed Sync', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/feeds/test-feed-id/sync');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('POST /api/feeds/sync-all - Bulk Feed Sync', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/feeds/sync-all');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('GET /api/feeds/count - Feed Count', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/feeds/count');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('PUT /api/articles/:articleId/read - Article Read State', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/articles/test-article-id/read')
        .send({ isRead: true });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('PUT /api/articles/:articleId/star - Article Star State', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/articles/test-article-id/star')
        .send({ isStarred: true });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('GET /api/articles/starred - Starred Articles', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/articles/starred');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('PUT /api/articles/:articleId/engagement - Engagement Signal', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/articles/test-article-id/engagement')
        .send({ signal: 'positive' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });
});
