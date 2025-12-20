import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MasonryGrid } from "@/components/feed/MasonryGrid";
import { ArticleCard } from "@/components/feed/ArticleCard";
import { ArticleSheet } from "@/components/article/ArticleSheet";
import { TrendingTopicCard } from "@/components/trending/TrendingTopicCard";
import { TrendingDrillDown } from "@/components/trending/TrendingDrillDown";
import { MOCK_ARTICLES, Article } from "@/lib/mock-data";
import { MOCK_CLUSTERS, TopicCluster } from "@/lib/mock-clusters";
import { motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Interleave clusters into the feed
const MIXED_FEED = [...MOCK_ARTICLES];
// Insert clusters at specific indices for demo
MIXED_FEED.splice(2, 0, { type: 'cluster', data: MOCK_CLUSTERS[0] } as any);
MIXED_FEED.splice(6, 0, { type: 'cluster', data: MOCK_CLUSTERS[1] } as any);
MIXED_FEED.splice(9, 0, { type: 'cluster', data: MOCK_CLUSTERS[2] } as any);

import { subDays, isAfter, isBefore, parseISO, formatDistanceToNow, differenceInDays } from "date-fns";
import { ArrowDown } from "lucide-react";

// Mock "current date" for demo purposes since mock data is future dated
const CURRENT_DATE = new Date("2025-12-20T12:00:00Z");
const CHUNK_SIZE_DAYS = 7;

export default function Home() {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<TopicCluster | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [historyDepth, setHistoryDepth] = useState(CHUNK_SIZE_DAYS);
  
  // Get source filter from URL manually since wouter's useLocation doesn't parse query params
  const searchParams = new URLSearchParams(window.location.search);
  const sourceFilter = searchParams.get("source");

  // State to hold mutable articles (initialized from MIXED_FEED)
  const [articles, setArticles] = useState(MIXED_FEED);

  // Actions
  const handleRemoveArticle = (id: string) => {
    setArticles(prev => prev.filter((item: any) => item.id !== id && item.data?.id !== id));
  };

  const handleToggleStar = (id: string) => {
    setArticles(prev => prev.map((item: any) => {
      if (item.id === id) {
        return { ...item, isStarred: !item.isStarred };
      }
      return item;
    }));
  };

  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article);
    // Mark as read
    setArticles(prev => prev.map((item: any) => {
      if (item.id === article.id) {
        return { ...item, isRead: true };
      }
      return item;
    }));
  };

  // Base filtering (Source + Status)
  const baseFilteredFeed = articles.filter((item: any) => {
    // 1. Source Filter
    if (sourceFilter) {
      if (item.type === 'cluster') return false; 
      const matchesSource = item.source.toLowerCase().includes(sourceFilter.toLowerCase()) || 
             sourceFilter.toLowerCase().includes(item.source.toLowerCase());
      if (!matchesSource) return false;
    }

    // 2. Status Filter
    if (activeFilter === "unread" && item.isRead) return false;
    if (activeFilter === "saved" && !item.isStarred) return false;
    
    return true;
  });

  // Calculate visible feed based on history depth
  const visibleFeed = baseFilteredFeed.filter((item: any) => {
    if (item.type === 'cluster') return true; // Always show relevant clusters for now
    
    const articleDate = parseISO(item.date);
    const cutoffDate = subDays(CURRENT_DATE, historyDepth);
    return isAfter(articleDate, cutoffDate);
  });

  // Calculate next chunk stats
  const nextChunkStartDate = subDays(CURRENT_DATE, historyDepth + CHUNK_SIZE_DAYS);
  const nextChunkEndDate = subDays(CURRENT_DATE, historyDepth);
  
  const nextChunkCount = baseFilteredFeed.filter((item: any) => {
    if (item.type === 'cluster') return false;
    const articleDate = parseISO(item.date);
    return isAfter(articleDate, nextChunkStartDate) && isBefore(articleDate, nextChunkEndDate);
  }).length;

  const handleLoadMore = () => {
    setHistoryDepth(prev => prev + CHUNK_SIZE_DAYS);
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-8 mb-20">
        {/* Page Header */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight mb-2">
                {sourceFilter ? sourceFilter : "For You"}
              </h1>
              <p className="text-muted-foreground">
                {sourceFilter 
                  ? `Latest articles from ${sourceFilter}`
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
          {visibleFeed.map((item: any, index) => {
            if (item.type === 'cluster') {
              return (
                <TrendingTopicCard
                  key={`cluster-${item.data.id}`}
                  cluster={item.data}
                  onClick={(c) => setSelectedCluster(c)}
                />
              );
            }
            // Regular article
            return (
              <ArticleCard
                key={item.id || `article-${index}`}
                article={item}
                onClick={(a) => handleArticleClick(a)}
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

      {/* Slide-over Sheets */}
      <ArticleSheet
        article={selectedArticle}
        isOpen={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />

      <TrendingDrillDown
        cluster={selectedCluster}
        isOpen={!!selectedCluster}
        onClose={() => setSelectedCluster(null)}
        onArticleClick={(article) => {
          setSelectedCluster(null); // Close cluster view
          setTimeout(() => setSelectedArticle(article), 300); // Open article view with slight delay
        }}
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
