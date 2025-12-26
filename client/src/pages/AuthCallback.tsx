import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getSupabaseClient, isSupabaseConfigured, backupSession } from '@shared/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { checkAuth } = useAuth();

  // Helper to establish backend session from Supabase session
  const establishBackendSession = async (session: any): Promise<boolean> => {
    try {
      console.log('🔐 AuthCallback: Establishing backend session...');
      const response = await fetch('/api/auth/oauth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('🔐 AuthCallback: Backend session error:', response.status, errorData);
        throw new Error(errorData.message || 'Failed to establish session');
      }
      
      const data = await response.json();
      console.log('✅ AuthCallback: Backend session established for:', data.user?.email);
      return true;
    } catch (err) {
      console.error('🔐 AuthCallback: Failed to establish backend session:', err);
      throw err;
    }
  };

  // Helper to verify session is persisted in localStorage
  const verifySessionPersisted = async (supabase: any, maxAttempts = 5): Promise<boolean> => {
    for (let i = 0; i < maxAttempts; i++) {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.log(`✅ AuthCallback: Session verified on attempt ${i + 1}`);
        return true;
      }
      console.log(`⏳ AuthCallback: Session not found, attempt ${i + 1}/${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, 200 * (i + 1))); // Exponential backoff
    }
    return false;
  };

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔐 AuthCallback: Starting OAuth callback handling');
        console.log('🔐 AuthCallback: Full URL:', window.location.href);
        
        // Check if Supabase is configured
        if (!isSupabaseConfigured()) {
          throw new Error('Supabase is not configured for OAuth');
        }
        
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error('Failed to initialize Supabase client');
        }

        // Check for error in URL first (OAuth error response)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);
        
        const errorParam = hashParams.get('error') || searchParams.get('error');
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');
        
        if (errorParam) {
          throw new Error(errorDescription || errorParam);
        }

        let session = null;

        // Check for authorization code (PKCE flow with code exchange)
        const code = searchParams.get('code');
        if (code) {
          console.log('🔐 AuthCallback: Found authorization code, exchanging for session');
          
          // Exchange the code for a session
          const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('🔐 AuthCallback: Code exchange error:', exchangeError);
            throw exchangeError;
          }
          
          if (sessionData.session) {
            console.log('✅ AuthCallback: Session obtained from code exchange');
            session = sessionData.session;
            // CRITICAL: Backup the session immediately after obtaining it
            backupSession(session);
            // Clear the URL to remove the code
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }

        // Check for tokens in URL hash (implicit flow)
        if (!session) {
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken) {
            console.log('🔐 AuthCallback: Found tokens in URL hash, setting session');
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });
            
            if (sessionError) {
              console.error('🔐 AuthCallback: Error setting session:', sessionError);
              throw sessionError;
            }
            
            if (sessionData.session) {
              console.log('✅ AuthCallback: Session set successfully from tokens');
              session = sessionData.session;
              // CRITICAL: Backup the session immediately
              backupSession(session);
              // Clear the URL hash
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        }
        
        // Try to get existing session if we don't have one yet
        if (!session) {
          console.log('🔐 AuthCallback: Checking for existing session...');
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data, error: getSessionError } = await supabase.auth.getSession();
          
          if (getSessionError) {
            console.error('🔐 AuthCallback: getSession error:', getSessionError);
            throw getSessionError;
          }
          
          session = data.session;
        }

        if (!session) {
          console.log('🔐 AuthCallback: No session found');
          throw new Error('No session found after OAuth callback. Please try logging in again.');
        }

        // We have a session - establish backend session
        await establishBackendSession(session);
        
        // Verify the session is persisted before proceeding
        const isPersisted = await verifySessionPersisted(supabase);
        if (!isPersisted) {
          console.warn('⚠️ AuthCallback: Session may not be fully persisted, proceeding anyway');
        }
        
        // Update auth context
        await checkAuth();
        
        // Small delay to ensure state is propagated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('✅ AuthCallback: Redirecting to home');
        setLocation('/');
        
      } catch (err) {
        console.error('❌ OAuth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        
        // Redirect to auth page after a delay
        setTimeout(() => {
          setLocation('/auth');
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [setLocation, checkAuth]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground text-center">
            Redirecting to login page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Spinner className="h-8 w-8 mx-auto" />
        <div className="text-lg font-medium">Completing authentication...</div>
        <p className="text-sm text-muted-foreground">
          Please wait while we set up your account.
        </p>
      </div>
    </div>
  );
}