import React, { createContext, useContext, useEffect, useState } from 'react';
import { type Profile } from '@shared/schema';
import { isSupabaseConfigured, getSupabaseClient } from '@shared/supabase';
import { apiRequest, apiFetch } from '@/lib/queryClient';

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
    try {
      // First, try to check if we have an existing backend session
      // This is faster than going through Supabase OAuth flow
      const response = await apiFetch('GET', '/api/auth/me');

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        return; // Already authenticated via backend session
      }
      
      // No backend session - check if there's a Supabase session (for OAuth)
      // This handles the case where user logged in via OAuth but backend session expired
      if (response.status === 401 && isSupabaseConfigured()) {
        try {
          const client = getSupabaseClient();
          if (client) {
            const { data: { session }, error } = await client.auth.getSession();
            
            if (session && !error) {
              // We have a Supabase session but no backend session
              // Re-authenticate with the backend
              console.log('🔐 Re-authenticating with backend using Supabase session');
              await handleOAuthSession(session);
              return;
            }
          }
        } catch (supabaseError) {
          // Supabase not configured or unavailable
          console.log('Supabase session check skipped:', supabaseError instanceof Error ? supabaseError.message : 'Unknown error');
        }
      }
      
      // No valid session found
      setUser(null);
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OAuth session from Supabase
  const handleOAuthSession = async (session: any) => {
    try {
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
      const response = await apiRequest('POST', '/api/auth/login', { email, password });
      const data = await response.json();
      
      console.log('✅ AuthContext: Login successful, setting user:', data.user?.email);
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
      const response = await apiRequest('POST', '/api/auth/register', { 
        email, 
        password, 
        display_name: displayName 
      });
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
    checkAuth();

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