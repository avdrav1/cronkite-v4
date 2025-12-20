import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/data/categories";
import { REGIONS } from "@/data/regions";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { Confetti } from "@/components/ui/confetti"; // Placeholder import, simulating confetti
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

interface ConfirmationStepProps {
  selectedInterests: string[];
  selectedRegion: string | null;
  selectedFeedsCount: number;
}

export function ConfirmationStep({ selectedInterests, selectedRegion, selectedFeedsCount }: ConfirmationStepProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const regionName = selectedRegion ? REGIONS.find(r => r.code === selectedRegion)?.name : null;
  const regionFlag = selectedRegion ? REGIONS.find(r => r.code === selectedRegion)?.flag : null;

  // Trigger initial feed sync when component mounts
  useEffect(() => {
    const triggerInitialSync = async () => {
      setIsSyncing(true);
      setSyncError(null);

      try {
        // Trigger feed synchronization
        await apiRequest('POST', '/api/feeds/sync', {});
        setSyncComplete(true);
      } catch (error) {
        console.error('Failed to trigger feed sync:', error);
        setSyncError(error instanceof Error ? error.message : 'Failed to sync feeds');
      } finally {
        setIsSyncing(false);
      }
    };

    triggerInitialSync();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center max-w-lg mx-auto py-8 relative"
    >
      <div className="text-6xl mb-6 animate-bounce">🎉</div>
      
      <h1 className="text-4xl font-display font-bold tracking-tight mb-8">
        {isSyncing ? "Setting up your feed..." : syncComplete ? "You're all set!" : "Almost ready!"}
      </h1>

      {isSyncing && (
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Fetching your first articles...</p>
        </div>
      )}

      {syncError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-8">
          <p className="font-medium">Sync Error</p>
          <p>{syncError}</p>
          <p className="mt-2 text-xs">Don't worry, you can sync feeds later from the settings page.</p>
        </div>
      )}

      <div className="w-full bg-card border border-border rounded-2xl p-6 shadow-lg mb-10 text-left">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Your Interests</h3>
            <div className="flex flex-wrap gap-2">
              {selectedInterests.map(id => {
                const cat = CATEGORIES.find(c => c.id === id);
                return (
                   <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-sm font-medium">
                     <span>{cat?.emoji}</span> {cat?.label}
                   </span>
                );
              })}
            </div>
          </div>

          {selectedRegion && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Region</h3>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border/50">
                 <span className="text-xl">{regionFlag}</span>
                 <span className="font-medium">{regionName}</span>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border">
             <div className="flex justify-between items-center">
               <span className="text-muted-foreground">Subscriptions</span>
               <span className="font-bold text-lg">{selectedFeedsCount} feeds</span>
             </div>
          </div>
        </div>
      </div>

      <Link href="/">
        <Button 
          size="lg" 
          className="w-full md:w-auto px-12 h-14 text-lg rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all bg-primary hover:bg-primary/90"
          disabled={isSyncing}
        >
          {isSyncing ? "Syncing..." : "Start Reading →"}
        </Button>
      </Link>
      
      <p className="mt-4 text-sm text-muted-foreground">
        You can always add more feeds later from the sidebar.
      </p>
    </motion.div>
  );
}
