import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  Activity,
  Calendar,
  Zap,
  Timer,
  ShieldX,
  ArrowLeft
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

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

export default function SyncMonitor() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [recentRuns, setRecentRuns] = useState<SchedulerRun[]>([]);
  const [nextSyncs, setNextSyncs] = useState<NextSyncInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect non-admin users
  useEffect(() => {
    if (user && !user.is_admin) {
      setLocation('/');
    }
  }, [user, setLocation]);

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
    if (user?.is_admin) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
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
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-8 w-8" />
          <span className="ml-3">Loading sync status...</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 pb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Activity className="h-8 w-8 text-primary" />
                Sync Monitor
              </h1>
              <p className="text-muted-foreground">Real-time feed synchronization status</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Scheduler Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Last Run</CardDescription>
              <CardTitle className="text-lg">
                {scheduler?.lastRunAt 
                  ? formatDistanceToNow(new Date(scheduler.lastRunAt), { addSuffix: true })
                  : 'Never'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Runs (24h)</CardDescription>
              <CardTitle className="text-2xl">{scheduler?.runs24h || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Success Rate</CardDescription>
              <CardTitle className={cn(
                "text-2xl",
                (scheduler?.successRate24h || 0) >= 90 ? "text-green-600" :
                (scheduler?.successRate24h || 0) >= 70 ? "text-amber-600" : "text-red-600"
              )}>
                {scheduler?.successRate24h != null ? `${scheduler?.successRate24h}%` : 'N/A'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Feeds Synced (24h)</CardDescription>
              <CardTitle className="text-2xl">{scheduler?.feedsSynced24h || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>New Articles (24h)</CardDescription>
              <CardTitle className="text-2xl text-primary">{scheduler?.articlesNew24h || 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Next Scheduled Syncs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Next Scheduled Syncs
              </CardTitle>
              <CardDescription>Feeds due for synchronization</CardDescription>
            </CardHeader>
            <CardContent>
              {nextSyncs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No feeds scheduled for sync</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {nextSyncs.map((feed) => (
                    <div key={feed.feedId} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-muted/50 border">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={getPriorityColor(feed.priority)}>
                          {getPriorityIcon(feed.priority)}
                        </span>
                        <span className="truncate font-medium">{feed.feedName}</span>
                        <Badge variant="outline" className="text-xs">
                          {feed.priority}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {new Date(feed.nextSyncAt) <= new Date() 
                          ? 'Due now'
                          : formatDistanceToNow(new Date(feed.nextSyncAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Runs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Scheduler Runs
              </CardTitle>
              <CardDescription>History of sync operations</CardDescription>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent runs</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {recentRuns.map((run) => (
                    <div key={run.id} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg bg-muted/30 border">
                      <div className="flex items-center gap-2">
                        {run.feeds_failed === 0 ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : run.feeds_failed < run.feeds_synced / 2 ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
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
              )}
            </CardContent>
          </Card>
        </div>

        {/* No runs warning */}
        {!scheduler?.lastRunAt && recentRuns.length === 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No scheduler runs detected. The feed sync scheduler may not be configured or running.
              Check your Netlify scheduled functions configuration.
            </AlertDescription>
          </Alert>
        )}

        {/* Info Card */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Activity className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium mb-1">About Feed Sync</p>
                <p className="text-sm text-muted-foreground">
                  Feeds are synchronized automatically every 15 minutes via Netlify scheduled functions.
                  High priority feeds sync hourly, medium priority daily, and low priority weekly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
