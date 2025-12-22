import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import createMemoryStore from 'memorystore';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { createClient } from '@supabase/supabase-js';
import { getStorage } from './storage';
import { type Profile } from '@shared/schema';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User extends Profile {}
  }
}

const MemoryStore = createMemoryStore(session);

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Session configuration with environment-aware cookie settings
export const sessionConfig = session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  name: 'cronkite.sid', // Explicit session name
  proxy: isProduction, // Trust proxy in production (Netlify, etc.)
  cookie: {
    secure: isProduction, // Use secure cookies in production (HTTPS)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-site in production, 'lax' for development
    path: '/' // Explicit path
  }
});

console.log(`🔐 Session configured for ${isProduction ? 'production' : 'development'} mode:`, {
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  proxy: isProduction
});

// Passport configuration - uses async storage
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email: string, password: string, done) => {
    try {
      const storage = await getStorage();
      const user = await storage.authenticateUser(email, password);
      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }
      return done(null, user);
    } catch (error) {
      console.error('Passport authentication error:', error);
      return done(error);
    }
  }
));

passport.serializeUser((user: Profile, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const storage = await getStorage();
    const user = await storage.getUser(id);
    
    if (!user) {
      // User no longer exists in database - invalidate session
      // This handles cases where user was deleted or session references stale data
      console.log('🔐 deserializeUser: User not found, invalidating session:', id);
      return done(null, false); // Return false to signal invalid session
    }
    
    done(null, user);
  } catch (error) {
    // Handle database errors gracefully - return false to invalidate session
    // rather than crashing the application with done(error)
    console.error('🔐 deserializeUser: Error fetching user:', error);
    // On error, return false to invalidate session rather than crashing
    // Requirements: 4.2, 4.3
    done(null, false);
  }
});

// ============================================================================
// Session Validation Utilities
// ============================================================================

/**
 * Validates that a session has valid user data.
 * Returns true only if the session is authenticated AND has valid user data.
 * 
 * @param req - Express request object
 * @returns boolean indicating session validity
 * 
 * Requirements: 2.1, 2.2
 */
export function isValidSession(req: Request): boolean {
  // Session must be authenticated
  if (!req.isAuthenticated()) {
    return false;
  }
  
  // Check if user data exists
  if (!req.user) {
    return false;
  }
  
  // Check if user has required fields (id and email)
  if (!req.user.id || !req.user.email) {
    return false;
  }
  
  return true;
}

/**
 * Result of session validation with detailed reason
 */
export interface SessionValidationResult {
  isValid: boolean;
  reason: 'not_authenticated' | 'missing_user' | 'invalid_user_data' | 'valid';
}

/**
 * Validates session state and returns detailed result.
 * Provides more information than isValidSession for debugging and logging.
 * 
 * @param req - Express request object
 * @returns SessionValidationResult with isValid boolean and reason string
 * 
 * Requirements: 2.1, 2.2, 4.1
 */
export function validateSession(req: Request): SessionValidationResult {
  // Check if authenticated
  if (!req.isAuthenticated()) {
    return { isValid: false, reason: 'not_authenticated' };
  }
  
  // Check if user data exists
  if (!req.user) {
    return { isValid: false, reason: 'missing_user' };
  }
  
  // Check if user has required fields (id and email)
  if (!req.user.id || !req.user.email) {
    return { isValid: false, reason: 'invalid_user_data' };
  }
  
  return { isValid: true, reason: 'valid' };
}

/**
 * Clears an invalid session and its cookie.
 * Handles errors gracefully with logging - never throws.
 * Includes timeout to prevent hanging.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @returns Promise that resolves when session is cleared
 * 
 * Requirements: 1.2, 1.3, 3.1
 */
export async function clearInvalidSession(req: Request, res: Response): Promise<void> {
  return new Promise((resolve) => {
    // Set a timeout to prevent hanging - resolve after 3 seconds regardless
    const timeout = setTimeout(() => {
      console.warn('⚠️ Session clearing timed out, proceeding anyway');
      clearSessionCookie(res);
      resolve();
    }, 3000);
    
    // Log the session invalidation for debugging
    console.log('🔐 Clearing invalid session:', {
      sessionID: req.sessionID,
      hasUser: !!req.user,
      isAuthenticated: req.isAuthenticated()
    });
    
    // Call req.logout() to clear Passport session
    req.logout((logoutErr) => {
      if (logoutErr) {
        console.warn('⚠️ Error during logout:', logoutErr);
      }
      
      // Call req.session.destroy() to destroy Express session
      if (req.session) {
        req.session.destroy((destroyErr) => {
          clearTimeout(timeout);
          if (destroyErr) {
            console.warn('⚠️ Error destroying session:', destroyErr);
          }
          
          // Clear session cookie
          clearSessionCookie(res);
          console.log('🔐 Session cleared successfully');
          resolve();
        });
      } else {
        clearTimeout(timeout);
        // No session to destroy, just clear cookie
        clearSessionCookie(res);
        console.log('🔐 Session cleared (no session to destroy)');
        resolve();
      }
    });
  });
}

/**
 * Helper to clear the session cookie with proper settings
 */
function clearSessionCookie(res: Response): void {
  res.clearCookie('cronkite.sid', {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  });
}

// Middleware to check if user is authenticated
// Supports both Express sessions (development) and Supabase JWT tokens (serverless/production)
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  // First check Express session (works in development and when sessions persist)
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  
  // In serverless environments, sessions don't persist between invocations
  // Check for Supabase JWT token in Authorization header
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const supabase = createSupabaseClient();
      
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
      
      if (error || !supabaseUser) {
        console.log('🔐 requireAuth: Invalid Supabase token:', error?.message);
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Invalid or expired token'
        });
      }
      
      // Token is valid - get or create user profile
      const storage = await getStorage();
      let profile = await storage.getUser(supabaseUser.id);
      
      if (!profile) {
        // Create profile for OAuth user (shouldn't normally happen, but handle it)
        console.log('🔐 requireAuth: Creating profile for token user:', supabaseUser.email);
        profile = await storage.createUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          display_name: supabaseUser.user_metadata?.full_name || 
                       supabaseUser.user_metadata?.name || 
                       supabaseUser.email!.split('@')[0],
          avatar_url: supabaseUser.user_metadata?.avatar_url || 
                     supabaseUser.user_metadata?.picture || null,
          timezone: "America/New_York",
          region_code: null,
          onboarding_completed: false
        });
      }
      
      // Set user in request for downstream handlers
      req.user = profile;
      console.log('🔐 requireAuth: Authenticated via Supabase token:', profile.email);
      return next();
      
    } catch (error) {
      console.error('🔐 requireAuth: Token validation error:', error);
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Token validation failed'
      });
    }
  }
  
  // No valid session or token
  res.status(401).json({ 
    error: 'Authentication required',
    message: 'You must be logged in to access this resource'
  });
};

// Middleware to check if user is not authenticated (for login/register routes)
// Enhanced to validate session integrity and handle stale/invalid sessions gracefully
// Requirements: 1.1, 3.1, 3.2
export const requireNoAuth = async (req: Request, res: Response, next: NextFunction) => {
  // If not authenticated at all, proceed immediately
  if (!req.isAuthenticated()) {
    return next();
  }
  
  // Check if the session has valid user data
  if (!isValidSession(req)) {
    // Session is authenticated but invalid (stale/corrupted) - clear it and proceed
    // This allows users to log in even when they have stale cookies
    console.log('🔐 requireNoAuth: Detected invalid session, clearing...');
    await clearInvalidSession(req, res);
    return next();
  }
  
  // Valid authenticated session - block the request (user is already logged in)
  res.status(400).json({ 
    error: 'Already authenticated',
    message: 'You are already logged in'
  });
};

// Supabase client for OAuth
export const createSupabaseClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
};

// Middleware to handle Supabase JWT tokens (for OAuth)
export const handleSupabaseAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  try {
    const token = authHeader.substring(7);
    const supabase = createSupabaseClient();
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return next();
    }
    
    const storage = await getStorage();
    
    // Get or create user profile
    let profile = await storage.getUser(user.id);
    
    if (!profile) {
      // Create profile for OAuth user
      profile = await storage.createUser({
        id: user.id,
        email: user.email!,
        display_name: user.user_metadata?.display_name || user.email!.split('@')[0],
        avatar_url: user.user_metadata?.avatar_url || null,
        timezone: "America/New_York",
        region_code: null,
        onboarding_completed: false
      });
    }
    
    // Set user in request
    req.user = profile;
    next();
  } catch (error) {
    console.error('Supabase auth error:', error);
    next();
  }
};

// Combined auth middleware that handles both session and JWT
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // First try Supabase JWT
  handleSupabaseAuth(req, res, () => {
    // If no JWT user, try session auth
    if (!req.user && req.isAuthenticated()) {
      // User is already set by passport
    }
    next();
  });
};