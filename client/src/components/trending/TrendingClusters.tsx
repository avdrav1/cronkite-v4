import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, ChevronRight, Loader2, Sparkles, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ArticleCluster {
  id: string;
  topic: string;
  summary: string;
  articleIds: string[];
  articleCount: number;
  sources: string[];
  latestTimestamp: string;
  relevanceScore: number;
  avgSimilarity?: number;
  generationMethod?: string;
}

interface TrendingClustersProps {
  onClusterClick?: (cluster: ArticleCluster) => void;
  activeClusterId?: string;
  className?: string;
}

export function TrendingClusters({ onClusterClick, activeClusterId, className }: TrendingClustersProps) {
  const [clusters, setClusters] = useState<ArticleCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClusters() {
      try {
        setIsLoading(true);
        setError(null);
        console.log('🔍 TrendingClusters: Fetching clusters...');
        const response = await apiFetch('GET', '/api/clusters');
        
        console.log('🔍 TrendingClusters: Response status:', response.status);
        
        if (!response.ok) {
          if (response.status === 401) {
            console.log('🔍 TrendingClusters: Auth required - user may need to re-login');
            setError('Please log in to see trending topics');
          } else {
            console.error('🔍 TrendingClusters: API error:', response.status);
            setError('Unable to load trending topics');
          }
          setClusters([]);
          return;
        }
        
        const data = await response.json();
        
        console.log('🔍 TrendingClusters: API response:', {
          hasClusters: !!data.clusters,
          clusterCount: data.clusters?.length || 0,
          method: data.method,
          cached: data.cached,
          message: data.message
        });
        
        if (data.clusters && data.clusters.length > 0) {
          setClusters(data.clusters);
          console.log('✅ TrendingClusters: Loaded', data.clusters.length, 'clusters');
        } else {
          console.log('ℹ️ TrendingClusters: No clusters returned from API');
          setClusters([]);
        }
      } catch (err) {
        console.error('❌ TrendingClusters: Failed to fetch clusters:', err);
        setError('Unable to load trending topics');
      } finally {
        setIsLoading(false);
      }
    }

    fetchClusters();
  }, []);

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
          <TrendingUp className="h-4 w-4" />
          Trending Topics
        </div>
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Analyzing articles...</span>
        </div>
      </div>
    );
  }

  if (error || clusters.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
          <TrendingUp className="h-4 w-4" />
          Trending Topics
        </div>
        <div className="text-center py-6 text-muted-foreground text-sm">
          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>{error || "No trending topics yet"}</p>
          <p className="text-xs mt-1 opacity-75">
            {error 
              ? "Check AI status below for details"
              : "Topics appear when multiple sources cover the same story"
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
          <TrendingUp className="h-4 w-4" />
          Trending Topics
        </div>
        
        <div className="space-y-2">
          <AnimatePresence>
            {clusters.map((cluster, index) => (
              <motion.button
                key={cluster.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => {
                  console.log('🔥 TrendingClusters button clicked:', cluster.id);
                  onClusterClick?.(cluster);
                }}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all group",
                  activeClusterId === cluster.id
                    ? "bg-primary/15 border-primary/30 shadow-sm"
                    : "bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 border-primary/10 hover:border-primary/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        From {cluster.sources.length} source{cluster.sources.length !== 1 ? 's' : ''}
                      </span>
                      
                      {/* Source diversity indicator - Requirements: 2.7 */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded cursor-help">
                            <Users className="h-3 w-3" />
                            {cluster.sources.length} sources
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Coverage from {cluster.sources.length} different news sources</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      {/* Relevance score indicator - Requirements: 2.7 */}
                      {cluster.relevanceScore > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded cursor-help">
                              <BarChart3 className="h-3 w-3" />
                              {Math.round(cluster.relevanceScore)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Relevance score: {cluster.articleCount} articles × {cluster.sources.length} sources</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(cluster.latestTimestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {cluster.topic}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {cluster.summary}
                    </p>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {cluster.sources.slice(0, 3).map((source, i) => (
                        <span key={i} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {source}
                        </span>
                      ))}
                      {cluster.sources.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{cluster.sources.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default TrendingClusters;
