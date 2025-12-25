import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CATEGORIES, getCategoryById } from "@/data/categories";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw, AlertCircle, CheckCircle2, PartyPopper, Rss } from "lucide-react";

// Sync status response type from API
interface SyncStatusResponse {
  isActive: boolean;
  totalFeeds: number;
  completedFeeds: number;
  failedFeeds: number;
  syncingFeeds: number;
  currentFeed?: string;
  errors: Array<{ feedName: string; error: string }>;
  newArticlesCount?: number;
  lastSyncAt?: string;
}

// Sync progress state for UI
interface SyncProgress {
  current: number;
  total: number;
  currentFeedName?: string;
  newArticles: number;
}

interface ConfirmationStepProps {
  selectedInterests: string[];
  selectedRegion: string | null;
  selectedFeedsCount: number;
}

export function ConfirmationStep({ selectedInterests, selectedRegion, selectedFeedsCount }: ConfirmationStepProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ current: 0, total: 0, newArticles: 0 });
  const [failedFeeds, setFailedFeeds] = useState<Array<{ feedName: string; error: string }>>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedRef = useRef(false);

  // Poll sync status for progress updates
  const pollSyncStatus = useCallback(async () => {
    try {
      const response = await apiRequest('GET', '/api/feeds/sync/status');
      const status: SyncStatusResponse = await response.json();
      
      setSyncProgress({
        current: status.completedFeeds + status.failedFeeds,
        total: status.totalFeeds,
        currentFeedName: status.currentFeed,
        newArticles: status.newArticlesCount || 0
      });
      
      if (status.errors && status.errors.length > 0) {
        setFailedFeeds(status.errors);
      }
      
      // Check if sync is complete
      if (!status.isActive && status.totalFeeds > 0) {
        // Sync finished
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        
        if (status.failedFeeds === status.totalFeeds) {
          // All feeds failed
          setSyncError('All feeds failed to sync. Please try again.');
        } else {
          setSyncComplete(true);
        }
        setIsSyncing(false);
      }
    } catch (error) {
      console.error('Failed to poll sync status:', error);
      // Don't stop polling on error, just log it
    }
  }, []);

  // Retry sync for failed feeds
  const handleRetrySync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setFailedFeeds([]);
    setSyncProgress({ current: 0, total: selectedFeedsCount, newArticles: 0 });
    
    try {
      await apiRequest('POST', '/api/feeds/sync', {});
      
      // Start polling for progress
      pollingRef.current = setInterval(pollSyncStatus, 1500);
    } catch (error) {
      console.error('Failed to retry sync:', error);
      setSyncError(error instanceof Error ? error.message : 'Failed to sync feeds');
      setIsSyncing(false);
    }
  };

  // Complete onboarding process when component mounts
  useEffect(() => {
    // Prevent double execution in strict mode
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    
    const completeOnboarding = async () => {
      setIsSyncing(true);
      setSyncError(null);
      setSyncProgress({ current: 0, total: selectedFeedsCount, newArticles: 0 });

      try {
        // Mark onboarding as completed
        await apiRequest('PUT', '/api/users/profile', {
          onboarding_completed: true
        });

        // Trigger initial feed synchronization for subscribed feeds
        await apiRequest('POST', '/api/feeds/sync', {});
        
        // Start polling for sync progress
        pollingRef.current = setInterval(pollSyncStatus, 1500);
        
        // Initial poll
        await pollSyncStatus();
      } catch (error) {
        console.error('Failed to complete onboarding:', error);
        setSyncError(error instanceof Error ? error.message : 'Failed to complete setup');
        setIsSyncing(false);
      }
    };

    completeOnboarding();
    
    // Cleanup polling on unmount
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [selectedFeedsCount, pollSyncStatus]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center max-w-lg mx-auto py-8 relative"
    >
      <div className="mb-6">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <PartyPopper className="h-8 w-8 text-primary" />
        </div>
      </div>
      
      <h1 className="text-3xl font-display font-bold tracking-tight mb-2">
        {isSyncing ? "Setting up your feed..." : syncComplete ? "You're all set!" : "Almost ready!"}
      </h1>
      
      <p className="text-muted-foreground mb-8">
        {isSyncing 
          ? "We're fetching the latest articles for you" 
          : syncComplete 
            ? "Your personalized news feed is ready"
            : "Preparing your reading experience"}
      </p>

      {/* Sync Progress Indicator */}
      {isSyncing && (
        <div className="flex flex-col items-center gap-4 mb-8 w-full">
          <div className="flex items-center gap-3">
            <Spinner className="h-5 w-5 text-primary" />
            <span className="font-medium">Syncing feeds...</span>
          </div>
          
          {/* Progress bar */}
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>
                {syncProgress.current} of {syncProgress.total || selectedFeedsCount} feeds
              </span>
              {syncProgress.total > 0 && (
                <span>
                  {Math.round((syncProgress.current / syncProgress.total) * 100)}%
                </span>
              )}
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ 
                  width: syncProgress.total > 0 
                    ? `${(syncProgress.current / syncProgress.total) * 100}%` 
                    : '0%' 
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          </div>
          
          {/* Current feed being synced */}
          {syncProgress.currentFeedName && (
            <p className="text-sm text-muted-foreground">
              Fetching: {syncProgress.currentFeedName}
            </p>
          )}
          
          {/* New articles count */}
          {syncProgress.newArticles > 0 && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              {syncProgress.newArticles} new articles found
            </p>
          )}
        </div>
      )}

      {/* Sync Complete with partial failures */}
      {syncComplete && failedFeeds.length > 0 && (
        <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 mb-8 w-full">
          <div className="flex items-center gap-2 font-medium mb-2">
            <AlertCircle className="h-4 w-4" />
            <span>Some feeds couldn't be synced</span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {failedFeeds.length} feed{failedFeeds.length > 1 ? 's' : ''} failed. You can retry from settings later.
          </p>
        </div>
      )}

      {/* Sync Error */}
      {syncError && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 mb-8 w-full">
          <div className="flex items-center gap-2 font-medium mb-2">
            <AlertCircle className="h-4 w-4" />
            <span>Sync Error</span>
          </div>
          <p className="text-xs mb-3">{syncError}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRetrySync}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-3 w-3" />
            Retry Sync
          </Button>
        </div>
      )}

      <div className="w-full bg-card border border-border rounded-2xl p-6 shadow-lg mb-8 text-left">
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Your Topics</h3>
            <div className="flex flex-wrap gap-2">
              {selectedInterests.map(id => {
                const cat = getCategoryById(id);
                if (!cat) return null;
                const Icon = cat.icon;
                return (
                   <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm font-medium">
                     <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                     {cat.label}
                   </span>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-border">
             <div className="flex justify-between items-center">
               <div className="flex items-center gap-2 text-muted-foreground">
                 <Rss className="h-4 w-4" />
                 <span>Subscriptions</span>
               </div>
               <span className="font-bold text-lg">{selectedFeedsCount} feeds</span>
             </div>
          </div>
        </div>
      </div>

      <Link href="/">
        <Button 
          size="lg" 
          className="w-full md:w-auto px-12 h-12 rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all bg-primary hover:bg-primary/90"
          disabled={isSyncing}
        >
          {isSyncing ? "Syncing..." : "Start Reading"}
        </Button>
      </Link>
      
      <p className="mt-4 text-sm text-muted-foreground">
        You can always add more feeds later from the sidebar.
      </p>
    </motion.div>
  );
}
