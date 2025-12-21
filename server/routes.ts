import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { getStorage } from "./storage";
import { requireAuth, requireNoAuth, createSupabaseClient } from "./auth-middleware";
import { syncFeeds, syncFeed } from "./rss-sync";
import { FeedFilteringValidator, type FilterOptions, validateFilterOptions, filterFeedsByInterestsWithMapping } from "./feed-filtering-validation";
import { categoryMappingService } from "@shared/category-mapping";
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
      
      const storage = await getStorage();
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
      
      // Start RSS synchronization for feeds
      console.log(`Starting RSS sync for ${feedsToSync.length} feeds for user ${userId}`);
      
      // Process feeds
      const syncPromise = syncFeeds(feedsToSync, {
        maxArticles: 50, // Limit articles per feed
        respectEtag: true,
        respectLastModified: true,
        batchSize: 3, // Process 3 feeds at a time
        delayMs: 2000 // 2 second delay between batches
      });
      
      // If waitForResults is true, wait for sync to complete and return detailed results
      if (waitForResults) {
        try {
          const results = await syncPromise;
          
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
          
          console.log(`RSS sync completed for user ${userId}: ${successCount} success, ${failureCount} failed, ${newArticlesCount} new articles`);
          
          return res.json({
            success: true,
            message: 'Feed synchronization completed',
            totalFeeds: feedsToSync.length,
            successfulSyncs: successCount,
            failedSyncs: failureCount,
            newArticles: newArticlesCount,
            updatedArticles: updatedArticlesCount,
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
      
      // Update feed settings
      // For now, we'll simulate the update
      // In production, this would update the feed in the database
      
      res.json({
        message: 'Feed updated successfully',
        feedId,
        updates: { status, priority, folder_name }
      });
    } catch (error) {
      console.error('Update feed error:', error);
      res.status(500).json({
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

  // GET /api/articles - Get user's article feed
  // OPTIMIZED: Uses parallel queries instead of sequential N+1 pattern
  app.get('/api/articles', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 50;
      
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
      const articlesPerFeed = Math.ceil(limit / userFeeds.length);
      const feedArticlePromises = userFeeds.map(async (feed) => {
        try {
          const feedArticles = await storage.getArticlesByFeedId(feed.id, articlesPerFeed);
          
          // Add feed information to each article
          return feedArticles.map(article => ({
            ...article,
            feed_name: feed.name,
            feed_url: feed.site_url || feed.url,
            feed_icon: feed.icon_url
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
      
      // Limit results
      const limitedArticles = allArticles.slice(0, limit);
      
      res.json({
        articles: limitedArticles,
        total: limitedArticles.length,
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

  return httpServer;
}
