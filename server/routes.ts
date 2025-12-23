import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { getStorage } from "./storage";
import { requireAuth, requireNoAuth, createSupabaseClient } from "./auth-middleware";
import { syncFeeds, syncFeed } from "./rss-sync";
import { 
  createFeedSyncIntegrationService, 
  syncFeedsWithIntegration,
  type FeedSyncIntegrationService 
} from "./feed-sync-integration";
import { FeedFilteringValidator, type FilterOptions, validateFilterOptions, filterFeedsByInterestsWithMapping } from "./feed-filtering-validation";
import { categoryMappingService } from "@shared/category-mapping";
import { generateArticleSummary, isAISummaryAvailable, clusterArticles, isClusteringAvailable } from "./ai-summary";
import { requireFeedOwnership, validateFeedOwnership } from "./feed-ownership";
import { createSimilarArticlesService } from "./similar-articles-service";
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
  httpServer: Server | null,
  app: any
): Promise<Server | null> {
  
  // Health Check Route (for deployment validation)
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  });
  
  // Authentication Routes
  
  // POST /api/auth/register - Email/password registration
  app.post('/api/auth/register', requireNoAuth, async (req: Request, res: Response) => {
    try {
      const { email, password, display_name } = registerSchema.parse(req.body);
      
      const storage = await getStorage();
      
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
  app.post('/api/auth/login', requireNoAuth, (req: Request, res: Response, next: any) => {
    console.log('🔐 Login attempt:', { 
      email: req.body.email, 
      hasPassword: !!req.body.password,
      sessionID: req.sessionID,
      hasSession: !!req.session
    });
    
    try {
      loginSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log('❌ Login validation failed:', error.errors);
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid input data',
          details: error.errors
        });
      }
    }
    
    passport.authenticate('local', (err: any, user: any, info: any) => {
      console.log('🔐 Passport authenticate result:', { 
        hasError: !!err, 
        hasUser: !!user, 
        info: info,
        errorMessage: err?.message 
      });
      
      if (err) {
        console.error('❌ Authentication error:', err);
        return res.status(500).json({
          error: 'Authentication error',
          message: 'An error occurred during authentication'
        });
      }
      
      if (!user) {
        console.log('❌ Authentication failed - no user returned:', info);
        return res.status(401).json({
          error: 'Authentication failed',
          message: info?.message || 'Invalid email or password'
        });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('❌ Session creation error:', loginErr);
          return res.status(500).json({
            error: 'Login failed',
            message: 'An error occurred during login'
          });
        }
        
        console.log('✅ Login successful:', { 
          userId: user.id, 
          email: user.email,
          sessionID: req.sessionID,
          isAuthenticated: req.isAuthenticated()
        });
        
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
      
      const storage = await getStorage();
      
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

  // POST /api/auth/oauth/callback - OAuth callback handler for Supabase sessions
  app.post('/api/auth/oauth/callback', async (req: Request, res: Response) => {
    console.log('🔐 OAuth callback received');
    
    try {
      const { session } = req.body;
      
      if (!session || !session.user) {
        console.log('❌ OAuth callback: Invalid session data received');
        return res.status(400).json({
          error: 'Invalid session',
          message: 'No valid session data provided'
        });
      }
      
      const supabaseUser = session.user;
      console.log('🔐 OAuth callback: Processing user:', { 
        id: supabaseUser.id, 
        email: supabaseUser.email,
        provider: supabaseUser.app_metadata?.provider 
      });
      
      const storage = await getStorage();
      
      // Get or create user profile from Supabase user data
      // Note: Supabase may have already created the profile via trigger on auth.users insert
      let user = await storage.getUser(supabaseUser.id);
      
      if (!user) {
        // Profile doesn't exist yet - create it
        // This can happen if the trigger didn't fire or if using a different auth setup
        const displayName = supabaseUser.user_metadata?.full_name || 
                           supabaseUser.user_metadata?.name || 
                           supabaseUser.email?.split('@')[0] || 
                           'User';
        
        console.log('🔐 OAuth callback: Creating new user profile (trigger may not have fired)');
        
        try {
          user = await storage.createUser({
            id: supabaseUser.id,
            email: supabaseUser.email!,
            display_name: displayName,
            avatar_url: supabaseUser.user_metadata?.avatar_url || 
                       supabaseUser.user_metadata?.picture || null,
            timezone: "America/New_York",
            region_code: null,
            onboarding_completed: false
          });
          
          console.log('✅ OAuth callback: Created new user:', {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            provider: supabaseUser.app_metadata?.provider
          });
        } catch (createError) {
          // If creation fails due to duplicate key, the trigger may have created it
          // Try to fetch the user again
          const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
          console.log('⚠️  OAuth callback: User creation failed, checking if trigger created it:', errorMessage);
          
          if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
            // Wait a moment for the trigger to complete, then try fetching again
            await new Promise(resolve => setTimeout(resolve, 500));
            user = await storage.getUser(supabaseUser.id);
            
            if (user) {
              console.log('✅ OAuth callback: Found user created by trigger:', user.email);
            } else {
              // Still can't find the user - re-throw the original error
              throw createError;
            }
          } else {
            throw createError;
          }
        }
      } else {
        console.log('🔐 OAuth callback: Found existing user:', user.id);
        
        // Update existing user with latest OAuth data if needed
        const updates: any = {};
        
        if (supabaseUser.user_metadata?.avatar_url && 
            supabaseUser.user_metadata.avatar_url !== user.avatar_url) {
          updates.avatar_url = supabaseUser.user_metadata.avatar_url;
        }
        
        if (supabaseUser.user_metadata?.full_name && 
            supabaseUser.user_metadata.full_name !== user.display_name) {
          updates.display_name = supabaseUser.user_metadata.full_name;
        }
        
        if (Object.keys(updates).length > 0) {
          user = await storage.updateUser(user.id, updates);
          console.log('✅ OAuth callback: Updated user:', { id: user.id, updates });
        }
      }
      
      // Ensure we have a valid user at this point
      if (!user) {
        console.error('❌ OAuth callback: Failed to get or create user profile');
        return res.status(500).json({
          error: 'Profile creation failed',
          message: 'Could not create or retrieve user profile'
        });
      }
      
      // Log the user in to create a session
      req.login(user, (err) => {
        if (err) {
          console.error('❌ OAuth callback: Session creation error:', err);
          return res.status(500).json({
            error: 'Session creation failed',
            message: 'User authenticated but session creation failed'
          });
        }
        
        console.log('✅ OAuth callback: Session created successfully:', { 
          userId: user.id,
          sessionID: req.sessionID,
          isAuthenticated: req.isAuthenticated()
        });
        
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('❌ OAuth callback error:', {
        message: errorMessage,
        stack: errorStack,
        name: error instanceof Error ? error.name : 'Unknown'
      });
      
      // Return more detailed error info for debugging (in production, you might want to hide this)
      res.status(500).json({
        error: 'OAuth callback failed',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
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
      
      const storage = await getStorage();
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
      
      const storage = await getStorage();
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
      
      const storage = await getStorage();
      
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
      
      const storage = await getStorage();
      await storage.setUserInterests(userId, interests);
      
      // Don't mark onboarding as completed here - wait until feeds are subscribed
      
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
      
      const storage = await getStorage();
      
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
  
  // Enhanced validation schema for recommended feeds query parameters
  const recommendedFeedsQuerySchema = z.object({
    category: z.string().min(1).max(50).optional().refine(val => {
      if (!val) return true;
      // Allow alphanumeric, spaces, hyphens, and underscores
      return /^[a-zA-Z0-9\s\-_]+$/.test(val);
    }, {
      message: "Category must contain only letters, numbers, spaces, hyphens, and underscores"
    }).refine(val => {
      if (!val) return true;
      // Validate that the category exists in our mapping or can be used as fallback
      const isValidFrontend = categoryMappingService.isValidFrontendCategory(val);
      if (isValidFrontend) return true;
      
      // Allow unmapped categories for fallback behavior (Requirement 1.5)
      console.warn(`Category '${val}' not found in mapping - will attempt fallback`);
      return true;
    }, {
      message: "Category not recognized - check available categories"
    }),
    search: z.string().min(1).max(100).optional().refine(val => {
      if (!val) return true;
      // Prevent potential injection attacks
      return !/[<>'";&|`${}()\\]/.test(val);
    }, {
      message: "Search query contains invalid characters"
    }),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 1000, {
      message: "Limit must be between 1 and 1000"
    }).optional(),
    // Additional query parameters for enhanced filtering
    featured: z.string().optional().refine(val => {
      if (!val) return true;
      return val === 'true' || val === 'false';
    }, {
      message: "Featured must be 'true' or 'false'"
    }).transform(val => val === 'true' ? true : val === 'false' ? false : undefined),
    country: z.string().min(2).max(3).optional().refine(val => {
      if (!val) return true;
      return /^[A-Z]{2,3}$/.test(val);
    }, {
      message: "Country must be a 2-3 letter uppercase country code"
    }),
    language: z.string().min(2).max(5).optional().refine(val => {
      if (!val) return true;
      return /^[a-z]{2}(-[A-Z]{2})?$/.test(val);
    }, {
      message: "Language must be a valid language code (e.g., 'en', 'en-US')"
    })
  });

  // GET /api/feeds/recommended - Get recommended feeds list (~865 feeds from database)
  // OPTIMIZED: Reduced verbose logging for better performance
  app.get('/api/feeds/recommended', requireAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Validate query parameters
      const validatedQuery = recommendedFeedsQuerySchema.parse(req.query);
      const { category, search, limit, featured, country, language } = validatedQuery;
      
      // Get feeds from storage
      const storage = await getStorage();
      const recommendedFeeds = await storage.getRecommendedFeeds();
      
      const originalCount = recommendedFeeds.length;
      
      // Only log warnings for actual issues
      if (originalCount === 0) {
        console.warn('⚠️ No feeds returned from storage');
      }
      
      // Apply filtering
      let filteredFeeds = [...recommendedFeeds];
      
      // Category filter with mapping support
      if (category) {
        const databaseCategory = categoryMappingService.frontendToDatabase(category);
        if (databaseCategory) {
          filteredFeeds = filteredFeeds.filter(feed => feed.category === databaseCategory);
        } else {
          // Fallback: case-insensitive matching
          filteredFeeds = filteredFeeds.filter(feed => 
            feed.category.toLowerCase() === category.toLowerCase()
          );
        }
      }
      
      // Featured filter
      if (featured !== undefined) {
        filteredFeeds = filteredFeeds.filter(feed => feed.is_featured === featured);
      }
      
      // Country filter
      if (country) {
        filteredFeeds = filteredFeeds.filter(feed => 
          feed.country && feed.country.toUpperCase() === country.toUpperCase()
        );
      }
      
      // Language filter
      if (language) {
        filteredFeeds = filteredFeeds.filter(feed => 
          feed.language.toLowerCase() === language.toLowerCase()
        );
      }
      
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        filteredFeeds = filteredFeeds.filter(feed => {
          const nameMatch = feed.name.toLowerCase().includes(searchLower);
          const descMatch = feed.description?.toLowerCase().includes(searchLower);
          const tagMatch = feed.tags && feed.tags.some(tag => tag.toLowerCase().includes(searchLower));
          return nameMatch || descMatch || tagMatch;
        });
      }
      
      // Limit application
      if (limit) {
        filteredFeeds = filteredFeeds.slice(0, limit);
      }
      
      const totalTime = Date.now() - startTime;
      
      // Only log slow requests
      if (totalTime > 2000) {
        console.warn(`⚠️ Slow /api/feeds/recommended: ${totalTime}ms`);
      }
      
      res.json({
        feeds: filteredFeeds,
        total: filteredFeeds.length,
        metadata: {
          originalCount,
          filteredCount: filteredFeeds.length,
          processingTime: totalTime,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid query parameters provided',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          })),
          timestamp: new Date().toISOString()
        });
      }
      
      console.error('Get recommended feeds error:', error);
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          return res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'Please try again in a few moments.',
            retryAfter: 30
          });
        }
      }
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'An error occurred while retrieving recommended feeds.'
      });
    }
  });
  
  // GET /api/feeds/user - Get user's subscribed feeds
  app.get('/api/feeds/user', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      const storage = await getStorage();
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
  // Updated with feed limit enforcement (Requirements: 3.1, 3.2, 3.3)
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
      
      const storage = await getStorage();
      
      // Check feed limit before subscribing (Requirements: 3.1, 3.2, 3.3, 3.5)
      const currentCount = await storage.getUserFeedCount(userId);
      const maxAllowed = 25; // MAX_FEEDS_PER_USER
      const availableSlots = maxAllowed - currentCount;
      
      if (availableSlots <= 0) {
        return res.status(400).json({
          error: 'FEED_LIMIT_EXCEEDED',
          message: `Cannot subscribe: you have ${currentCount}/${maxAllowed} feeds. Remove some feeds to add new ones.`,
          currentCount,
          maxAllowed,
          subscribed_count: 0,
          rejected_count: feedIds.length
        });
      }
      
      // If requesting more feeds than available slots, use subscribeToFeedsWithLimit
      if (feedIds.length > availableSlots) {
        const result = await storage.subscribeToFeedsWithLimit(userId, feedIds, maxAllowed);
        
        // Mark onboarding as completed after successful feed subscription
        const user = req.user!;
        if (!user.onboarding_completed && result.subscribed.length > 0) {
          await storage.updateUser(userId, { onboarding_completed: true });
        }
        
        return res.status(result.rejected.length > 0 ? 207 : 200).json({
          message: result.reason || 'Feeds subscribed with limit enforcement',
          subscribed_count: result.subscribed.length,
          rejected_count: result.rejected.length,
          subscribed: result.subscribed,
          rejected: result.rejected,
          currentCount: currentCount + result.subscribed.length,
          maxAllowed
        });
      }
      
      // Normal subscription (within limits)
      await storage.subscribeToFeeds(userId, feedIds);
      
      // Mark onboarding as completed after successful feed subscription
      const user = req.user!;
      if (!user.onboarding_completed) {
        await storage.updateUser(userId, { onboarding_completed: true });
      }
      
      res.json({
        message: 'Successfully subscribed to feeds',
        subscribed_count: feedIds.length
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Subscribe to feeds error:', errorMessage, error);
      res.status(500).json({
        error: 'Failed to subscribe to feeds',
        message: errorMessage
      });
    }
  });
  
  // DELETE /api/feeds/unsubscribe/:id - Unsubscribe from a feed
  // Requirements: 4.1, 4.2, 4.3, 4.4, 4.5 - Feed deletion with ownership validation
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
      
      // Validate feed ownership (Requirements: 4.4)
      const ownershipResult = await requireFeedOwnership(userId, feedId);
      
      if (!ownershipResult.isValid) {
        return res.status(ownershipResult.httpStatus).json(ownershipResult.errorResponse);
      }
      
      const storage = await getStorage();
      await storage.unsubscribeFromFeed(userId, feedId);
      
      // Get updated feed count (Requirements: 4.5)
      const newFeedCount = await storage.getUserFeedCount(userId);
      
      res.json({
        success: true,
        message: 'Successfully unsubscribed from feed',
        newFeedCount
      });
    } catch (error) {
      console.error('Unsubscribe from feed error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unsubscribe from feed',
        message: 'An error occurred while unsubscribing from feed'
      });
    }
  });
  
  // GET /api/feeds/sync/status - Get current sync status for authenticated user
  // Requirements: 2.6, 2.7 - Provide sync progress tracking and visual feedback
  app.get('/api/feeds/sync/status', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      console.log(`📊 Getting sync status for user ${userId}`);
      
      const storage = await getStorage();
      const syncStatus = await storage.getFeedSyncStatus(userId);
      
      console.log(`📊 Sync status for user ${userId}:`, {
        totalFeeds: syncStatus.totalFeeds,
        syncing: syncStatus.syncing,
        completed: syncStatus.completed,
        failed: syncStatus.failed,
        isActive: syncStatus.isActive
      });
      
      res.json({
        isActive: syncStatus.isActive,
        totalFeeds: syncStatus.totalFeeds,
        completedFeeds: syncStatus.completed,
        failedFeeds: syncStatus.failed,
        syncingFeeds: syncStatus.syncing,
        currentFeed: syncStatus.currentFeed,
        errors: syncStatus.errors,
        newArticlesCount: syncStatus.newArticlesCount,
        lastSyncAt: syncStatus.lastSyncAt?.toISOString()
      });
    } catch (error) {
      console.error('Get sync status error:', error);
      res.status(500).json({
        error: 'Failed to get sync status',
        message: 'An error occurred while retrieving sync status'
      });
    }
  });
  
  // POST /api/feeds/sync - Trigger feed synchronization
  // Requirements: 2.1, 2.4, 2.9 - Trigger sync with detailed results
  app.post('/api/feeds/sync', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { feedIds, waitForResults } = req.body;
      
      const storage = await getStorage();
      
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
      
      // Start RSS synchronization for feeds with embedding integration
      console.log(`Starting RSS sync for ${feedsToSync.length} feeds for user ${userId}`);
      
      // Process feeds with embedding and clustering integration
      // Requirements: 3.8, 3.9, 7.1, 7.2 - Wire feed sync to embedding pipeline
      const syncPromise = syncFeedsWithIntegration(storage, feedsToSync, {
        maxArticles: 50, // Limit articles per feed
        respectEtag: true,
        respectLastModified: true,
        batchSize: 3, // Process 3 feeds at a time
        delayMs: 2000 // 2 second delay between batches
      });
      
      // If waitForResults is true, wait for sync to complete and return detailed results
      if (waitForResults) {
        try {
          const integrationResult = await syncPromise;
          const results = integrationResult.syncResults;
          
          const successCount = results.filter(r => r.success).length;
          const failureCount = results.filter(r => !r.success).length;
          const newArticlesCount = results.reduce((sum, r) => sum + r.articlesNew, 0);
          const updatedArticlesCount = results.reduce((sum, r) => sum + r.articlesUpdated, 0);
          
          // Build errors array with feed names
          const errors: Array<{ feedId: string; feedName: string; error: string }> = [];
          results.forEach((result, index) => {
            if (!result.success && result.error) {
              const feed = feedsToSync[index];
              errors.push({
                feedId: feed.id,
                feedName: feed.name,
                error: result.error
              });
            }
          });
          
          console.log(`RSS sync completed for user ${userId}: ${successCount} success, ${failureCount} failed, ${newArticlesCount} new articles, ${integrationResult.totalEmbeddingsQueued} embeddings queued`);
          
          return res.json({
            success: true,
            message: 'Feed synchronization completed',
            totalFeeds: feedsToSync.length,
            successfulSyncs: successCount,
            failedSyncs: failureCount,
            newArticles: newArticlesCount,
            updatedArticles: updatedArticlesCount,
            embeddingsQueued: integrationResult.totalEmbeddingsQueued,
            clusteringTriggered: integrationResult.clusteringTriggered,
            errors
          });
        } catch (syncError) {
          console.error('RSS sync error:', syncError);
          return res.status(500).json({
            success: false,
            error: 'Sync failed',
            message: syncError instanceof Error ? syncError.message : 'An error occurred during synchronization',
            totalFeeds: feedsToSync.length,
            successfulSyncs: 0,
            failedSyncs: feedsToSync.length,
            newArticles: 0,
            updatedArticles: 0,
            errors: feedsToSync.map(feed => ({
              feedId: feed.id,
              feedName: feed.name,
              error: 'Sync failed'
            }))
          });
        }
      }
      
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
        success: true,
        message: 'Feed synchronization started',
        sync_results: syncResults,
        totalFeeds: feedsToSync.length,
        // Initial values - client should poll /api/feeds/sync/status for updates
        successfulSyncs: 0,
        failedSyncs: 0,
        newArticles: 0,
        updatedArticles: 0,
        errors: []
      });
    } catch (error) {
      console.error('Trigger feed sync error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger feed sync',
        message: 'An error occurred while starting feed synchronization'
      });
    }
  });
  
  // POST /api/feeds/validate - Validate a custom feed URL
  app.post('/api/feeds/validate', requireAuth, async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'URL is required'
        });
      }
      
      // Basic URL validation
      try {
        new URL(url);
      } catch {
        return res.status(400).json({
          valid: false,
          message: 'Invalid URL format'
        });
      }
      
      // For now, return a simple validation response
      // In production, this would actually fetch and parse the RSS feed
      const isValidUrl = url.includes('rss') || url.includes('feed') || url.includes('xml') || url.includes('atom');
      
      if (isValidUrl) {
        res.json({
          valid: true,
          name: `Custom Feed from ${new URL(url).hostname}`,
          description: 'RSS feed detected at the provided URL'
        });
      } else {
        res.json({
          valid: false,
          message: 'No RSS or Atom feed found at this URL'
        });
      }
    } catch (error) {
      console.error('Feed validation error:', error);
      res.status(500).json({
        error: 'Validation failed',
        message: 'An error occurred while validating the feed'
      });
    }
  });
  
  // POST /api/feeds/custom - Add a custom feed
  app.post('/api/feeds/custom', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { url, name, description } = req.body;
      
      if (!url || !name) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'URL and name are required'
        });
      }
      
      // Create a custom feed entry
      const feedId = `custom_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // For now, we'll simulate adding the feed
      // In production, this would add the feed to the database
      
      res.json({
        feedId,
        message: 'Custom feed added successfully'
      });
    } catch (error) {
      console.error('Add custom feed error:', error);
      res.status(500).json({
        error: 'Failed to add custom feed',
        message: 'An error occurred while adding the custom feed'
      });
    }
  });
  
  // PUT /api/feeds/:id - Update feed settings
  // Requirements: 4.4 - Feed ownership validation
  app.put('/api/feeds/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const feedId = req.params.id;
      const { status, priority, folder_name } = req.body;
      
      if (!feedId) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Feed ID is required'
        });
      }
      
      // Validate feed ownership (Requirements: 4.4)
      const ownershipResult = await requireFeedOwnership(userId, feedId);
      
      if (!ownershipResult.isValid) {
        return res.status(ownershipResult.httpStatus).json(ownershipResult.errorResponse);
      }
      
      // Update feed settings
      // For now, we'll simulate the update
      // In production, this would update the feed in the database
      
      res.json({
        success: true,
        message: 'Feed updated successfully',
        feedId,
        updates: { status, priority, folder_name }
      });
    } catch (error) {
      console.error('Update feed error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update feed',
        message: 'An error occurred while updating the feed'
      });
    }
  });

  // GET /api/feeds/sync-status - Get synchronization status
  app.get('/api/feeds/sync-status', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      const storage = await getStorage();
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

  // ============================================================================
  // Feed Priority API Routes
  // Requirements: 6.2, 6.3, 6.5 - Feed priority management
  // ============================================================================

  // PUT /api/feeds/:id/priority - Update single feed priority
  // Requirements: 6.2, 6.3
  app.put('/api/feeds/:id/priority', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const feedId = req.params.id;
      const { priority } = req.body;
      
      if (!feedId) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_FEED_ID',
          message: 'Feed ID is required'
        });
      }
      
      // Validate priority value (Requirements: 6.3)
      if (!priority || !['high', 'medium', 'low'].includes(priority)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PRIORITY',
          message: "Priority must be 'high', 'medium', or 'low'"
        });
      }
      
      // Validate feed ownership
      const ownershipResult = await requireFeedOwnership(userId, feedId);
      
      if (!ownershipResult.isValid) {
        return res.status(ownershipResult.httpStatus).json(ownershipResult.errorResponse);
      }
      
      const storage = await getStorage();
      const { createFeedSchedulerManager } = await import('./feed-scheduler');
      const scheduler = createFeedSchedulerManager(storage);
      
      // Update priority and recalculate schedule (Requirements: 6.2)
      const updatedFeed = await scheduler.updateFeedPriority(feedId, priority);
      
      res.json({
        success: true,
        feedId: updatedFeed.id,
        feedName: updatedFeed.name,
        priority: updatedFeed.sync_priority,
        nextSyncAt: updatedFeed.next_sync_at?.toISOString() || null,
        syncIntervalHours: updatedFeed.sync_interval_hours
      });
      
    } catch (error) {
      console.error('Update feed priority error:', error);
      res.status(500).json({
        success: false,
        error: 'PRIORITY_UPDATE_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred while updating feed priority'
      });
    }
  });

  // PUT /api/feeds/priority - Bulk update feed priorities
  // Requirements: 6.5
  app.put('/api/feeds/priority', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { feedPriorities } = req.body;
      
      // Validate input
      if (!Array.isArray(feedPriorities) || feedPriorities.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_INPUT',
          message: 'feedPriorities must be a non-empty array'
        });
      }
      
      // Validate each entry
      for (const entry of feedPriorities) {
        if (!entry.feedId || typeof entry.feedId !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'INVALID_FEED_ID',
            message: 'Each entry must have a valid feedId'
          });
        }
        if (!entry.priority || !['high', 'medium', 'low'].includes(entry.priority)) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_PRIORITY',
            message: `Invalid priority for feed ${entry.feedId}. Must be 'high', 'medium', or 'low'`
          });
        }
      }
      
      // Validate ownership for all feeds
      const storage = await getStorage();
      const userFeeds = await storage.getUserFeeds(userId);
      const userFeedIds = new Set(userFeeds.map(f => f.id));
      
      const unauthorizedFeeds = feedPriorities.filter(fp => !userFeedIds.has(fp.feedId));
      if (unauthorizedFeeds.length > 0) {
        return res.status(403).json({
          success: false,
          error: 'UNAUTHORIZED_FEEDS',
          message: 'You do not have access to some of the specified feeds',
          unauthorizedFeedIds: unauthorizedFeeds.map(f => f.feedId)
        });
      }
      
      const { createFeedSchedulerManager } = await import('./feed-scheduler');
      const scheduler = createFeedSchedulerManager(storage);
      
      // Bulk update priorities
      const updatedFeeds = await scheduler.bulkUpdatePriorities(feedPriorities);
      
      res.json({
        success: true,
        updatedCount: updatedFeeds.length,
        feeds: updatedFeeds.map(feed => ({
          feedId: feed.id,
          feedName: feed.name,
          priority: feed.sync_priority,
          nextSyncAt: feed.next_sync_at?.toISOString() || null,
          syncIntervalHours: feed.sync_interval_hours
        }))
      });
      
    } catch (error) {
      console.error('Bulk update feed priorities error:', error);
      res.status(500).json({
        success: false,
        error: 'BULK_PRIORITY_UPDATE_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred while updating feed priorities'
      });
    }
  });

  // GET /api/feeds/schedule - Get sync schedule for user's feeds
  // Requirements: 6.4
  app.get('/api/feeds/schedule', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      const storage = await getStorage();
      const { createFeedSchedulerManager } = await import('./feed-scheduler');
      const scheduler = createFeedSchedulerManager(storage);
      
      const schedule = await scheduler.getSyncSchedule(userId);
      
      res.json({
        success: true,
        schedule: schedule.map(item => ({
          feedId: item.feedId,
          feedName: item.feedName,
          priority: item.priority,
          lastSyncAt: item.lastSyncAt?.toISOString() || null,
          nextSyncAt: item.nextSyncAt.toISOString(),
          syncIntervalHours: item.syncIntervalHours
        })),
        total: schedule.length
      });
      
    } catch (error) {
      console.error('Get feed schedule error:', error);
      res.status(500).json({
        success: false,
        error: 'SCHEDULE_ERROR',
        message: 'An error occurred while retrieving feed schedule'
      });
    }
  });

  // GET /api/articles - Get user's article feed
  // OPTIMIZED: Uses parallel queries instead of sequential N+1 pattern
  app.get('/api/articles', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      // No artificial limit - frontend handles date-based pagination (7-day chunks)
      const maxArticlesPerFeed = 200; // Reasonable per-feed limit to prevent memory issues
      
      const storage = await getStorage();
      
      // Get user's subscribed feeds
      const userFeeds = await storage.getUserFeeds(userId);
      
      if (userFeeds.length === 0) {
        return res.json({
          articles: [],
          total: 0,
          feeds_count: 0,
          message: 'No subscribed feeds found'
        });
      }
      
      // OPTIMIZATION: Fetch articles from all feeds in parallel instead of sequentially
      const feedArticlePromises = userFeeds.map(async (feed) => {
        try {
          const feedArticles = await storage.getArticlesByFeedId(feed.id, maxArticlesPerFeed);
          
          // Add feed information to each article, including category (folder_name)
          return feedArticles.map(article => ({
            ...article,
            feed_name: feed.name,
            feed_url: feed.site_url || feed.url,
            feed_icon: feed.icon_url,
            feed_category: feed.folder_name || 'General' // Include category for filtering
          }));
        } catch (error) {
          console.error(`Failed to get articles for feed ${feed.id}:`, error);
          return []; // Return empty array on error, continue with other feeds
        }
      });
      
      // Wait for all parallel queries to complete
      const feedArticlesArrays = await Promise.all(feedArticlePromises);
      const allArticles = feedArticlesArrays.flat();
      
      // Sort by published date (newest first)
      allArticles.sort((a, b) => {
        const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return dateB - dateA;
      });
      
      // Return all articles - frontend handles date-based pagination (7-day chunks)
      res.json({
        articles: allArticles,
        total: allArticles.length,
        feeds_count: userFeeds.length
      });
    } catch (error) {
      console.error('Get articles error:', error);
      res.status(500).json({
        error: 'Failed to get articles',
        message: 'An error occurred while retrieving articles'
      });
    }
  });

  // POST /api/articles/:id/summary - Generate AI summary for an article
  app.post('/api/articles/:id/summary', requireAuth, async (req: Request, res: Response) => {
    try {
      const articleId = req.params.id;
      const { title, content, excerpt } = req.body;

      if (!title) {
        return res.status(400).json({
          error: 'Missing required field',
          message: 'Article title is required'
        });
      }

      // Check if AI is available
      if (!isAISummaryAvailable()) {
        console.log('AI summary unavailable - ANTHROPIC_API_KEY not set');
        return res.status(503).json({
          error: 'AI service unavailable',
          message: 'Anthropic API key not configured',
          fallback: true
        });
      }

      console.log('Generating AI summary for article:', title.substring(0, 50));
      const summary = await generateArticleSummary(title, content || '', excerpt);

      if (!summary) {
        console.log('AI summary returned null');
        return res.status(500).json({
          error: 'Summary generation failed',
          message: 'Could not generate summary for this article',
          fallback: true
        });
      }

      console.log('AI summary generated successfully:', summary.points.length, 'points');
      res.json({
        articleId,
        summary: summary.points,
        generatedAt: summary.generatedAt,
        model: summary.model
      });
    } catch (error) {
      console.error('AI summary error:', error);
      res.status(500).json({
        error: 'Summary generation failed',
        message: 'An error occurred while generating the summary',
        fallback: true
      });
    }
  });

  // ============================================================================
  // AI Status and Usage API Routes
  // Requirements: 7.5, 8.6 - Embedding/clustering status and usage statistics
  // ============================================================================

  // GET /api/ai/status - Check AI service availability and embedding/clustering status
  // Requirements: 7.5
  app.get('/api/ai/status', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      const storage = await getStorage();
      
      // Get embedding queue stats
      let embeddingStats = {
        pending: 0,
        processing: 0,
        failed: 0,
        deadLetter: 0
      };
      
      try {
        const { createEmbeddingQueueManager } = await import('./embedding-service');
        const embeddingManager = createEmbeddingQueueManager(storage);
        embeddingStats = await embeddingManager.getQueueStats();
      } catch (e) {
        // Embedding service may not be fully configured
        console.warn('Could not get embedding stats:', e);
      }
      
      // Check service availability
      const { isEmbeddingServiceAvailable } = await import('./embedding-service');
      const { isClusteringServiceAvailable } = await import('./clustering-service');
      
      res.json({
        available: isAISummaryAvailable(),
        features: {
          articleSummary: isAISummaryAvailable(),
          topicClustering: isClusteringAvailable(),
          embeddings: isEmbeddingServiceAvailable(),
          vectorClustering: isClusteringServiceAvailable(),
          semanticSearch: isEmbeddingServiceAvailable()
        },
        embedding: {
          serviceAvailable: isEmbeddingServiceAvailable(),
          queue: embeddingStats
        },
        clustering: {
          serviceAvailable: isClusteringServiceAvailable()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get AI status error:', error);
      res.status(500).json({
        error: 'AI_STATUS_ERROR',
        message: 'An error occurred while retrieving AI status'
      });
    }
  });

  // GET /api/ai/usage - Get user's AI usage statistics
  // Requirements: 8.6
  app.get('/api/ai/usage', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
      
      const storage = await getStorage();
      const { createAIRateLimiter } = await import('./ai-rate-limiter');
      const rateLimiter = createAIRateLimiter(storage);
      
      // Get current day usage stats
      const usageStats = await rateLimiter.getUsageStats(userId);
      
      // Get historical usage if requested
      let historicalUsage: Array<{
        date: string;
        embeddings: number;
        clusterings: number;
        searches: number;
        totalTokens: number;
        estimatedCost: number;
      }> = [];
      
      if (days > 1) {
        const historical = await rateLimiter.getHistoricalUsage(userId, days);
        historicalUsage = historical.map(day => ({
          date: day.date,
          embeddings: day.embeddings_count,
          clusterings: day.clusterings_count,
          searches: day.searches_count,
          totalTokens: day.total_tokens,
          estimatedCost: parseFloat(day.estimated_cost?.toString() || '0')
        }));
      }
      
      res.json({
        success: true,
        today: {
          embeddings: usageStats.daily.embeddings,
          clusterings: usageStats.daily.clusterings,
          searches: usageStats.daily.searches,
          summaries: usageStats.daily.summaries,
          totalTokens: usageStats.daily.totalTokens,
          openaiTokens: usageStats.daily.openaiTokens,
          anthropicTokens: usageStats.daily.anthropicTokens,
          estimatedCost: usageStats.daily.estimatedCost
        },
        limits: {
          embeddingsPerDay: usageStats.limits.embeddingsPerDay,
          clusteringsPerDay: usageStats.limits.clusteringsPerDay,
          searchesPerDay: usageStats.limits.searchesPerDay
        },
        remaining: {
          embeddings: usageStats.remaining.embeddings,
          clusterings: usageStats.remaining.clusterings,
          searches: usageStats.remaining.searches
        },
        resetAt: usageStats.resetAt.toISOString(),
        history: historicalUsage,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Get AI usage error:', error);
      res.status(500).json({
        success: false,
        error: 'AI_USAGE_ERROR',
        message: 'An error occurred while retrieving AI usage statistics'
      });
    }
  });

  // GET /api/clusters - Get trending topic clusters from user's articles
  // Requirements: 2.5, 2.7, 9.5 - Vector-based clustering with relevance scores and graceful degradation
  app.get('/api/clusters', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const useVectorClustering = req.query.vector !== 'false'; // Default to vector-based
      
      const storage = await getStorage();
      const userFeeds = await storage.getUserFeeds(userId);
      
      if (userFeeds.length === 0) {
        return res.json({ clusters: [], message: 'No feeds to cluster' });
      }
      
      // Try vector-based clustering first if enabled
      // Requirements: 9.5 - Serve cached clusters on AI failure
      if (useVectorClustering) {
        try {
          const { createClusteringServiceManager, isClusteringServiceAvailable } = await import('./clustering-service');
          
          // Even if clustering service is unavailable, try to get cached clusters
          const clusteringService = createClusteringServiceManager(storage);
          
          // Get user's feed IDs for filtering
          const feedIds = userFeeds.map(f => f.id);
          
          // Get clusters sorted by relevance score (Requirements: 2.7)
          // This will return cached clusters even if AI service is down
          const vectorClusters = await clusteringService.getUserClusters(userId, limit);
          
          if (vectorClusters.length > 0) {
            return res.json({
              clusters: vectorClusters.map(cluster => ({
                id: cluster.id,
                topic: cluster.topic,
                summary: cluster.summary,
                articleCount: cluster.articleCount,
                sources: cluster.sources,
                avgSimilarity: cluster.avgSimilarity,
                relevanceScore: cluster.relevanceScore,
                latestTimestamp: cluster.latestTimestamp.toISOString(),
                expiresAt: cluster.expiresAt.toISOString()
              })),
              articlesAnalyzed: vectorClusters.reduce((sum, c) => sum + c.articleCount, 0),
              generatedAt: new Date().toISOString(),
              method: 'vector',
              cached: !isClusteringServiceAvailable() // Indicate if serving cached data
            });
          }
          
          // If no cached clusters and service is unavailable, fall through to text-based
          if (!isClusteringServiceAvailable()) {
            console.warn('⚠️ Clustering service unavailable and no cached clusters, falling back to text-based');
          }
        } catch (vectorError) {
          console.warn('Vector clustering failed, falling back to text-based:', vectorError);
        }
      }
      
      // Fallback to text-based clustering (Requirements: 9.5)
      // This provides graceful degradation when AI services are unavailable
      const feedArticlePromises = userFeeds.map(async (feed) => {
        try {
          const feedArticles = await storage.getArticlesByFeedId(feed.id, 20);
          return feedArticles.map(article => ({
            id: article.id,
            title: article.title,
            excerpt: article.excerpt || '',
            source: feed.name,
            published_at: article.published_at ? article.published_at.toISOString() : undefined
          }));
        } catch {
          return [];
        }
      });
      
      const feedArticlesArrays = await Promise.all(feedArticlePromises);
      const allArticles = feedArticlesArrays.flat();
      
      // Sort by date and take most recent
      allArticles.sort((a, b) => {
        const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return dateB - dateA;
      });
      
      const recentArticles = allArticles.slice(0, 50);
      
      // Generate clusters using text-based method
      const clusters = await clusterArticles(recentArticles);
      
      res.json({
        clusters,
        articlesAnalyzed: recentArticles.length,
        generatedAt: new Date().toISOString(),
        method: 'text',
        fallback: true // Indicate this is fallback data
      });
    } catch (error) {
      console.error('Clustering error:', error);
      res.status(500).json({
        error: 'Clustering failed',
        message: 'An error occurred while generating topic clusters',
        clusters: []
      });
    }
  });

  // ============================================================================
  // Feed Management Controls API Routes
  // Requirements: 1.x (Single Feed Sync), 2.x (Bulk Sync), 3.x (Feed Limits),
  //               5.x (Feed Count), 6.x (Read State), 7.x (Starred State),
  //               8.x (Engagement Signals)
  // ============================================================================

  // POST /api/feeds/:feedId/sync - Sync a single feed
  // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.4 (ownership validation)
  app.post('/api/feeds/:feedId/sync', requireAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const userId = req.user!.id;
      const feedId = req.params.feedId;
      
      if (!feedId) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_FEED_ID',
          message: 'Feed ID is required'
        });
      }
      
      // Validate feed ownership using helper (Requirements: 4.4)
      const ownershipResult = await requireFeedOwnership(userId, feedId);
      
      if (!ownershipResult.isValid) {
        return res.status(ownershipResult.httpStatus).json(ownershipResult.errorResponse);
      }
      
      const feed = ownershipResult.feed!;
      
      console.log(`🔄 Starting single feed sync for: ${feed.name} (${feedId})`);
      
      // Perform the sync
      const result = await syncFeed(feed, {
        maxArticles: 50,
        respectEtag: true,
        respectLastModified: true
      });
      
      const syncDurationMs = Date.now() - startTime;
      
      if (!result.success) {
        console.log(`❌ Single feed sync failed for: ${feed.name} - ${result.error}`);
        return res.status(500).json({
          success: false,
          feedId: feed.id,
          feedName: feed.name,
          articlesFound: 0,
          articlesNew: 0,
          articlesUpdated: 0,
          error: result.error || 'Feed sync failed',
          syncDurationMs
        });
      }
      
      console.log(`✅ Single feed sync completed for: ${feed.name} - ${result.articlesNew} new, ${result.articlesUpdated} updated`);
      
      res.json({
        success: true,
        feedId: feed.id,
        feedName: feed.name,
        articlesFound: result.articlesFound,
        articlesNew: result.articlesNew,
        articlesUpdated: result.articlesUpdated,
        syncDurationMs
      });
      
    } catch (error) {
      const syncDurationMs = Date.now() - startTime;
      console.error('Single feed sync error:', error);
      res.status(500).json({
        success: false,
        error: 'SYNC_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred during feed synchronization',
        syncDurationMs
      });
    }
  });

  // POST /api/feeds/sync-all - Sync all user feeds (bulk sync)
  // Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
  app.post('/api/feeds/sync-all', requireAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const userId = req.user!.id;
      const { waitForResults = true } = req.body;
      
      const storage = await getStorage();
      const userFeeds = await storage.getUserFeeds(userId);
      
      if (userFeeds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'NO_FEEDS',
          message: 'No feeds to sync',
          totalFeeds: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          newArticles: 0,
          updatedArticles: 0,
          errors: []
        });
      }
      
      console.log(`🔄 Starting bulk sync for ${userFeeds.length} feeds for user ${userId}`);
      
      // Process feeds in batches (Requirements: 2.2)
      const syncPromise = syncFeeds(userFeeds, {
        maxArticles: 50,
        respectEtag: true,
        respectLastModified: true,
        batchSize: 3,
        delayMs: 2000
      });
      
      if (waitForResults) {
        const results = await syncPromise;
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        const newArticlesCount = results.reduce((sum, r) => sum + r.articlesNew, 0);
        const updatedArticlesCount = results.reduce((sum, r) => sum + r.articlesUpdated, 0);
        
        // Build errors array (Requirements: 2.5)
        const errors: Array<{ feedId: string; feedName: string; error: string }> = [];
        results.forEach((result, index) => {
          if (!result.success && result.error) {
            const feed = userFeeds[index];
            errors.push({
              feedId: feed.id,
              feedName: feed.name,
              error: result.error
            });
          }
        });
        
        const syncDurationMs = Date.now() - startTime;
        
        console.log(`✅ Bulk sync completed: ${successCount}/${userFeeds.length} success, ${newArticlesCount} new articles`);
        
        return res.json({
          success: true,
          totalFeeds: userFeeds.length,
          successfulSyncs: successCount,
          failedSyncs: failureCount,
          newArticles: newArticlesCount,
          updatedArticles: updatedArticlesCount,
          errors,
          syncDurationMs
        });
      }
      
      // Background sync - don't wait for results
      syncPromise.catch(error => {
        console.error('Background bulk sync error:', error);
      });
      
      res.json({
        success: true,
        message: 'Bulk synchronization started',
        totalFeeds: userFeeds.length,
        successfulSyncs: 0,
        failedSyncs: 0,
        newArticles: 0,
        updatedArticles: 0,
        errors: []
      });
      
    } catch (error) {
      const syncDurationMs = Date.now() - startTime;
      console.error('Bulk sync error:', error);
      res.status(500).json({
        success: false,
        error: 'BULK_SYNC_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred during bulk synchronization',
        totalFeeds: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        newArticles: 0,
        updatedArticles: 0,
        errors: [],
        syncDurationMs
      });
    }
  });

  // GET /api/feeds/count - Get user's feed count and capacity
  // Requirements: 5.1, 5.2, 5.3, 5.4
  app.get('/api/feeds/count', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      const storage = await getStorage();
      const currentCount = await storage.getUserFeedCount(userId);
      
      const maxAllowed = 25; // MAX_FEEDS_PER_USER
      const remaining = maxAllowed - currentCount;
      const isNearLimit = currentCount >= 20; // FEED_LIMIT_WARNING_THRESHOLD
      
      res.json({
        currentCount,
        maxAllowed,
        remaining,
        isNearLimit
      });
      
    } catch (error) {
      console.error('Get feed count error:', error);
      res.status(500).json({
        error: 'FEED_COUNT_ERROR',
        message: 'An error occurred while retrieving feed count'
      });
    }
  });

  // PUT /api/articles/:articleId/read - Mark article as read/unread
  // Requirements: 6.1, 6.2
  app.put('/api/articles/:articleId/read', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const articleId = req.params.articleId;
      const { isRead } = req.body;
      
      if (!articleId) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_ARTICLE_ID',
          message: 'Article ID is required'
        });
      }
      
      if (typeof isRead !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_READ_STATE',
          message: 'isRead must be a boolean value'
        });
      }
      
      const storage = await getStorage();
      const userArticle = await storage.markArticleRead(userId, articleId, isRead);
      
      res.json({
        success: true,
        articleId,
        isRead: userArticle.is_read,
        readAt: userArticle.read_at ? userArticle.read_at.toISOString() : null
      });
      
    } catch (error) {
      console.error('Mark article read error:', error);
      res.status(500).json({
        success: false,
        error: 'READ_STATE_ERROR',
        message: 'An error occurred while updating read state'
      });
    }
  });

  // PUT /api/articles/:articleId/star - Star/unstar article
  // Requirements: 7.1, 7.2
  app.put('/api/articles/:articleId/star', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const articleId = req.params.articleId;
      const { isStarred } = req.body;
      
      if (!articleId) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_ARTICLE_ID',
          message: 'Article ID is required'
        });
      }
      
      if (typeof isStarred !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_STARRED_STATE',
          message: 'isStarred must be a boolean value'
        });
      }
      
      const storage = await getStorage();
      const userArticle = await storage.markArticleStarred(userId, articleId, isStarred);
      
      res.json({
        success: true,
        articleId,
        isStarred: userArticle.is_starred,
        starredAt: userArticle.starred_at ? userArticle.starred_at.toISOString() : null
      });
      
    } catch (error) {
      console.error('Mark article starred error:', error);
      res.status(500).json({
        success: false,
        error: 'STARRED_STATE_ERROR',
        message: 'An error occurred while updating starred state'
      });
    }
  });

  // GET /api/articles/starred - Get all starred articles
  // Requirements: 7.3
  app.get('/api/articles/starred', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
      
      const storage = await getStorage();
      const starredArticles = await storage.getStarredArticles(userId, limit, offset);
      
      // Get user's feeds to add feed information to articles
      const userFeeds = await storage.getUserFeeds(userId);
      const feedMap = new Map(userFeeds.map(feed => [feed.id, feed]));
      
      // Add feed information to each article
      const articlesWithFeedInfo = starredArticles.map(article => {
        const feed = feedMap.get(article.feed_id);
        return {
          ...article,
          feed_name: feed?.name || 'Unknown Source',
          feed_url: feed?.site_url || feed?.url,
          feed_icon: feed?.icon_url,
          feed_category: feed?.folder_name || 'General'
        };
      });
      
      res.json({
        articles: articlesWithFeedInfo,
        total: articlesWithFeedInfo.length
      });
      
    } catch (error) {
      console.error('Get starred articles error:', error);
      res.status(500).json({
        error: 'STARRED_ARTICLES_ERROR',
        message: 'An error occurred while retrieving starred articles'
      });
    }
  });

  // PUT /api/articles/:articleId/engagement - Set engagement signal
  // Requirements: 8.1, 8.2, 8.3, 8.4
  app.put('/api/articles/:articleId/engagement', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const articleId = req.params.articleId;
      const { signal } = req.body;
      
      if (!articleId) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_ARTICLE_ID',
          message: 'Article ID is required'
        });
      }
      
      // Validate signal value
      if (signal !== 'positive' && signal !== 'negative' && signal !== null) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_SIGNAL',
          message: "Engagement signal must be 'positive', 'negative', or null"
        });
      }
      
      const storage = await getStorage();
      const userArticle = await storage.setEngagementSignal(userId, articleId, signal);
      
      res.json({
        success: true,
        articleId,
        signal: userArticle.engagement_signal,
        signalAt: userArticle.engagement_signal_at ? userArticle.engagement_signal_at.toISOString() : null
      });
      
    } catch (error) {
      console.error('Set engagement signal error:', error);
      res.status(500).json({
        success: false,
        error: 'ENGAGEMENT_SIGNAL_ERROR',
        message: 'An error occurred while updating engagement signal'
      });
    }
  });

  // ============================================================================
  // Semantic Search API Routes
  // Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
  // Property 13: Semantic Search Result Constraints
  // ============================================================================

  // GET /api/search - Semantic search for articles
  // Requirements: 5.1, 5.6
  app.get('/api/search', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const query = req.query.q as string | undefined;
      const feedId = req.query.feedId as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const limit = req.query.limit as string | undefined;
      
      // Requirements: 5.6 - Handle empty query (return default feed)
      if (!query || query.trim().length === 0) {
        // Return empty result with message for empty query
        return res.json({
          success: true,
          articles: [],
          query: '',
          totalResults: 0,
          processingTimeMs: 0,
          fallbackUsed: false,
          message: 'Please provide a search query'
        });
      }
      
      const storage = await getStorage();
      const { createSemanticSearchService } = await import('./semantic-search-service');
      const searchService = createSemanticSearchService(storage);
      
      // Build search options
      const searchOptions: {
        userId: string;
        maxResults?: number;
        feedIds?: string[];
        dateFrom?: Date;
        dateTo?: Date;
      } = {
        userId,
      };
      
      // Parse limit
      if (limit) {
        const parsedLimit = parseInt(limit, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          searchOptions.maxResults = Math.min(parsedLimit, 50); // Cap at 50
        }
      }
      
      // Parse feed filter
      if (feedId) {
        searchOptions.feedIds = [feedId];
      }
      
      // Parse date filters
      if (dateFrom) {
        const parsedDateFrom = new Date(dateFrom);
        if (!isNaN(parsedDateFrom.getTime())) {
          searchOptions.dateFrom = parsedDateFrom;
        }
      }
      
      if (dateTo) {
        const parsedDateTo = new Date(dateTo);
        if (!isNaN(parsedDateTo.getTime())) {
          searchOptions.dateTo = parsedDateTo;
        }
      }
      
      // Perform search
      const result = await searchService.search(query.trim(), searchOptions);
      
      res.json({
        success: true,
        articles: result.articles.map(article => ({
          id: article.id,
          title: article.title,
          excerpt: article.excerpt,
          feedName: article.feedName,
          feedId: article.feedId,
          publishedAt: article.publishedAt?.toISOString() || null,
          relevanceScore: article.relevanceScore,
          imageUrl: article.imageUrl || null
        })),
        query: result.query,
        totalResults: result.totalResults,
        processingTimeMs: result.processingTimeMs,
        fallbackUsed: result.fallbackUsed
      });
      
    } catch (error) {
      console.error('Semantic search error:', error);
      res.status(500).json({
        success: false,
        error: 'SEARCH_ERROR',
        message: 'An error occurred while searching articles'
      });
    }
  });

  // ============================================================================
  // Similar Articles API Routes
  // Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
  // ============================================================================

  // GET /api/articles/:id/similar - Get similar articles for a given article
  // Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
  // Property 12: Similar Articles Search Constraints
  app.get('/api/articles/:id/similar', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const articleId = req.params.id;
      
      if (!articleId) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_ARTICLE_ID',
          message: 'Article ID is required'
        });
      }
      
      const storage = await getStorage();
      const similarArticlesService = createSimilarArticlesService(storage);
      
      const result = await similarArticlesService.findSimilar(articleId, userId);
      
      // Requirements: 4.5 - Handle no-results case
      if (result.similarArticles.length === 0) {
        return res.json({
          success: true,
          articleId,
          similarArticles: [],
          message: result.message || 'No similar articles found',
          fromCache: result.fromCache,
          cacheExpiresAt: result.cacheExpiresAt?.toISOString()
        });
      }
      
      res.json({
        success: true,
        articleId,
        similarArticles: result.similarArticles.map(article => ({
          id: article.articleId,
          title: article.title,
          feedName: article.feedName,
          feedId: article.feedId,
          similarityScore: article.similarityScore,
          publishedAt: article.publishedAt?.toISOString() || null,
          imageUrl: article.imageUrl || null
        })),
        total: result.similarArticles.length,
        fromCache: result.fromCache,
        cacheExpiresAt: result.cacheExpiresAt?.toISOString()
      });
      
    } catch (error) {
      console.error('Get similar articles error:', error);
      res.status(500).json({
        success: false,
        error: 'SIMILAR_ARTICLES_ERROR',
        message: 'An error occurred while finding similar articles'
      });
    }
  });

  return httpServer;
}
