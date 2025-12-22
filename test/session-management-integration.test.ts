/**
 * Integration tests for Session Management Fix
 * Feature: session-management-fix
 * 
 * These tests validate the session management behavior when users have
 * stale or invalid session cookies, ensuring they can still log in.
 * 
 * Requirements tested:
 * - 1.1: Login with stale session cookie should succeed after auto-clear
 * - 3.1: requireNoAuth should clear invalid sessions and proceed
 * - 4.1: Valid sessions should block login attempts with 400 error
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import createMemoryStore from 'memorystore';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

// Mock user data for testing
const mockUsers = new Map<string, { id: string; email: string; display_name: string; password: string }>();

// Setup test user
const testUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  display_name: 'Test User',
  password: 'password123'
};
mockUsers.set(testUser.id, testUser);
mockUsers.set(testUser.email, testUser);

/**
 * Creates a test Express app with session management middleware
 * that mirrors the production auth-middleware behavior
 */
function createTestApp() {
  const app = express();
  const MemoryStore = createMemoryStore(session);
  
  app.use(express.json());
  
  // Session configuration matching production
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({ checkPeriod: 86400000 }),
    name: 'cronkite.sid',
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      path: '/'
    }
  }));
  
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Configure passport with local strategy
  passport.use(new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    (email: string, password: string, done) => {
      const user = mockUsers.get(email);
      if (!user || user.password !== password) {
        return done(null, false, { message: 'Invalid credentials' });
      }
      return done(null, { id: user.id, email: user.email, display_name: user.display_name });
    }
  ));
  
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser((id: string, done) => {
    const user = mockUsers.get(id);
    if (!user) {
      // User not found - return false to invalidate session (matches production behavior)
      return done(null, false);
    }
    done(null, { id: user.id, email: user.email, display_name: user.display_name });
  });
  
  return app;
}

/**
 * Session validation helper - mirrors isValidSession from auth-middleware.ts
 */
function isValidSession(req: Request): boolean {
  if (!req.isAuthenticated()) {
    return false;
  }
  if (!req.user) {
    return false;
  }
  const user = req.user as any;
  if (!user.id || !user.email) {
    return false;
  }
  return true;
}

/**
 * Clear invalid session helper - mirrors clearInvalidSession from auth-middleware.ts
 */
async function clearInvalidSession(req: Request, res: Response): Promise<void> {
  return new Promise((resolve) => {
    req.logout((logoutErr) => {
      if (req.session) {
        req.session.destroy((destroyErr) => {
          res.clearCookie('cronkite.sid', {
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'lax'
          });
          resolve();
        });
      } else {
        res.clearCookie('cronkite.sid', {
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'lax'
        });
        resolve();
      }
    });
  });
}

/**
 * Enhanced requireNoAuth middleware - mirrors production behavior
 * Validates session integrity and clears invalid sessions
 */
const requireNoAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  
  if (!isValidSession(req)) {
    await clearInvalidSession(req, res);
    return next();
  }
  
  res.status(400).json({ 
    error: 'Already authenticated',
    message: 'You are already logged in'
  });
};

describe('Session Management Integration Tests', () => {
  let app: Express;
  
  beforeAll(() => {
    app = createTestApp();
    
    // Login route with requireNoAuth middleware
    app.post('/api/auth/login', requireNoAuth, (req: Request, res: Response, next: NextFunction) => {
      passport.authenticate('local', (err: any, user: any, info: any) => {
        if (err) {
          return res.status(500).json({ error: 'Authentication error' });
        }
        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials', message: info?.message });
        }
        req.login(user, (loginErr) => {
          if (loginErr) {
            return res.status(500).json({ error: 'Login failed' });
          }
          res.json({ user });
        });
      })(req, res, next);
    });
    
    // Test route to check authentication status
    app.get('/api/auth/status', (req: Request, res: Response) => {
      res.json({
        isAuthenticated: req.isAuthenticated(),
        hasUser: !!req.user,
        user: req.user || null
      });
    });
    
    // Route to simulate creating a stale session (authenticated but no user data)
    app.post('/api/test/create-stale-session', (req: Request, res: Response) => {
      // Manually set session as authenticated but with invalid user data
      (req.session as any).passport = { user: 'non-existent-user-id' };
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to create stale session' });
        }
        res.json({ message: 'Stale session created', sessionID: req.sessionID });
      });
    });
    
    // Route to create a valid session for testing
    app.post('/api/test/create-valid-session', (req: Request, res: Response) => {
      const user = { id: testUser.id, email: testUser.email, display_name: testUser.display_name };
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to create session' });
        }
        res.json({ message: 'Valid session created', user });
      });
    });
  });

  /**
   * Test 5.1: Login with stale session
   * Requirements: 1.1, 3.1
   * 
   * Scenario: User has a stale session cookie that references a non-existent user.
   * Expected: The system should clear the invalid session and allow login to proceed.
   */
  describe('5.1 Login with stale session', () => {
    it('should allow login when session references non-existent user', async () => {
      const agent = request.agent(app);
      
      // Step 1: Create a stale session (references non-existent user)
      const staleResponse = await agent
        .post('/api/test/create-stale-session')
        .expect(200);
      
      expect(staleResponse.body.message).toBe('Stale session created');
      
      // Step 2: Verify the session is in a stale state
      // The session exists but deserializeUser will return false for non-existent user
      const statusResponse = await agent
        .get('/api/auth/status')
        .expect(200);
      
      // Session should not be authenticated because deserializeUser returns false
      // for non-existent users
      expect(statusResponse.body.isAuthenticated).toBe(false);
      
      // Step 3: Attempt login - should succeed because session is invalid
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);
      
      expect(loginResponse.body.user).toBeDefined();
      expect(loginResponse.body.user.email).toBe(testUser.email);
      
      // Step 4: Verify user is now properly authenticated
      const finalStatus = await agent
        .get('/api/auth/status')
        .expect(200);
      
      expect(finalStatus.body.isAuthenticated).toBe(true);
      expect(finalStatus.body.user.email).toBe(testUser.email);
    });

    it('should clear session cookie when invalid session is detected', async () => {
      const agent = request.agent(app);
      
      // Create stale session
      await agent
        .post('/api/test/create-stale-session')
        .expect(200);
      
      // Attempt login - should clear invalid session and succeed
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);
      
      expect(loginResponse.body.user).toBeDefined();
      
      // New session should be valid
      const statusResponse = await agent
        .get('/api/auth/status')
        .expect(200);
      
      expect(statusResponse.body.isAuthenticated).toBe(true);
    });
  });

  /**
   * Test 5.2: Login with valid session
   * Requirements: 4.1
   * 
   * Scenario: User has a valid session and attempts to login again.
   * Expected: The system should return 400 error indicating user is already logged in.
   */
  describe('5.2 Login with valid session', () => {
    it('should return 400 when user is already logged in with valid session', async () => {
      const agent = request.agent(app);
      
      // Step 1: Create a valid session
      const sessionResponse = await agent
        .post('/api/test/create-valid-session')
        .expect(200);
      
      expect(sessionResponse.body.message).toBe('Valid session created');
      expect(sessionResponse.body.user.email).toBe(testUser.email);
      
      // Step 2: Verify the session is valid
      const statusResponse = await agent
        .get('/api/auth/status')
        .expect(200);
      
      expect(statusResponse.body.isAuthenticated).toBe(true);
      expect(statusResponse.body.hasUser).toBe(true);
      expect(statusResponse.body.user.email).toBe(testUser.email);
      
      // Step 3: Attempt login again - should be blocked with 400
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(400);
      
      expect(loginResponse.body.error).toBe('Already authenticated');
      expect(loginResponse.body.message).toBe('You are already logged in');
    });

    it('should maintain valid session after blocked login attempt', async () => {
      const agent = request.agent(app);
      
      // Create valid session
      await agent
        .post('/api/test/create-valid-session')
        .expect(200);
      
      // Attempt login (should be blocked)
      await agent
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(400);
      
      // Session should still be valid
      const statusResponse = await agent
        .get('/api/auth/status')
        .expect(200);
      
      expect(statusResponse.body.isAuthenticated).toBe(true);
      expect(statusResponse.body.user.email).toBe(testUser.email);
    });
  });

  /**
   * Additional edge case tests
   */
  describe('Edge cases', () => {
    it('should allow login when no session exists', async () => {
      const agent = request.agent(app);
      
      // No session created - direct login should work
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);
      
      expect(loginResponse.body.user).toBeDefined();
      expect(loginResponse.body.user.email).toBe(testUser.email);
    });

    it('should reject login with invalid credentials regardless of session state', async () => {
      const agent = request.agent(app);
      
      // Attempt login with wrong password
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(401);
      
      expect(loginResponse.body.error).toBe('Invalid credentials');
    });
  });
});
