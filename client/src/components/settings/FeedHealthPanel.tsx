import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Zap,
  Timer,
  TrendingUp,
  AlertCircle,
  Pause,
  HelpCircle,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FeedHealth {
  feed_id: string;
  feed_name: string;
  feed_url: string;
  status: string;
  priority: string;
  health_status: string;
  success_rate_7d: number | null;
  sync_count_7d: number;
  articles_new_7d: number;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_at: string | null;
  consecutive_failures: number;
  next_sync_at: string | null;
}

interface SchedulerStatus {
  lastRunAt: string | null;
  runs24h: number;
  successRate24h: number | null;
  feedsSynced24h: number;
  articlesNew24h: number;
  isHealthy: boolean;
}

interface SchedulerRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  feeds_synced: number;
  feeds_succeeded: number;
  feeds_failed: number;
  articles_new: number;
  errors: string | null;
}

const HEALTH_STATUS_CONFIG = {
  healthy: { 
    label: 'Healthy', 
    icon: CheckCircle2, 
    color: 'text-emerald-500', 
    bgColor: 'bg-emerald-500/10',
    description: 'Feed is syncing normally'
  },
  warning: { 
    label: 'Warning', 
    icon: AlertCircle, 
    color: 'text-amber-500', 
    bgColor: 'bg-amber-500/10',
    description: '3+ consecutive sync failures'
  },
  critical: { 
    label: 'Critical', 
    icon: XCircle, 
    color: 'text-red-500', 
    bgColor: 'bg-red-500/10',
    description: '5+ consecutive sync failures'
  },
  error: { 
    label: 'Error', 
    icon: XCircle, 
    color: 'text-red-500', 
    bgColor: 'bg-red-500/10',
    description: 'Feed is in error state'
  },
  failing: { 
    label: 'Failing', 
    icon: AlertTriangle, 
    color: 'text-red-400', 
    bgColor: 'bg-red-400/10',
    description: 'All recent syncs have failed'
  },
  degraded: { 
    label: 'Degraded', 
    icon: AlertTriangle, 
    color: 'text-orange-500', 
    bgColor: 'bg-orange-500/10',
    description: 'Less than 50% success rate'
  },
  paused: { 
    label: 'Paused', 
    icon: Pause, 
    color: 'text-zinc-500', 
    bgColor: 'bg-zinc-500/10',
    description: 'Feed sync is paused'
  },
  unknown: { 
    label: 'Unknown', 
    icon: HelpCircle, 
    color: 'text-zinc-400', 
    bgColor: 'bg-zinc-400/10',
    description: 'No sync data available'
  }
} as const;

export function FeedHealthPanel() {
  const [feedHealth, setFeedHealth] = useState<FeedHealth[]>([]);
  const [summary, setSummary] = useState<{ total: number; healthy: number; warning: number; critical: number; paused: number } | null>(null);
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [recentRuns, setRecentRuns] = useState<SchedulerRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFeeds, setExpandedFeeds] = useState<Set<string>>(new Set());
  const [selectedFeed, setSelectedFeed] = useState<FeedHealth | null>(null);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [syncHistoryLoading, setSyncHistoryLoading] = useState(false);

  const fetchHealthData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch feed health and scheduler status in parallel
      const [healthRes, schedulerRes] = await Promise.all([
        apiRequest('GET', '/api/feeds/health'),
        apiRequest('GET', '/api/scheduler/status')
      ]);

      const healthData = await healthRes.json();
      const schedulerData = await schedulerRes.json();

      if (healthData.success) {
        setFeedHealth(healthData.feeds || []);
        setSummary(healthData.summary || null);
      }

      if (schedulerData.success) {
        setScheduler(schedulerData.scheduler?.feedSync || null);
        setRecentRuns(schedulerData.recentRuns || []);
      }
    } catch (err) {
      console.error('Failed to fetch health data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load health data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSyncHistory = async (feedId: string) => {
    try {
      setSyncHistoryLoading(true);
      const response = await apiRequest('GET', `/api/feeds/${feedId}/sync-history?limit=20`);
      const data = await response.json();
      if (data.success) {
        setSyncHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch sync history:', err);
    } finally {
      setSyncHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  useEffect(() => {
    if (selectedFeed) {
      fetchSyncHistory(selectedFeed.feed_id);
    }
  }, [selectedFeed]);

  const toggleFeedExpanded = (feedId: string) => {
    setExpandedFeeds(prev => {
      const next = new Set(prev);
      if (next.has(feedId)) {
        next.delete(feedId);
      } else {
        next.add(feedId);
      }
      return next;
    });
  };

  const getHealthBadge = (status: string) => {
    const config = HEALTH_STATUS_CONFIG[status as keyof typeof HEALTH_STATUS_CONFIG] || HEALTH_STATUS_CONFIG.unknown;
    const Icon = config.icon;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("gap-1 cursor-help", config.color, config.bgColor)}>
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <Zap className="h-3.5 w-3.5 text-red-500" />;
      case 'medium': return <Clock className="h-3.5 w-3.5 text-amber-500" />;
      case 'low': return <Timer className="h-3.5 w-3.5 text-blue-500" />;
      default: return <Clock className="h-3.5 w-3.5 text-zinc-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary animate-pulse" />
          <h3 className="text-lg font-semibold">Feed Health</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Feed Health</h3>
        </div>
        <div className="text-center py-8">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchHealthData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scheduler Status */}
      <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Sync Scheduler Status</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchHealthData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {scheduler ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="flex items-center gap-2">
                {scheduler.isHealthy ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
                <span className={cn("text-sm font-medium", scheduler.isHealthy ? "text-emerald-600" : "text-amber-600")}>
                  {scheduler.isHealthy ? 'Healthy' : 'Needs Attention'}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Last Run</p>
              <p className="text-sm font-medium">
                {scheduler.lastRunAt 
                  ? formatDistanceToNow(new Date(scheduler.lastRunAt), { addSuffix: true })
                  : 'Never'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Runs (24h)</p>
              <p className="text-sm font-medium">{scheduler.runs24h || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Success Rate (24h)</p>
              <p className="text-sm font-medium">
                {scheduler.successRate24h !== null ? `${scheduler.successRate24h}%` : 'N/A'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Scheduler status not available. The scheduler may not have run yet.</p>
        )}

        {scheduler && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-4 text-xs text-muted-foreground">
            <span><TrendingUp className="h-3 w-3 inline mr-1" />{scheduler.feedsSynced24h || 0} feeds synced</span>
            <span>{scheduler.articlesNew24h || 0} new articles</span>
          </div>
        )}
      </div>

      {/* Health Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 bg-card rounded-lg border">
            <p className="text-xs text-muted-foreground mb-1">Total Feeds</p>
            <p className="text-2xl font-bold">{summary.total}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Healthy</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.healthy}</p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Warning</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.warning}</p>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <p className="text-xs text-red-600 dark:text-red-400 mb-1">Critical</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.critical}</p>
          </div>
          <div className="p-3 bg-zinc-500/10 rounded-lg border border-zinc-500/20">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Paused</p>
            <p className="text-2xl font-bold text-zinc-600 dark:text-zinc-400">{summary.paused}</p>
          </div>
        </div>
      )}

      {/* Feed Health List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Feed Details</h4>
        
        {feedHealth.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No feeds to display</p>
        ) : (
          feedHealth.map(feed => (
            <Collapsible
              key={feed.feed_id}
              open={expandedFeeds.has(feed.feed_id)}
              onOpenChange={() => toggleFeedExpanded(feed.feed_id)}
            >
              <div className={cn(
                "border rounded-lg transition-colors",
                feed.health_status === 'critical' || feed.health_status === 'error' 
                  ? "border-red-500/30 bg-red-500/5"
                  : feed.health_status === 'warning' || feed.health_status === 'failing'
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-border"
              )}>
                <CollapsibleTrigger asChild>
                  <button className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      {expandedFeeds.has(feed.feed_id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      {getPriorityIcon(feed.priority)}
                      <span className="font-medium truncate">{feed.feed_name}</span>
                      {getHealthBadge(feed.health_status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      {feed.success_rate_7d !== null && (
                        <span>{feed.success_rate_7d}% success</span>
                      )}
                      {feed.articles_new_7d > 0 && (
                        <span>{feed.articles_new_7d} new (7d)</span>
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Last Sync</p>
                        <p className="font-medium">
                          {feed.last_sync_at 
                            ? formatDistanceToNow(new Date(feed.last_sync_at), { addSuffix: true })
                            : 'Never'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Next Sync</p>
                        <p className="font-medium">
                          {feed.next_sync_at 
                            ? formatDistanceToNow(new Date(feed.next_sync_at), { addSuffix: true })
                            : 'Not scheduled'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Syncs (7d)</p>
                        <p className="font-medium">{feed.sync_count_7d}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Consecutive Failures</p>
                        <p className={cn("font-medium", feed.consecutive_failures >= 3 && "text-red-500")}>
                          {feed.consecutive_failures}
                        </p>
                      </div>
                    </div>

                    {feed.last_sync_error && (
                      <div className="p-2 bg-red-500/10 rounded border border-red-500/20">
                        <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Last Error</p>
                        <p className="text-xs text-red-600/80 dark:text-red-400/80 font-mono break-all">
                          {feed.last_sync_error}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs"
                            onClick={() => setSelectedFeed(feed)}
                          >
                            View Sync History
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Sync History: {selectedFeed?.feed_name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            {syncHistoryLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                              </div>
                            ) : syncHistory.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">No sync history available</p>
                            ) : (
                              syncHistory.map((log, idx) => (
                                <div 
                                  key={log.id || idx} 
                                  className={cn(
                                    "p-3 rounded-lg border text-sm",
                                    log.status === 'success' ? "bg-emerald-500/5 border-emerald-500/20" :
                                    log.status === 'error' ? "bg-red-500/5 border-red-500/20" :
                                    "bg-muted/50"
                                  )}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      {log.status === 'success' ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                      ) : log.status === 'error' ? (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                      ) : (
                                        <Clock className="h-4 w-4 text-amber-500" />
                                      )}
                                      <span className="font-medium capitalize">{log.status}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {log.sync_started_at && format(new Date(log.sync_started_at), 'MMM d, h:mm a')}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Articles: </span>
                                      <span>{log.articles_new || 0} new</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Duration: </span>
                                      <span>{log.sync_duration_ms ? `${log.sync_duration_ms}ms` : 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">HTTP: </span>
                                      <span>{log.http_status_code || 'N/A'}</span>
                                    </div>
                                  </div>
                                  {log.error_message && (
                                    <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-mono break-all">
                                      {log.error_message}
                                    </p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      <a 
                        href={feed.feed_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Feed
                      </a>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  );
}
