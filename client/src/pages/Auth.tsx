import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';

type AuthMode = 'login' | 'register';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const { isLoading, isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users (handled by AppRouter now)
  useEffect(() => {
    if (isAuthenticated && user) {
      if (!user.onboarding_completed) {
        setLocation('/onboarding');
      } else {
        setLocation('/');
      }
    }
  }, [isAuthenticated, user, setLocation]);

  // Don't render if already authenticated (prevents flash)
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-lg font-medium">Redirecting...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Brand */}
        <div className="text-center">
          <h1 className="text-5xl font-masthead font-bold tracking-tight">Cronkite</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered news aggregation
          </p>
        </div>

        {/* Google OAuth Button */}
        <GoogleAuthButton disabled={isLoading} />

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with email
            </span>
          </div>
        </div>

        {/* Login/Register Forms */}
        {mode === 'login' ? (
          <LoginForm onSwitchToRegister={() => setMode('register')} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setMode('login')} />
        )}
      </div>
    </div>
  );
}