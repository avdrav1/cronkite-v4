import { ThemeProvider } from "next-themes";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

// Loading component for authentication states
function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <div className="space-y-2">
          <p className="text-2xl font-masthead font-medium">Cronkite</p>
          <p className="text-sm text-muted-foreground">Loading your personalized news feed...</p>
        </div>
      </div>
    </div>
  );
}

// Simplified router without complex authentication redirects
function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/auth" component={Auth} />
      <Route path="/auth/callback" component={AuthCallback} />
      
      {/* Protected routes - simplified logic */}
      <Route path="/onboarding">
        {isAuthenticated ? <Onboarding /> : <Auth />}
      </Route>
      
      <Route path="/settings">
        {isAuthenticated ? <SettingsPage /> : <Auth />}
      </Route>
      
      <Route path="/admin">
        {isAuthenticated ? <Admin /> : <Auth />}
      </Route>
      
      <Route path="/admin/sync-monitor">
        {isAuthenticated ? <SyncMonitor /> : <Auth />}
      </Route>
      
      <Route path="/">
        {isAuthenticated ? <Home /> : <Auth />}
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
