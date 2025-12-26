import React, { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import { Rss, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeedsQuery, useFeedCountQuery, useArticleCountsQuery } from "@/hooks/useFeedsQuery";
import type { Feed } from "@shared/schema";

const EXPANDED_CATEGORIES_KEY = 'cronkite-expanded-categories';

interface FeedsListProps {
  onFeedSelect?: (feedId: string, feedName: string) => void;
  onCategorySelect?: (category: string) => void;
}

interface GroupedFeeds {
  [category: string]: Feed[];
}

function getFeedCategory(feed: Feed): string {
  if (feed.folder_name) return feed.folder_name;
  return inferCategoryFromFeed(feed);
}

function inferCategoryFromFeed(feed: Feed): string {
  const url = feed.url?.toLowerCase() || '';
  const name = feed.name?.toLowerCase() || '';
  
  if (url.includes('techcrunch') || url.includes('wired') || url.includes('arstechnica') || 
      url.includes('theverge') || url.includes('engadget') || url.includes('zdnet') ||
      name.includes('tech') || name.includes('gadget') || name.includes('software')) return 'Technology';
  if (url.includes('bloomberg') || url.includes('wsj') || url.includes('forbes') || 
      url.includes('reuters') || url.includes('cnbc') || url.includes('economist') ||
      name.includes('business') || name.includes('finance') || name.includes('market')) return 'Business';
  if (url.includes('nature') || url.includes('science') || url.includes('newscientist') ||
      url.includes('phys.org') || url.includes('sciencedaily') ||
      name.includes('science') || name.includes('research')) return 'Science';
  if (url.includes('bbc') || url.includes('cnn') || url.includes('nytimes') || 
      url.includes('guardian') || url.includes('washingtonpost') || url.includes('apnews') ||
      name.includes('news') || name.includes('world') || name.includes('global')) return 'World News';
  if (url.includes('espn') || url.includes('sports') || url.includes('athletic') ||
      name.includes('sport') || name.includes('football') || name.includes('basketball')) return 'Sports';
  if (url.includes('variety') || url.includes('hollywood') || url.includes('entertainment') ||
      name.includes('movie') || name.includes('entertainment') || name.includes('celebrity')) return 'Entertainment';
  if (url.includes('health') || url.includes('medical') || url.includes('webmd') ||
      name.includes('health') || name.includes('medical') || name.includes('wellness')) return 'Health';
  return 'General';
}

export function groupFeedsByCategory(feeds: Feed[]): GroupedFeeds {
  return feeds.reduce((acc, feed) => {
    const category = getFeedCategory(feed);
    if (!acc[category]) acc[category] = [];
    acc[category].push(feed);
    return acc;
  }, {} as GroupedFeeds);
}

export function FeedsList({ onFeedSelect, onCategorySelect }: FeedsListProps) {
  const { data, isLoading, error } = useFeedsQuery();
  const { data: feedCountData } = useFeedCountQuery();
  const { data: articleCountsData } = useArticleCountsQuery();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem(EXPANDED_CATEGORIES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(Array.isArray(parsed) ? parsed : ['General']);
      }
    } catch { /* ignore */ }
    return new Set(['General']);
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(EXPANDED_CATEGORIES_KEY, JSON.stringify(Array.from(expandedCategories)));
    } catch { /* ignore */ }
  }, [expandedCategories]);

  const urlParams = useMemo(() => {
    const searchParams = new URLSearchParams(searchString);
    return { source: searchParams.get('source'), category: searchParams.get('category') };
  }, [searchString]);

  const groupedFeeds = useMemo(() => {
    if (!data?.feeds) return {};
    return groupFeedsByCategory(data.feeds);
  }, [data?.feeds]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  const handleFeedClick = (feed: Feed) => {
    setLocation(`/?source=${encodeURIComponent(feed.name)}`);
    window.dispatchEvent(new CustomEvent('feedFilterChange', { detail: { source: feed.name } }));
    onFeedSelect?.(feed.id, feed.name);
  };

  const handleCategoryClick = (category: string) => {
    setLocation(`/?category=${encodeURIComponent(category)}`);
    window.dispatchEvent(new CustomEvent('feedFilterChange', { detail: { category } }));
    onCategorySelect?.(category);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feeds</div>
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feeds</div>
        <div className="px-3 py-2 text-sm text-destructive">Failed to load feeds.</div>
      </div>
    );
  }

  if (!data?.feeds || data.feeds.length === 0) return <EmptyFeedsState />;

  const categories = Object.keys(groupedFeeds).sort();
  const getCategoryArticleCount = (category: string): number => {
    if (!articleCountsData?.counts) return 0;
    return (groupedFeeds[category] || []).reduce((sum, feed) => sum + (articleCountsData.counts[feed.id] || 0), 0);
  };
  const isAllArticlesActive = !urlParams.source && !urlParams.category;

  return (
    <div className="space-y-4">
      <div className="px-3 flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feeds</span>
        {feedCountData && (
          <span className={cn(
            "text-xs font-medium px-1.5 py-0.5 rounded",
            feedCountData.isNearLimit ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted text-muted-foreground"
          )}>
            {feedCountData.currentCount}/{feedCountData.maxAllowed}
          </span>
        )}
      </div>
      
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => { setLocation('/'); window.dispatchEvent(new CustomEvent('feedFilterChange', { detail: {} })); }}
          className={cn(
            "w-full flex items-center h-9 text-sm font-medium rounded-md transition-colors",
            isAllArticlesActive ? "bg-primary/15 text-primary border-l-2 border-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <span className="w-9 shrink-0" />
          <span className="flex-1 text-left">All Articles</span>
          {articleCountsData && (
            <span className={cn("text-xs tabular-nums min-w-[3rem] text-right shrink-0 pr-3", isAllArticlesActive ? "text-primary/70" : "text-muted-foreground/70")}>
              {articleCountsData.totalArticles.toLocaleString()}
            </span>
          )}
        </button>

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
  categoryArticleCount: number;
  articleCounts?: Record<string, number>;
}

function CategoryFolder({ label, feeds, isExpanded, isActive, activeFeedName, onToggle, onCategoryClick, onFeedClick, categoryArticleCount, articleCounts }: CategoryFolderProps) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        className={cn(
          "w-full flex items-center h-9 text-sm font-medium rounded-md transition-colors",
          isActive ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        onClick={onCategoryClick}
      >
        <span className="h-9 w-9 p-0 flex items-center justify-center shrink-0" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span className="flex-1 text-left">{label}</span>
        <span className={cn("text-xs tabular-nums w-12 text-right shrink-0 pr-3", isActive ? "text-primary/70" : "text-muted-foreground/50")}>
          {categoryArticleCount > 0 ? categoryArticleCount.toLocaleString() : feeds.length}
        </span>
      </button>
      {isExpanded && (
        <div className="space-y-1">
          {feeds.map(feed => (
            <FeedItem key={feed.id} feed={feed} isActive={activeFeedName === feed.name} onClick={() => onFeedClick(feed)} articleCount={articleCounts?.[feed.id]} />
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
  articleCount?: number;
}

function FeedItem({ feed, isActive, onClick, articleCount }: FeedItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 h-8 text-sm transition-colors rounded-md",
        isActive ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-primary hover:bg-muted/50"
      )}
    >
      <span className="w-3 shrink-0" />
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 shrink-0" />
      <span className="flex-1 text-left truncate">{feed.name}</span>
      {articleCount !== undefined && articleCount > 0 && (
        <span className={cn("text-xs tabular-nums min-w-[3rem] text-right shrink-0 pr-3", isActive ? "text-primary/70" : "text-muted-foreground/50")}>
          {articleCount.toLocaleString()}
        </span>
      )}
    </button>
  );
}

function EmptyFeedsState() {
  const [, setLocation] = useLocation();
  return (
    <div className="space-y-4">
      <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feeds</div>
      <div className="px-3 py-4 text-center space-y-3">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Rss className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No feeds yet</p>
          <p className="text-xs text-muted-foreground">Subscribe to feeds to see them here</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setLocation('/onboarding')}>
          <Plus className="h-4 w-4" />
          Add Feeds
        </Button>
      </div>
    </div>
  );
}

export default FeedsList;
