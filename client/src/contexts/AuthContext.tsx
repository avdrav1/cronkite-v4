import React, { createContext, useContext, useEffect, useState } from 'react';
import { type Profile } from '@shared/schema';
import { isSupabaseConfigured, getSupabaseClient } from '@shared/supabase';

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
      // First check if there's a Supabase session (for OAuth)
      // Only check Supabase if it's properly configured
      if (isSupabaseConfigured()) {
        try {
          const client = getSupabaseClient();
          if (client) {
            const { data: { session }, error } = await client.auth.getSession();
            
            if (session && !error) {
              // We have a Supabase session, send it to our backend for profile creation/retrieval
              await handleOAuthSession(session);
              return;
            }
          }
        } catch (supabaseError) {
          // Supabase not configured or unavailable - continue with regular session check
          console.log('Supabase session check skipped:', supabaseError instanceof Error ? supabaseError.message : 'Unknown error');
        }
      } else {
        console.log('Supabase not configured - skipping OAuth session check');
      }

      // No Supabase session, check for regular session
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else if (response.status === 401) {
        // Session expired or invalid
        setUser(null);
      } else {
        // Other server errors
        console.error('Auth check failed with status:', response.status);
        setUser(null);
      }
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
      const response = await fetch('/api/auth/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ session }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'OAuth session handling failed');
      }

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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      console.log('🔐 AuthContext: Login response status:', response.status);
      
      const data = await response.json();
      console.log('🔐 AuthContext: Login response data:', { 
        hasUser: !!data.user, 
        hasError: !!data.error,
        error: data.error,
        message: data.message 
      });

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

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
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          access_token: accessToken,
          refresh_token: refreshToken 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Google login failed');
      }

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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          email, 
          password, 
          display_name: displayName 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

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

      // Also logout from our backend
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      // Even if the server request fails, clear local state
      setUser(null);
      
      if (!response.ok) {
        console.warn('Server logout failed, but local session cleared');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if server request fails
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
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Profile update failed');
      }

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