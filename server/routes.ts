import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { storage } from "./storage";
import { requireAuth, requireNoAuth, createSupabaseClient } from "./auth-middleware";
import { syncFeeds, syncFeed } from "./rss-sync";
import { 
  insertProfileSchema, 
  selectProfileSchema,
  insertUserSettingsSchema,
  selectUserSettingsSchema,
  insertUserInterestsSchema
} from "@shared/schema";
import { z } from "zod";

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(1)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const googleAuthSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional()
});

// User management validation schemas
const updateProfileSchema = z.object({
  display_name: z.string().min(1).optional(),
  avatar_url: z.string().url().nullable().optional(),
  timezone: z.string().optional(),
  region_code: z.string().nullable().optional()
});

const updateUserSettingsSchema = insertUserSettingsSchema.partial().omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true
});

const setUserInterestsSchema = z.object({
  interests: z.array(z.string()).min(1, "At least one interest must be selected")
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Authentication Routes
  
  // POST /api/auth/register - Email/password registration
  app.post('/api/auth/register', requireNoAuth, async (req: Request, res: Response) => {
    try {
      const { email, password, display_name } = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          error: 'User already exists',
          message: 'A user with this email already exists'
        });
      }
      
      // Create user with password
      const user = await storage.createUserWithPassword({
        email,
        display_name,
        avatar_url: null,
        timezone: "America/New_York",
        region_code: null,
        onboarding_completed: false
      }, password);
      
      // Log the user in
      req.login(user, (err) => {
        if (err) {
          console.log('Login error during registration:', err);
          return res.status(500).json({
            error: 'Login failed',
            message: 'User created but login failed'
          });
        }
        
        console.log('User logged in successfully during registration');
        console.log('Session after login:', req.session);
        console.log('User in session:', req.user);
        
        res.status(201).json({
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            onboarding_completed: user.onboarding_completed
          }
        });
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid input data',
          details: error.errors
        });
      }
      
      console.error('Registration error:', error);
      res.status(500).json({
        error: 'Registration failed',
        message: 'An error occurred during registration'
      });
    }
  });
  
  // POST /api/auth/login - Email/password login
  app.post('/api/auth/login', requireNoAuth, (req: Request, res: Response, next) => {
    try {
      loginSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid input data',
          details: error.errors
        });
      }
    }
    
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({
          error: 'Authentication error',
          message: 'An error occurred during authentication'
        });
      }
      
      if (!user) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: info?.message || 'Invalid email or password'
        });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({
            error: 'Login failed',
            message: 'An error occurred during login'
          });
        }
        
        res.json({
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            onboarding_completed: user.onboarding_completed
          }
        });
      });
    })(req, res, next);
  });
  
  // POST /api/auth/google - Google OAuth callback
  app.post('/api/auth/google', requireNoAuth, async (req: Request, res: Response) => {
    try {
      const { access_token } = googleAuthSchema.parse(req.body);
      
      const supabase = createSupabaseClient();
      
      // Exchange the access token for a Supabase session
      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token: req.body.refresh_token || ''
      });
      
      if (error || !data.user) {
        return res.status(400).json({
          error: 'Google authentication failed',
          message: error?.message || 'Invalid Google token'
        });
      }
      
      // Get or create user profile
      let user = await storage.getUser(data.user.id);
      
      if (!user) {
        user = await storage.createUser({
          id: data.user.id,
          email: data.user.email!,
          display_name: data.user.user_metadata?.full_name || data.user.email!.split('@')[0],
          avatar_url: data.user.user_metadata?.avatar_url || null,
          timezone: "America/New_York",
          region_code: null,
          onboarding_completed: false
        });
      }
      
      // Log the user in
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({
            error: 'Login failed',
            message: 'User authenticated but login failed'
          });
        }
        
        res.json({
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            onboarding_completed: user.onboarding_completed
          }
        });
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid input data',
          details: error.errors
        });
      }
      
      console.error('Google auth error:', error);
      res.status(500).json({
        error: 'Google authentication failed',
        message: 'An error occurred during Google authentication'
      });
    }
  });
  
  // GET /api/auth/me - Get current user profile
  app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
    const user = req.user!;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        timezone: user.timezone,
        region_code: user.region_code,
        onboarding_completed: user.onboarding_completed
      }
    });
  });
  
  // POST /api/auth/logout - User logout
  app.post('/api/auth/logout', requireAuth, (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({
          error: 'Logout failed',
          message: 'An error occurred during logout'
        });
      }
      
      res.json({
        message: 'Logged out successfully'
      });
    });
  });

  // User Management Routes
  
  // GET /api/users/profile - Get user profile
  app.get('/api/users/profile', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          timezone: user.timezone,
          region_code: user.region_code,
          onboarding_completed: user.onboarding_completed,
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: 'Failed to get profile',
        message: 'An error occurred while retrieving user profile'
      });
    }
  });
  
  // PUT /api/users/profile - Update user profile
  app.put('/api/users/profile', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const updates = updateProfileSchema.parse(req.body);
      
      const updatedUser = await storage.updateUser(userId, updates);
      
      res.json({
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          display_name: updatedUser.display_name,
          avatar_url: updatedUser.avatar_url,
          timezone: updatedUser.timezone,
          region_code: updatedUser.region_code,
          onboarding_completed: updatedUser.onboarding_completed,
          created_at: updatedUser.created_at,
          updated_at: updatedUser.updated_at
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid input data',
          details: error.errors
        });
      }
      
      console.error('Update profile error:', error);
      res.status(500).json({
        error: 'Failed to update profile',
        message: 'An error occurred while updating user profile'
      });
    }
  });
  
  // GET /api/users/settings - Get user settings
  app.get('/api/users/settings', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      let userSettings = await storage.getUserSettings(userId);
      
      // If no settings exist, create default settings
      if (!userSettings) {
        userSettings = await storage.createUserSettings(userId);
      }
      
      res.json({
        settings: userSettings
      });
    } catch (error) {
      console.error('Get user settings error:', error);
      res.status(500).json({
        error: 'Failed to get settings',
        message: 'An error occurred while retrieving user settings'
      });
    }
  });
  
  // PUT /api/users/settings - Update user settings
  app.put('/api/users/settings', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const updates = updateUserSettingsSchema.parse(req.body);
      
      // Ensure user settings exist first
      let userSettings = await storage.getUserSettings(userId);
      if (!userSettings) {
        userSettings = await storage.createUserSettings(userId);
      }
      
      const updatedSettings = await storage.updateUserSettings(userId, updates);
      
      res.json({
        settings: updatedSettings
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid input data',
          details: error.errors
        });
      }
      
      console.error('Update user settings error:', error);
      res.status(500).json({
        error: 'Failed to update settings',
        message: 'An error occurred while updating user settings'
      });
    }
  });
  
  // POST /api/users/interests - Set user interests
  app.post('/api/users/interests', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { interests } = setUserInterestsSchema.parse(req.body);
      
      await storage.setUserInterests(userId, interests);
      
      // Mark onboarding as completed if not already done
      const user = req.user!;
      if (!user.onboarding_completed) {
        await storage.updateUser(userId, { onboarding_completed: true });
      }
      
      res.json({
        message: 'User interests updated successfully',
        interests
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid input data',
          details: error.errors
        });
      }
      
      console.error('Set user interests error:', error);
      res.status(500).json({
        error: 'Failed to set interests',
        message: 'An error occurred while setting user interests'
      });
    }
  });
  
  // GET /api/users/onboarding-status - Check onboarding completion
  app.get('/api/users/onboarding-status', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      
      // Get user interests to check if they have been set
      const userInterests = await storage.getUserInterests(user.id);
      const hasInterests = userInterests.length > 0;
      
      // Get user feeds to check if they have subscribed to any feeds
      const userFeeds = await storage.getUserFeeds(user.id);
      const hasFeeds = userFeeds.length > 0;
      
      res.json({
        onboarding_completed: user.onboarding_completed,
        has_interests: hasInterests,
        has_feeds: hasFeeds,
        steps_completed: {
          profile_created: true, // If they're authenticated, profile exists
          interests_selected: hasInterests,
          feeds_subscribed: hasFeeds,
          onboarding_marked_complete: user.onboarding_completed
        }
      });
    } catch (error) {
      console.error('Get onboarding status error:', error);
      res.status(500).json({
        error: 'Failed to get onboarding status',
        message: 'An error occurred while checking onboarding status'
      });
    }
  });

  // Feed Management Routes
  
  // GET /api/feeds/recommended - Get recommended feeds list (~865 feeds from database)
  app.get('/api/feeds/recommended', requireAuth, async (req: Request, res: Response) => {
    try {
      const { category, search, limit } = req.query;
      
      let recommendedFeeds = await storage.getRecommendedFeeds();
      
      // Filter by category if provided
      if (category && typeof category === 'string') {
        recommendedFeeds = recommendedFeeds.filter(feed => 
          feed.category.toLowerCase() === category.toLowerCase()
        );
      }
      
      // Filter by search query if provided
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        recommendedFeeds = recommendedFeeds.filter(feed =>
          feed.name.toLowerCase().includes(searchLower) ||
          feed.description?.toLowerCase().includes(searchLower) ||
          (feed.tags && feed.tags.some(tag => tag.toLowerCase().includes(searchLower)))
        );
      }
      
      // Apply limit if provided
      if (limit && typeof limit === 'string') {
        const limitNum = parseInt(limit, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          recommendedFeeds = recommendedFeeds.slice(0, limitNum);
        }
      }
      
      res.json({
        feeds: recommendedFeeds,
        total: recommendedFeeds.length
      });
    } catch (error) {
      console.error('Get recommended feeds error:', error);
      res.status(500).json({
        error: 'Failed to get recommended feeds',
        message: 'An error occurred while retrieving recommended feeds'
      });
    }
  });
  
  // GET /api/feeds/user - Get user's subscribed feeds
  app.get('/api/feeds/user', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      const userFeeds = await storage.getUserFeeds(userId);
      
      res.json({
        feeds: userFeeds,
        total: userFeeds.length
      });
    } catch (error) {
      console.error('Get user feeds error:', error);
      res.status(500).json({
        error: 'Failed to get user feeds',
        message: 'An error occurred while retrieving user feeds'
      });
    }
  });
  
  // POST /api/feeds/subscribe - Subscribe to feeds (bulk subscription)
  app.post('/api/feeds/subscribe', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { feedIds } = req.body;
      
      // Validate input
      if (!Array.isArray(feedIds) || feedIds.length === 0) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'feedIds must be a non-empty array'
        });
      }
      
      // Validate that all feedIds are strings
      if (!feedIds.every(id => typeof id === 'string')) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'All feed IDs must be strings'
        });
      }
      
      await storage.subscribeToFeeds(userId, feedIds);
      
      res.json({
        message: 'Successfully subscribed to feeds',
        subscribed_count: feedIds.length
      });
    } catch (error) {
      console.error('Subscribe to feeds error:', error);
      res.status(500).json({
        error: 'Failed to subscribe to feeds',
        message: 'An error occurred while subscribing to feeds'
      });
    }
  });
  
  // DELETE /api/feeds/unsubscribe/:id - Unsubscribe from a feed
  app.delete('/api/feeds/unsubscribe/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const feedId = req.params.id;
      
      if (!feedId) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Feed ID is required'
        });
      }
      
      await storage.unsubscribeFromFeed(userId, feedId);
      
      res.json({
        message: 'Successfully unsubscribed from feed'
      });
    } catch (error) {
      console.error('Unsubscribe from feed error:', error);
      res.status(500).json({
        error: 'Failed to unsubscribe from feed',
        message: 'An error occurred while unsubscribing from feed'
      });
    }
  });
  
  // POST /api/feeds/sync - Trigger feed synchronization
  app.post('/api/feeds/sync', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { feedIds } = req.body;
      
      // Get user's feeds
      const userFeeds = await storage.getUserFeeds(userId);
      
      // Determine which feeds to sync
      let feedsToSync = userFeeds;
      if (feedIds && Array.isArray(feedIds)) {
        feedsToSync = userFeeds.filter(feed => feedIds.includes(feed.id));
      }
      
      if (feedsToSync.length === 0) {
        return res.status(400).json({
          error: 'No feeds to sync',
          message: 'No valid feeds found for synchronization'
        });
      }
      
      // Start RSS synchronization for feeds
      console.log(`Starting RSS sync for ${feedsToSync.length} feeds for user ${userId}`);
      
      // Process feeds in background (don't await to return immediately)
      const syncPromise = syncFeeds(feedsToSync, {
        maxArticles: 50, // Limit articles per feed
        respectEtag: true,
        respectLastModified: true,
        batchSize: 3, // Process 3 feeds at a time
        delayMs: 2000 // 2 second delay between batches
      });
      
      // Don't await the sync, let it run in background
      syncPromise.catch(error => {
        console.error('Background RSS sync error:', error);
      });
      
      const syncResults = feedsToSync.map(feed => ({
        feedId: feed.id,
        feedName: feed.name,
        status: 'started'
      }));
      
      res.json({
        message: 'Feed synchronization started',
        sync_results: syncResults,
        total_feeds: feedsToSync.length
      });
    } catch (error) {
      console.error('Trigger feed sync error:', error);
      res.status(500).json({
        error: 'Failed to trigger feed sync',
        message: 'An error occurred while starting feed synchronization'
      });
    }
  });
  
  // GET /api/feeds/sync-status - Get synchronization status
  app.get('/api/feeds/sync-status', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      const syncStatus = await storage.getFeedSyncStatus(userId);
      
      res.json({
        sync_status: syncStatus
      });
    } catch (error) {
      console.error('Get sync status error:', error);
      res.status(500).json({
        error: 'Failed to get sync status',
        message: 'An error occurred while retrieving sync status'
      });
    }
  });

  return httpServer;
}
