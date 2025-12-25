import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatDistanceToNow, format } from "date-fns";

interface FeedHealthSummary {
  totalFeeds: number;
  feedsWithIssues: number;
  overallSuccessRate: number;
  healthyFeeds: number;
}

interface FeedHealthItem {
  feedId: string;
  feedName: string;
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  successRate: number;
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'error' | 'in_progress' | null;
  lastError: string | null;
  isHealthy: boolean;
}

interface FeedHealthResponse {
  summary: FeedHealthSummary;
  feeds: FeedHealthItem[];
}

interface FeedHealthDetailSync {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  articlesFound: number;
  articlesNew: number;
  error: string | null;
}

interface FeedHealthDetail {
  feedId: string;
  feedName: string;
  feedUrl: string;
  priority: string;
  status: string;
  stats: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    avgSyncDuration: number;
    totalArticlesFound: number;
    totalArticlesNew: number;
  };
  lastSync: {
    at: string | null;
    status: string | null;
    error: string | null;
  };
  recentSyncs: FeedHealthDetailSync[];
  isHealthy: boolean;
}

export function FeedHealth() {
  const [healthData, setHealthData] = useState<FeedHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFeed, setExpandedFeed] = useState<string | null>(null);
  const [feedDetail, setFeedDetail] = useState<FeedHealthDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchHealthData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest('GET', '/api/feeds/health');
      const data = await response.json();
      setHealthData(data);
    } catch (err) {
      console.error('Failed to fetch feed health:', err);
      setError(err instanceof Error ? err.message : 'Failed to load feed health data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFeedDetail = async (feedId: string) => {
    try {
      setLoadingDetail(true);
      const response = await apiRequest('GET', `/api/feeds/${feedId}/health?days=7`);
      const data = await response.json();
      setFeedDetail(data);
    } catch (err) {
      console.error('Failed to fetch feed detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const handleExpandFeed = async (feedId: string) => {
    if (expandedFeed === feedId) {
      setExpandedFeed(null);
      setFeedDetail(null);
    } else {
      setExpandedFeed(feedId);
      await fetchFeedDetail(feedId);
    }
  };

  const getStatusIcon = (status: string | null, isHealthy: boolean) => {
    if (status === 'in_progress') {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
    if (isHealthy) {
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-emerald-500';
    if (rate >= 70) return 'text-amber-500';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Feed Health Monitor</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Feed Health Monitor</h3>
        </div>
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchHealthData} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!healthData) return null;

  const { summary, feeds } = healthData;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Feed Health Monitor</h3>
        </div>
        <Button onClick={fetchHealthData} variant="ghost" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{summary.totalFeeds}</div>
          <div className="text-sm text-muted-foreground">Total Feeds</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-emerald-500">{summary.healthyFeeds}</div>
          <div className="text-sm text-muted-foreground">Healthy</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className={cn("text-2xl font-bold", summary.feedsWithIssues > 0 ? "text-red-500" : "text-emerald-500")}>
            {summary.feedsWithIssues}
          </div>
          <div className="text-sm text-muted-foreground">With Issues</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className={cn("text-2xl font-bold", getSuccessRateColor(summary.overallSuccessRate))}>
            {summary.overallSuccessRate}%
          </div>
          <div className="text-sm text-muted-foreground">Success Rate</div>
        </div>
      </div>

      {/* Overall Health Bar */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Overall Sync Health (Last 7 Days)</span>
          <span className={cn("text-sm font-bold", getSuccessRateColor(summary.overallSuccessRate))}>
            {summary.overallSuccessRate}%
          </span>
        </div>
        <Progress 
          value={summary.overallSuccessRate} 
          className={cn(
            "h-2",
            summary.overallSuccessRate < 70 && "[&>div]:bg-red-500",
            summary.overallSuccessRate >= 70 && summary.overallSuccessRate < 90 && "[&>div]:bg-amber-500"
          )}
        />
      </div>

      {/* Feed List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Individual Feed Status</h4>
        
        {feeds.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No feeds to monitor. Subscribe to some feeds to see health data.
          </div>
        ) : (
          feeds.map(feed => (
            <Collapsible 
              key={feed.feedId} 
              open={expandedFeed === feed.feedId}
              onOpenChange={() => handleExpandFeed(feed.feedId)}
            >
              <CollapsibleTrigger asChild>
                <div className={cn(
                  "bg-card border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                  !feed.isHealthy && "border-red-200 dark:border-red-900/50"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedFeed === feed.feedId ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      {getStatusIcon(feed.lastSyncStatus, feed.isHealthy)}
                      <div>
                        <div className="font-medium">{feed.feedName}</div>
                        <div className="text-xs text-muted-foreground">
                          {feed.lastSyncAt 
                            ? `Last sync: ${formatDistanceToNow(new Date(feed.lastSyncAt), { addSuffix: true })}`
                            : 'Never synced'
                          }
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={cn("text-sm font-bold", getSuccessRateColor(feed.successRate))}>
                          {feed.successRate}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {feed.successfulSyncs}/{feed.totalSyncs} syncs
                        </div>
                      </div>
                      {!feed.isHealthy && (
                        <Badge variant="destructive" className="text-xs">
                          Issues
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {feed.lastError && !feed.isHealthy && (
                    <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/10 rounded text-xs text-red-600 dark:text-red-400">
                      <span className="font-medium">Last error:</span> {feed.lastError}
                    </div>
                  )}
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                {loadingDetail && expandedFeed === feed.feedId ? (
                  <div className="p-4 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : feedDetail && expandedFeed === feed.feedId ? (
                  <div className="mt-2 bg-muted/30 border rounded-lg p-4 space-y-4">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-card rounded p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <TrendingUp className="h-3 w-3" />
                          Avg Duration
                        </div>
                        <div className="font-semibold">
                          {feedDetail.stats.avgSyncDuration > 0 
                            ? `${(feedDetail.stats.avgSyncDuration / 1000).toFixed(1)}s`
                            : 'N/A'
                          }
                        </div>
                      </div>
                      <div className="bg-card rounded p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <FileText className="h-3 w-3" />
                          Articles Found
                        </div>
                        <div className="font-semibold">{feedDetail.stats.totalArticlesFound}</div>
                      </div>
                      <div className="bg-card rounded p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <FileText className="h-3 w-3" />
                          New Articles
                        </div>
                        <div className="font-semibold text-emerald-500">{feedDetail.stats.totalArticlesNew}</div>
                      </div>
                      <div className="bg-card rounded p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Clock className="h-3 w-3" />
                          Priority
                        </div>
                        <div className="font-semibold capitalize">{feedDetail.priority}</div>
                      </div>
                    </div>

                    {/* Recent Syncs */}
                    <div>
                      <h5 className="text-sm font-medium mb-2">Recent Sync History</h5>
                      <div className="space-y-1">
                        {feedDetail.recentSyncs.slice(0, 5).map(sync => (
                          <div 
                            key={sync.id} 
                            className={cn(
                              "flex items-center justify-between p-2 rounded text-xs",
                              sync.status === 'success' ? "bg-emerald-50 dark:bg-emerald-900/10" : 
                              sync.status === 'error' ? "bg-red-50 dark:bg-red-900/10" :
                              "bg-blue-50 dark:bg-blue-900/10"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {sync.status === 'success' ? (
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              ) : sync.status === 'error' ? (
                                <XCircle className="h-3 w-3 text-red-500" />
                              ) : (
                                <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                              )}
                              <span>{format(new Date(sync.startedAt), 'MMM d, h:mm a')}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              {sync.status === 'success' && (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  +{sync.articlesNew} new
                                </span>
                              )}
                              {sync.duration && (
                                <span className="text-muted-foreground">
                                  {(sync.duration / 1000).toFixed(1)}s
                                </span>
                              )}
                              {sync.error && (
                                <span className="text-red-500 truncate max-w-[200px]" title={sync.error}>
                                  {sync.error}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CollapsibleContent>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  );
}
