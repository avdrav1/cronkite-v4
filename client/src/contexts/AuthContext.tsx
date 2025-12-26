import React, { createContext, useContext, useEffect, useState } from 'react';
import { type Profile } from '@shared/schema';
import { isSupabaseConfigured, getSupabaseClient, clearBackupSession, backupSession } from '@shared/supabase';
import { apiRequest } from '@/lib/queryClient';

interface AuthContextType {
  user: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (accessToken: string, refreshToken?: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  checkAuth: () => Promise<void>;
  handleAuthError: (response: Response) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null;

  // Check authentication status on mount
  const checkAuth = async () => {
    console.log('🔐 AuthContext: Starting auth check...');
    
    try {
      // First, try to check if we have an existing backend session
      // This is faster than going through Supabase OAuth flow
      // Add timeout to prevent hanging on stale sessions
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      let response: Response;
      try {
        response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.warn('⚠️ AuthContext: /api/auth/me request timed out');
        } else {
          console.error('❌ AuthContext: /api/auth/me fetch error:', fetchError);
        }
        // On timeout or network error, assume not authenticated
        setUser(null);
        return;
      }
      
      console.log('🔐 AuthContext: /api/auth/me response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ AuthContext: Authenticated via backend session:', data.user?.email);
        setUser(data.user);
        return; // Already authenticated via backend session
      }
      
      // No backend session - check if there's a Supabase session (for OAuth)
      // This handles the case where user logged in via OAuth but backend session expired
      if (response.status === 401 && isSupabaseConfigured()) {
        console.log('🔐 AuthContext: Checking Supabase session...');
        try {
          const client = getSupabaseClient();
          if (client) {
            // Add timeout to prevent hanging
            const sessionPromise = client.auth.getSession();
            const timeoutPromise = new Promise<{ data: { session: null }, error: Error }>((_, reject) => 
              setTimeout(() => reject(new Error('Supabase session check timeout')), 3000)
            );
            
            const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);
            
            if (session && !error) {
              // We have a Supabase session but no backend session
              // Re-authenticate with the backend
              console.log('🔐 Re-authenticating with backend using Supabase session');
              await handleOAuthSession(session);
              return;
            }
            console.log('🔐 AuthContext: No Supabase session found');
          }
        } catch (supabaseError) {
          // Supabase not configured, unavailable, or timed out
          console.log('Supabase session check skipped:', supabaseError instanceof Error ? supabaseError.message : 'Unknown error');
        }
      }
      
      // No valid session found
      console.log('🔐 AuthContext: No valid session, setting user to null');
      setUser(null);
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      console.log('🔐 AuthContext: Auth check complete, setting isLoading to false');
      setIsLoading(false);
    }
  };

  // Handle OAuth session from Supabase
  const handleOAuthSession = async (session: any) => {
    try {
      // Backup the session for reliability
      backupSession(session);
      
      const response = await apiRequest('POST', '/api/auth/oauth/callback', { session });
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('OAuth session handling error:', error);
      setUser(null);
    }
  };

  // Login with email and password
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    console.log('🔐 AuthContext: Starting login attempt for:', email);
    
    try {
      console.log('🔐 AuthContext: Sending login request...');
      
      // Use direct fetch to avoid Supabase token check delay
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      let response: Response;
      try {
        response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Login request timed out. Please try again.');
        }
        throw fetchError;
      }
      
      console.log('🔐 AuthContext: Login response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errorData.message || errorData.error || 'Login failed');
      }
      
      const data = await response.json();
      console.log('✅ AuthContext: Login successful, setting user:', data.user?.email);
      setUser(data.user);
    } catch (error) {
      console.error('❌ AuthContext: Login error:', error);
      throw error;
    } finally {
      console.log('🔐 AuthContext: Login attempt complete, setting isLoading to false');
      setIsLoading(false);
    }
  };

  // Login with Google OAuth
  const loginWithGoogle = async (accessToken: string, refreshToken?: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/auth/google', { 
        access_token: accessToken,
        refresh_token: refreshToken 
      });
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Register new user
  const register = async (email: string, password: string, displayName: string) => {
    setIsLoading(true);
    try {
      // Use direct fetch to avoid Supabase token check delay
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      let response: Response;
      try {
        response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password, display_name: displayName }),
          credentials: 'include',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Registration request timed out. Please try again.');
        }
        throw fetchError;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Registration failed' }));
        throw new Error(errorData.message || errorData.error || 'Registration failed');
      }
      
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout user
  const logout = async () => {
    setIsLoading(true);
    try {
      // Clear backup session first
      clearBackupSession();
      
      // Sign out from Supabase if configured
      if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        if (client) {
          await client.auth.signOut();
        }
      }

      // Also logout from our backend (ignore errors)
      try {
        await apiRequest('POST', '/api/auth/logout');
      } catch {
        console.warn('Server logout failed, but local session cleared');
      }

      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Update user profile
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      const response = await apiRequest('PUT', '/api/users/profile', updates);
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Skip initial auth check if we're on the OAuth callback page
    // The AuthCallback component will handle authentication and call checkAuth when ready
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
      console.log('🔐 AuthContext: Skipping initial auth check - on callback page');
      setIsLoading(false);
      return;
    }
    
    // Add a global timeout for auth check to prevent infinite loading
    const authTimeout = setTimeout(() => {
      console.warn('⚠️ AuthContext: Auth check timed out after 10 seconds');
      setIsLoading(false);
      setUser(null);
    }, 10000);
    
    checkAuth().finally(() => {
      clearTimeout(authTimeout);
    });

    // Listen for auth state changes from Supabase (only if properly configured)
    let subscription: { unsubscribe: () => void } | null = null;
    
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data } = client.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
              await handleOAuthSession(session);
            } else if (event === 'SIGNED_OUT') {
              setUser(null);
            }
          });
          subscription = data.subscription;
        }
      } catch (error) {
        console.log('Supabase auth listener not available:', error instanceof Error ? error.message : 'Unknown error');
      }
    } else {
      console.log('Supabase not configured - auth listener not set up');
    }

    return () => {
      clearTimeout(authTimeout);
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Handle authentication errors (like session expiry)
  const handleAuthError = (response: Response): boolean => {
    if (response.status === 401) {
      // Session expired, clear user state
      setUser(null);
      return true; // Indicates auth error was handled
    }
    return false; // Not an auth error
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    loginWithGoogle,
    register,
    logout,
    updateProfile,
    checkAuth,
    handleAuthError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};