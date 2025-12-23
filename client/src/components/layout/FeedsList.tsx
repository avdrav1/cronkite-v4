import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Folder, Rss, ChevronDown, ChevronRight, Plus, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeedsQuery, useInvalidateFeedsQuery, useFeedCountQuery } from "@/hooks/useFeedsQuery";
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
  const invalidateFeedsQuery = useInvalidateFeedsQuery();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Sync state - Requirements: 1.4, 2.4 (show loading state during sync)
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    syncingFeedId: null,
    isBulkSyncing: false
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
  // Re-parse when location changes to ensure reactivity
  const urlParams = useMemo(() => {
    // Use window.location.search but depend on location from wouter for reactivity
    const searchParams = new URLSearchParams(window.location.search);
    return {
      source: searchParams.get('source'),
      category: searchParams.get('category'),
    };
  }, [location]); // location dependency ensures re-render on navigation

  // Group feeds by category
  const groupedFeeds = useMemo(() => {
    if (!data?.feeds) return {};
    return groupFeedsByCategory(data.feeds);
  }, [data?.feeds]);

  // Single feed sync handler - Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
  const handleSyncFeed = async (feedId: string, feedName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (syncState.isSyncing || syncState.isBulkSyncing) return;
    
    setSyncState({ isSyncing: true, syncingFeedId: feedId, isBulkSyncing: false });
    
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
      setSyncState({ isSyncing: false, syncingFeedId: null, isBulkSyncing: false });
    }
  };

  // Bulk sync handler - Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
  const handleSyncAll = async () => {
    if (syncState.isSyncing || syncState.isBulkSyncing) return;
    
    setSyncState({ isSyncing: false, syncingFeedId: null, isBulkSyncing: true });
    
    try {
      const response = await apiRequest('POST', '/api/feeds/sync-all', { waitForResults: true });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "All Feeds Synced",
          description: `${result.successfulSyncs}/${result.totalFeeds} feeds synced, ${result.newArticles} new articles`,
        });
        // Refresh feeds data
        invalidateFeedsQuery();
      } else {
        toast({
          variant: "destructive",
          title: "Bulk Sync Failed",
          description: result.message || "Failed to sync feeds",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sync Error",
        description: error instanceof Error ? error.message : "An error occurred during bulk sync",
      });
    } finally {
      setSyncState({ isSyncing: false, syncingFeedId: null, isBulkSyncing: false });
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
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          <span className="ml-1">Sync All</span>
        </Button>
      </div>
      <div className="space-y-1">
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
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
          onClick={handleCategoryClick}
        >
          <Folder className="h-4 w-4 text-muted-foreground/70" />
          <span className="flex-1 text-left">{label}</span>
          <span className="text-xs text-muted-foreground/50">{feeds.length}</span>
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
}

function FeedItem({ feed, isActive, onClick, onSync, isSyncing, isDisabled }: FeedItemProps) {
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
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
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
