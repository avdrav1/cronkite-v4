import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@shared/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { checkAuth } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from the URL hash
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (data.session) {
          // Session is handled by the AuthContext's onAuthStateChange listener
          // Just trigger a check to ensure everything is synced
          await checkAuth();
          
          // Redirect to home or onboarding
          setLocation('/');
        } else {
          throw new Error('No session found after OAuth callback');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
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