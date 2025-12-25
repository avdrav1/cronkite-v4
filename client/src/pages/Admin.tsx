import { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Download
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

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

  // Load feeds on mount
  useEffect(() => {
    loadFeeds();
  }, []);

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
    const brokenFeeds = feeds.filter(f => f.status === 'error' || f.status === 'empty');
    if (brokenFeeds.length === 0) {
      alert('No broken feeds to remove');
      return;
    }
    
    if (!confirm(`Remove ${brokenFeeds.length} broken feeds?`)) return;
    
    try {
      await apiRequest('POST', '/api/admin/feeds/remove-broken');
      setFeeds(prev => prev.filter(f => f.status !== 'error' && f.status !== 'empty'));
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
          {(summary.errors > 0 || summary.empty > 0) && (
            <Button variant="destructive" size="sm" onClick={removeAllBroken}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove {summary.errors + summary.empty} Broken
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
