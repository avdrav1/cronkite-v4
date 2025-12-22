import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { MasonryGrid } from "@/components/feed/MasonryGrid";
import { ArticleCard } from "@/components/feed/ArticleCard";
import { ArticleSheet } from "@/components/article/ArticleSheet";
import { motion } from "framer-motion";
import { SlidersHorizontal, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { type Article } from "@shared/schema";

// Extended article type with feed information and UI state
interface ArticleWithFeed extends Article {
  // UI state fields
  isRead?: boolean;
  isStarred?: boolean;
  relevancyScore?: number;
  
  // Computed/display fields
  source?: string; // Feed name for display
  date?: string; // Formatted date for display
  readTime?: string; // Estimated read time
  imageUrl?: string; // Alias for image_url for compatibility
  
  // Feed information
  feed_name?: string;
  feed_url?: string;
  feed_icon?: string;
}

// Mixed feed item type (just articles for now)
interface FeedItem {
  type: 'article';
  data: ArticleWithFeed;
  id: string;
}

import { subDays, isAfter, isBefore, parseISO, formatDistanceToNow, differenceInDays } from "date-fns";
import { ArrowDown } from "lucide-react";

const CURRENT_DATE = new Date();
const CHUNK_SIZE_DAYS = 7;

export default function Home() {
  const [selectedArticle, setSelectedArticle] = useState<ArticleWithFeed | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [historyDepth, setHistoryDepth] = useState(CHUNK_SIZE_DAYS);
  
  // Real data state
  const [articles, setArticles] = useState<ArticleWithFeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedsCount, setFeedsCount] = useState(0);
  
  // Track URL search params for filtering
  const [searchParams, setSearchParams] = useState(() => new URLSearchParams(window.location.search));
  
  // Use wouter's useLocation for reactivity when URL changes
  const [location] = useLocation();
  
  // Update search params when location changes
  useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search));
  }, [location]);
  
  // Also listen for popstate events (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setSearchParams(new URLSearchParams(window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  // Get source and category filters from URL params
  const sourceFilter = searchParams.get("source");
  const categoryFilter = searchParams.get("category");

  // Fetch articles from API
  const fetchArticles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiRequest('GET', '/api/articles?limit=100');
      const data = await response.json();
      
      if (!data.articles) {
        throw new Error('No articles data received');
      }
      
      // Convert API articles to our format with UI state
      const articlesWithState: ArticleWithFeed[] = data.articles.map((article: any) => ({
        ...article,
        // Map API fields to expected UI fields
        id: article.id,
        title: article.title,
        url: article.url,
        excerpt: article.excerpt || article.content?.substring(0, 200) + '...',
        content: article.content,
        author: article.author,
        date: article.published_at || article.created_at,
        published_at: article.published_at,
        source: article.feed_name || 'Unknown Source',
        image: article.image_url,
        imageUrl: article.image_url, // For compatibility with ArticleCard
        readTime: Math.max(1, Math.floor((article.content?.length || 0) / 200)) + ' min read',
        relevancyScore: 75, // Default relevancy score for now
        tags: [], // Default empty tags
        // UI state
        isRead: article.is_read || false,
        isStarred: article.is_starred || false,
        // Feed information
        feed_name: article.feed_name,
        feed_url: article.feed_url,
        feed_icon: article.feed_icon
      }));
      
      setArticles(articlesWithState);
      setFeedsCount(data.feeds_count || 0);
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      setError(error instanceof Error ? error.message : 'Failed to load articles');
    } finally {
      setIsLoading(false);
    }
  };

  // Load articles on component mount
  useEffect(() => {
    fetchArticles();
  }, []);

  // Create feed with just articles
  const createMixedFeed = (articles: ArticleWithFeed[]): FeedItem[] => {
    return articles.map(article => ({
      type: 'article',
      data: article,
      id: article.id
    }));
  };

  // Actions
  const handleRemoveArticle = (id: string) => {
    setArticles(prev => prev.filter(article => article.id !== id));
  };

  const handleToggleStar = (id: string) => {
    setArticles(prev => prev.map(article => {
      if (article.id === id) {
        return { ...article, isStarred: !article.isStarred };
      }
      return article;
    }));
  };

  const handleArticleClick = (article: ArticleWithFeed) => {
    setSelectedArticle(article);
    // Mark as read
    setArticles(prev => prev.map(item => {
      if (item.id === article.id) {
        return { ...item, isRead: true };
      }
      return item;
    }));
  };

  // Create feed
  const mixedFeed = createMixedFeed(articles);

  // Base filtering (Source + Category + Status)
  const baseFilteredFeed = mixedFeed.filter((item) => {
    const article = item.data as ArticleWithFeed;
    
    // 1. Source Filter (specific feed name) - EXACT match
    if (sourceFilter) {
      // Match against the article's source (feed name)
      const articleSource = article.source || article.feed_name || '';
      const matchesSource = articleSource.toLowerCase() === sourceFilter.toLowerCase();
      if (!matchesSource) return false;
    }

    // 2. Category Filter (filter by feed category)
    if (categoryFilter) {
      // Articles don't have category directly, but we can match against feed_name patterns
      // For now, we'll need to check if the article's feed belongs to the category
      // This would require the API to return category info with articles
      // For now, we'll skip category filtering at the article level
      // TODO: Implement proper category filtering when API returns category info
    }

    // 3. Status Filter
    if (activeFilter === "unread" && article.isRead) return false;
    if (activeFilter === "saved" && !article.isStarred) return false;
    
    return true;
  });

  // Calculate visible feed based on history depth
  const visibleFeed = baseFilteredFeed.filter((item) => {
    const article = item.data as ArticleWithFeed;
    if (!article.date) return true; // Show articles without dates
    
    const articleDate = parseISO(article.date);
    const cutoffDate = subDays(CURRENT_DATE, historyDepth);
    return isAfter(articleDate, cutoffDate);
  });

  // Calculate next chunk stats
  const nextChunkStartDate = subDays(CURRENT_DATE, historyDepth + CHUNK_SIZE_DAYS);
  const nextChunkEndDate = subDays(CURRENT_DATE, historyDepth);
  
  const nextChunkCount = baseFilteredFeed.filter((item) => {
    const article = item.data as ArticleWithFeed;
    if (!article.date) return false;
    const articleDate = parseISO(article.date);
    return isAfter(articleDate, nextChunkStartDate) && isBefore(articleDate, nextChunkEndDate);
  }).length;

  const handleLoadMore = () => {
    setHistoryDepth(prev => prev + CHUNK_SIZE_DAYS);
  };

  // Loading state - Requirement 2.6
  if (isLoading) {
    return (
      <AppShell>
        <div className="flex flex-col gap-8 mb-20">
          {/* Page Header */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-display font-bold tracking-tight mb-2">For You</h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Spinner className="h-4 w-4" />
                  <span>Fetching your articles...</span>
                </div>
              </div>
            </div>
          </div>

          {/* Skeleton Cards */}
          <MasonryGrid isLoading={true} skeletonCount={8} />
        </div>
      </AppShell>
    );
  }

  // Error state - Requirement 2.9
  if (error) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 max-w-md mx-auto text-center">
          <div className="text-6xl mb-6">😕</div>
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <Alert variant="destructive" className="mb-6 text-left">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <p className="text-muted-foreground mb-6">
            We couldn't load your articles. This might be a temporary issue with our servers or your connection.
          </p>
          <Button onClick={fetchArticles} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <p className="text-xs text-muted-foreground mt-6">
            If the problem persists, try refreshing the page or check your internet connection.
          </p>
        </div>
      </AppShell>
    );
  }

  // Empty state - Requirement 2.8
  if (articles.length === 0) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 max-w-md mx-auto text-center">
          <div className="text-6xl mb-6">📰</div>
          <h2 className="text-2xl font-bold mb-4">No articles yet</h2>
          <p className="text-muted-foreground mb-6">
            {feedsCount === 0 
              ? "You haven't subscribed to any feeds yet. Complete your onboarding to get started with personalized news!"
              : `Your ${feedsCount} subscribed feed${feedsCount > 1 ? 's are' : ' is'} being synchronized. Articles will appear here as they're fetched from your sources.`
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={fetchArticles} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {feedsCount === 0 && (
              <Button asChild>
                <a href="/onboarding">Complete Setup</a>
              </Button>
            )}
          </div>
          {feedsCount > 0 && (
            <p className="text-xs text-muted-foreground mt-6">
              Tip: New articles are fetched periodically. Check back in a few minutes or click refresh.
            </p>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-8 mb-20">
        {/* Page Header */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight mb-2">
                {sourceFilter ? sourceFilter : categoryFilter ? categoryFilter : "For You"}
              </h1>
              <p className="text-muted-foreground">
                {sourceFilter 
                  ? `Latest articles from ${sourceFilter}`
                  : categoryFilter
                    ? `Latest articles in ${categoryFilter}`
                    : "Top stories curated by AI based on your interests."
                }
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border/50 self-start">
               <FilterButton 
                 label="All" 
                 active={activeFilter === "all"} 
                 onClick={() => setActiveFilter("all")} 
               />
               <FilterButton 
                 label="Unread" 
                 active={activeFilter === "unread"} 
                 onClick={() => setActiveFilter("unread")} 
               />
               <FilterButton 
                 label="Starred" 
                 active={activeFilter === "saved"} 
                 onClick={() => setActiveFilter("saved")} 
               />
            </div>
          </div>
        </div>

        {/* Masonry Feed */}
        <MasonryGrid>
          {visibleFeed.map((item, index) => {
            const article = item.data as ArticleWithFeed;
            return (
              <ArticleCard
                key={item.id}
                article={article as any} // Type assertion for compatibility
                onClick={(a) => handleArticleClick(a as ArticleWithFeed)}
                onRemove={handleRemoveArticle}
                onStar={handleToggleStar}
              />
            );
          })}
        </MasonryGrid>

        {/* Load More Button */}
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="w-px h-8 bg-border"></div>
          <Button 
            variant="outline" 
            size="lg" 
            onClick={handleLoadMore}
            className="group gap-2 rounded-full px-8 h-12 border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all"
            disabled={nextChunkCount === 0}
          >
            {nextChunkCount > 0 ? (
              <>
                Load {nextChunkCount} stories from previous week
                <ArrowDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
              </>
            ) : (
              <span className="text-muted-foreground">No more older stories</span>
            )}
          </Button>
          {nextChunkCount > 0 && (
            <span className="text-xs text-muted-foreground font-mono">
              {differenceInDays(CURRENT_DATE, nextChunkStartDate)} days ago
            </span>
          )}
        </div>
      </div>

      {/* Article Sheet */}
      <ArticleSheet
        article={selectedArticle as any} // Type assertion for compatibility
        isOpen={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </AppShell>
  );
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
        active 
          ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      {label}
    </button>
  );
}
