import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getSupabaseClient, isSupabaseConfigured } from '@shared/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { checkAuth } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔐 AuthCallback: Starting OAuth callback handling');
        console.log('🔐 AuthCallback: Full URL:', window.location.href);
        console.log('🔐 AuthCallback: URL hash:', window.location.hash);
        console.log('🔐 AuthCallback: URL search:', window.location.search);
        
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
            // Clear the URL to remove the code
            window.history.replaceState({}, document.title, window.location.pathname);
            await checkAuth();
            setLocation('/');
            return;
          }
        }

        // Check for tokens in URL hash (implicit flow)
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
            // Clear the URL hash
            window.history.replaceState({}, document.title, window.location.pathname);
            await checkAuth();
            setLocation('/');
            return;
          }
        }
        
        // Try to get existing session (might already be set by Supabase's detectSessionInUrl)
        // Wait a moment for Supabase to process the URL
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data, error: getSessionError } = await supabase.auth.getSession();
        
        if (getSessionError) {
          console.error('🔐 AuthCallback: getSession error:', getSessionError);
          throw getSessionError;
        }

        if (data.session) {
          console.log('✅ AuthCallback: Found existing session');
          await checkAuth();
          setLocation('/');
        } else {
          console.log('🔐 AuthCallback: No session found, no code, no tokens');
          throw new Error('No session found after OAuth callback. Please try logging in again.');
        }
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