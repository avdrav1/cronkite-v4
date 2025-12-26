import React, { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import { Folder, Rss, ChevronDown, ChevronRight, Plus, RefreshCw, Loader2, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeedsQuery, useInvalidateFeedsQuery, useFeedCountQuery, useArticleCountsQuery } from "@/hooks/useFeedsQuery";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Feed } from "@shared/schema";

const EXPANDED_CATEGORIES_KEY = 'cronkite-expanded-categories';

interface FeedsListProps {
  onFeedSelect?: (feedId: string, feedName: string) => void;
  onCategorySelect?: (category: string) => void;
}

interface GroupedFeeds {
  [category: string]: Feed[];
}

// Sync state tracking
interface SyncState {
  isSyncing: boolean;
  syncingFeedId: string | null;
  isBulkSyncing: boolean;
  bulkSyncProgress: {
    total: number;
    completed: number;
    failed: number;
    currentFeed?: string;
  } | null;
}

/**
 * Gets the category for a feed, using folder_name if available, otherwise inferring from URL/name
 */
function getFeedCategory(feed: Feed): string {
  // Use folder_name if it's set (copied from recommended_feeds during subscription)
  if (feed.folder_name) {
    return feed.folder_name;
  }
  
  // Fallback to inference for feeds without folder_name (legacy feeds)
  return inferCategoryFromFeed(feed);
}

/**
 * Infers a category from feed URL or name when folder_name is not set
 */
function inferCategoryFromFeed(feed: Feed): string {
  const url = feed.url?.toLowerCase() || '';
  const name = feed.name?.toLowerCase() || '';
  
  // Technology
  if (url.includes('techcrunch') || url.includes('wired') || url.includes('arstechnica') || 
      url.includes('theverge') || url.includes('engadget') || url.includes('zdnet') ||
      name.includes('tech') || name.includes('gadget') || name.includes('software')) {
    return 'Technology';
  }
  
  // Business & Finance
  if (url.includes('bloomberg') || url.includes('wsj') || url.includes('forbes') || 
      url.includes('reuters') || url.includes('cnbc') || url.includes('economist') ||
      name.includes('business') || name.includes('finance') || name.includes('market')) {
    return 'Business';
  }
  
  // Science
  if (url.includes('nature') || url.includes('science') || url.includes('newscientist') ||
      url.includes('phys.org') || url.includes('sciencedaily') ||
      name.includes('science') || name.includes('research')) {
    return 'Science';
  }
  
  // World News
  if (url.includes('bbc') || url.includes('cnn') || url.includes('nytimes') || 
      url.includes('guardian') || url.includes('washingtonpost') || url.includes('apnews') ||
      name.includes('news') || name.includes('world') || name.includes('global')) {
    return 'World News';
  }
  
  // Sports
  if (url.includes('espn') || url.includes('sports') || url.includes('athletic') ||
      name.includes('sport') || name.includes('football') || name.includes('basketball')) {
    return 'Sports';
  }
  
  // Entertainment
  if (url.includes('variety') || url.includes('hollywood') || url.includes('entertainment') ||
      name.includes('movie') || name.includes('entertainment') || name.includes('celebrity')) {
    return 'Entertainment';
  }
  
  // Health
  if (url.includes('health') || url.includes('medical') || url.includes('webmd') ||
      name.includes('health') || name.includes('medical') || name.includes('wellness')) {
    return 'Health';
  }
  
  // Default to "General" instead of "Uncategorized"
  return 'General';
}

/**
 * Groups feeds by category (using folder_name if available, otherwise inferred from URL/name patterns)
 * Property 1: Feed Grouping Preserves All Feeds
 * Validates: Requirements 3.2
 */
export function groupFeedsByCategory(feeds: Feed[]): GroupedFeeds {
  return feeds.reduce((acc, feed) => {
    // Use folder_name if available, otherwise infer category
    const category = getFeedCategory(feed);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(feed);
    return acc;
  }, {} as GroupedFeeds);
}

export function FeedsList({ onFeedSelect, onCategorySelect }: FeedsListProps) {
  const { data, isLoading, error } = useFeedsQuery();
  const { data: feedCountData } = useFeedCountQuery();
  const { data: articleCountsData } = useArticleCountsQuery();
  const invalidateFeedsQuery = useInvalidateFeedsQuery();
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  
  // Sync state - Requirements: 1.4, 2.4 (show loading state during sync)
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    syncingFeedId: null,
    isBulkSyncing: false,
    bulkSyncProgress: null
  });
  
  // Initialize expanded categories from sessionStorage for session persistence
  // Requirements: 4.4 - Remember expanded/collapsed state during the session
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem(EXPANDED_CATEGORIES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(Array.isArray(parsed) ? parsed : ['General']);
      }
    } catch {
      // Ignore parsing errors, use default
    }
    return new Set(['General']);
  });

  // Persist expanded categories to sessionStorage when they change
  useEffect(() => {
    try {
      sessionStorage.setItem(
        EXPANDED_CATEGORIES_KEY,
        JSON.stringify(Array.from(expandedCategories))
      );
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }, [expandedCategories]);

  // Parse URL to determine active feed/category
  // Use wouter's useSearch for proper reactivity when URL changes
  const urlParams = useMemo(() => {
    const searchParams = new URLSearchParams(searchString);
    return {
      source: searchParams.get('source'),
      category: searchParams.get('category'),
    };
  }, [searchString]); // searchString from useSearch ensures reactivity

  // Group feeds by category
  const groupedFeeds = useMemo(() => {
    if (!data?.feeds) return {};
    return groupFeedsByCategory(data.feeds);
  }, [data?.feeds]);

  // Single feed sync handler - Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
  const handleSyncFeed = async (feedId: string, feedName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (syncState.isSyncing || syncState.isBulkSyncing) return;
    
    setSyncState({ isSyncing: true, syncingFeedId: feedId, isBulkSyncing: false, bulkSyncProgress: null });
    
    try {
      const response = await apiRequest('POST', `/api/feeds/${feedId}/sync`);
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Feed Synced",
          description: `${feedName}: ${result.articlesNew} new, ${result.articlesUpdated} updated articles`,
        });
        // Refresh feeds data
        invalidateFeedsQuery();
      } else {
        toast({
          variant: "destructive",
          title: "Sync Failed",
          description: result.error || "Failed to sync feed",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sync Error",
        description: error instanceof Error ? error.message : "An error occurred during sync",
      });
    } finally {
      setSyncState({ isSyncing: false, syncingFeedId: null, isBulkSyncing: false, bulkSyncProgress: null });
    }
  };

  // Bulk sync handler - Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
  // Uses async sync with polling for progress to avoid 504 timeouts
  const handleSyncAll = async () => {
    if (syncState.isSyncing || syncState.isBulkSyncing) return;
    
    const totalFeeds = data?.feeds?.length || 0;
    setSyncState({ 
      isSyncing: false, 
      syncingFeedId: null, 
      isBulkSyncing: true,
      bulkSyncProgress: { total: totalFeeds, completed: 0, failed: 0 }
    });
    
    try {
      // Start sync without waiting (fire-and-forget)
      await apiRequest('POST', '/api/feeds/sync-all', { waitForResults: false });
      
      // Poll for sync status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await apiRequest('GET', '/api/feeds/sync/status');
          const status = await statusResponse.json();
          
          setSyncState(prev => ({
            ...prev,
            bulkSyncProgress: {
              total: status.totalFeeds || totalFeeds,
              completed: status.completedFeeds || 0,
              failed: status.failedFeeds || 0,
              currentFeed: status.currentFeed
            }
          }));
          
          // Check if sync is complete
          if (!status.isActive) {
            clearInterval(pollInterval);
            
            toast({
              title: "Sync Complete",
              description: `${status.completedFeeds} feeds synced${status.failedFeeds > 0 ? `, ${status.failedFeeds} failed` : ''}`,
            });
            
            // Refresh feeds data
            invalidateFeedsQuery();
            
            setSyncState({ 
              isSyncing: false, 
              syncingFeedId: null, 
              isBulkSyncing: false,
              bulkSyncProgress: null
            });
          }
        } catch (pollError) {
          console.error('Sync status poll error:', pollError);
        }
      }, 1500);
      
      // Safety timeout - stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setSyncState(prev => {
          if (prev.isBulkSyncing) {
            toast({
              title: "Sync Timeout",
              description: "Sync is taking longer than expected. Check back later.",
            });
            return { isSyncing: false, syncingFeedId: null, isBulkSyncing: false, bulkSyncProgress: null };
          }
          return prev;
        });
      }, 5 * 60 * 1000);
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sync Error",
        description: error instanceof Error ? error.message : "An error occurred during bulk sync",
      });
      setSyncState({ isSyncing: false, syncingFeedId: null, isBulkSyncing: false, bulkSyncProgress: null });
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleFeedClick = (feed: Feed) => {
    const feedName = feed.name;
    const newUrl = `/?source=${encodeURIComponent(feedName)}`;
    console.log('FeedsList: Navigating to', newUrl);
    // Use wouter's setLocation which properly updates the router state
    setLocation(newUrl);
    // Also dispatch a custom event for components that need it
    window.dispatchEvent(new CustomEvent('feedFilterChange', { detail: { source: feedName } }));
    onFeedSelect?.(feed.id, feedName);
  };

  const handleCategoryClick = (category: string) => {
    const newUrl = `/?category=${encodeURIComponent(category)}`;
    console.log('FeedsList: Navigating to category', newUrl);
    // Use wouter's setLocation which properly updates the router state
    setLocation(newUrl);
    // Also dispatch a custom event for components that need it
    window.dispatchEvent(new CustomEvent('feedFilterChange', { detail: { category } }));
    onCategorySelect?.(category);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Feeds
        </div>
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Feeds
        </div>
        <div className="px-3 py-2 text-sm text-destructive">
          Failed to load feeds. Please try again.
        </div>
      </div>
    );
  }

  // Empty state - no subscriptions
  // Requirements: 3.5
  if (!data?.feeds || data.feeds.length === 0) {
    return <EmptyFeedsState />;
  }

  const categories = Object.keys(groupedFeeds).sort();

  // Calculate category article counts
  const getCategoryArticleCount = (category: string): number => {
    if (!articleCountsData?.counts) return 0;
    const feedsInCategory = groupedFeeds[category] || [];
    return feedsInCategory.reduce((sum, feed) => {
      return sum + (articleCountsData.counts[feed.id] || 0);
    }, 0);
  };

  // Check if "All Articles" is active (no source or category filter)
  const isAllArticlesActive = !urlParams.source && !urlParams.category;

  const handleAllArticlesClick = () => {
    setLocation('/');
    window.dispatchEvent(new CustomEvent('feedFilterChange', { detail: {} }));
  };

  return (
    <div className="space-y-4">
      <div className="px-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Feeds
          </span>
          {feedCountData && (
            <span className={cn(
              "text-xs font-medium px-1.5 py-0.5 rounded",
              feedCountData.isNearLimit 
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
                : "bg-muted text-muted-foreground"
            )}>
              {feedCountData.currentCount}/{feedCountData.maxAllowed}
            </span>
          )}
        </div>
        {/* Sync All Button - Requirements: 2.1, 2.4 */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleSyncAll}
          disabled={syncState.isBulkSyncing || syncState.isSyncing}
          title="Sync all feeds"
        >
          {syncState.isBulkSyncing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="ml-1">
                {syncState.bulkSyncProgress 
                  ? `${syncState.bulkSyncProgress.completed}/${syncState.bulkSyncProgress.total}`
                  : 'Syncing...'
                }
              </span>
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3" />
              <span className="ml-1">Sync All</span>
            </>
          )}
        </Button>
      </div>
      
      {/* Sync Progress Bar */}
      {syncState.isBulkSyncing && syncState.bulkSyncProgress && (
        <div className="px-3 space-y-1">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ 
                width: `${syncState.bulkSyncProgress.total > 0 
                  ? (syncState.bulkSyncProgress.completed / syncState.bulkSyncProgress.total) * 100 
                  : 0}%` 
              }}
            />
          </div>
          {syncState.bulkSyncProgress.currentFeed && (
            <p className="text-[10px] text-muted-foreground truncate">
              {syncState.bulkSyncProgress.currentFeed}
            </p>
          )}
        </div>
      )}
      
      <div className="space-y-1">
        {/* All Articles option */}
        <button
          type="button"
          onClick={handleAllArticlesClick}
          className={cn(
            "w-full flex items-center justify-start gap-2 px-3 h-9 text-sm font-medium rounded-md transition-colors relative",
            isAllArticlesActive
              ? "bg-primary/15 text-primary border-l-2 border-primary font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Newspaper className={cn("h-4 w-4", isAllArticlesActive && "text-primary")} />
          <span className="flex-1 text-left">All Articles</span>
          {articleCountsData && (
            <span className={cn(
              "text-xs tabular-nums text-right min-w-[3ch]",
              isAllArticlesActive ? "text-primary/70" : "text-muted-foreground/70"
            )}>
              {articleCountsData.totalArticles.toLocaleString()}
            </span>
          )}
        </button>

        {/* Category folders */}
        {categories.map(category => (
          <CategoryFolder
            key={category}
            label={category}
            feeds={groupedFeeds[category]}
            isExpanded={expandedCategories.has(category)}
            isActive={urlParams.category === category}
            activeFeedName={urlParams.source}
            onToggle={() => toggleCategory(category)}
            onCategoryClick={() => handleCategoryClick(category)}
            onFeedClick={handleFeedClick}
            onSyncFeed={handleSyncFeed}
            syncingFeedId={syncState.syncingFeedId}
            isSyncing={syncState.isSyncing || syncState.isBulkSyncing}
            categoryArticleCount={getCategoryArticleCount(category)}
            articleCounts={articleCountsData?.counts}
          />
        ))}
      </div>
    </div>
  );
}

interface CategoryFolderProps {
  label: string;
  feeds: Feed[];
  isExpanded: boolean;
  isActive: boolean;
  activeFeedName: string | null;
  onToggle: () => void;
  onCategoryClick: () => void;
  onFeedClick: (feed: Feed) => void;
  onSyncFeed: (feedId: string, feedName: string, e: React.MouseEvent) => void;
  syncingFeedId: string | null;
  isSyncing: boolean;
  categoryArticleCount: number;
  articleCounts?: Record<string, number>;
}

function CategoryFolder({
  label,
  feeds,
  isExpanded,
  isActive,
  activeFeedName,
  onToggle,
  onCategoryClick,
  onFeedClick,
  onSyncFeed,
  syncingFeedId,
  isSyncing,
  categoryArticleCount,
  articleCounts,
}: CategoryFolderProps) {
  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Toggle category:', label);
    onToggle();
  };

  const handleCategoryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Category clicked:', label);
    onCategoryClick();
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center">
        <button
          type="button"
          className="h-9 w-9 p-0 flex items-center justify-center hover:bg-muted/50 rounded-md"
          onClick={handleToggle}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 flex items-center justify-start gap-2 px-2 h-9 text-sm font-medium rounded-md",
            isActive
              ? "bg-primary/15 text-primary border-l-2 border-primary font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
          onClick={handleCategoryClick}
        >
          <Folder className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground/70")} />
          <span className="flex-1 text-left">{label}</span>
          <span className={cn(
            "text-xs tabular-nums text-right min-w-[3ch]",
            isActive ? "text-primary/70" : "text-muted-foreground/50"
          )}>
            {categoryArticleCount > 0 ? categoryArticleCount.toLocaleString() : feeds.length}
          </span>
        </button>
      </div>
      {isExpanded && (
        <div className="pl-4 space-y-1 border-l border-border/50 ml-5">
          {feeds.map(feed => (
            <FeedItem
              key={feed.id}
              feed={feed}
              isActive={activeFeedName === feed.name}
              onClick={() => onFeedClick(feed)}
              onSync={(e) => onSyncFeed(feed.id, feed.name, e)}
              isSyncing={syncingFeedId === feed.id}
              isDisabled={isSyncing}
              articleCount={articleCounts?.[feed.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FeedItemProps {
  feed: Feed;
  isActive: boolean;
  onClick: () => void;
  onSync: (e: React.MouseEvent) => void;
  isSyncing: boolean;
  isDisabled: boolean;
  articleCount?: number;
}

function FeedItem({ feed, isActive, onClick, onSync, isSyncing, isDisabled, articleCount }: FeedItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('FeedItem clicked:', feed.name);
    onClick();
  };

  return (
    <div className="group flex items-center">
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex-1 flex items-center justify-start gap-2 px-3 h-8 text-sm transition-colors rounded-md",
          isActive
            ? "bg-primary/15 text-primary border-l-2 border-primary font-medium"
            : "text-muted-foreground hover:text-primary hover:bg-muted/50"
        )}
      >
        {feed.icon_url ? (
          <img
            src={feed.icon_url}
            alt=""
            className="h-4 w-4 rounded-sm object-cover"
            onError={(e) => {
              // Fallback to dot indicator if icon fails to load
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={cn(
          "h-1.5 w-1.5 rounded-full bg-primary/40",
          feed.icon_url && "hidden"
        )} />
        <span className="flex-1 text-left truncate">{feed.name}</span>
        {articleCount !== undefined && articleCount > 0 && (
          <span className={cn(
            "text-xs tabular-nums text-right min-w-[3ch]",
            isActive ? "text-primary/70" : "text-muted-foreground/50"
          )}>
            {articleCount.toLocaleString()}
          </span>
        )}
      </button>
      {/* Sync button - Requirements: 1.4 (show loading state during sync) */}
      <button
        type="button"
        onClick={onSync}
        disabled={isDisabled}
        className={cn(
          "h-6 w-6 flex items-center justify-center rounded-md transition-opacity",
          "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          "opacity-0 group-hover:opacity-100",
          isSyncing && "opacity-100",
          isDisabled && !isSyncing && "cursor-not-allowed"
        )}
        title="Sync this feed"
      >
        {isSyncing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}

/**
 * Empty state component shown when user has no subscribed feeds
 * Requirements: 3.5
 */
function EmptyFeedsState() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-4">
      <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Feeds
      </div>
      <div className="px-3 py-4 text-center space-y-3">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Rss className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No feeds yet</p>
          <p className="text-xs text-muted-foreground">
            Subscribe to feeds to see them here
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setLocation('/onboarding')}
        >
          <Plus className="h-4 w-4" />
          Add Feeds
        </Button>
      </div>
    </div>
  );
}

export default FeedsList;
