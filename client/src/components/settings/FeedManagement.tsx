import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useInvalidateFeedsQuery } from "@/hooks/useFeedsQuery";
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Folder, 
  ChevronDown, 
  ChevronRight,
  AlertTriangle,
  Pause,
  RefreshCw,
  Trash2,
  Edit2,
  Play,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

import { AddFeedModal } from "@/components/feed/AddFeedModal";

// Feed interface matching the API response
interface Feed {
  id: string;
  name: string;
  url: string;
  site_url?: string;
  description?: string;
  icon_url?: string;
  status: 'active' | 'paused' | 'error';
  priority: 'high' | 'medium' | 'low';
  last_fetched_at?: string;
  article_count: number;
  folder_name?: string;
  created_at: string;
  updated_at: string;
}

// Feed count response - Requirements: 5.1, 5.2, 5.3, 5.4
interface FeedCountResponse {
  currentCount: number;
  maxAllowed: number;
  remaining: number;
  isNearLimit: boolean;
}

export function FeedManagement() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['Tech', 'News', 'Gaming']);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { toast } = useToast();
  const invalidateFeedsQuery = useInvalidateFeedsQuery();
  
  // Feed count state - Requirements: 5.1, 5.2, 5.3, 5.4
  const [feedCount, setFeedCount] = useState<FeedCountResponse | null>(null);

  // Fetch feed count from API - Requirements: 5.1, 5.2, 5.3, 5.4
  const fetchFeedCount = async () => {
    try {
      const response = await apiRequest('GET', '/api/feeds/count');
      const data = await response.json();
      setFeedCount(data);
    } catch (error) {
      console.error('Failed to fetch feed count:', error);
    }
  };

  // Fetch user's feeds from API
  const fetchFeeds = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiRequest('GET', '/api/feeds/user');
      const data = await response.json();
      
      if (!data.feeds) {
        throw new Error('No feeds data received');
      }
      
      // Transform API response to match our Feed interface
      const transformedFeeds: Feed[] = data.feeds.map((feed: any) => ({
        id: feed.id,
        name: feed.name,
        url: feed.url,
        site_url: feed.site_url,
        description: feed.description,
        icon_url: feed.icon_url,
        status: feed.status || 'active',
        priority: feed.priority || 'medium',
        last_fetched_at: feed.last_fetched_at,
        article_count: feed.article_count || 0,
        folder_name: feed.folder_name || 'General',
        created_at: feed.created_at,
        updated_at: feed.updated_at
      }));
      
      setFeeds(transformedFeeds);
      
      // Auto-expand folders that have feeds
      const folders = Array.from(new Set(transformedFeeds.map(f => f.folder_name || 'General')));
      setExpandedFolders(folders);
    } catch (error) {
      console.error('Failed to fetch feeds:', error);
      setError(error instanceof Error ? error.message : 'Failed to load feeds');
    } finally {
      setIsLoading(false);
    }
  };

  // Load feeds on component mount
  useEffect(() => {
    fetchFeeds();
    fetchFeedCount();
  }, []);

  // Filter feeds based on search
  const filteredFeeds = feeds.filter(feed => 
    feed.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    feed.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by folder
  const feedsByFolder: Record<string, Feed[]> = {};
  filteredFeeds.forEach(feed => {
    const folder = feed.folder_name || 'General';
    if (!feedsByFolder[folder]) {
      feedsByFolder[folder] = [];
    }
    feedsByFolder[folder].push(feed);
  });

  // Handle feed actions (pause, resume, delete)
  const handleFeedAction = async (feedId: string, action: 'pause' | 'resume' | 'delete' | 'retry') => {
    try {
      switch (action) {
        case 'pause':
          await apiRequest('PUT', `/api/feeds/${feedId}`, { status: 'paused' });
          toast({
            title: "Feed Paused",
            description: "Feed has been paused and will not sync new articles.",
          });
          break;
        case 'resume':
          await apiRequest('PUT', `/api/feeds/${feedId}`, { status: 'active' });
          toast({
            title: "Feed Resumed",
            description: "Feed has been resumed and will sync new articles.",
          });
          break;
        case 'delete':
          await apiRequest('DELETE', `/api/feeds/unsubscribe/${feedId}`);
          // Invalidate the user feeds query to update sidebar immediately
          // Requirements: 5.2 - Remove feed from sidebar without page refresh
          invalidateFeedsQuery();
          toast({
            title: "Feed Removed",
            description: "Feed has been removed from your subscriptions.",
          });
          // Refresh feed count after deletion
          await fetchFeedCount();
          break;
        case 'retry':
          await apiRequest('POST', '/api/feeds/sync', { feedIds: [feedId] });
          toast({
            title: "Sync Started",
            description: "Feed synchronization has been started.",
          });
          break;
      }
      
      // Refresh feeds list
      await fetchFeeds();
    } catch (error) {
      console.error(`Failed to ${action} feed:`, error);
      toast({
        variant: "destructive",
        title: `Failed to ${action} feed`,
        description: error instanceof Error ? error.message : `An error occurred while ${action}ing the feed.`,
        duration: 5000,
      });
    }
  };

  // Handle feed refresh callback from AddFeedModal
  const handleFeedAdded = () => {
    fetchFeeds();
    fetchFeedCount();
    setIsAddModalOpen(false);
  };

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => 
      prev.includes(folder) 
        ? prev.filter(f => f !== folder) 
        : [...prev, folder]
    );
  };

  const getStatusColor = (status: Feed['status']) => {
    switch (status) {
      case 'active': return 'bg-emerald-500';
      case 'paused': return 'bg-zinc-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-zinc-500';
    }
  };

  const getStatusIcon = (status: Feed['status']) => {
    switch (status) {
      case 'active': return null;
      case 'paused': return <Pause className="h-4 w-4 text-zinc-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-display font-bold">Feed Management</h2>
          <p className="text-muted-foreground">Loading your feeds...</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-display font-bold">Feed Management</h2>
          <p className="text-muted-foreground">Failed to load feeds</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchFeeds} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold">Feed Management</h2>
            <p className="text-muted-foreground">Manage your subscriptions and organize feeds</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search feeds..." 
                className="pl-9 bg-muted/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              className="gap-2 bg-primary hover:bg-primary/90" 
              onClick={() => setIsAddModalOpen(true)}
              disabled={feedCount?.remaining === 0}
            >
              <Plus className="h-4 w-4" /> Add Feed
            </Button>
          </div>
        </div>

        {/* Feed Count Display - Requirements: 5.3, 5.4 */}
        {feedCount && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Feed Subscriptions: {feedCount.currentCount} / {feedCount.maxAllowed}
              </span>
              <span className="text-sm text-muted-foreground">
                {feedCount.remaining} remaining
              </span>
            </div>
            <Progress 
              value={(feedCount.currentCount / feedCount.maxAllowed) * 100} 
              className={cn(
                "h-2",
                feedCount.isNearLimit && "bg-amber-100 dark:bg-amber-900/20"
              )}
            />
            {/* Near Limit Warning - Requirements: 5.4 */}
            {feedCount.isNearLimit && (
              <Alert className="mt-3 border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  You're approaching the feed limit ({feedCount.currentCount}/{feedCount.maxAllowed}). 
                  Consider removing unused feeds to make room for new subscriptions.
                </AlertDescription>
              </Alert>
            )}
            {/* At Limit Warning */}
            {feedCount.remaining === 0 && (
              <Alert className="mt-3 border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-700 dark:text-red-300">
                  You've reached the maximum feed limit ({feedCount.maxAllowed} feeds). 
                  Remove existing feeds to add new ones.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="font-medium text-foreground">{feeds.length} feeds total</div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {feeds.filter(f => f.status === 'active').length} active
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            {feeds.filter(f => f.status === 'paused').length} paused
          </div>
          <div className="flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-red-500" />
            {feeds.filter(f => f.status === 'error').length} error
          </div>
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {Object.entries(feedsByFolder).map(([folder, folderFeeds]) => {
          const isExpanded = expandedFolders.includes(folder);
          
          return (
            <div key={folder} className="space-y-2">
              <button 
                onClick={() => toggleFolder(folder)}
                className="flex items-center gap-2 w-full text-left p-2 hover:bg-muted/50 rounded-lg group transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                )}
                <Folder className="h-4 w-4 text-primary fill-primary/10" />
                <span className="font-semibold text-sm">{folder}</span>
                <span className="text-xs text-muted-foreground">({folderFeeds.length} feeds)</span>
              </button>

              {isExpanded && (
                <div className="pl-4 space-y-3">
                  {folderFeeds.map(feed => (
                    <div 
                      key={feed.id} 
                      className="group bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all duration-200 hover:border-primary/20"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <div className={cn("w-2 h-2 rounded-full shrink-0", getStatusColor(feed.status))} />
                            <h3 className="font-bold text-base truncate">{feed.name}</h3>
                            {getStatusIcon(feed.status)}
                            {feed.status === 'error' && (
                              <span className="text-xs text-red-500 font-medium bg-red-500/10 px-2 py-0.5 rounded">
                                Error syncing
                              </span>
                            )}
                            {feed.status === 'paused' && (
                              <span className="text-xs text-zinc-500 font-medium bg-zinc-500/10 px-2 py-0.5 rounded">
                                Paused
                              </span>
                            )}
                          </div>
                          
                          <div className="text-sm text-muted-foreground truncate font-mono mb-2 pl-5">
                            {feed.url}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground pl-5">
                            <div className="flex items-center gap-1.5">
                              <RefreshCw className="h-3 w-3" />
                              Last sync: {feed.last_fetched_at ? formatDistanceToNow(new Date(feed.last_fetched_at), { addSuffix: true }) : 'Never'}
                            </div>
                            <div>{feed.article_count} articles</div>
                            <div className="flex items-center gap-1.5">
                              Priority: 
                              <span className={cn(
                                "font-medium capitalize",
                                feed.priority === 'high' ? "text-primary" : 
                                feed.priority === 'low' ? "text-muted-foreground" : "text-foreground"
                              )}>
                                {feed.priority}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start md:self-center pl-5 md:pl-0">
                           {feed.status === 'error' && (
                             <Button 
                               variant="outline" 
                               size="sm" 
                               className="h-8 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400"
                               onClick={() => handleFeedAction(feed.id, 'retry')}
                             >
                               <RefreshCw className="h-3 w-3" /> Retry Now
                             </Button>
                           )}
                           
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                 <MoreVertical className="h-4 w-4" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
                               <DropdownMenuItem>
                                 <Edit2 className="h-4 w-4 mr-2" /> Edit
                               </DropdownMenuItem>
                               {feed.status === 'paused' ? (
                                 <DropdownMenuItem 
                                   className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50 dark:focus:bg-emerald-900/20"
                                   onClick={() => handleFeedAction(feed.id, 'resume')}
                                 >
                                   <Play className="h-4 w-4 mr-2" /> Resume
                                 </DropdownMenuItem>
                               ) : (
                                 <DropdownMenuItem onClick={() => handleFeedAction(feed.id, 'pause')}>
                                   <Pause className="h-4 w-4 mr-2" /> Pause
                                 </DropdownMenuItem>
                               )}
                               <DropdownMenuSeparator />
                               <DropdownMenuItem 
                                 className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                                 onClick={() => handleFeedAction(feed.id, 'delete')}
                               >
                                 <Trash2 className="h-4 w-4 mr-2" /> Delete
                               </DropdownMenuItem>
                             </DropdownMenuContent>
                           </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredFeeds.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No feeds found matching "{searchQuery}"
          </div>
        )}
      </div>

      <AddFeedModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onFeedAdded={handleFeedAdded}
      />
    </div>
  );
}
