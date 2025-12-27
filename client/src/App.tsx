import { ThemeProvider } from "next-themes";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import Home from "@/pages/Home";
import SettingsPage from "@/pages/Settings";
import Onboarding from "@/pages/Onboarding";
import Auth from "@/pages/Auth";
import AuthCallback from "@/pages/AuthCallback";
import Admin from "@/pages/Admin";
import SyncMonitor from "@/pages/SyncMonitor";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

// Loading component for authentication states
function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Spinner className="h-8 w-8 mx-auto text-primary" />
        <div className="space-y-2">
          <p className="text-2xl font-masthead font-medium">Cronkite</p>
          <p className="text-sm text-muted-foreground">Loading your personalized news feed...</p>
        </div>
      </div>
    </div>
  );
}

// Protected route wrapper that handles authentication checks
function ProtectedRoute({ 
  component: Component, 
  requireOnboarding = true 
}: { 
  component: React.ComponentType;
  requireOnboarding?: boolean;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Redirect to auth if not authenticated
        setLocation('/auth');
      } else if (requireOnboarding && user && !user.onboarding_completed && location !== '/onboarding') {
        // Redirect to onboarding if not completed (except when already on onboarding page)
        setLocation('/onboarding');
      }
    }
  }, [isAuthenticated, isLoading, user, setLocation, location, requireOnboarding]);

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return null; // Will redirect to auth
  }

  // Allow access to onboarding even if not completed
  if (!requireOnboarding || !user || user.onboarding_completed || location === '/onboarding') {
    return <Component />;
  }

  return null; // Will redirect to onboarding
}

// Main router component that handles authentication flow
function AppRouter() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();

  // Handle initial authentication redirects
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        // If user is on auth page but authenticated, redirect appropriately
        if (location === '/auth') {
          if (!user.onboarding_completed) {
            setLocation('/onboarding');
          } else {
            setLocation('/');
          }
        }
      } else if (!isAuthenticated && location !== '/auth' && !location.startsWith('/auth/callback')) {
        // If not authenticated and not on auth or callback page, redirect to auth
        // Don't redirect from callback - it handles its own auth flow
        setLocation('/auth');
      }
    }
  }, [isAuthenticated, isLoading, user, location, setLocation]);

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/auth">
        {isAuthenticated ? null : <Auth />}
      </Route>
      
      <Route path="/auth/callback">
        <AuthCallback />
      </Route>
      
      {/* Protected routes */}
      <Route path="/onboarding">
        <ProtectedRoute component={Onboarding} requireOnboarding={false} />
      </Route>
      
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>
      
      <Route path="/admin">
        <ProtectedRoute component={Admin} />
      </Route>
      
      <Route path="/admin/sync-monitor">
        <ProtectedRoute component={SyncMonitor} />
      </Route>
      
      <Route path="/">
        <ProtectedRoute component={Home} />
      </Route>
      
      {/* 404 page */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <AuthProvider>
            <WebSocketProvider>
              <AppRouter />
              <Toaster />
            </WebSocketProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
