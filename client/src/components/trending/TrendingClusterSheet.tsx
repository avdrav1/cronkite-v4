import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TrendingUp, Sparkles, Newspaper, ExternalLink, Loader2, Plus, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { TrendingCluster } from "@/components/feed/TrendingTopicCard";

interface ClusterArticle {
  id: string;
  title: string;
  excerpt?: string;
  url: string;
  source: string;
  published_at: string;
  image_url?: string;
  feed_id?: string;
  feed_url?: string;
  feed_category?: string;
}

interface TrendingClusterSheetProps {
  cluster: TrendingCluster | null;
  isOpen: boolean;
  onClose: () => void;
  onArticleClick?: (articleId: string) => void;
  subscribedFeedIds?: string[];
}

export function TrendingClusterSheet({ cluster, isOpen, onClose, onArticleClick, subscribedFeedIds = [] }: TrendingClusterSheetProps) {
  const [articles, setArticles] = useState<ClusterArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [subscribingFeedId, setSubscribingFeedId] = useState<string | null>(null);
  const [localSubscribedIds, setLocalSubscribedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Combine prop subscriptions with locally added ones
  const allSubscribedFeedIds = new Set([...subscribedFeedIds, ...Array.from(localSubscribedIds)]);

  useEffect(() => {
    if (cluster && isOpen) {
      fetchClusterArticles();
    }
  }, [cluster, isOpen]);

  // Reset local subscriptions when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setLocalSubscribedIds(new Set());
    }
  }, [isOpen]);

  const fetchClusterArticles = async () => {
    if (!cluster) return;

    setIsLoading(true);
    try {
      // Fetch ALL articles by ID from API (includes articles from non-subscribed feeds)
      if (cluster.articleIds && cluster.articleIds.length > 0) {
        console.log(`📊 Fetching ${cluster.articleIds.length} articles by IDs for cluster "${cluster.topic}"`);

        const articlePromises = cluster.articleIds.map(async (id) => {
          try {
            const response = await apiFetch('GET', `/api/articles/${id}`);
            if (response.ok) {
              const data = await response.json();
              return data.article;
            }
            return null;
          } catch {
            return null;
          }
        });

        const fetchedArticles = await Promise.all(articlePromises);
        const validArticles = fetchedArticles.filter(Boolean).map((article: any) => ({
          id: article.id,
          title: article.title,
          excerpt: article.excerpt,
          url: article.url,
          source: article.feed_name || 'Unknown',
          published_at: article.published_at || article.created_at,
          image_url: article.image_url,
          feed_id: article.feed_id,
          feed_url: article.feed_url,
          feed_category: article.feed_category
        }));

        setArticles(validArticles);
        console.log(`📊 Loaded ${validArticles.length} articles by ID for cluster "${cluster.topic}"`);
      } else {
        console.log(`📊 No articleIds for cluster "${cluster.topic}"`);
        setArticles([]);
      }
    } catch (error) {
      console.error('Failed to fetch cluster articles:', error);
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (article: ClusterArticle) => {
    if (!article.feed_url || !article.feed_id) return;

    setSubscribingFeedId(article.feed_id);
    try {
      await apiRequest('POST', '/api/feeds/subscribe-by-url', {
        url: article.feed_url,
        name: article.source,
        category: article.feed_category || 'News'
      });

      // Add to local subscribed state
      setLocalSubscribedIds(prev => new Set([...Array.from(prev), article.feed_id!]));

      // Invalidate feeds query to refresh sidebar
      queryClient.invalidateQueries({ queryKey: ['/api/feeds'] });

      toast({
        title: "Subscribed",
        description: `Added ${article.source} to your feeds`
      });
    } catch (error) {
      console.error('Failed to subscribe:', error);
      toast({
        title: "Failed to subscribe",
        description: "Could not add this feed. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubscribingFeedId(null);
    }
  };

  if (!cluster) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4 pb-6 border-b">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-primary/90 text-primary-foreground px-2.5 py-1 rounded-full text-xs font-semibold">
              <TrendingUp className="h-3 w-3" />
              <span>Trending Topic</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(cluster.latestTimestamp), { addSuffix: true })}
            </span>
          </div>
          
          <SheetTitle className="text-xl font-display leading-tight">
            {cluster.topic}
          </SheetTitle>
          
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p>{cluster.summary}</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
              <Newspaper className="h-3 w-3" />
              <span>{cluster.articleCount} articles</span>
            </div>
            {cluster.sources.slice(0, 4).map((source, i) => (
              <span 
                key={i} 
                className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full"
              >
                {source}
              </span>
            ))}
          </div>
        </SheetHeader>

        <div className="py-6 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Related Articles
          </h3>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Loading articles...</span>
            </div>
          ) : articles.length > 0 ? (
            <div className="space-y-3">
              {articles.map((article) => {
                const isSubscribed = article.feed_id ? allSubscribedFeedIds.has(article.feed_id) : true;
                const isSubscribing = subscribingFeedId === article.feed_id;

                return (
                  <div
                    key={article.id}
                    className="w-full text-left p-4 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-all group"
                  >
                    <button
                      onClick={() => onArticleClick?.(article.id)}
                      className="w-full text-left"
                    >
                      <div className="flex gap-3">
                        {article.image_url && (
                          <div className="h-16 w-16 shrink-0 rounded-md overflow-hidden bg-muted">
                            <img
                              src={article.image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-primary uppercase">
                              {article.source}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
                            </span>
                          </div>
                          <h4 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                            {article.title}
                          </h4>
                          {article.excerpt && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {article.excerpt}
                            </p>
                          )}
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    </button>

                    {/* Subscribe button for non-subscribed feeds */}
                    {!isSubscribed && article.feed_url && (
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={isSubscribing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubscribe(article);
                          }}
                        >
                          {isSubscribing ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                              Subscribing...
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1.5" />
                              Subscribe to {article.source}
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Show subscribed indicator */}
                    {isSubscribed && article.feed_id && (
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <span className="inline-flex items-center text-xs text-muted-foreground">
                          <Check className="h-3 w-3 mr-1.5 text-green-500" />
                          Subscribed to {article.source}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>Articles in this cluster will appear here</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default TrendingClusterSheet;
