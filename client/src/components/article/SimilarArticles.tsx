import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, ExternalLink, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SimilarArticle {
  id: string;
  title: string;
  excerpt?: string;
  url: string;
  feedName: string;
  publishedAt: string;
  imageUrl?: string;
  similarityScore: number;
}

interface SimilarArticlesProps {
  articleId: string;
  className?: string;
  onArticleClick?: (articleId: string) => void;
}

/**
 * SimilarArticles component displays articles similar to the current article
 * using vector-based similarity search.
 * 
 * Requirements: 4.1, 4.5
 * - Display up to 5 similar articles with similarity scores >= 0.7
 * - Handle no-results state gracefully
 */
export function SimilarArticles({ articleId, className, onArticleClick }: SimilarArticlesProps) {
  const [similarArticles, setSimilarArticles] = useState<SimilarArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (articleId) {
      fetchSimilarArticles();
    }
  }, [articleId]);

  const fetchSimilarArticles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiRequest('GET', `/api/articles/${articleId}/similar`);
      const data = await response.json();
      
      if (data.articles) {
        setSimilarArticles(data.articles);
      } else {
        setSimilarArticles([]);
      }
    } catch (err) {
      console.error('Failed to fetch similar articles:', err);
      setError('Unable to load similar articles');
      setSimilarArticles([]);
    } finally {
      setIsLoading(false);
    }
  };


  // Format similarity score as percentage
  const formatSimilarity = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  // Get color class based on similarity score
  const getSimilarityColor = (score: number): string => {
    if (score >= 0.9) return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10";
    if (score >= 0.8) return "text-blue-600 dark:text-blue-400 bg-blue-500/10";
    return "text-amber-600 dark:text-amber-400 bg-amber-500/10";
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <Sparkles className="h-4 w-4 text-primary" />
          Similar Articles
        </div>
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Finding similar articles...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <Sparkles className="h-4 w-4 text-primary" />
          Similar Articles
        </div>
        <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // No results state - Requirements: 4.5
  if (similarArticles.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <Sparkles className="h-4 w-4 text-primary" />
          Similar Articles
        </div>
        <div className="text-center py-6 text-muted-foreground text-sm bg-muted/30 rounded-lg">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No similar articles found</p>
          <p className="text-xs mt-1">Check back as more articles are analyzed</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <Sparkles className="h-4 w-4 text-primary" />
          Similar Articles
        </div>
        
        <div className="space-y-3">
          <AnimatePresence>
            {similarArticles.map((article, index) => (
              <motion.button
                key={article.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onArticleClick?.(article.id)}
                className="w-full text-left p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-all group"
              >
                <div className="flex gap-3">
                  {article.imageUrl && (
                    <div className="h-14 w-14 shrink-0 rounded-md overflow-hidden bg-muted">
                      <img 
                        src={article.imageUrl} 
                        alt="" 
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-primary uppercase">
                        {article.feedName}
                      </span>
                      
                      {/* Similarity score badge - Requirements: 4.1 */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(
                            "text-xs font-medium px-1.5 py-0.5 rounded cursor-help",
                            getSimilarityColor(article.similarityScore)
                          )}>
                            {formatSimilarity(article.similarityScore)} match
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Semantic similarity: {(article.similarityScore * 100).toFixed(1)}%</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <h4 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </h4>
                    {article.excerpt && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        {article.excerpt}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default SimilarArticles;
