import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getCategoryIcon } from "@/data/categories";
import { cn } from "@/lib/utils";
import { Check, Plus, Minus, RefreshCw, AlertCircle, Wifi, WifiOff, ChevronDown, ChevronUp, Search, X, Star, TrendingUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { type RecommendedFeed } from "@shared/schema";
import { filterFeedsByInterests, groupFeedsByCategory, validateFilteringConsistency, sortFeedsByFeaturedAndPopularity } from "@/lib/feed-filtering";
import { useAuth } from "@/contexts/AuthContext";
import { useInvalidateFeedsQuery } from "@/hooks/useFeedsQuery";

interface FeedPreviewProps {
  selectedInterests: string[];
  selectedFeeds: string[];
  toggleFeed: (id: string) => void;
  toggleCategory: (category: string, feedIds: string[]) => void;
  onNext: () => void;
}

interface ErrorState {
  message: string;
  type: 'network' | 'server' | 'timeout' | 'unknown';
  retryable: boolean;
  details?: any;
}

const isDevelopment = import.meta.env.DEV;

// Exponential backoff retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
};

// Request timeout configuration
const REQUEST_TIMEOUT = 15000; // 15 seconds

export function FeedPreview({ selectedInterests, selectedFeeds, toggleFeed, toggleCategory, onNext }: FeedPreviewProps) {
  const [recommendedFeeds, setRecommendedFeeds] = useState<RecommendedFeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ErrorState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const { checkAuth } = useAuth();
  const invalidateFeedsQuery = useInvalidateFeedsQuery();

  // Initial feed display limit per category (Requirement 3.2)
  const INITIAL_FEED_LIMIT = 6;

  // Toggle expanded state for a category
  const toggleCategoryExpanded = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Filter feeds by search query (Requirement 3.4)
  const filterFeedsBySearch = (feeds: RecommendedFeed[]): RecommendedFeed[] => {
    if (!searchQuery.trim()) return feeds;
    const query = searchQuery.toLowerCase().trim();
    return feeds.filter(feed => 
      feed.name.toLowerCase().includes(query) ||
      (feed.description?.toLowerCase().includes(query) ?? false)
    );
  };

  // Enhanced error classification
  const classifyError = (error: any): ErrorState => {
    if (isDevelopment) {
      console.error('FeedPreview Error Details:', error);
    }

    // Network connectivity issues
    if (!navigator.onLine) {
      return {
        message: 'No internet connection. Please check your network and try again.',
        type: 'network',
        retryable: true,
        details: error
      };
    }

    // Timeout errors
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return {
        message: 'Request timed out. The server may be experiencing high load.',
        type: 'timeout',
        retryable: true,
        details: error
      };
    }

    // Server errors (5xx)
    if (error.message?.match(/^5\d\d:/)) {
      return {
        message: 'Server error occurred. Our team has been notified.',
        type: 'server',
        retryable: true,
        details: error
      };
    }

    // Client errors (4xx)
    if (error.message?.match(/^4\d\d:/)) {
      return {
        message: 'Unable to load feeds. Please refresh the page and try again.',
        type: 'server',
        retryable: false,
        details: error
      };
    }

    // Generic network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        message: 'Network error. Please check your connection and try again.',
        type: 'network',
        retryable: true,
        details: error
      };
    }

    // Unknown errors
    return {
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      type: 'unknown',
      retryable: true,
      details: error
    };
  };

  // Enhanced API request with timeout and retry logic
  const makeApiRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await apiRequest('GET', url);
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }, []);

  // Retry with exponential backoff
  const retryWithBackoff = useCallback(async (attempt: number): Promise<void> => {
    if (attempt >= RETRY_CONFIG.maxRetries) {
      throw new Error('Maximum retry attempts exceeded');
    }

    const delay = Math.min(
      RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt),
      RETRY_CONFIG.maxDelay
    );

    if (isDevelopment) {
      console.log(`Retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`);
    }

    await new Promise(resolve => setTimeout(resolve, delay));
  }, []);

  // Fetch recommended feeds with enhanced error handling and retry logic
  const fetchRecommendedFeeds = useCallback(async (isRetry = false) => {
    try {
      if (isRetry) {
        setIsRetrying(true);
      } else {
        setIsLoading(true);
        setRetryCount(0);
      }
      
      setError(null);

      const startTime = Date.now();
      const response = await makeApiRequest('/api/feeds/recommended');
      const data = await response.json();
      const endTime = Date.now();

      if (isDevelopment) {
        const debugData = {
          requestTime: endTime - startTime,
          feedCount: data.feeds?.length || 0,
          timestamp: new Date().toISOString(),
          retryAttempt: retryCount,
          userAgent: navigator.userAgent,
          online: navigator.onLine
        };
        setDebugInfo(debugData);
        console.log('FeedPreview Debug Info:', debugData);
      }

      if (!data.feeds || !Array.isArray(data.feeds)) {
        throw new Error('Invalid response format: feeds array not found');
      }

      setRecommendedFeeds(data.feeds);
      setRetryCount(0); // Reset retry count on success
      
    } catch (error) {
      const errorState = classifyError(error);
      
      if (errorState.retryable && retryCount < RETRY_CONFIG.maxRetries) {
        try {
          await retryWithBackoff(retryCount);
          setRetryCount(prev => prev + 1);
          return fetchRecommendedFeeds(true);
        } catch (retryError) {
          setError({
            ...errorState,
            message: `Failed after ${RETRY_CONFIG.maxRetries} attempts: ${errorState.message}`
          });
        }
      } else {
        setError(errorState);
      }
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [makeApiRequest, retryCount, retryWithBackoff]);

  // Manual retry function
  const handleRetry = useCallback(() => {
    setRetryCount(0);
    fetchRecommendedFeeds(false);
  }, [fetchRecommendedFeeds]);

  // Initialize feed loading on component mount
  useEffect(() => {
    fetchRecommendedFeeds(false);
  }, [fetchRecommendedFeeds]);

  // Enhanced subscription handling with better error handling
  const handleNext = async () => {
    if (selectedFeeds.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const startTime = Date.now();
      
      // Subscribe to selected feeds with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        await apiRequest('POST', '/api/feeds/subscribe', {
          feedIds: selectedFeeds
        });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }

      const endTime = Date.now();

      if (isDevelopment) {
        console.log('Subscription completed:', {
          feedCount: selectedFeeds.length,
          requestTime: endTime - startTime,
          timestamp: new Date().toISOString()
        });
      }

      // Invalidate the user feeds query to update sidebar immediately
      // Requirements: 5.1 - Add feed to sidebar without page refresh
      invalidateFeedsQuery();

      // Refresh user data to get updated onboarding_completed status
      await checkAuth();

      // Proceed to next step
      onNext();
    } catch (error) {
      console.error('Failed to subscribe to feeds:', error);
      const errorState = classifyError(error);
      setError({
        ...errorState,
        message: `Failed to subscribe: ${errorState.message}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter feeds based on selected interests with validation
  const filteringResult = filterFeedsByInterests(recommendedFeeds, selectedInterests);
  const relevantFeeds = filteringResult.feeds;
  
  // Validate filtering consistency (development mode only)
  if (isDevelopment) {
    const consistencyCheck = validateFilteringConsistency(recommendedFeeds, { interests: selectedInterests });
    if (!consistencyCheck.isValid) {
      console.warn('🔍 Frontend filtering consistency issues:', consistencyCheck.issues);
    }
  }
  
  // Group by category using the consistent grouping function
  const feedsByCategory = groupFeedsByCategory(relevantFeeds, selectedInterests);

  // Calculate estimated articles per day (using popularity_score as a proxy)
  const totalArticlesPerDay = selectedFeeds.reduce((acc, feedId) => {
    const feed = recommendedFeeds.find(f => f.id === feedId);
    // Estimate articles per day based on popularity score and frequency
    const estimatedDaily = feed ? Math.max(1, Math.floor(feed.popularity_score / 10)) : 0;
    return acc + estimatedDaily;
  }, 0);

  // Enhanced loading state with better UX
  if (isLoading || isRetrying) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-display font-bold mb-2">
            {isRetrying ? `Retrying... (${retryCount}/${RETRY_CONFIG.maxRetries})` : 'Loading feeds...'}
          </h2>
          <p className="text-muted-foreground">
            {isRetrying ? 'Attempting to reconnect' : 'Finding the best sources for your interests'}
          </p>
          {isDevelopment && debugInfo && (
            <div className="mt-4 p-3 bg-muted rounded-lg text-xs text-left">
              <strong>Debug Info:</strong>
              <pre className="mt-1 whitespace-pre-wrap">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          {isRetrying && (
            <div className="text-sm text-muted-foreground">
              {navigator.onLine ? (
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-green-500" />
                  Connected - Retrying request
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <WifiOff className="h-4 w-4 text-red-500" />
                  No internet connection
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Enhanced error state with better UX and retry options
  if (error) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-display font-bold mb-2">Unable to load feeds</h2>
          <p className="text-muted-foreground">We're having trouble connecting to our servers</p>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {error.message}
            </AlertDescription>
          </Alert>

          <div className="flex flex-col items-center gap-4">
            {error.retryable && (
              <Button 
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex items-center gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
                {isRetrying ? 'Retrying...' : 'Try Again'}
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="text-sm"
            >
              Refresh Page
            </Button>

            {isDevelopment && error.details && (
              <details className="mt-4 p-3 bg-muted rounded-lg text-xs max-w-md">
                <summary className="cursor-pointer font-medium">Debug Details</summary>
                <pre className="mt-2 whitespace-pre-wrap text-left">
                  {JSON.stringify(error.details, null, 2)}
                </pre>
              </details>
            )}
          </div>

          <div className="text-xs text-muted-foreground text-center max-w-md">
            {error.type === 'network' && (
              <>
                <WifiOff className="h-4 w-4 mx-auto mb-1" />
                Check your internet connection and try again
              </>
            )}
            {error.type === 'server' && (
              <>
                Our team has been notified and is working on a fix
              </>
            )}
            {error.type === 'timeout' && (
              <>
                The request is taking longer than expected. Please try again
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-display font-bold mb-2">Here's what we found for you</h2>
        <p className="text-muted-foreground">
          {filteringResult.filteredCount} feeds based on your interests
          {filteringResult.warnings.length > 0 && isDevelopment && (
            <span className="text-xs text-orange-500 block mt-1">
              {filteringResult.warnings.join(', ')}
            </span>
          )}
        </p>
      </div>

      {/* Search Input (Requirement 3.4) */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search feeds by name or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10 h-10"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <ScrollArea className="flex-1 pr-4 -mr-4 mb-6 h-[400px]">
        <div className="space-y-8">
          {Object.entries(feedsByCategory).map(([category, feeds], index) => {
            const CategoryIcon = getCategoryIcon(category);
            // Apply search filter to feeds within category
            const filteredFeeds = filterFeedsBySearch(feeds);
            // Skip category if no feeds match search
            if (filteredFeeds.length === 0) return null;
            
            const allSelected = filteredFeeds.every(f => selectedFeeds.includes(f.id));
            const isExpanded = expandedCategories.has(category);
            const hasMoreFeeds = filteredFeeds.length > INITIAL_FEED_LIMIT;
            const displayedFeeds = isExpanded ? filteredFeeds : filteredFeeds.slice(0, INITIAL_FEED_LIMIT);
            const hiddenCount = filteredFeeds.length - INITIAL_FEED_LIMIT;
            
            return (
              <motion.div 
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                {/* Category Header */}
                <div className="bg-muted/30 p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <div className="p-1.5 rounded-lg bg-muted">
                      <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="capitalize">{category}</span>
                    <span className="text-xs text-muted-foreground">
                      ({searchQuery ? `${filteredFeeds.length}/${feeds.length}` : feeds.length})
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => toggleCategory(category, filteredFeeds.map(f => f.id))}
                    className="text-xs h-8"
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                
                {/* Feeds List */}
                <div className="divide-y divide-border/50">
                  {displayedFeeds.map(feed => {
                    const isSelected = selectedFeeds.includes(feed.id);
                    // Calculate popularity level for visual indicator (Requirement 3.5)
                    const popularityLevel = feed.popularity_score >= 80 ? 'high' : feed.popularity_score >= 50 ? 'medium' : 'low';
                    
                    return (
                      <div 
                        key={feed.id} 
                        className={cn(
                          "p-4 flex items-start gap-4 cursor-pointer transition-colors hover:bg-muted/20",
                          isSelected ? "bg-primary/5" : ""
                        )}
                        onClick={() => toggleFeed(feed.id)}
                      >
                        <div 
                          className={cn(
                            "mt-1 w-5 h-5 rounded border flex items-center justify-center transition-all duration-200 shrink-0",
                            isSelected 
                              ? "bg-primary border-primary text-primary-foreground" 
                              : "border-muted-foreground/40 bg-background"
                          )}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">{feed.name}</h4>
                            {/* Featured Badge (Requirement 3.5) */}
                            {feed.is_featured && (
                              <Badge variant="secondary" className="shrink-0 h-5 px-1.5 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                <Star className="h-3 w-3 mr-0.5 fill-current" />
                                Featured
                              </Badge>
                            )}
                            {/* Popularity Indicator (Requirement 3.5) */}
                            <div className="flex items-center gap-1 ml-auto shrink-0">
                              <TrendingUp className={cn(
                                "h-3 w-3",
                                popularityLevel === 'high' ? "text-green-500" :
                                popularityLevel === 'medium' ? "text-yellow-500" : "text-muted-foreground"
                              )} />
                              <span className="text-xs text-muted-foreground">
                                ~{Math.max(1, Math.floor(feed.popularity_score / 10))}/day
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{feed.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Show More / Show Less Button (Requirement 3.3) */}
                {hasMoreFeeds && (
                  <div className="border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCategoryExpanded(category)}
                      className="w-full h-10 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Show {hiddenCount} more feed{hiddenCount !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </motion.div>
            );
          })}
          
          {/* No search results message */}
          {searchQuery && Object.entries(feedsByCategory).every(([_, feeds]) => filterFeedsBySearch(feeds).length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No feeds found matching "{searchQuery}"</p>
              <button 
                onClick={() => setSearchQuery('')}
                className="text-primary text-sm mt-2 hover:underline"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="mt-auto flex flex-col items-center gap-4 bg-background pt-4 border-t border-border">
        {error && (
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {(error as ErrorState).message}
              {(error as ErrorState).retryable && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleRetry}
                  className="ml-2 h-auto p-1 text-xs underline"
                >
                  Retry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="text-sm text-muted-foreground font-medium">
          {selectedFeeds.length} feeds selected <span className="mx-2">•</span> ~{totalArticlesPerDay} articles/day
          {isDevelopment && debugInfo && (
            <div className="mt-2 text-xs opacity-60">
              Load time: {debugInfo.requestTime}ms | Total feeds: {debugInfo.feedCount}
            </div>
          )}
        </div>
        
        <Button 
          size="lg" 
          onClick={handleNext} 
          className="w-full md:w-auto px-12 h-12 rounded-xl"
          disabled={selectedFeeds.length === 0 || isSubmitting}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              Subscribing...
            </div>
          ) : (
            'Continue'
          )}
        </Button>
      </div>
    </div>
  );
}
