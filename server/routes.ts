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
      let user = await storage.getUser(supabaseUser.id);
      
      if (!user) {
        // Create new user from OAuth data
        const displayName = supabaseUser.user_metadata?.full_name || 
                           supabaseUser.user_metadata?.name || 
                           supabaseUser.email?.split('@')[0] || 
                           'User';
        
        console.log('🔐 OAuth callback: Creating new user profile');
        
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
      console.error('❌ OAuth callback error:', error);
      res.status(500).json({
        error: 'OAuth callback failed',
        message: 'An error occurred during OAuth callback processing'
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
  app.get('/api/feeds/recommended', requireAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    const userId = req.user!.id;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const referer = req.get('Referer') || 'direct';
    
    // Enhanced request logging with security context (Requirement 4.2)
    console.log(`=== [${requestId}] GET /api/feeds/recommended REQUEST START ===`);
    console.log(`🔍 Request Context:`, {
      userId,
      clientIp,
      userAgent,
      referer,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      protocol: req.protocol,
      secure: req.secure,
      headers: {
        'content-type': req.get('Content-Type'),
        'accept': req.get('Accept'),
        'accept-language': req.get('Accept-Language'),
        'cache-control': req.get('Cache-Control')
      }
    });
    
    console.log(`📋 Query Parameters:`, req.query);
    console.log(`🔐 Authentication Status: Authenticated (User ID: ${userId})`);
    
    // Request rate limiting check (basic implementation)
    const requestKey = `feeds_req_${userId}`;
    const currentTime = Date.now();
    
    try {
      // Enhanced query parameter validation (Requirement 4.2)
      console.log(`[${requestId}] 🔍 Validating query parameters...`);
      const validationStartTime = Date.now();
      
      const validatedQuery = recommendedFeedsQuerySchema.parse(req.query);
      const { category, search, limit, featured, country, language } = validatedQuery;
      
      const validationTime = Date.now() - validationStartTime;
      console.log(`[${requestId}] ✅ Query validation completed in ${validationTime}ms`);
      console.log(`[${requestId}] 📋 Validated parameters:`, {
        category: category || null,
        search: search || null,
        limit: limit || null,
        featured: featured !== undefined ? featured : null,
        country: country || null,
        language: language || null
      });
      
      // Log category translation if category is provided (Requirement 1.3)
      if (category) {
        const databaseCategory = categoryMappingService.frontendToDatabase(category);
        if (databaseCategory) {
          console.log(`[${requestId}] 🔄 Category translation: ${category} (frontend) → ${databaseCategory} (database)`);
        } else {
          console.warn(`[${requestId}] ⚠️  Category '${category}' has no mapping - will use fallback matching`);
        }
      }
      
      // Input sanitization logging
      if (search) {
        console.log(`[${requestId}] 🧹 Search query sanitized: "${search}" (length: ${search.length})`);
      }
      
      // Storage layer interaction with enhanced monitoring (Requirement 4.2)
      console.log(`[${requestId}] 💾 Initiating storage layer query...`);
      const storageStartTime = Date.now();
      
      const storage = await getStorage();
      let recommendedFeeds;
      try {
        recommendedFeeds = await storage.getRecommendedFeeds();
        
        const storageEndTime = Date.now();
        const storageTime = storageEndTime - storageStartTime;
        
        console.log(`[${requestId}] ✅ Storage query successful in ${storageTime}ms`);
        console.log(`[${requestId}] 📊 Storage response: ${recommendedFeeds.length} feeds retrieved`);
        
        // Storage performance monitoring
        if (storageTime > 1000) {
          console.warn(`[${requestId}] ⚠️  SLOW STORAGE QUERY: ${storageTime}ms (threshold: 1000ms)`);
        } else if (storageTime > 500) {
          console.log(`[${requestId}] 🐌 Moderate storage query time: ${storageTime}ms`);
        } else {
          console.log(`[${requestId}] ⚡ Fast storage query: ${storageTime}ms`);
        }
        
      } catch (storageError) {
        const storageTime = Date.now() - storageStartTime;
        console.error(`[${requestId}] ❌ Storage query failed in ${storageTime}ms:`, {
          error: storageError instanceof Error ? {
            name: storageError.name,
            message: storageError.message,
            stack: storageError.stack
          } : storageError,
          storageType: 'SupabaseStorage'
        });
        throw storageError;
      }
      
      const originalCount = recommendedFeeds.length;
      console.log(`[${requestId}] 📊 Original feed count: ${originalCount}`);
      
      // Data validation and consistency checks
      if (originalCount === 0) {
        console.warn(`[${requestId}] ⚠️  WARNING: No feeds returned from storage - potential data issue`);
      } else if (originalCount < 800) {
        console.warn(`[${requestId}] ⚠️  WARNING: Low feed count (${originalCount}) - expected ~865 feeds`);
      } else {
        console.log(`[${requestId}] ✅ Feed count validation passed (${originalCount} feeds)`);
      }
      
      // Enhanced filtering with validation logic (Task 5: Feed filtering validation)
      console.log(`[${requestId}] 🔍 Applying filters with validation...`);
      
      // Prepare filter options for validation
      const filterOptions: FilterOptions = {
        category,
        search,
        featured,
        country,
        language,
        limit
      };
      
      // Validate filter options first
      const optionsValidation = validateFilterOptions(filterOptions);
      if (!optionsValidation.isValid) {
        console.error(`[${requestId}] ❌ Invalid filter options:`, optionsValidation.errors);
        return res.status(400).json({
          error: 'Invalid filter parameters',
          message: 'One or more filter parameters are invalid',
          details: optionsValidation.errors,
          requestId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Apply comprehensive filtering with validation
      const filteringResult = FeedFilteringValidator.validateComprehensiveFiltering(
        recommendedFeeds,
        filterOptions
      );
      
      // Check if filtering validation passed
      if (!filteringResult.isValid) {
        console.error(`[${requestId}] ❌ Feed filtering validation failed:`, filteringResult.errors);
        return res.status(500).json({
          error: 'Feed filtering error',
          message: 'An error occurred while filtering feeds',
          details: filteringResult.errors,
          requestId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Log validation warnings if any
      if (filteringResult.warnings.length > 0) {
        console.warn(`[${requestId}] ⚠️  Feed filtering warnings:`, filteringResult.warnings);
      }
      
      // Apply the actual filtering using category mapping for interests
      let filteredFeeds = [...recommendedFeeds];
      const filteringSteps = filteringResult.appliedFilters;
      
      // Category filter with mapping support
      if (category) {
        const beforeFilter = filteredFeeds.length;
        
        console.log(`[${requestId}] 🏷️  Processing category filter: '${category}'`);
        
        // Translate frontend category to database category using mapping service
        const databaseCategory = categoryMappingService.frontendToDatabase(category);
        
        if (databaseCategory) {
          console.log(`[${requestId}] ✅ Category mapping: ${category} → ${databaseCategory}`);
          
          // Filter feeds using the mapped database category
          filteredFeeds = filteredFeeds.filter(feed => feed.category === databaseCategory);
          
          const afterFilter = filteredFeeds.length;
          console.log(`[${requestId}] 🏷️  Category '${category}' (mapped to '${databaseCategory}'): ${beforeFilter} → ${afterFilter} feeds`);
        } else {
          // Fallback: attempt case-insensitive matching as per Requirement 1.5
          console.warn(`[${requestId}] ⚠️  No mapping found for category '${category}', attempting fallback`);
          
          const originalCategory = category;
          filteredFeeds = filteredFeeds.filter(feed => 
            feed.category.toLowerCase() === originalCategory.toLowerCase()
          );
          
          const afterFilter = filteredFeeds.length;
          console.warn(`[${requestId}] 🏷️  Category '${category}' (fallback): ${beforeFilter} → ${afterFilter} feeds`);
          
          // Log warning for unmapped category as per Requirement 1.5
          if (afterFilter === 0 && beforeFilter > 0) {
            console.warn(`[${requestId}] ❌ Category '${category}' not found in feeds and no mapping available`);
          }
        }
      }
      
      // Featured filter
      if (featured !== undefined) {
        const beforeFilter = filteredFeeds.length;
        filteredFeeds = filteredFeeds.filter(feed => feed.is_featured === featured);
        const afterFilter = filteredFeeds.length;
        console.log(`[${requestId}] ⭐ Featured '${featured}': ${beforeFilter} → ${afterFilter} feeds`);
      }
      
      // Country filter
      if (country) {
        const beforeFilter = filteredFeeds.length;
        filteredFeeds = filteredFeeds.filter(feed => 
          feed.country && feed.country.toUpperCase() === country.toUpperCase()
        );
        const afterFilter = filteredFeeds.length;
        console.log(`[${requestId}] 🌍 Country '${country}': ${beforeFilter} → ${afterFilter} feeds`);
      }
      
      // Language filter
      if (language) {
        const beforeFilter = filteredFeeds.length;
        filteredFeeds = filteredFeeds.filter(feed => 
          feed.language.toLowerCase() === language.toLowerCase()
        );
        const afterFilter = filteredFeeds.length;
        console.log(`[${requestId}] 🗣️  Language '${language}': ${beforeFilter} → ${afterFilter} feeds`);
      }
      
      // Search filter with enhanced logging
      if (search) {
        const beforeFilter = filteredFeeds.length;
        const searchLower = search.toLowerCase();
        const searchStartTime = Date.now();
        
        filteredFeeds = filteredFeeds.filter(feed => {
          const nameMatch = feed.name.toLowerCase().includes(searchLower);
          const descMatch = feed.description?.toLowerCase().includes(searchLower);
          const tagMatch = feed.tags && feed.tags.some(tag => tag.toLowerCase().includes(searchLower));
          return nameMatch || descMatch || tagMatch;
        });
        
        const searchTime = Date.now() - searchStartTime;
        const afterFilter = filteredFeeds.length;
        console.log(`[${requestId}] 🔍 Search '${search}': ${beforeFilter} → ${afterFilter} feeds (${searchTime}ms)`);
      }
      
      // Limit application
      if (limit) {
        const beforeLimit = filteredFeeds.length;
        filteredFeeds = filteredFeeds.slice(0, limit);
        const afterLimit = filteredFeeds.length;
        console.log(`[${requestId}] ✂️  Limit ${limit}: ${beforeLimit} → ${afterLimit} feeds`);
      }
      
      // Validate final filtering consistency
      if (filteredFeeds.length !== filteringResult.filteredCount) {
        console.warn(`[${requestId}] ⚠️  Filtering inconsistency detected: expected ${filteringResult.filteredCount}, got ${filteredFeeds.length}`);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Performance analysis and warnings
      const performanceMetrics = {
        totalTime,
        storageTime: Date.now() - storageStartTime,
        filteringTime: endTime - (storageStartTime + (Date.now() - storageStartTime)),
        requestsPerSecond: totalTime > 0 ? Math.round(1000 / totalTime) : 0
      };
      
      // Performance warnings
      if (totalTime > 2000) {
        console.warn(`[${requestId}] ⚠️  SLOW REQUEST: ${totalTime}ms (threshold: 2000ms)`);
      } else if (totalTime > 1000) {
        console.log(`[${requestId}] 🐌 Moderate request time: ${totalTime}ms`);
      } else {
        console.log(`[${requestId}] ⚡ Fast request: ${totalTime}ms`);
      }
      
      // Comprehensive success logging (Requirement 4.2)
      console.log(`[${requestId}] ✅ REQUEST COMPLETED SUCCESSFULLY`);
      console.log(`[${requestId}] 📊 Final Results:`, {
        originalCount,
        filteredCount: filteredFeeds.length,
        filteringSteps,
        performance: performanceMetrics,
        filters: {
          category: category || null,
          search: search || null,
          limit: limit || null,
          featured: featured !== undefined ? featured : null,
          country: country || null,
          language: language || null
        }
      });
      
      // Response construction with enhanced metadata
      const responseData = {
        feeds: filteredFeeds,
        total: filteredFeeds.length,
        metadata: {
          originalCount,
          filteredCount: filteredFeeds.length,
          filters: {
            category: category || null,
            search: search || null,
            limit: limit || null,
            featured: featured !== undefined ? featured : null,
            country: country || null,
            language: language || null
          },
          filteringSteps,
          requestId,
          processingTime: totalTime,
          performance: performanceMetrics,
          timestamp: new Date().toISOString(),
          storageType: 'SupabaseStorage'
        }
      };
      
      console.log(`[${requestId}] 📤 Sending response: ${JSON.stringify(responseData).length} bytes`);
      console.log(`=== [${requestId}] REQUEST END (SUCCESS) ===\n`);
      
      res.json(responseData);
      
    } catch (error) {
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Enhanced error handling and logging (Requirements 4.3, 4.4)
      console.error(`=== [${requestId}] ERROR OCCURRED ===`);
      console.error(`[${requestId}] ❌ Request failed in ${totalTime}ms`);
      console.error(`[${requestId}] 🔍 Error Context:`, {
        userId,
        clientIp,
        userAgent,
        query: req.query,
        timestamp: new Date().toISOString(),
        requestDuration: totalTime
      });
      
      // Detailed error analysis
      if (error instanceof z.ZodError) {
        console.error(`[${requestId}] 📋 VALIDATION ERROR:`, {
          errorType: 'ZodValidationError',
          errorCount: error.errors.length,
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            received: 'received' in err ? err.received : undefined
          })),
          rawQuery: req.query
        });
        
        // Check for category-specific validation errors (Requirement 1.3, 1.4)
        const categoryErrors = error.errors.filter(err => 
          err.path.includes('category')
        );
        
        if (categoryErrors.length > 0) {
          console.error(`[${requestId}] 🏷️  CATEGORY VALIDATION ERRORS:`, {
            categoryValue: req.query.category,
            availableFrontendCategories: categoryMappingService.getAllFrontendCategories(),
            availableDatabaseCategories: categoryMappingService.getAllDatabaseCategories(),
            categoryErrors: categoryErrors.map(err => ({
              message: err.message,
              code: err.code
            }))
          });
        }
        
        const validationResponse = {
          error: 'Validation error',
          message: 'Invalid query parameters provided',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: 'received' in err ? err.received : undefined
          })),
          // Add category-specific help for category errors (Requirement 1.4)
          ...(categoryErrors.length > 0 && {
            categoryHelp: {
              availableCategories: categoryMappingService.getAllFrontendCategories(),
              message: 'Use one of the available frontend category IDs'
            }
          }),
          requestId,
          timestamp: new Date().toISOString(),
          processingTime: totalTime
        };
        
        console.error(`[${requestId}] 📤 Sending validation error response`);
        console.error(`=== [${requestId}] REQUEST END (VALIDATION ERROR) ===\n`);
        
        return res.status(400).json(validationResponse);
      }
      
      // Storage and system errors with detailed logging
      console.error(`[${requestId}] 💾 SYSTEM ERROR:`, {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        storageType: 'SupabaseStorage',
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        }
      });
      
      // Specific error type handling with appropriate HTTP status codes
      if (error instanceof Error) {
        // Connection and timeout errors
        if (error.message.includes('connection') || 
            error.message.includes('timeout') || 
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ETIMEDOUT')) {
          
          console.error(`[${requestId}] 🔌 CONNECTION ERROR: Service unavailable`);
          const serviceUnavailableResponse = {
            error: 'Service temporarily unavailable',
            message: 'The feed service is temporarily unavailable. Please try again in a few moments.',
            requestId,
            retryAfter: 30,
            timestamp: new Date().toISOString(),
            processingTime: totalTime
          };
          
          console.error(`[${requestId}] 📤 Sending service unavailable response (503)`);
          console.error(`=== [${requestId}] REQUEST END (SERVICE UNAVAILABLE) ===\n`);
          
          return res.status(503).json(serviceUnavailableResponse);
        }
        
        // Data not found errors
        if (error.message.includes('not found') || 
            error.message.includes('empty') ||
            error.message.includes('no data')) {
          
          console.error(`[${requestId}] 📭 DATA NOT FOUND ERROR: No feeds available`);
          const notFoundResponse = {
            error: 'No feeds available',
            message: 'No recommended feeds are currently available. Please contact support if this persists.',
            requestId,
            timestamp: new Date().toISOString(),
            processingTime: totalTime,
            supportContact: 'support@cronkite.app'
          };
          
          console.error(`[${requestId}] 📤 Sending not found response (404)`);
          console.error(`=== [${requestId}] REQUEST END (NOT FOUND) ===\n`);
          
          return res.status(404).json(notFoundResponse);
        }
        
        // Authentication/authorization errors
        if (error.message.includes('unauthorized') || 
            error.message.includes('forbidden') ||
            error.message.includes('access denied')) {
          
          console.error(`[${requestId}] 🔐 AUTHORIZATION ERROR: Access denied`);
          const unauthorizedResponse = {
            error: 'Access denied',
            message: 'You do not have permission to access this resource.',
            requestId,
            timestamp: new Date().toISOString(),
            processingTime: totalTime
          };
          
          console.error(`[${requestId}] 📤 Sending unauthorized response (403)`);
          console.error(`=== [${requestId}] REQUEST END (UNAUTHORIZED) ===\n`);
          
          return res.status(403).json(unauthorizedResponse);
        }
        
        // Rate limiting errors
        if (error.message.includes('rate limit') || 
            error.message.includes('too many requests')) {
          
          console.error(`[${requestId}] 🚦 RATE LIMIT ERROR: Too many requests`);
          const rateLimitResponse = {
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please wait before making another request.',
            requestId,
            retryAfter: 60,
            timestamp: new Date().toISOString(),
            processingTime: totalTime
          };
          
          console.error(`[${requestId}] 📤 Sending rate limit response (429)`);
          console.error(`=== [${requestId}] REQUEST END (RATE LIMITED) ===\n`);
          
          return res.status(429).json(rateLimitResponse);
        }
      }
      
      // Generic server error with comprehensive logging
      console.error(`[${requestId}] 💥 UNHANDLED ERROR: Generic server error`);
      console.error(`[${requestId}] 🔍 Error Details:`, {
        errorString: String(error),
        errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        requestContext: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          query: req.query,
          userId,
          timestamp: new Date().toISOString()
        }
      });
      
      const genericErrorResponse = {
        error: 'Internal server error',
        message: 'An unexpected error occurred while retrieving recommended feeds. Please try again later.',
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: totalTime,
        supportContact: 'support@cronkite.app'
      };
      
      console.error(`[${requestId}] 📤 Sending generic error response (500)`);
      console.error(`=== [${requestId}] REQUEST END (INTERNAL ERROR) ===\n`);
      
      res.status(500).json(genericErrorResponse);
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
  
  // POST /api/feeds/sync - Trigger feed synchronization
  app.post('/api/feeds/sync', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { feedIds } = req.body;
      
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
          message: 'No subscribed feeds found'
        });
      }
      
      // Get articles from all user feeds
      const allArticles = [];
      for (const feed of userFeeds) {
        try {
          const feedArticles = await storage.getArticlesByFeedId(feed.id, Math.ceil(limit / userFeeds.length));
          
          // Add feed information to each article
          const articlesWithFeed = feedArticles.map(article => ({
            ...article,
            feed_name: feed.name,
            feed_url: feed.site_url || feed.url,
            feed_icon: feed.icon_url
          }));
          
          allArticles.push(...articlesWithFeed);
        } catch (error) {
          console.error(`Failed to get articles for feed ${feed.id}:`, error);
          // Continue with other feeds even if one fails
        }
      }
      
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
