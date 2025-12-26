import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getCategoryIcon } from "@/data/categories";
import { cn } from "@/lib/utils";
import { 
  Check, 
  Search, 
  X, 
  ChevronLeft, 
  Star, 
  Loader2,
  AlertCircle,
  RefreshCw,
  Rss
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { type RecommendedFeed } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useInvalidateFeedsQuery } from "@/hooks/useFeedsQuery";

interface FeedDiscoveryProps {
  selectedCategories: string[];
  selectedFeeds: string[];
  toggleFeed: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  isResetFlow?: boolean; // True when user is re-running onboarding to reset feeds
}

const MAX_FEEDS = 25;

type ViewMode = 'categories' | 'feeds';

export function FeedDiscovery({ 
  selectedCategories, 
  selectedFeeds, 
  toggleFeed, 
  onNext,
  onBack,
  isResetFlow = false
}: FeedDiscoveryProps) {
  const [allFeeds, setAllFeeds] = useState<RecommendedFeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  
  const { checkAuth } = useAuth();
  const invalidateFeedsQuery = useInvalidateFeedsQuery();

  // Fetch all feeds on mount
  useEffect(() => {
    const fetchFeeds = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiRequest('GET', '/api/feeds/recommended?limit=1000');
        const data = await response.json();
        if (data.feeds) {
          setAllFeeds(data.feeds);
        }
      } catch (err) {
        console.error('Failed to fetch feeds:', err);
        setError('Failed to load feeds. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchFeeds();
  }, []);

  // Filter feeds based on selected categories and search
  const filteredFeeds = useMemo(() => {
    let feeds = allFeeds;
    
    // Filter by active category if in feeds view
    if (activeCategory) {
      feeds = feeds.filter(f => f.category === activeCategory);
    } else if (selectedCategories.length > 0 && !searchQuery) {
      // When showing categories view, filter by selected categories
      feeds = feeds.filter(f => selectedCategories.includes(f.category));
    }
    
    // Apply search filter across all feeds
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      feeds = allFeeds.filter(f => 
        f.name.toLowerCase().includes(query) ||
        f.description?.toLowerCase().includes(query) ||
        f.category.toLowerCase().includes(query)
      );
    }
    
    // Sort by featured first, then popularity
    return feeds.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return (b.popularity_score || 0) - (a.popularity_score || 0);
    });
  }, [allFeeds, activeCategory, selectedCategories, searchQuery]);

  // Get feed counts per category (using actual database category names)
  const categoryFeedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allFeeds.forEach(feed => {
      counts[feed.category] = (counts[feed.category] || 0) + 1;
    });
    return counts;
  }, [allFeeds]);

  // Get selected feed count per category
  const selectedFeedCountsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedFeeds.forEach(feedId => {
      const feed = allFeeds.find(f => f.id === feedId);
      if (feed) {
        counts[feed.category] = (counts[feed.category] || 0) + 1;
      }
    });
    return counts;
  }, [allFeeds, selectedFeeds]);

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    setViewMode('feeds');
    setSearchQuery('');
  };

  const handleBackToCategories = () => {
    setActiveCategory(null);
    setViewMode('categories');
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    apiRequest('GET', '/api/feeds/recommended?limit=1000')
      .then(res => res.json())
      .then(data => {
        if (data.feeds) setAllFeeds(data.feeds);
      })
      .catch(() => setError('Failed to load feeds'))
      .finally(() => setIsLoading(false));
  };

  const handleSubmit = async () => {
    if (selectedFeeds.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // If this is a reset flow, clear existing subscriptions first
      if (isResetFlow) {
        await apiRequest('DELETE', '/api/feeds/subscriptions');
      }
      
      await apiRequest('POST', '/api/feeds/subscribe', {
        feedIds: selectedFeeds
      });
      
      // Immediately trigger feed sync in background (don't wait for results)
      // This starts fetching articles while user sees the confirmation screen
      apiRequest('POST', '/api/feeds/sync', { waitForResults: false }).catch(err => {
        console.error('Background feed sync failed to start:', err);
      });
      
      invalidateFeedsQuery();
      await checkAuth();
      onNext();
    } catch (err) {
      console.error('Failed to subscribe:', err);
      setError('Failed to subscribe to feeds. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFeed = (id: string) => {
    const isCurrentlySelected = selectedFeeds.includes(id);
    // Only allow adding if under limit, always allow removing
    if (!isCurrentlySelected && selectedFeeds.length >= MAX_FEEDS) {
      return; // At limit, can't add more
    }
    toggleFeed(id);
  };

  const selectAllInCategory = useCallback((categoryId: string) => {
    const categoryFeeds = allFeeds.filter(f => f.category === categoryId);
    const allSelected = categoryFeeds.every(f => selectedFeeds.includes(f.id));
    
    if (allSelected) {
      // Deselect all in category
      categoryFeeds.forEach(feed => {
        if (selectedFeeds.includes(feed.id)) toggleFeed(feed.id);
      });
    } else {
      // Select feeds up to the limit
      const currentlySelected = categoryFeeds.filter(f => selectedFeeds.includes(f.id)).length;
      const notSelected = categoryFeeds.filter(f => !selectedFeeds.includes(f.id));
      const canAdd = MAX_FEEDS - selectedFeeds.length;
      
      notSelected.slice(0, canAdd).forEach(feed => {
        toggleFeed(feed.id);
      });
    }
  }, [allFeeds, selectedFeeds, toggleFeed]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading feeds...</p>
      </div>
    );
  }

  if (error && allFeeds.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={handleRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  const ActiveIcon = activeCategory ? getCategoryIcon(activeCategory) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4">
        <AnimatePresence mode="wait">
          {viewMode === 'categories' && !searchQuery ? (
            <motion.div
              key="categories-header"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              <h2 className="text-2xl font-display font-bold mb-1">Choose Your Feeds</h2>
              <p className="text-muted-foreground text-sm">
                {allFeeds.length} feeds available across {selectedCategories.length} categories
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="feeds-header"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3"
            >
              {!searchQuery && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleBackToCategories}
                  className="shrink-0"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              {activeCategory && ActiveIcon && !searchQuery && (
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <ActiveIcon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium">{activeCategory}</span>
                  <Badge variant="secondary" className="text-xs">
                    {filteredFeeds.length} feeds
                  </Badge>
                </div>
              )}
              {searchQuery && (
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {filteredFeeds.length} results for "{searchQuery}"
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search all feeds..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value) {
              setViewMode('feeds');
              setActiveCategory(null);
            }
          }}
          className="pl-10 pr-10 h-10"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              if (!activeCategory) setViewMode('categories');
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content Area */}
      <ScrollArea className="flex-1 -mx-2 px-2">
        <AnimatePresence mode="wait">
          {viewMode === 'categories' && !searchQuery ? (
            <motion.div
              key="categories-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {selectedCategories.map((categoryId, index) => {
                const Icon = getCategoryIcon(categoryId);
                const feedCount = categoryFeedCounts[categoryId] || 0;
                const selectedCount = selectedFeedCountsByCategory[categoryId] || 0;
                
                return (
                  <motion.button
                    key={categoryId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleCategoryClick(categoryId)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border text-left",
                      "transition-all hover:border-primary/50 hover:bg-muted/50",
                      selectedCount > 0 ? "border-primary/30 bg-primary/5" : "border-border bg-card"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg shrink-0",
                      selectedCount > 0 ? "bg-primary/20" : "bg-muted"
                    )}>
                      <Icon className={cn(
                        "h-5 w-5",
                        selectedCount > 0 ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{categoryId}</div>
                      <div className="text-xs text-muted-foreground">
                        {feedCount} feeds available
                      </div>
                    </div>
                    {selectedCount > 0 && (
                      <Badge className="shrink-0 bg-primary text-primary-foreground">
                        {selectedCount}
                      </Badge>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="feeds-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {activeCategory && !searchQuery && (
                <div className="flex justify-end mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selectAllInCategory(activeCategory)}
                    className="text-xs"
                  >
                    {filteredFeeds.every(f => selectedFeeds.includes(f.id)) 
                      ? "Deselect All" 
                      : "Select All"}
                  </Button>
                </div>
              )}
              {filteredFeeds.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Rss className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No feeds found</p>
                </div>
              ) : (
                filteredFeeds.map((feed, index) => {
                  const isSelected = selectedFeeds.includes(feed.id);
                  return (
                    <motion.div
                      key={feed.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.3) }}
                      onClick={() => handleToggleFeed(feed.id)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border cursor-pointer",
                        "transition-all hover:border-primary/50",
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "border-border bg-card hover:bg-muted/50",
                        !isSelected && selectedFeeds.length >= MAX_FEEDS && "opacity-50 cursor-not-allowed hover:border-border hover:bg-card"
                      )}
                    >
                      <div className={cn(
                        "mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all",
                        isSelected 
                          ? "bg-primary border-primary text-primary-foreground" 
                          : "border-muted-foreground/40 bg-background"
                      )}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm truncate">{feed.name}</span>
                          {feed.is_featured && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {feed.description || 'No description available'}
                        </p>
                        {searchQuery && (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {feed.category}
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <span className={cn(
            "font-medium",
            selectedFeeds.length >= MAX_FEEDS ? "text-amber-600 dark:text-amber-400" : "text-foreground"
          )}>
            {selectedFeeds.length}
          </span>
          <span className="text-muted-foreground">/{MAX_FEEDS} feeds selected</span>
          {selectedFeeds.length >= MAX_FEEDS && (
            <span className="ml-2 text-amber-600 dark:text-amber-400 text-xs">(limit reached)</span>
          )}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={onBack}
            className="flex-1 sm:flex-none"
          >
            Back
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={selectedFeeds.length === 0 || isSubmitting}
            className="flex-1 sm:flex-none px-8"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Subscribing...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
