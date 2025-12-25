import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useInvalidateFeedsQuery } from "@/hooks/useFeedsQuery";
import { Search, Plus, MoreVertical, Folder, ChevronDown, ChevronRight, AlertTriangle, Pause, RefreshCw, Trash2, Edit2, Play, Info, Clock, Zap, Timer, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AddFeedModal } from "@/components/feed/AddFeedModal";
import { FeedHealth } from "@/components/settings/FeedHealth";

interface Feed {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'paused' | 'error';
  priority: 'high' | 'medium' | 'low';
  last_fetched_at?: string;
  article_count: number;
  folder_name?: string;
}

interface FeedCountResponse {
  currentCount: number;
  maxAllowed: number;
  remaining: number;
  isNearLimit: boolean;
}

const PRIORITY_CONFIG = {
  high: { label: 'High', interval: '1 hour', description: 'Breaking news sources', icon: Zap, color: 'text-red-500' },
  medium: { label: 'Medium', interval: '24 hours', description: 'Regular news sources', icon: Clock, color: 'text-amber-500' },
  low: { label: 'Low', interval: '7 days', description: 'Infrequent publishers', icon: Timer, color: 'text-blue-500' }
} as const;

export function FeedManagement() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { toast } = useToast();
  const invalidateFeedsQuery = useInvalidateFeedsQuery();
  const [feedCount, setFeedCount] = useState<FeedCountResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, newArticles: 0 });

  const fetchFeedCount = async () => {
    try {
      const response = await apiRequest('GET', '/api/feeds/count');
      setFeedCount(await response.json());
    } catch (e) { console.error('Failed to fetch feed count:', e); }
  };

  const fetchFeeds = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest('GET', '/api/feeds/user');
      const data = await response.json();
      if (!data.feeds) throw new Error('No feeds data received');
      setFeeds(data.feeds.map((f: any) => ({
        id: f.id, name: f.name, url: f.url, status: f.status || 'active',
        priority: f.priority || 'medium', last_fetched_at: f.last_fetched_at,
        article_count: f.article_count || 0, folder_name: f.folder_name || 'General'
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feeds');
    } finally { setIsLoading(false); }
  };

  const handleSyncAll = async () => {
    const activeFeeds = feeds.filter(f => f.status === 'active');
    if (!activeFeeds.length) { toast({ title: "No feeds to sync" }); return; }
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: activeFeeds.length, newArticles: 0 });
    let totalNew = 0;
    for (let i = 0; i < activeFeeds.length; i++) {
      setSyncProgress(p => ({ ...p, current: i + 1 }));
      try {
        const res = await apiRequest('POST', '/api/feeds/sync', { feedIds: [activeFeeds[i].id] });
        const r = await res.json();
        if (r.results?.[0]) { totalNew += r.results[0].articlesNew || 0; setSyncProgress(p => ({ ...p, newArticles: totalNew })); }
      } catch (e) { console.error(e); }
    }
    toast({ title: "Sync Complete", description: `${totalNew} new articles found.` });
    await fetchFeeds(); await fetchFeedCount();
    setIsSyncing(false); setSyncProgress({ current: 0, total: 0, newArticles: 0 });
  };

  useEffect(() => { fetchFeeds(); fetchFeedCount(); }, []);

  const filteredFeeds = feeds.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.url.toLowerCase().includes(searchQuery.toLowerCase()));
  const feedsByFolder: Record<string, Feed[]> = {};
  filteredFeeds.forEach(f => { const folder = f.folder_name || 'General'; if (!feedsByFolder[folder]) feedsByFolder[folder] = []; feedsByFolder[folder].push(f); });
  const totalArticleCount = feeds.reduce((s, f) => s + (f.article_count || 0), 0);

  const handleFeedAction = async (feedId: string, action: 'pause' | 'resume' | 'delete' | 'retry') => {
    try {
      if (action === 'pause') await apiRequest('PUT', `/api/feeds/${feedId}`, { status: 'paused' });
      else if (action === 'resume') await apiRequest('PUT', `/api/feeds/${feedId}`, { status: 'active' });
      else if (action === 'delete') { await apiRequest('DELETE', `/api/feeds/unsubscribe/${feedId}`); invalidateFeedsQuery(); await fetchFeedCount(); }
      else if (action === 'retry') await apiRequest('POST', '/api/feeds/sync', { feedIds: [feedId] });
      toast({ title: action === 'delete' ? "Feed Removed" : action === 'retry' ? "Sync Started" : `Feed ${action === 'pause' ? 'Paused' : 'Resumed'}` });
      await fetchFeeds();
    } catch (e) { toast({ variant: "destructive", title: `Failed to ${action} feed` }); }
  };

  const toggleFolder = (folder: string) => setExpandedFolders(p => p.includes(folder) ? p.filter(f => f !== folder) : [...p, folder]);
  const getStatusColor = (s: Feed['status']) => s === 'active' ? 'bg-emerald-500' : s === 'error' ? 'bg-red-500' : 'bg-zinc-500';
  const getStatusIcon = (s: Feed['status']) => s === 'paused' ? <Pause className="h-4 w-4 text-zinc-500" /> : s === 'error' ? <AlertTriangle className="h-4 w-4 text-red-500" /> : null;
  const getPriorityBadge = (p: Feed['priority']) => {
    const c = PRIORITY_CONFIG[p]; const Icon = c.icon;
    return (<Tooltip><TooltipTrigger asChild><Badge variant="outline" className={cn("text-xs gap-1 cursor-help", c.color)}><Icon className="h-3 w-3" />{c.label}</Badge></TooltipTrigger><TooltipContent><p className="font-medium">{c.description}</p><p className="text-xs text-muted-foreground">Syncs every {c.interval}</p></TooltipContent></Tooltip>);
  };

  if (isLoading) return (<div className="flex flex-col h-full"><div className="p-6 border-b"><h2 className="text-2xl font-bold">Feed Management</h2></div><div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></div>);
  if (error) return (<div className="flex flex-col h-full"><div className="p-6 border-b"><h2 className="text-2xl font-bold">Feed Management</h2></div><div className="flex-1 flex items-center justify-center text-center"><AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" /><p className="text-red-600 mb-4">{error}</p><Button onClick={fetchFeeds}><RefreshCw className="h-4 w-4 mr-2" />Try Again</Button></div></div>);

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h2 className="text-2xl font-bold mb-1">Feed Management</h2>
        <p className="text-muted-foreground mb-4">Manage subscriptions and monitor feed health</p>
        <Tabs defaultValue="feeds" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="feeds" className="gap-2"><Folder className="h-4 w-4" />My Feeds</TabsTrigger>
            <TabsTrigger value="health" className="gap-2"><Activity className="h-4 w-4" />Feed Health</TabsTrigger>
          </TabsList>
          <TabsContent value="feeds" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search feeds..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <Button variant="outline" onClick={handleSyncAll} disabled={isSyncing || !feeds.filter(f => f.status === 'active').length}>
                <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />{isSyncing ? 'Syncing...' : 'Sync All'}
              </Button>
              <Button onClick={() => setIsAddModalOpen(true)} disabled={feedCount?.remaining === 0}><Plus className="h-4 w-4 mr-2" />Add Feed</Button>
            </div>
            {isSyncing && (<div className="p-4 bg-muted/50 rounded-lg"><div className="flex justify-between mb-2 text-sm"><span>Syncing... ({syncProgress.current}/{syncProgress.total})</span><span>{syncProgress.newArticles} new</span></div><Progress value={(syncProgress.current / syncProgress.total) * 100} className="h-2" /></div>)}
            {feedCount && (<div><div className="flex justify-between mb-2 text-sm text-muted-foreground"><span>Feeds: {feedCount.currentCount}/{feedCount.maxAllowed}</span><span>{feedCount.remaining} remaining</span></div><Progress value={(feedCount.currentCount / feedCount.maxAllowed) * 100} className="h-2" />{feedCount.isNearLimit && <Alert className="mt-3"><AlertTriangle className="h-4 w-4" /><AlertDescription>Approaching feed limit.</AlertDescription></Alert>}</div>)}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{feeds.length} feeds</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{feeds.filter(f => f.status === 'active').length} active</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-500" />{feeds.filter(f => f.status === 'paused').length} paused</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{feeds.filter(f => f.status === 'error').length} error</span>
              <span className="ml-auto font-medium text-foreground">{totalArticleCount.toLocaleString()} articles</span>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border">
              <div className="flex gap-3"><Info className="h-5 w-5 text-muted-foreground shrink-0" /><div><p className="text-sm font-medium mb-2">Feed Priority Levels</p><div className="grid grid-cols-3 gap-2 text-xs"><span className="flex items-center gap-1"><Zap className="h-3 w-3 text-red-500" />High: Hourly</span><span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" />Medium: Daily</span><span className="flex items-center gap-1"><Timer className="h-3 w-3 text-blue-500" />Low: Weekly</span></div></div></div>
            </div>
            <TooltipProvider>
              <div className="space-y-3">
                {Object.entries(feedsByFolder).map(([folder, folderFeeds]) => (
                  <div key={folder}>
                    <button onClick={() => toggleFolder(folder)} className="flex items-center gap-2 w-full p-2 hover:bg-muted/50 rounded-lg">
                      {expandedFolders.includes(folder) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Folder className="h-4 w-4 text-primary" /><span className="font-semibold text-sm">{folder}</span><span className="text-xs text-muted-foreground">({folderFeeds.length})</span>
                    </button>
                    {expandedFolders.includes(folder) && (
                      <div className="pl-4 space-y-2 mt-2">
                        {folderFeeds.map(feed => (
                          <div key={feed.id} className="bg-card border rounded-lg p-4 hover:shadow-sm transition-shadow">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className={cn("w-2 h-2 rounded-full", getStatusColor(feed.status))} />
                                  <span className="font-medium truncate">{feed.name}</span>
                                  {getStatusIcon(feed.status)}
                                  {getPriorityBadge(feed.priority)}
                                </div>
                                <p className="text-xs text-muted-foreground truncate mb-1">{feed.url}</p>
                                <p className="text-xs text-muted-foreground">Last sync: {feed.last_fetched_at ? formatDistanceToNow(new Date(feed.last_fetched_at), { addSuffix: true }) : 'Never'} · {feed.article_count} articles</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {feed.status === 'error' && <Button variant="outline" size="sm" onClick={() => handleFeedAction(feed.id, 'retry')}><RefreshCw className="h-3 w-3 mr-1" />Retry</Button>}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem><Edit2 className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                                    {feed.status === 'paused' ? <DropdownMenuItem onClick={() => handleFeedAction(feed.id, 'resume')}><Play className="h-4 w-4 mr-2" />Resume</DropdownMenuItem> : <DropdownMenuItem onClick={() => handleFeedAction(feed.id, 'pause')}><Pause className="h-4 w-4 mr-2" />Pause</DropdownMenuItem>}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-600" onClick={() => handleFeedAction(feed.id, 'delete')}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!filteredFeeds.length && <p className="text-center py-8 text-muted-foreground">No feeds found</p>}
              </div>
            </TooltipProvider>
          </TabsContent>
          <TabsContent value="health" className="mt-4">
            <FeedHealth />
          </TabsContent>
        </Tabs>
      </div>
      <AddFeedModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onFeedAdded={() => { fetchFeeds(); fetchFeedCount(); setIsAddModalOpen(false); }} />
    </div>
  );
}
