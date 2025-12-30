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
  const [authCheckCompleted, setAuthCheckCompleted] = useState(false);

  const isAuthenticated = user !== null;

  // Check authentication status
  const checkAuth = async () => {
    console.log('🔐 AuthContext: Starting auth check...');
    
    try {
      // First, try to check if we have an existing backend session
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced timeout
      
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
        console.warn('⚠️ AuthContext: /api/auth/me request failed or timed out');
        setUser(null);
        return;
      }
      
      console.log('🔐 AuthContext: /api/auth/me response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ AuthContext: Authenticated via backend session:', data.user?.email);
        setUser(data.user);
        return;
      }
      
      // No backend session - check if there's a Supabase session (for OAuth)
      if (response.status === 401 && isSupabaseConfigured()) {
        console.log('🔐 AuthContext: Checking Supabase session...');
        try {
          const client = getSupabaseClient();
          if (client) {
            const sessionPromise = client.auth.getSession();
            const timeoutPromise = new Promise<{ data: { session: null }, error: Error }>((_, reject) => 
              setTimeout(() => reject(new Error('Supabase session check timeout')), 2000)
            );
            
            const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);
            
            if (session && !error) {
              console.log('🔐 Re-authenticating with backend using Supabase session');
              await handleOAuthSession(session);
              return;
            }
          }
        } catch (supabaseError) {
          console.log('Supabase session check failed:', supabaseError instanceof Error ? supabaseError.message : 'Unknown error');
        }
      }
      
      // No valid session found
      console.log('🔐 AuthContext: No valid session, setting user to null');
      setUser(null);
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    }
  };

  // Handle OAuth session from Supabase
  const handleOAuthSession = async (session: any) => {
    try {
      backupSession(session);
      
      // Try to establish backend session first
      try {
        const response = await apiRequest('POST', '/api/auth/oauth/callback', { session });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          console.log('✅ AuthContext: OAuth session established via backend');
          return;
        }
      } catch (backendError) {
        console.warn('⚠️ AuthContext: Backend OAuth callback failed, trying JWT auth:', backendError);
      }
      
      // Backend session failed - try to get user profile using JWT token
      // This works in serverless environments where sessions don't persist
      console.log('🔐 AuthContext: Attempting JWT-based authentication...');
      const meResponse = await apiRequest('GET', '/api/auth/me');
      if (meResponse.ok) {
        const data = await meResponse.json();
        setUser(data.user);
        console.log('✅ AuthContext: Authenticated via JWT token');
        return;
      }
      
      // If both methods fail, user is not authenticated
      console.error('❌ AuthContext: All authentication methods failed');
      setUser(null);
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
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
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errorData.message || errorData.error || 'Login failed');
      }
      
      const data = await response.json();
      console.log('✅ AuthContext: Login successful, setting user:', data.user?.email);

      if (data.session) {
        backupSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          user: data.user
        } as any);
      }

      setUser(data.user);
    } catch (error) {
      console.error('❌ AuthContext: Login error:', error);
      throw error;
    } finally {
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
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
      clearBackupSession();
      
      if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        if (client) {
          await client.auth.signOut();
        }
      }

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

  // Handle authentication errors (like session expiry)
  const handleAuthError = (response: Response): boolean => {
    if (response.status === 401) {
      setUser(null);
      return true;
    }
    return false;
  };

  // Fixed useEffect with proper dependencies and error handling
  useEffect(() => {
    // Prevent multiple auth checks
    if (authCheckCompleted) {
      return;
    }

    // Skip initial auth check if we're on the OAuth callback page
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
      console.log('🔐 AuthContext: Skipping initial auth check - on callback page');
      setIsLoading(false);
      setAuthCheckCompleted(true);
      return;
    }
    
    // Add a global timeout for auth check to prevent infinite loading
    const authTimeout = setTimeout(() => {
      console.warn('⚠️ AuthContext: Auth check timed out after 8 seconds');
      setIsLoading(false);
      setUser(null);
      setAuthCheckCompleted(true);
    }, 8000);
    
    checkAuth()
      .finally(() => {
        clearTimeout(authTimeout);
        setIsLoading(false);
        setAuthCheckCompleted(true);
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
            } else if (event === 'TOKEN_REFRESHED' && session) {
              backupSession(session);
              console.log('🔄 Token refreshed, backup session updated');
            } else if (event === 'SIGNED_OUT') {
              setUser(null);
            }
          });
          subscription = data.subscription;
        }
      } catch (error) {
        console.log('Supabase auth listener not available:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    return () => {
      clearTimeout(authTimeout);
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []); // Empty dependency array - only run once on mount

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