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

  // Debug endpoint for read state (temporary - for debugging)
  app.get('/api/debug/read-state', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const storage = await getStorage();
      
      // Get all user article states
      const { data: userArticles, error } = await (storage as any).supabase
        .from('user_articles')
        .select('*')
        .eq('user_id', userId)
        .limit(50);
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      const readArticles = userArticles?.filter((ua: any) => ua.is_read) || [];
      const starredArticles = userArticles?.filter((ua: any) => ua.is_starred) || [];
      
      res.json({
        userId,
        totalRecords: userArticles?.length || 0,
        readCount: readArticles.length,
        starredCount: starredArticles.length,
        sampleRecords: userArticles?.slice(0, 10).map((ua: any) => ({
          article_id: ua.article_id?.substring(0, 8) + '...',
          is_read: ua.is_read,
          is_starred: ua.is_starred,
          read_at: ua.read_at,
          updated_at: ua.updated_at
        })),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Debug failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // AI Diagnostic Route (for debugging clustering issues)
  app.get('/api/ai-status', async (req: Request, res: Response) => {
    try {
      const storage = await getStorage();
      
      // Check AI service availability
      const anthropicAvailable = isClusteringAvailable();
      const summaryAvailable = isAISummaryAvailable();
      
      // Get some stats
      const recommendedFeeds = await storage.getRecommendedFeeds();
      
      res.json({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        ai: {
          anthropicConfigured: anthropicAvailable,
          openaiConfigured: !!process.env.OPENAI_API_KEY,
          summaryAvailable,
          clusteringAvailable: anthropicAvailable
        },
        database: {
          supabaseConfigured: !!process.env.SUPABASE_URL,
          recommendedFeedsCount: recommendedFeeds.length
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Diagnostic failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test endpoint for clusters (no auth required for debugging)
  app.get('/api/test-clusters', async (req: Request, res: Response) => {
    try {
      const storage = await getStorage();
      console.log('📊 Test clusters endpoint called');
      
      const clusters = await storage.getClusters({
        userId: undefined,
        includeExpired: false,
        limit: 10
      });
      
      console.log(`📊 Test clusters returned ${clusters.length} clusters`);
      
      res.json({
        success: true,
        clusterCount: clusters.length,
        clusters: clusters.map(c => ({
          id: c.id,
          title: c.title,
          articleCount: c.article_count,
          expiresAt: c.expires_at
        })),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('📊 Test clusters error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
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

  // GET /api/feeds/categories - Get distinct categories from recommended_feeds with feed counts
  app.get('/api/feeds/categories', requireAuth, async (req: Request, res: Response) => {
    try {
      const storage = await getStorage();
      const categories = await storage.getCategories();
      
      res.json({
        categories,
        total: categories.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({
        error: 'Failed to get categories',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
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

  // POST /api/feeds/subscribe-by-url - Subscribe to a feed by URL
  // Looks up the recommended feed by URL and subscribes the user
  app.post('/api/feeds/subscribe-by-url', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { url, name, category } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Feed URL is required'
        });
      }
      
      const storage = await getStorage();
      
      // Check feed limit before subscribing
      const currentCount = await storage.getUserFeedCount(userId);
      const maxAllowed = 25;
      
      if (currentCount >= maxAllowed) {
        return res.status(400).json({
          error: 'FEED_LIMIT_EXCEEDED',
          message: `Cannot subscribe: you have ${currentCount}/${maxAllowed} feeds. Remove some feeds to add new ones.`,
          currentCount,
          maxAllowed
        });
      }
      
      // Look up the recommended feed by URL
      const recommendedFeeds = await storage.getRecommendedFeeds();
      const matchingFeed = recommendedFeeds.find(f => 
        f.url.toLowerCase() === url.toLowerCase() ||
        f.url.toLowerCase().replace(/\/$/, '') === url.toLowerCase().replace(/\/$/, '')
      );
      
      if (matchingFeed) {
        // Subscribe using the UUID from the recommended feed
        await storage.subscribeToFeeds(userId, [matchingFeed.id]);
        
        // Mark onboarding as completed
        const user = req.user!;
        if (!user.onboarding_completed) {
          await storage.updateUser(userId, { onboarding_completed: true });
        }
        
        return res.json({
          success: true,
          message: 'Successfully subscribed to feed',
          feedId: matchingFeed.id,
          feedName: matchingFeed.name
        });
      }
      
      // Feed not in recommended list - create a custom feed subscription
      // For now, return an error suggesting to use the custom feed flow
      return res.status(404).json({
        error: 'Feed not found',
        message: 'This feed is not in our recommended list. Please use the custom URL feature to add it.',
        suggestion: 'custom'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Subscribe by URL error:', errorMessage, error);
      res.status(500).json({
        error: 'Failed to subscribe to feed',
        message: errorMessage
      });
    }
  });

  // DELETE /api/feeds/subscriptions - Clear all user subscriptions (for reset flow)
  app.delete('/api/feeds/subscriptions', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const storage = await getStorage();
      
      const removedCount = await storage.clearUserSubscriptions(userId);
      
      // Trigger cluster regeneration in background to clean up stale clusters
      // The next 5-minute cycle will also regenerate, but this speeds up the cleanup
      try {
        const { triggerClusterGeneration } = await import('./ai-background-scheduler');
        // Don't await - let it run in background
        triggerClusterGeneration().catch(err => 
          console.warn('Background cluster regeneration failed:', err)
        );
      } catch (e) {
        // AI scheduler might not be initialized, that's ok
      }
      
      res.json({
        message: 'All subscriptions cleared',
        removed_count: removedCount
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Clear subscriptions error:', errorMessage, error);
      res.status(500).json({
        error: 'Failed to clear subscriptions',
        message: errorMessage
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
  // Requirements: 1.1, 1.5 - Validate RSS/Atom feed URL and return feed metadata
  app.post('/api/feeds/validate', requireAuth, async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({
          valid: false,
          error: 'INVALID_URL',
          message: 'Please enter a valid URL'
        });
      }
      
      // Basic URL validation
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({
          valid: false,
          error: 'INVALID_URL',
          message: 'Please enter a valid URL'
        });
      }
      
      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({
          valid: false,
          error: 'INVALID_URL',
          message: 'URL must use HTTP or HTTPS protocol'
        });
      }
      
      // Import RSS parser dynamically to avoid circular dependencies
      const Parser = (await import('rss-parser')).default;
      const parser = new Parser({
        timeout: 15000, // 15 second timeout for validation
        headers: {
          'User-Agent': 'Cronkite News Aggregator/1.0 (+https://cronkite.app)',
          'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml'
        }
      });
      
      try {
        // Fetch and parse the RSS feed
        const feed = await parser.parseURL(url);
        
        // Extract feed metadata
        const feedTitle = feed.title || `Feed from ${parsedUrl.hostname}`;
        const feedDescription = feed.description || feed.subtitle || `RSS feed from ${parsedUrl.hostname}`;
        const feedLink = feed.link || parsedUrl.origin;
        const feedImage = feed.image?.url || feed.itunes?.image || null;
        const articleCount = feed.items?.length || 0;
        
        console.log(`✅ Feed validation successful: ${feedTitle} (${articleCount} articles)`);
        
        res.json({
          valid: true,
          name: feedTitle,
          description: feedDescription,
          siteUrl: feedLink,
          iconUrl: feedImage,
          articleCount,
          language: feed.language || 'en'
        });
        
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
        console.log(`❌ Feed validation failed for ${url}: ${errorMessage}`);
        
        // Provide user-friendly error messages
        if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
          return res.status(504).json({
            valid: false,
            error: 'TIMEOUT',
            message: 'Could not reach the feed URL. Please check the URL and try again.'
          });
        }
        
        if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
          return res.status(400).json({
            valid: false,
            error: 'NOT_FOUND',
            message: 'Could not find the server. Please check the URL.'
          });
        }
        
        if (errorMessage.includes('Non-whitespace before first tag') || 
            errorMessage.includes('Invalid XML') ||
            errorMessage.includes('Unexpected close tag')) {
          return res.status(400).json({
            valid: false,
            error: 'NOT_RSS_FEED',
            message: 'Could not find a valid RSS or Atom feed at this URL'
          });
        }
        
        return res.status(400).json({
          valid: false,
          error: 'NOT_RSS_FEED',
          message: 'Could not find a valid RSS or Atom feed at this URL'
        });
      }
      
    } catch (error) {
      console.error('Feed validation error:', error);
      res.status(500).json({
        valid: false,
        error: 'VALIDATION_ERROR',
        message: 'An error occurred while validating the feed'
      });
    }
  });
  
  // POST /api/feeds/custom - Add a custom feed
  // Requirements: 1.2, 1.3, 1.4, 1.6 - Create custom feed with validation and persistence
  app.post('/api/feeds/custom', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { url, name, description, siteUrl, iconUrl, category } = req.body;
      
      // Validate required fields
      if (!url || typeof url !== 'string') {
        return res.status(400).json({
          error: 'INVALID_URL',
          message: 'Please enter a valid URL'
        });
      }
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({
          error: 'INVALID_NAME',
          message: 'Feed name is required'
        });
      }
      
      // Validate URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({
          error: 'INVALID_URL',
          message: 'Please enter a valid URL'
        });
      }
      
      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({
          error: 'INVALID_URL',
          message: 'URL must use HTTP or HTTPS protocol'
        });
      }
      
      const storage = await getStorage();
      
      // Check if feed already exists
      const existingFeed = await storage.getRecommendedFeedByUrl(url);
      if (existingFeed) {
        return res.status(409).json({
          error: 'FEED_EXISTS',
          message: 'This feed has already been added',
          feedId: existingFeed.id,
          feed: {
            id: existingFeed.id,
            name: existingFeed.name,
            url: existingFeed.url,
            description: existingFeed.description,
            category: existingFeed.category
          }
        });
      }
      
      // Validate the feed URL by fetching and parsing it
      const Parser = (await import('rss-parser')).default;
      const parser = new Parser({
        timeout: 15000,
        headers: {
          'User-Agent': 'Cronkite News Aggregator/1.0 (+https://cronkite.app)',
          'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml'
        }
      });
      
      try {
        // Validate the feed is actually an RSS/Atom feed
        await parser.parseURL(url);
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
        console.log(`❌ Custom feed validation failed for ${url}: ${errorMessage}`);
        
        if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
          return res.status(504).json({
            error: 'TIMEOUT',
            message: 'Could not reach the feed URL. Please check the URL and try again.'
          });
        }
        
        return res.status(400).json({
          error: 'NOT_RSS_FEED',
          message: 'Could not find a valid RSS or Atom feed at this URL'
        });
      }
      
      // Create the custom feed in the database
      try {
        const customFeed = await storage.createCustomFeed({
          url,
          name,
          description: description || undefined,
          siteUrl: siteUrl || undefined,
          iconUrl: iconUrl || undefined,
          category: category || 'Custom',
          createdBy: userId
        });
        
        console.log(`✅ Custom feed created: ${customFeed.name} (${customFeed.id}) by user ${userId}`);
        
        res.status(201).json({
          feedId: customFeed.id,
          message: 'Custom feed added successfully',
          feed: {
            id: customFeed.id,
            name: customFeed.name,
            url: customFeed.url,
            description: customFeed.description,
            category: customFeed.category
          }
        });
        
      } catch (dbError) {
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
        console.error(`❌ Database error creating custom feed: ${errorMessage}`);
        
        // Check for duplicate key error (race condition)
        if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
          const existingFeed = await storage.getRecommendedFeedByUrl(url);
          if (existingFeed) {
            return res.status(409).json({
              error: 'FEED_EXISTS',
              message: 'This feed has already been added',
              feedId: existingFeed.id,
              feed: {
                id: existingFeed.id,
                name: existingFeed.name,
                url: existingFeed.url,
                description: existingFeed.description,
                category: existingFeed.category
              }
            });
          }
        }
        
        return res.status(500).json({
          error: 'DB_ERROR',
          message: 'An error occurred. Please try again.'
        });
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Add custom feed error:', errorMessage);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
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
      
      // Get user article states (is_read, is_starred, engagement_signal) in batch
      const articleIds = allArticles.map(a => a.id);
      const userArticleStates = await storage.getUserArticleStates(userId, articleIds);
      
      console.log('📖 GET /api/articles - userArticleStates:', {
        totalArticles: allArticles.length,
        statesFound: userArticleStates.size,
        readCount: Array.from(userArticleStates.values()).filter(s => s.is_read).length,
        starredCount: Array.from(userArticleStates.values()).filter(s => s.is_starred).length
      });
      
      // Merge user states into articles
      const articlesWithState = allArticles.map(article => {
        const userState = userArticleStates.get(article.id);
        return {
          ...article,
          is_read: userState?.is_read || false,
          is_starred: userState?.is_starred || false,
          engagement_signal: userState?.engagement_signal || null
        };
      });
      
      // Sort by published date (newest first)
      articlesWithState.sort((a, b) => {
        const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return dateB - dateA;
      });
      
      // Return all articles - frontend handles date-based pagination (7-day chunks)
      res.json({
        articles: articlesWithState,
        total: articlesWithState.length,
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

  // GET /api/articles/starred - Get all starred articles
  // Requirements: 7.3
  // NOTE: This route MUST be defined BEFORE /api/articles/:id to prevent "starred" being treated as an ID
  app.get('/api/articles/starred', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
      
      console.log('⭐ GET /api/articles/starred called:', { userId, limit, offset });
      
      const storage = await getStorage();
      console.log('⭐ Storage type:', storage.constructor.name);
      
      const starredArticles = await storage.getStarredArticles(userId, limit, offset);
      console.log('⭐ getStarredArticles returned:', starredArticles.length, 'articles');
      
      // Get user's feeds to add feed information to articles
      const userFeeds = await storage.getUserFeeds(userId);
      const feedMap = new Map(userFeeds.map(feed => [feed.id, feed]));
      console.log('⭐ User has', userFeeds.length, 'feeds');
      
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
      
      console.log('⭐ Returning', articlesWithFeedInfo.length, 'starred articles');
      
      res.json({
        articles: articlesWithFeedInfo,
        total: articlesWithFeedInfo.length
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Get starred articles error:', {
        message: errorMessage,
        userId: req.user?.id
      });
      res.status(500).json({
        error: 'STARRED_ARTICLES_ERROR',
        message: errorMessage
      });
    }
  });

  // GET /api/articles/read - Get all read articles
  // Requirements: 6.1, 6.2
  // NOTE: This route MUST be defined BEFORE /api/articles/:id to prevent "read" being treated as an ID
  app.get('/api/articles/read', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
      
      console.log('📖 GET /api/articles/read called:', { userId, limit, offset });
      
      const storage = await getStorage();
      console.log('📖 Storage type:', storage.constructor.name);
      
      const readArticles = await storage.getReadArticles(userId, limit, offset);
      console.log('📖 getReadArticles returned:', readArticles.length, 'articles');
      
      // Get user's feeds to add feed information to articles
      const userFeeds = await storage.getUserFeeds(userId);
      const feedMap = new Map(userFeeds.map(feed => [feed.id, feed]));
      console.log('📖 User has', userFeeds.length, 'feeds');
      
      // Add feed information to each article
      const articlesWithFeedInfo = readArticles.map(article => {
        const feed = feedMap.get(article.feed_id);
        return {
          ...article,
          feed_name: feed?.name || 'Unknown Source',
          feed_url: feed?.site_url || feed?.url,
          feed_icon: feed?.icon_url,
          feed_category: feed?.folder_name || 'General'
        };
      });
      
      console.log('📖 Returning', articlesWithFeedInfo.length, 'read articles');
      
      res.json({
        articles: articlesWithFeedInfo,
        total: articlesWithFeedInfo.length
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Get read articles error:', {
        message: errorMessage,
        userId: req.user?.id
      });
      res.status(500).json({
        error: 'READ_ARTICLES_ERROR',
        message: errorMessage
      });
    }
  });

  // GET /api/articles/:id - Get a single article by ID
  app.get('/api/articles/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const articleId = req.params.id;
      
      if (!articleId) {
        return res.status(400).json({
          error: 'Missing article ID',
          message: 'Article ID is required'
        });
      }
      
      const storage = await getStorage();
      
      // Get the article
      const article = await storage.getArticleById(articleId);
      
      if (!article) {
        return res.status(404).json({
          error: 'Article not found',
          message: 'The requested article does not exist'
        });
      }
      
      // Get the feed to include feed info
      const feed = await storage.getFeedById(article.feed_id);
      
      // Get user's article state
      const userArticleState = await storage.getUserArticleState(userId, articleId);
      
      res.json({
        article: {
          ...article,
          feed_name: feed?.name || 'Unknown Source',
          feed_url: feed?.url || null,
          feed_icon: feed?.icon_url || null,
          feed_category: feed?.folder_name || 'General',
          is_read: userArticleState?.is_read || false,
          is_starred: userArticleState?.is_starred || false,
          engagement_signal: userArticleState?.engagement_signal || null
        }
      });
    } catch (error) {
      console.error('Get article error:', error);
      res.status(500).json({
        error: 'Failed to get article',
        message: 'An error occurred while retrieving the article'
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

  // POST /api/ai/trigger-embeddings - Manual embedding queue processing
  // Requirements: 3.5, 3.6, 7.5
  app.post('/api/ai/trigger-embeddings', requireAuth, async (req: Request, res: Response) => {
    try {
      const { triggerEmbeddingProcessing } = await import('./ai-background-scheduler');
      
      const result = await triggerEmbeddingProcessing();
      
      res.json({
        success: true,
        message: 'Embedding processing triggered',
        result: {
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Trigger embeddings error:', error);
      res.status(500).json({
        success: false,
        error: 'TRIGGER_EMBEDDINGS_ERROR',
        message: 'An error occurred while triggering embedding processing'
      });
    }
  });

  // POST /api/ai/trigger-clustering - Manual cluster generation
  // Requirements: 3.5, 3.6, 7.5
  app.post('/api/ai/trigger-clustering', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { triggerClusterGeneration } = await import('./ai-background-scheduler');
      
      // Generate clusters for the current user
      const result = await triggerClusterGeneration(userId);
      
      res.json({
        success: true,
        message: 'Cluster generation triggered',
        result: {
          clustersCreated: result.clustersCreated,
          articlesProcessed: result.articlesProcessed
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Trigger clustering error:', error);
      res.status(500).json({
        success: false,
        error: 'TRIGGER_CLUSTERING_ERROR',
        message: 'An error occurred while triggering cluster generation'
      });
    }
  });

  // GET /api/ai/scheduler-stats - Get scheduler statistics and status
  // Requirements: 3.5, 3.6, 7.5
  app.get('/api/ai/scheduler-stats', requireAuth, async (req: Request, res: Response) => {
    try {
      const { getSchedulerStats } = await import('./ai-background-scheduler');
      
      const stats = getSchedulerStats();
      
      res.json({
        success: true,
        scheduler: {
          isRunning: stats.isRunning,
          services: stats.services,
          stats: {
            embeddingsProcessed: stats.embeddingsProcessed,
            embeddingsFailed: stats.embeddingsFailed,
            clustersGenerated: stats.clustersGenerated,
            clustersExpired: stats.clustersExpired
          },
          lastRuns: {
            embedding: stats.lastEmbeddingRun?.toISOString() || null,
            clustering: stats.lastClusteringRun?.toISOString() || null,
            cleanup: stats.lastCleanupRun?.toISOString() || null
          },
          recentErrors: stats.errors
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get scheduler stats error:', error);
      res.status(500).json({
        success: false,
        error: 'SCHEDULER_STATS_ERROR',
        message: 'An error occurred while retrieving scheduler statistics'
      });
    }
  });

  // GET /api/clusters - Get trending topic clusters
  // Requirements: 2.5, 2.7, 9.5 - Vector-based clustering with relevance scores and graceful degradation
  // Note: Clusters are global (not user-specific), but we still require auth for access control
  app.get('/api/clusters', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const forceRefresh = req.query.refresh === 'true'; // Force regenerate clusters
      
      console.log(`📊 Fetching clusters for user ${userId}, limit: ${limit}, forceRefresh: ${forceRefresh}`);
      console.log(`📊 req.user exists: ${!!req.user}, req.user.id: ${req.user?.id}`);
      
      const storage = await getStorage();
      console.log(`📊 Storage type: ${storage.constructor.name}`);
      
      // Try to get cached clusters first (unless force refresh)
      // Clusters are global, not user-specific
      if (!forceRefresh) {
        try {
          console.log(`📊 Attempting to get cached clusters...`);
          
          // First, try direct storage.getClusters call to debug
          console.log(`📊 Testing direct storage.getClusters...`);
          const directClusters = await storage.getClusters({
            userId: undefined,
            includeExpired: false,
            limit
          });
          console.log(`📊 Direct storage.getClusters returned ${directClusters.length} clusters`);
          
          if (directClusters.length > 0) {
            console.log(`📊 First cluster: ${directClusters[0].title}`);
            
            // Map clusters with article IDs from the cluster record
            const clustersWithArticleIds = directClusters.map((cluster) => {
              // Use article_ids stored directly in cluster, fallback to empty array
              const articleIds = cluster.article_ids || [];
              // Handle timestamps - Supabase returns strings, not Date objects
              const timeframeEnd = cluster.timeframe_end 
                ? (typeof cluster.timeframe_end === 'string' ? cluster.timeframe_end : cluster.timeframe_end.toISOString())
                : new Date().toISOString();
              const expiresAt = cluster.expires_at
                ? (typeof cluster.expires_at === 'string' ? cluster.expires_at : cluster.expires_at.toISOString())
                : new Date().toISOString();
              return {
                id: cluster.id,
                topic: cluster.title,
                summary: cluster.summary || '',
                articleIds,
                articleCount: cluster.article_count,
                sources: cluster.source_feeds || [],
                avgSimilarity: parseFloat(cluster.avg_similarity || '0'),
                relevanceScore: parseFloat(cluster.relevance_score || '0'),
                latestTimestamp: timeframeEnd,
                expiresAt: expiresAt
              };
            });
            
            const response = {
              clusters: clustersWithArticleIds,
              articlesAnalyzed: directClusters.reduce((sum, c) => sum + c.article_count, 0),
              generatedAt: new Date().toISOString(),
              method: 'vector',
              cached: true
            };
            console.log(`📊 Returning ${response.clusters.length} clusters from direct storage call`);
            return res.json(response);
          }
          
          console.log(`📊 No clusters from direct call, trying ClusteringServiceManager...`);
          const { createClusteringServiceManager } = await import('./clustering-service');
          const clusteringService = createClusteringServiceManager(storage as any);
          const cachedClusters = await clusteringService.getUserClusters(undefined, limit); // Pass undefined for global clusters
          
          console.log(`📊 Got ${cachedClusters.length} cached clusters from service`);
          
          if (cachedClusters.length > 0) {
            console.log(`📊 Returning ${cachedClusters.length} cached clusters`);
            
            // Use articleIds directly from cached clusters (already populated by service)
            const clustersWithArticleIds = cachedClusters.map((cluster) => {
              // Handle timestamps - may be Date objects or strings
              const latestTs = cluster.latestTimestamp
                ? (typeof cluster.latestTimestamp === 'string' ? cluster.latestTimestamp : cluster.latestTimestamp.toISOString())
                : new Date().toISOString();
              const expiresTs = cluster.expiresAt
                ? (typeof cluster.expiresAt === 'string' ? cluster.expiresAt : cluster.expiresAt.toISOString())
                : new Date().toISOString();
              return {
                id: cluster.id,
                topic: cluster.topic,
                summary: cluster.summary,
                articleIds: cluster.articleIds || [],
                articleCount: cluster.articleCount,
                sources: cluster.sources,
                avgSimilarity: cluster.avgSimilarity,
                relevanceScore: cluster.relevanceScore,
                latestTimestamp: latestTs,
                expiresAt: expiresTs
              };
            });
            
            const response = {
              clusters: clustersWithArticleIds,
              articlesAnalyzed: cachedClusters.reduce((sum, c) => sum + c.articleCount, 0),
              generatedAt: new Date().toISOString(),
              method: 'vector',
              cached: true
            };
            console.log(`📊 Response cluster count: ${response.clusters.length}`);
            return res.json(response);
          } else {
            console.log(`📊 No cached clusters found`);
          }
        } catch (cacheError) {
          console.warn('📊 Failed to get cached clusters:', cacheError instanceof Error ? cacheError.message : cacheError);
          console.warn('📊 Cache error stack:', cacheError instanceof Error ? cacheError.stack : 'no stack');
        }
      }
      
      // No cached clusters - check if user has feeds for on-demand generation
      const userFeeds = await storage.getUserFeeds(userId);
      console.log(`📊 User has ${userFeeds.length} feeds`);
      
      if (userFeeds.length === 0) {
        console.log(`📊 No feeds for user, returning empty clusters (no on-demand generation possible)`);
        return res.json({ clusters: [], message: 'No feeds subscribed - subscribe to feeds to see trending topics' });
      }
      
      // No cached clusters - generate on-demand using text-based method
      console.log(`📊 Generating clusters on-demand using text-based method`);
      
      const feedArticlePromises = userFeeds.map(async (feed) => {
        try {
          const feedArticles = await storage.getArticlesByFeedId(feed.id, 20);
          return feedArticles.map(article => {
            // Handle published_at - may be Date object or string from Supabase
            let publishedAt: string | undefined;
            if (article.published_at) {
              publishedAt = typeof article.published_at === 'string' 
                ? article.published_at 
                : article.published_at.toISOString();
            }
            return {
              id: article.id,
              title: article.title,
              excerpt: article.excerpt || '',
              source: feed.name,
              published_at: publishedAt
            };
          });
        } catch {
          return [];
        }
      });
      
      const feedArticlesArrays = await Promise.all(feedArticlePromises);
      const allArticles = feedArticlesArrays.flat();
      
      console.log(`📊 Found ${allArticles.length} total articles for clustering`);
      
      // Sort by date and take most recent
      allArticles.sort((a, b) => {
        const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return dateB - dateA;
      });
      
      const recentArticles = allArticles.slice(0, 50);
      
      console.log(`📊 Using ${recentArticles.length} recent articles for clustering`);
      
      // Generate clusters using text-based method (Anthropic)
      const clusters = await clusterArticles(recentArticles);
      
      console.log(`📊 Generated ${clusters.length} text-based clusters`);
      
      res.json({
        clusters,
        articlesAnalyzed: recentArticles.length,
        generatedAt: new Date().toISOString(),
        method: 'text',
        onDemand: true
      });
    } catch (error) {
      console.error('📊 Clustering error:', error);
      console.error('📊 Clustering error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('📊 Clustering error stack:', error instanceof Error ? error.stack : 'No stack');
      res.status(500).json({
        error: 'Clustering failed',
        message: error instanceof Error ? error.message : 'An error occurred while generating topic clusters',
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

  // GET /api/feeds/article-counts - Get article counts per feed for the user
  app.get('/api/feeds/article-counts', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      const storage = await getStorage();
      const countsByFeed = await storage.getArticleCountsByFeed(userId);
      
      // Convert Map to object for JSON response
      const counts: Record<string, number> = {};
      let totalArticles = 0;
      
      countsByFeed.forEach((count, feedId) => {
        counts[feedId] = count;
        totalArticles += count;
      });
      
      res.json({
        counts,
        totalArticles
      });
      
    } catch (error) {
      console.error('Get article counts error:', error);
      res.status(500).json({
        error: 'ARTICLE_COUNTS_ERROR',
        message: 'An error occurred while retrieving article counts'
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
      
      console.log('📖 PUT /api/articles/:articleId/read called:', { userId, articleId, isRead });
      
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
      console.log('📖 Calling storage.markArticleRead...');
      const userArticle = await storage.markArticleRead(userId, articleId, isRead);
      console.log('📖 markArticleRead result:', { is_read: userArticle.is_read, read_at: userArticle.read_at });
      
      // Handle read_at which could be Date, string, or null
      let readAtStr: string | null = null;
      if (userArticle.read_at) {
        readAtStr = userArticle.read_at instanceof Date 
          ? userArticle.read_at.toISOString() 
          : String(userArticle.read_at);
      }
      
      res.json({
        success: true,
        articleId,
        isRead: userArticle.is_read,
        readAt: readAtStr
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Mark article read error:', {
        message: errorMessage,
        userId: req.user?.id,
        articleId: req.params.articleId
      });
      res.status(500).json({
        success: false,
        error: 'READ_STATE_ERROR',
        message: errorMessage
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
      
      // Handle starred_at which could be Date, string, or null
      let starredAtStr: string | null = null;
      if (userArticle.starred_at) {
        starredAtStr = userArticle.starred_at instanceof Date 
          ? userArticle.starred_at.toISOString() 
          : String(userArticle.starred_at);
      }
      
      res.json({
        success: true,
        articleId,
        isStarred: userArticle.is_starred,
        starredAt: starredAtStr
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('Mark article starred error:', {
        message: errorMessage,
        stack: errorStack,
        userId: req.user?.id,
        articleId: req.params.articleId
      });
      res.status(500).json({
        success: false,
        error: 'STARRED_STATE_ERROR',
        message: errorMessage // Return actual error for debugging
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
      
      // Handle engagement_signal_at which could be Date, string, or null
      let signalAtStr: string | null = null;
      if (userArticle.engagement_signal_at) {
        signalAtStr = userArticle.engagement_signal_at instanceof Date 
          ? userArticle.engagement_signal_at.toISOString() 
          : String(userArticle.engagement_signal_at);
      }
      
      res.json({
        success: true,
        articleId,
        signal: userArticle.engagement_signal,
        signalAt: signalAtStr
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Set engagement signal error:', {
        message: errorMessage,
        userId: req.user?.id,
        articleId: req.params.articleId
      });
      res.status(500).json({
        success: false,
        error: 'ENGAGEMENT_SIGNAL_ERROR',
        message: errorMessage
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

  // ============================================================================
  // Admin Routes - Feed Management
  // ============================================================================

  // GET /api/admin/feeds - Get all recommended feeds with health status
  app.get('/api/admin/feeds', requireAuth, async (req: Request, res: Response) => {
    try {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      if (!supabase) {
        return res.status(500).json({ error: 'Database not available' });
      }
      
      const { data: feeds, error } = await supabase
        .from('recommended_feeds')
        .select('id, name, url, category, popularity_score, is_featured, created_at')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      // Map to health format (status will be 'pending' until audit runs)
      const feedsWithHealth = (feeds || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        url: f.url,
        category: f.category,
        status: 'pending',
        totalArticles: 0,
        articlesLast30Days: 0,
      }));
      
      res.json({ feeds: feedsWithHealth });
    } catch (error) {
      console.error('Admin get feeds error:', error);
      res.status(500).json({ error: 'Failed to get feeds' });
    }
  });

  // POST /api/admin/feeds/:id/test - Test a single feed
  app.post('/api/admin/feeds/:id/test', requireAuth, async (req: Request, res: Response) => {
    try {
      const feedId = req.params.id;
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      // Get feed URL
      const { data: feed, error: fetchError } = await supabase
        .from('recommended_feeds')
        .select('id, name, url, category')
        .eq('id', feedId)
        .single();
      
      if (fetchError || !feed) {
        return res.status(404).json({ error: 'Feed not found' });
      }
      
      // Test the feed
      const Parser = (await import('rss-parser')).default;
      const parser = new Parser({
        timeout: 15000,
        headers: {
          'User-Agent': 'Cronkite/1.0 (RSS Reader)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      });
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      try {
        const startTime = Date.now();
        const parsed = await parser.parseURL(feed.url);
        const responseTime = Date.now() - startTime;
        
        const items = parsed.items || [];
        let articlesLast30Days = 0;
        let latestDate: Date | null = null;
        
        for (const item of items) {
          const pubDate = item.pubDate || item.isoDate;
          if (pubDate) {
            const articleDate = new Date(pubDate);
            if (!latestDate || articleDate > latestDate) {
              latestDate = articleDate;
            }
            if (articleDate >= thirtyDaysAgo) {
              articlesLast30Days++;
            }
          }
        }
        
        let status: string = 'healthy';
        if (items.length === 0) {
          status = 'empty';
        } else if (articlesLast30Days === 0) {
          status = 'stale';
        }
        
        res.json({
          feed: {
            id: feed.id,
            name: feed.name,
            url: feed.url,
            category: feed.category,
            status,
            totalArticles: items.length,
            articlesLast30Days,
            latestArticleDate: latestDate?.toISOString(),
            responseTimeMs: responseTime,
            lastChecked: new Date().toISOString()
          }
        });
      } catch (parseError: any) {
        let httpStatus: number | undefined;
        if (parseError.message?.includes('Status code')) {
          const match = parseError.message.match(/Status code (\d+)/);
          if (match) httpStatus = parseInt(match[1], 10);
        }
        
        res.json({
          feed: {
            id: feed.id,
            name: feed.name,
            url: feed.url,
            category: feed.category,
            status: 'error',
            error: parseError.message,
            httpStatus,
            totalArticles: 0,
            articlesLast30Days: 0,
            lastChecked: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Admin test feed error:', error);
      res.status(500).json({ error: 'Failed to test feed' });
    }
  });

  // DELETE /api/admin/feeds/:id - Remove a recommended feed
  app.delete('/api/admin/feeds/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const feedId = req.params.id;
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      const { error } = await supabase
        .from('recommended_feeds')
        .delete()
        .eq('id', feedId);
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Admin delete feed error:', error);
      res.status(500).json({ error: 'Failed to delete feed' });
    }
  });

  // POST /api/admin/feeds/remove-broken - Remove all broken feeds
  app.post('/api/admin/feeds/remove-broken', requireAuth, async (req: Request, res: Response) => {
    try {
      const { feedIds } = req.body;
      
      if (!feedIds || !Array.isArray(feedIds)) {
        return res.status(400).json({ error: 'feedIds array required' });
      }
      
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      const { error } = await supabase
        .from('recommended_feeds')
        .delete()
        .in('id', feedIds);
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      res.json({ success: true, removed: feedIds.length });
    } catch (error) {
      console.error('Admin remove broken feeds error:', error);
      res.status(500).json({ error: 'Failed to remove broken feeds' });
    }
  });

  // POST /api/admin/feeds/audit - Run health audit on all feeds (streaming)
  app.post('/api/admin/feeds/audit', requireAuth, async (req: Request, res: Response) => {
    try {
      const storage = await getStorage();
      const supabase = (storage as any).supabase;
      
      // Get all feeds
      const { data: feeds, error } = await supabase
        .from('recommended_feeds')
        .select('id, name, url, category')
        .order('category', { ascending: true });
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const Parser = (await import('rss-parser')).default;
      const parser = new Parser({
        timeout: 15000,
        headers: {
          'User-Agent': 'Cronkite/1.0 (RSS Reader)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      });
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const results: any[] = [];
      const batchSize = 5;
      
      for (let i = 0; i < feeds.length; i += batchSize) {
        const batch = feeds.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(batch.map(async (feed: any) => {
          try {
            const startTime = Date.now();
            const parsed = await parser.parseURL(feed.url);
            const responseTime = Date.now() - startTime;
            
            const items = parsed.items || [];
            let articlesLast30Days = 0;
            let latestDate: Date | null = null;
            
            for (const item of items) {
              const pubDate = item.pubDate || item.isoDate;
              if (pubDate) {
                const articleDate = new Date(pubDate);
                if (!latestDate || articleDate > latestDate) {
                  latestDate = articleDate;
                }
                if (articleDate >= thirtyDaysAgo) {
                  articlesLast30Days++;
                }
              }
            }
            
            let status = 'healthy';
            if (items.length === 0) status = 'empty';
            else if (articlesLast30Days === 0) status = 'stale';
            
            return {
              id: feed.id,
              name: feed.name,
              url: feed.url,
              category: feed.category,
              status,
              totalArticles: items.length,
              articlesLast30Days,
              latestArticleDate: latestDate?.toISOString(),
              responseTimeMs: responseTime,
              lastChecked: new Date().toISOString()
            };
          } catch (parseError: any) {
            let httpStatus: number | undefined;
            if (parseError.message?.includes('Status code')) {
              const match = parseError.message.match(/Status code (\d+)/);
              if (match) httpStatus = parseInt(match[1], 10);
            }
            
            return {
              id: feed.id,
              name: feed.name,
              url: feed.url,
              category: feed.category,
              status: 'error',
              error: parseError.message,
              httpStatus,
              totalArticles: 0,
              articlesLast30Days: 0,
              lastChecked: new Date().toISOString()
            };
          }
        }));
        
        results.push(...batchResults);
        
        // Send progress update
        res.write(`data: ${JSON.stringify({ type: 'progress', current: Math.min(i + batchSize, feeds.length), total: feeds.length })}\n\n`);
        
        // Send individual results
        for (const result of batchResults) {
          res.write(`data: ${JSON.stringify({ type: 'result', feed: result })}\n\n`);
        }
      }
      
      // Send complete
      res.write(`data: ${JSON.stringify({ type: 'complete', feeds: results })}\n\n`);
      res.end();
      
    } catch (error) {
      console.error('Admin audit feeds error:', error);
      res.status(500).json({ error: 'Failed to audit feeds' });
    }
  });

  return httpServer;
}
