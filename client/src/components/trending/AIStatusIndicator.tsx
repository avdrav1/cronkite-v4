import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, CheckCircle, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface SchedulerStats {
  embeddingsProcessed: number;
  embeddingsFailed: number;
  clustersGenerated: number;
  clustersExpired: number;
  lastEmbeddingRun: string | null;
  lastClusteringRun: string | null;
  lastCleanupRun: string | null;
  errors: string[];
  isRunning: boolean;
  services: {
    embeddings: boolean;
    clustering: boolean;
  };
}

interface AIStatusIndicatorProps {
  className?: string;
  compact?: boolean;
}

/**
 * AI Status Indicator - Shows users when AI clusters/topics are being generated
 * Provides visibility into the AI processing pipeline status
 */
export function AIStatusIndicator({ className, compact = false }: AIStatusIndicatorProps) {
  const [stats, setStats] = useState<SchedulerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      setIsRefreshing(true);
      const response = await apiRequest('GET', '/api/ai/scheduler-stats');
      const data = await response.json();
      if (data.scheduler) {
        setStats(data.scheduler);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch AI stats:', err);
      setError('Unable to load AI status');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground text-sm", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading AI status...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground text-sm", className)}>
        <AlertCircle className="h-4 w-4 text-amber-500" />
        <span>{error || 'AI status unavailable'}</span>
      </div>
    );
  }

  const isActive = stats.isRunning;
  const hasEmbeddings = stats.services.embeddings;
  const hasClustering = stats.services.clustering;

  // Determine overall status
  const getStatusInfo = () => {
    if (!isActive) {
      return { icon: AlertCircle, color: "text-amber-500", label: "AI Paused" };
    }
    if (!hasEmbeddings && !hasClustering) {
      return { icon: AlertCircle, color: "text-amber-500", label: "API Keys Missing" };
    }
    if (stats.errors.length > 0) {
      return { icon: AlertCircle, color: "text-amber-500", label: "Some Errors" };
    }
    return { icon: CheckCircle, color: "text-emerald-500", label: "AI Active" };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1.5 cursor-help", className)}>
              <StatusIcon className={cn("h-3.5 w-3.5", statusInfo.color)} />
              <span className="text-xs text-muted-foreground">{statusInfo.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-2 text-xs">
              <div className="font-medium">AI Processing Status</div>
              <div className="space-y-1">
                <div className="flex justify-between gap-4">
                  <span>Embeddings:</span>
                  <span className={hasEmbeddings ? "text-emerald-500" : "text-amber-500"}>
                    {hasEmbeddings ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Clustering:</span>
                  <span className={hasClustering ? "text-emerald-500" : "text-amber-500"}>
                    {hasClustering ? "Active" : "Fallback"}
                  </span>
                </div>
                {stats.lastClusteringRun && (
                  <div className="flex justify-between gap-4">
                    <span>Last cluster:</span>
                    <span>{formatDistanceToNow(new Date(stats.lastClusteringRun), { addSuffix: true })}</span>
                  </div>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn("space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50", className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">AI Processing</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("h-4 w-4", statusInfo.color)} />
            <span className={cn("text-xs font-medium", statusInfo.color)}>{statusInfo.label}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-muted-foreground cursor-help">
                <div className={cn("w-2 h-2 rounded-full", hasEmbeddings ? "bg-emerald-500" : "bg-amber-500")} />
                <span>Embeddings</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{hasEmbeddings ? "OpenAI embeddings active" : "OpenAI API key not configured"}</p>
              {stats.embeddingsProcessed > 0 && (
                <p className="text-muted-foreground">{stats.embeddingsProcessed} processed</p>
              )}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-muted-foreground cursor-help">
                <div className={cn("w-2 h-2 rounded-full", hasClustering ? "bg-emerald-500" : "bg-amber-500")} />
                <span>Clustering</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{hasClustering ? "Anthropic clustering active" : "Using fallback labels"}</p>
              {stats.clustersGenerated > 0 && (
                <p className="text-muted-foreground">{stats.clustersGenerated} clusters created</p>
              )}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Last Activity */}
        {(stats.lastClusteringRun || stats.lastEmbeddingRun) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Last activity:{" "}
              {stats.lastClusteringRun 
                ? formatDistanceToNow(new Date(stats.lastClusteringRun), { addSuffix: true })
                : stats.lastEmbeddingRun
                  ? formatDistanceToNow(new Date(stats.lastEmbeddingRun), { addSuffix: true })
                  : "Never"
              }
            </span>
          </div>
        )}

        {/* Refresh Button */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={fetchStats}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Refresh Status
        </Button>

        {/* Errors */}
        <AnimatePresence>
          {stats.errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded p-2"
            >
              <div className="font-medium mb-1">Recent Issues:</div>
              <ul className="list-disc list-inside space-y-0.5">
                {stats.errors.slice(0, 3).map((error, i) => (
                  <li key={i} className="truncate">{error}</li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}

export default AIStatusIndicator;
