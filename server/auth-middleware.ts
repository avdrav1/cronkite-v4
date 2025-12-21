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
    done(null, user || false);
  } catch (error) {
    console.error('Passport deserialize error:', error);
    done(error);
  }
});

// Middleware to check if user is authenticated
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ 
    error: 'Authentication required',
    message: 'You must be logged in to access this resource'
  });
};

// Middleware to check if user is not authenticated (for login/register routes)
export const requireNoAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  
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