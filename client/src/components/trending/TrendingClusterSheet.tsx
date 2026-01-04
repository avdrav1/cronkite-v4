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
  isSubscribed?: boolean;
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
      console.log(`📊 Fetching articles for cluster "${cluster.topic}"`);
      
      // Always use the cluster articles endpoint for consistent results
      const response = await apiFetch('GET', `/api/clusters/${cluster.id}/articles?includeAll=true`);
      if (response.ok) {
        const data = await response.json();
        if (data.articles && data.articles.length > 0) {
          const mappedArticles = data.articles.map((article: any) => ({
            id: article.id,
            title: article.title,
            excerpt: article.excerpt,
            url: article.url,
            source: article.source || 'Unknown',
            published_at: article.published_at,
            image_url: article.image_url,
            feed_id: article.feed_id,
            feed_url: article.feed_url,
            feed_category: article.feed_category,
            isSubscribed: article.feed_id ? allSubscribedFeedIds.has(article.feed_id) : false
          }));
          
          // Deduplicate by article ID and URL
          const seenIds = new Set<string>();
          const seenUrls = new Set<string>();
          const uniqueArticles = mappedArticles.filter((article: ClusterArticle) => {
            if (seenIds.has(article.id)) return false;
            if (article.url && seenUrls.has(article.url)) return false;
            seenIds.add(article.id);
            if (article.url) seenUrls.add(article.url);
            return true;
          });
          
          setArticles(uniqueArticles);
          console.log(`📊 Loaded ${uniqueArticles.length} unique articles for cluster "${cluster.topic}"`);
          return;
        }
      }
      
      setArticles([]);
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

      // Invalidate queries to refresh sidebar and counts
      queryClient.invalidateQueries({ queryKey: ['user-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['feed-count'] });
      queryClient.invalidateQueries({ queryKey: ['article-counts'] });

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
              <span>
                {isLoading ? 'Loading...' : `${articles.length} article${articles.length !== 1 ? 's' : ''} from ${new Set(articles.map(a => a.source)).size} source${new Set(articles.map(a => a.source)).size !== 1 ? 's' : ''}`}
              </span>
            </div>
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
            <div className="space-y-6">
              {/* Group articles by source */}
              {Object.entries(
                articles.reduce((groups, article) => {
                  const source = article.source || 'Unknown';
                  if (!groups[source]) groups[source] = [];
                  groups[source].push(article);
                  return groups;
                }, {} as Record<string, ClusterArticle[]>)
              ).map(([source, sourceArticles]) => {
                const firstArticle = sourceArticles[0];
                // Recalculate subscription status using current allSubscribedFeedIds
                const isSubscribed = firstArticle.feed_id ? allSubscribedFeedIds.has(firstArticle.feed_id) : true;
                const isSubscribing = subscribingFeedId === firstArticle.feed_id;

                return (
                  <div key={source} className="space-y-2">
                    {/* Source header with subscribe button */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/30">
                      <span className="text-sm font-semibold text-primary">
                        {source} ({sourceArticles.length})
                      </span>
                      {!isSubscribed && firstArticle.feed_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          disabled={isSubscribing}
                          onClick={() => handleSubscribe(firstArticle)}
                        >
                          {isSubscribing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Subscribe
                            </>
                          )}
                        </Button>
                      )}
                      {isSubscribed && (
                        <span className="inline-flex items-center text-xs text-muted-foreground">
                          <Check className="h-3 w-3 mr-1 text-green-500" />
                          Subscribed
                        </span>
                      )}
                    </div>
                    
                    {/* Articles from this source */}
                    {sourceArticles.map((article) => (
                      <a
                        key={article.id}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-left p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-all group"
                      >
                        <div className="flex gap-3">
                          {article.image_url && (
                            <div className="h-14 w-14 shrink-0 rounded-md overflow-hidden bg-muted">
                              <img src={article.image_url} alt="" className="h-full w-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
                            </span>
                            <h4 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                              {article.title}
                            </h4>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      </a>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>No articles currently available for this topic</p>
              <p className="text-xs mt-1">Articles may still be loading or unavailable</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default TrendingClusterSheet;
