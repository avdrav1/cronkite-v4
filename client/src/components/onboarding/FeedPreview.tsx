import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/data/categories";
import { cn } from "@/lib/utils";
import { Check, Plus, Minus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { type RecommendedFeed } from "@shared/schema";

interface FeedPreviewProps {
  selectedInterests: string[];
  selectedFeeds: string[];
  toggleFeed: (id: string) => void;
  toggleCategory: (category: string, feedIds: string[]) => void;
  onNext: () => void;
}

export function FeedPreview({ selectedInterests, selectedFeeds, toggleFeed, toggleCategory, onNext }: FeedPreviewProps) {
  const [recommendedFeeds, setRecommendedFeeds] = useState<RecommendedFeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch recommended feeds from backend
  useEffect(() => {
    const fetchRecommendedFeeds = async () => {
      try {
        setIsLoading(true);
        const response = await apiRequest('GET', '/api/feeds/recommended');
        const data = await response.json();
        setRecommendedFeeds(data.feeds);
      } catch (error) {
        console.error('Failed to fetch recommended feeds:', error);
        setError(error instanceof Error ? error.message : 'Failed to load feeds');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendedFeeds();
  }, []);

  // Filter feeds based on selected interests
  const relevantFeeds = recommendedFeeds.filter(feed => selectedInterests.includes(feed.category));
  
  // Group by category
  const feedsByCategory: Record<string, RecommendedFeed[]> = {};
  selectedInterests.forEach(cat => {
    const feeds = relevantFeeds.filter(f => f.category === cat);
    if (feeds.length > 0) {
      feedsByCategory[cat] = feeds;
    }
  });

  // Calculate estimated articles per day (using popularity_score as a proxy)
  const totalArticlesPerDay = selectedFeeds.reduce((acc, feedId) => {
    const feed = recommendedFeeds.find(f => f.id === feedId);
    // Estimate articles per day based on popularity score and frequency
    const estimatedDaily = feed ? Math.max(1, Math.floor(feed.popularity_score / 10)) : 0;
    return acc + estimatedDaily;
  }, 0);

  const handleNext = async () => {
    if (selectedFeeds.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Subscribe to selected feeds
      await apiRequest('POST', '/api/feeds/subscribe', {
        feedIds: selectedFeeds
      });

      // Proceed to next step
      onNext();
    } catch (error) {
      console.error('Failed to subscribe to feeds:', error);
      setError(error instanceof Error ? error.message : 'Failed to subscribe to feeds');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-display font-bold mb-2">Loading feeds...</h2>
          <p className="text-muted-foreground">Finding the best sources for your interests</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-display font-bold mb-2">Error loading feeds</h2>
          <p className="text-muted-foreground text-red-600">{error}</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-display font-bold mb-2">Here's what we found for you</h2>
        <p className="text-muted-foreground">{relevantFeeds.length} feeds based on your interests</p>
      </div>

      <ScrollArea className="flex-1 pr-4 -mr-4 mb-6 h-[400px]">
        <div className="space-y-8">
          {Object.entries(feedsByCategory).map(([category, feeds], index) => {
            const categoryInfo = CATEGORIES.find(c => c.id === category);
            const allSelected = feeds.every(f => selectedFeeds.includes(f.id));
            
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
                    <span className="text-xl">{categoryInfo?.emoji}</span>
                    <span className="capitalize">{categoryInfo?.label || category}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => toggleCategory(category, feeds.map(f => f.id))}
                    className="text-xs h-8"
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                
                {/* Feeds List */}
                <div className="divide-y divide-border/50">
                  {feeds.map(feed => {
                    const isSelected = selectedFeeds.includes(feed.id);
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
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="font-medium truncate">{feed.name}</h4>
                            <span className="text-xs text-muted-foreground shrink-0">
                              ~{Math.max(1, Math.floor(feed.popularity_score / 10))}/day
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">{feed.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="mt-auto flex flex-col items-center gap-4 bg-background pt-4 border-t border-border">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div className="text-sm text-muted-foreground font-medium">
          {selectedFeeds.length} feeds selected <span className="mx-2">•</span> ~{totalArticlesPerDay} articles/day
        </div>
        <Button 
          size="lg" 
          onClick={handleNext} 
          className="w-full md:w-auto px-12 h-12 rounded-xl"
          disabled={selectedFeeds.length === 0 || isSubmitting}
        >
          {isSubmitting ? "Subscribing..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
