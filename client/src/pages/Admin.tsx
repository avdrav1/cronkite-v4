import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  Search,
  Play,
  Square,
  Download,
  Activity,
  Calendar,
  Zap,
  Timer,
  ShieldX,
  Sparkles
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface FeedHealth {
  id: string;
  name: string;
  url: string;
  category: string;
  status: 'healthy' | 'error' | 'empty' | 'stale' | 'pending' | 'testing';
  error?: string;
  httpStatus?: number;
  totalArticles: number;
  articlesLast30Days: number;
  latestArticleDate?: string;
  responseTimeMs?: number;
  lastChecked?: string;
}

interface HealthSummary {
  total: number;
  healthy: number;
  errors: number;
  empty: number;
  stale: number;
  pending: number;
}

export default function Admin() {
  const [feeds, setFeeds] = useState<FeedHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [auditProgress, setAuditProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect non-admin users
  useEffect(() => {
    if (user && !user.is_admin) {
      setLocation('/');
    }
  }, [user, setLocation]);

  // Load feeds on mount
  useEffect(() => {
    if (user?.is_admin) {
      loadFeeds();
    }
  }, [user]);

  // Show access denied for non-admin users
  if (user && !user.is_admin) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <ShieldX className="h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <Button onClick={() => setLocation('/')}>Go Home</Button>
        </div>
      </AppShell>
    );
  }

  const loadFeeds = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest('GET', '/api/admin/feeds');
      const data = await response.json();
      setFeeds(data.feeds || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feeds');
    } finally {
      setIsLoading(false);
    }
  };

  const runHealthAudit = async () => {
    try {
      setIsRunningAudit(true);
      setError(null);
      
      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();
      
      // Mark all feeds as pending
      const pendingFeeds = feeds.map(f => ({ ...f, status: 'pending' as const }));
      setFeeds(pendingFeeds);
      setAuditProgress({ current: 0, total: pendingFeeds.length });
      
      // Test feeds in small batches from the client side to avoid timeout
      const batchSize = 5;
      const results: FeedHealth[] = [];
      
      for (let i = 0; i < pendingFeeds.length; i += batchSize) {
        // Check if cancelled
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        
        const batch = pendingFeeds.slice(i, i + batchSize);
        
        // Test each feed in the batch in parallel
        const batchResults = await Promise.all(
          batch.map(async (feed) => {
            try {
              if (abortControllerRef.current?.signal.aborted) {
                return { ...feed, status: 'pending' as const };
              }
              const response = await apiRequest('POST', `/api/admin/feeds/${feed.id}/test`);
              const data = await response.json();
              return data.feed as FeedHealth;
            } catch (err) {
              return {
                ...feed,
                status: 'error' as const,
                error: err instanceof Error ? err.message : 'Test failed',
                lastChecked: new Date().toISOString()
              };
            }
          })
        );
        
        results.push(...batchResults);
        
        // Update progress and results
        setAuditProgress({ current: results.length, total: pendingFeeds.length });
        setFeeds(prev => {
          const updated = [...prev];
          for (const result of batchResults) {
            const idx = updated.findIndex(f => f.id === result.id);
            if (idx !== -1) {
              updated[idx] = result;
            }
          }
          return updated;
        });
        
        // Small delay between batches to avoid overwhelming the server
        if (i + batchSize < pendingFeeds.length && !abortControllerRef.current?.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsRunningAudit(false);
      setAuditProgress({ current: 0, total: 0 });
      abortControllerRef.current = null;
    }
  };

  const stopAudit = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const testFeed = async (feedId: string) => {
    try {
      setFeeds(prev => prev.map(f => 
        f.id === feedId ? { ...f, status: 'testing' as const } : f
      ));
      
      const response = await apiRequest('POST', `/api/admin/feeds/${feedId}/test`);
      const result = await response.json();
      
      setFeeds(prev => prev.map(f => 
        f.id === feedId ? { ...f, ...result.feed } : f
      ));
    } catch (err) {
      setFeeds(prev => prev.map(f => 
        f.id === feedId ? { ...f, status: 'error' as const, error: 'Test failed' } : f
      ));
    }
  };

  const removeFeed = async (feedId: string) => {
    if (!confirm('Are you sure you want to remove this feed?')) return;
    
    try {
      await apiRequest('DELETE', `/api/admin/feeds/${feedId}`);
      setFeeds(prev => prev.filter(f => f.id !== feedId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove feed');
    }
  };

  const removeAllBroken = async () => {
    const brokenFeeds = feeds.filter(f => f.status === 'error' || f.status === 'empty' || f.status === 'stale');
    if (brokenFeeds.length === 0) {
      alert('No broken feeds to remove');
      return;
    }
    
    if (!confirm(`Remove ${brokenFeeds.length} broken/stale feeds?`)) return;
    
    try {
      const feedIds = brokenFeeds.map(f => f.id);
      await apiRequest('POST', '/api/admin/feeds/remove-broken', { feedIds });
      setFeeds(prev => prev.filter(f => f.status !== 'error' && f.status !== 'empty' && f.status !== 'stale'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove broken feeds');
    }
  };

  const exportReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      summary: getSummary(),
      feeds: feeds
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feed-health-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const getSummary = (): HealthSummary => {
    return {
      total: feeds.length,
      healthy: feeds.filter(f => f.status === 'healthy').length,
      errors: feeds.filter(f => f.status === 'error').length,
      empty: feeds.filter(f => f.status === 'empty').length,
      stale: feeds.filter(f => f.status === 'stale').length,
      pending: feeds.filter(f => f.status === 'pending' || f.status === 'testing').length,
    };
  };

  const categories = Array.from(new Set(feeds.map(f => f.category))).sort();
  
  const filteredFeeds = feeds.filter(f => {
    if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !f.url.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedCategory && f.category !== selectedCategory) return false;
    if (selectedStatus && f.status !== selectedStatus) return false;
    return true;
  });

  const summary = getSummary();

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-8 w-8" />
          <span className="ml-3">Loading feeds...</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Feed Administration</h1>
            <p className="text-muted-foreground">Manage and monitor recommended feeds health</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            {isRunningAudit ? (
              <Button 
                variant="destructive"
                onClick={stopAudit}
              >
                <Square className="h-4 w-4 mr-2" />
                Stop ({auditProgress.current}/{auditProgress.total})
              </Button>
            ) : (
              <Button 
                onClick={runHealthAudit}
              >
                <Play className="h-4 w-4 mr-2" />
                Run Health Audit
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar - shown during audit */}
        {isRunningAudit && auditProgress.total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Testing feeds: {auditProgress.current} of {auditProgress.total}
              </span>
              <span className="font-medium">
                {((auditProgress.current / auditProgress.total) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${(auditProgress.current / auditProgress.total) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {summary.healthy} healthy, {summary.errors} errors, {summary.stale} stale
              </span>
              <span>
                ~{Math.ceil((auditProgress.total - auditProgress.current) / 5 * 2)} seconds remaining
              </span>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Sync Monitor */}
        <SyncMonitor />

        {/* Cluster Management */}
        <ClusterAdmin />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedStatus(null)}>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-2xl">{summary.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card 
            className={cn("cursor-pointer hover:bg-muted/50", selectedStatus === 'healthy' && "ring-2 ring-green-500")}
            onClick={() => setSelectedStatus(selectedStatus === 'healthy' ? null : 'healthy')}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" /> Healthy
              </CardDescription>
              <CardTitle className="text-2xl text-green-600">{summary.healthy}</CardTitle>
            </CardHeader>
          </Card>
          <Card 
            className={cn("cursor-pointer hover:bg-muted/50", selectedStatus === 'error' && "ring-2 ring-red-500")}
            onClick={() => setSelectedStatus(selectedStatus === 'error' ? null : 'error')}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" /> Errors
              </CardDescription>
              <CardTitle className="text-2xl text-red-600">{summary.errors}</CardTitle>
            </CardHeader>
          </Card>
          <Card 
            className={cn("cursor-pointer hover:bg-muted/50", selectedStatus === 'empty' && "ring-2 ring-orange-500")}
            onClick={() => setSelectedStatus(selectedStatus === 'empty' ? null : 'empty')}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-orange-500" /> Empty
              </CardDescription>
              <CardTitle className="text-2xl text-orange-600">{summary.empty}</CardTitle>
            </CardHeader>
          </Card>
          <Card 
            className={cn("cursor-pointer hover:bg-muted/50", selectedStatus === 'stale' && "ring-2 ring-yellow-500")}
            onClick={() => setSelectedStatus(selectedStatus === 'stale' ? null : 'stale')}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-500" /> Stale
              </CardDescription>
              <CardTitle className="text-2xl text-yellow-600">{summary.stale}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Health %</CardDescription>
              <CardTitle className={cn(
                "text-2xl",
                summary.healthy / summary.total > 0.9 ? "text-green-600" :
                summary.healthy / summary.total > 0.7 ? "text-yellow-600" : "text-red-600"
              )}>
                {summary.total > 0 ? ((summary.healthy / summary.total) * 100).toFixed(1) : 0}%
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search feeds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="h-10 px-3 rounded-md border border-input bg-background"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {(summary.errors > 0 || summary.empty > 0 || summary.stale > 0) && (
            <Button variant="destructive" size="sm" onClick={removeAllBroken}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove {summary.errors + summary.empty + summary.stale} Broken
            </Button>
          )}
        </div>

        {/* Feed List */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Feed</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Articles (30d)</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredFeeds.map(feed => (
                <tr key={feed.id} className="hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{feed.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-md">{feed.url}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline">{feed.category}</Badge>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={feed.status} error={feed.error} />
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {feed.articlesLast30Days > 0 ? feed.articlesLast30Days : '-'}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => testFeed(feed.id)}
                        disabled={feed.status === 'testing'}
                      >
                        {feed.status === 'testing' ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeFeed(feed.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredFeeds.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No feeds match your filters
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatusBadge({ status, error }: { status: string; error?: string }) {
  switch (status) {
    case 'healthy':
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Healthy</Badge>;
    case 'error':
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" title={error}>
          Error
        </Badge>
      );
    case 'empty':
      return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Empty</Badge>;
    case 'stale':
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Stale</Badge>;
    case 'testing':
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Testing...</Badge>;
    case 'pending':
      return <Badge variant="outline">Pending</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

interface SchedulerRun {
  id: string;
  run_type: string;
  started_at: string;
  completed_at: string | null;
  feeds_synced: number;
  feeds_succeeded: number;
  feeds_failed: number;
  articles_new: number;
  errors: string | null;
}

interface SchedulerStatus {
  lastRunAt: string | null;
  runs24h: number;
  successRate24h: number | null;
  feedsSynced24h: number;
  articlesNew24h: number;
  isHealthy: boolean;
}

interface NextSyncInfo {
  feedId: string;
  feedName: string;
  nextSyncAt: string;
  priority: string;
}

function SyncMonitor() {
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [recentRuns, setRecentRuns] = useState<SchedulerRun[]>([]);
  const [nextSyncs, setNextSyncs] = useState<NextSyncInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [schedulerRes, nextSyncsRes] = await Promise.all([
        apiRequest('GET', '/api/scheduler/status'),
        apiRequest('GET', '/api/admin/feeds/next-sync')
      ]);

      const schedulerData = await schedulerRes.json();
      const nextSyncsData = await nextSyncsRes.json();

      if (schedulerData.success) {
        setScheduler(schedulerData.scheduler?.feedSync || null);
        setRecentRuns(schedulerData.recentRuns || []);
      }

      if (nextSyncsData.success) {
        // Map the API response to our expected format
        const mappedFeeds = (nextSyncsData.feeds || []).map((f: any) => ({
          feedId: f.id,
          feedName: f.name,
          nextSyncAt: f.next_sync_at,
          priority: f.sync_priority || 'medium'
        }));
        setNextSyncs(mappedFeeds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sync status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-amber-500';
      case 'low': return 'text-blue-500';
      default: return 'text-muted-foreground';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <Zap className="h-3 w-3" />;
      case 'medium': return <Clock className="h-3 w-3" />;
      case 'low': return <Timer className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Sync Monitor</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Spinner className="h-5 w-5" />
            <span className="ml-2 text-sm text-muted-foreground">Loading sync status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Sync Monitor</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Sync Monitor</CardTitle>
            {scheduler?.isHealthy ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                Healthy
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Needs Attention
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Scheduled sync runs every 15 minutes via Netlify
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scheduler Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Last Run</p>
            <p className="text-sm font-medium">
              {scheduler?.lastRunAt 
                ? formatDistanceToNow(new Date(scheduler.lastRunAt), { addSuffix: true })
                : 'Never'}
            </p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Runs (24h)</p>
            <p className="text-sm font-medium">{scheduler?.runs24h || 0}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className={cn(
              "text-sm font-medium",
              (scheduler?.successRate24h || 0) >= 90 ? "text-green-600" :
              (scheduler?.successRate24h || 0) >= 70 ? "text-amber-600" : "text-red-600"
            )}>
              {scheduler?.successRate24h != null ? `${scheduler?.successRate24h}%` : 'N/A'}
            </p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Feeds Synced (24h)</p>
            <p className="text-sm font-medium">{scheduler?.feedsSynced24h || 0}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">New Articles (24h)</p>
            <p className="text-sm font-medium">{scheduler?.articlesNew24h || 0}</p>
          </div>
        </div>        {/* Next Scheduled Syncs */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Next Scheduled Syncs
          </h4>
          {nextSyncs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feeds scheduled for sync</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {nextSyncs.slice(0, 5).map((feed) => (
                <div key={feed.feedId} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={getPriorityColor(feed.priority)}>
                      {getPriorityIcon(feed.priority)}
                    </span>
                    <span className="truncate">{feed.feedName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {new Date(feed.nextSyncAt) <= new Date() 
                      ? 'Due now'
                      : formatDistanceToNow(new Date(feed.nextSyncAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
              {nextSyncs.length > 5 && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  +{nextSyncs.length - 5} more feeds scheduled
                </p>
              )}
            </div>
          )}
        </div>

        {/* Recent Runs */}
        {recentRuns.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Scheduler Runs
            </h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {recentRuns.slice(0, 5).map((run) => (
                <div key={run.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    {run.feeds_failed === 0 ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    ) : run.feeds_failed < run.feeds_synced / 2 ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span className="text-xs">
                      {format(new Date(run.started_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{run.feeds_synced} feeds</span>
                    <span className="text-green-600">+{run.articles_new} articles</span>
                    {run.feeds_failed > 0 && (
                      <span className="text-red-500">{run.feeds_failed} failed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No runs warning */}
        {!scheduler?.lastRunAt && recentRuns.length === 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No scheduler runs detected. The Netlify scheduled function may not be running. 
              Check your Netlify dashboard for function logs.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

interface ClusterInfo {
  id: string;
  title: string;
  summary: string;
  articleCount: number;
  sourceCount: number;
  sources: string[];
  createdAt: string;
  expiresAt: string;
  isValid: boolean;
}

interface ClusterSummary {
  total: number;
  valid: number;
  invalid: number;
  empty: number;
  singleSource: number;
}

function ClusterAdmin() {
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [summary, setSummary] = useState<ClusterSummary | null>(null);
  const [settings, setSettings] = useState({
    min_cluster_sources: 3,
    min_cluster_articles: 3,
    cluster_similarity_threshold: '0.60',
    keyword_overlap_min: 3,
    cluster_time_window_hours: 48
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const response = await apiRequest('GET', '/api/admin/clusters/settings');
      const data = await response.json();
      if (data.success && data.settings) {
        setSettings({
          min_cluster_sources: data.settings.min_cluster_sources ?? 3,
          min_cluster_articles: data.settings.min_cluster_articles ?? 3,
          cluster_similarity_threshold: data.settings.cluster_similarity_threshold ?? '0.60',
          keyword_overlap_min: data.settings.keyword_overlap_min ?? 3,
          cluster_time_window_hours: data.settings.cluster_time_window_hours ?? 48
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSavingSettings(true);
      await apiRequest('PUT', '/api/admin/clusters/settings', settings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const fetchClusters = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest('GET', '/api/admin/clusters');
      const data = await response.json();
      if (data.success) {
        setClusters(data.clusters || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clusters');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCluster = async (id: string, title: string) => {
    if (!confirm(`Delete cluster "${title}"?`)) return;
    try {
      await apiRequest('DELETE', `/api/admin/clusters/${id}`);
      setClusters(prev => prev.filter(c => c.id !== id));
      if (summary) {
        setSummary({ ...summary, total: summary.total - 1, invalid: summary.invalid - 1 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete cluster');
    }
  };

  const cleanupInvalid = async () => {
    if (!confirm(`Delete all ${summary?.invalid || 0} invalid clusters?`)) return;
    try {
      setIsCleaningUp(true);
      const response = await apiRequest('POST', '/api/admin/clusters/cleanup', undefined, { timeout: 60000 });
      const data = await response.json();
      if (data.success) {
        await fetchClusters();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup clusters');
    } finally {
      setIsCleaningUp(false);
    }
  };

  useEffect(() => { 
    fetchClusters();
    fetchSettings();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Cluster Management</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Spinner className="h-5 w-5" />
            <span className="ml-2 text-sm text-muted-foreground">Loading clusters...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Cluster Management</CardTitle>
            {summary && (
              <Badge variant={summary.invalid > 0 ? "destructive" : "default"}>
                {summary.valid} valid / {summary.invalid} invalid
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
              {showSettings ? 'Hide' : 'Settings'}
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchClusters}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {summary && summary.invalid > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={cleanupInvalid}
                disabled={isCleaningUp}
              >
                {isCleaningUp ? <Spinner className="h-4 w-4 mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Cleanup {summary.invalid} Invalid
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Trending topic clusters (requires 2+ sources to be valid)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showSettings && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-semibold mb-4">Clustering Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Min Sources</label>
                <Input 
                  type="number" 
                  min="1" 
                  value={settings.min_cluster_sources}
                  onChange={(e) => setSettings({...settings, min_cluster_sources: parseInt(e.target.value)})}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum unique sources per cluster</p>
              </div>
              <div>
                <label className="text-sm font-medium">Min Articles</label>
                <Input 
                  type="number" 
                  min="1" 
                  value={settings.min_cluster_articles}
                  onChange={(e) => setSettings({...settings, min_cluster_articles: parseInt(e.target.value)})}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum articles per cluster</p>
              </div>
              <div>
                <label className="text-sm font-medium">Similarity Threshold</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  max="1" 
                  value={settings.cluster_similarity_threshold}
                  onChange={(e) => setSettings({...settings, cluster_similarity_threshold: e.target.value})}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Embedding similarity (0.0-1.0)</p>
              </div>
              <div>
                <label className="text-sm font-medium">Keyword Overlap</label>
                <Input 
                  type="number" 
                  min="1" 
                  value={settings.keyword_overlap_min}
                  onChange={(e) => setSettings({...settings, keyword_overlap_min: parseInt(e.target.value)})}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Min shared keywords required</p>
              </div>
              <div>
                <label className="text-sm font-medium">Time Window (hours)</label>
                <Input 
                  type="number" 
                  min="1" 
                  value={settings.cluster_time_window_hours}
                  onChange={(e) => setSettings({...settings, cluster_time_window_hours: parseInt(e.target.value)})}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Max time span for articles</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={saveSettings} disabled={isSavingSettings}>
                {isSavingSettings ? <Spinner className="h-4 w-4 mr-2" /> : null}
                Save Settings
              </Button>
              <Button variant="outline" onClick={fetchSettings}>Reset</Button>
            </div>
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {summary && (
          <div className="grid grid-cols-5 gap-3 mb-4">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-medium">{summary.total}</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <p className="text-xs text-green-600">Valid</p>
              <p className="text-lg font-medium text-green-700">{summary.valid}</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
              <p className="text-xs text-red-600">Invalid</p>
              <p className="text-lg font-medium text-red-700">{summary.invalid}</p>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
              <p className="text-xs text-orange-600">Empty</p>
              <p className="text-lg font-medium text-orange-700">{summary.empty}</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
              <p className="text-xs text-amber-600">Single Source</p>
              <p className="text-lg font-medium text-amber-700">{summary.singleSource}</p>
            </div>
          </div>
        )}

        <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium">Cluster</th>
                <th className="text-center p-2 font-medium">Articles</th>
                <th className="text-center p-2 font-medium">Sources</th>
                <th className="text-center p-2 font-medium">Status</th>
                <th className="text-right p-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clusters.map(cluster => (
                <tr key={cluster.id} className={cn("hover:bg-muted/30", !cluster.isValid && "bg-red-50/50 dark:bg-red-900/10")}>
                  <td className="p-2">
                    <div className="font-medium truncate max-w-xs" title={cluster.title}>{cluster.title}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-xs">
                      {cluster.sources.slice(0, 3).join(', ')}{cluster.sources.length > 3 && ` +${cluster.sources.length - 3}`}
                    </div>
                  </td>
                  <td className="p-2 text-center tabular-nums">{cluster.articleCount}</td>
                  <td className="p-2 text-center tabular-nums">{cluster.sourceCount}</td>
                  <td className="p-2 text-center">
                    {cluster.isValid ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Valid</Badge>
                    ) : cluster.articleCount === 0 ? (
                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Empty</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">1 Source</Badge>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteCluster(cluster.id, cluster.title)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {clusters.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No clusters found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
