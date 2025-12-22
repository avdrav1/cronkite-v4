import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Folder, Rss, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeedsQuery } from "@/hooks/useFeedsQuery";
import type { Feed } from "@shared/schema";

const EXPANDED_CATEGORIES_KEY = 'cronkite-expanded-categories';

interface FeedsListProps {
  onFeedSelect?: (feedId: string, feedName: string) => void;
  onCategorySelect?: (category: string) => void;
}

interface GroupedFeeds {
  [category: string]: Feed[];
}

/**
 * Infers a category from feed URL or name when folder is not set
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
 * Groups feeds by category (inferred from URL/name patterns)
 * Property 1: Feed Grouping Preserves All Feeds
 * Validates: Requirements 3.2
 */
export function groupFeedsByCategory(feeds: Feed[]): GroupedFeeds {
  return feeds.reduce((acc, feed) => {
    // Infer category from feed URL/name patterns
    const category = inferCategoryFromFeed(feed);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(feed);
    return acc;
  }, {} as GroupedFeeds);
}

export function FeedsList({ onFeedSelect, onCategorySelect }: FeedsListProps) {
  const { data, isLoading, error } = useFeedsQuery();
  const [location, setLocation] = useLocation();
  
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
    setLocation(`/?source=${encodeURIComponent(feedName)}`);
    onFeedSelect?.(feed.id, feedName);
  };

  const handleCategoryClick = (category: string) => {
    setLocation(`/?category=${encodeURIComponent(category)}`);
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
      <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Feeds
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
}: CategoryFolderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 p-0"
          onClick={onToggle}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "flex-1 justify-start gap-2 px-2 h-9 text-sm font-medium",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={onCategoryClick}
        >
          <Folder className="h-4 w-4 text-muted-foreground/70" />
          <span className="flex-1 text-left">{label}</span>
          <span className="text-xs text-muted-foreground/50">{feeds.length}</span>
        </Button>
      </div>
      {isExpanded && (
        <div className="pl-4 space-y-1 border-l border-border/50 ml-5">
          {feeds.map(feed => (
            <FeedItem
              key={feed.id}
              feed={feed}
              isActive={activeFeedName === feed.name}
              onClick={() => onFeedClick(feed)}
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
}

function FeedItem({ feed, isActive, onClick }: FeedItemProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "w-full justify-start gap-2 px-3 h-8 text-sm transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:text-primary"
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
      {feed.article_count > 0 && (
        <span className="text-xs text-muted-foreground/50">{feed.article_count}</span>
      )}
    </Button>
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
