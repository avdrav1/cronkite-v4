import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  RefreshCw,
  Cpu,
  Search,
  Layers,
  TrendingUp,
  Clock,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format, formatDistanceToNow } from "date-fns";

interface UsageStats {
  daily: {
    embeddings: number;
    clusterings: number;
    searches: number;
    totalTokens: number;
    estimatedCost: number;
  };
  limits: {
    embeddingsPerDay: number;
    clusteringsPerDay: number;
    searchesPerDay: number;
  };
  resetAt: string;
}

interface AIStatus {
  embeddingService: {
    available: boolean;
    pendingCount: number;
    completedToday: number;
  };
  clusteringService: {
    available: boolean;
    lastRun: string | null;
    clustersActive: number;
  };
  searchService: {
    available: boolean;
    queriesProcessed: number;
  };
}

/**
 * AIUsageSettings component displays AI usage statistics and remaining limits.
 * 
 * Requirements: 8.6
 * - Show daily usage statistics
 * - Display remaining limits
 */
export function AIUsageSettings() {
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch both usage stats and AI status in parallel
      const [usageResponse, statusResponse] = await Promise.all([
        apiRequest('GET', '/api/ai/usage'),
        apiRequest('GET', '/api/ai/status')
      ]);

      const usageData = await usageResponse.json();
      const statusData = await statusResponse.json();

      setUsageStats(usageData);
      setAIStatus(statusData);
    } catch (err) {
      console.error('Failed to fetch AI data:', err);
      setError('Unable to load AI usage data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate usage percentages
  const getUsagePercentage = (used: number, limit: number): number => {
    if (limit === 0) return 0;
    return Math.min(100, (used / limit) * 100);
  };

  // Get color based on usage percentage
  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return "text-red-500";
    if (percentage >= 70) return "text-amber-500";
    return "text-emerald-500";
  };

  // Format cost
  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Features
          </h2>
          <p className="text-muted-foreground">Loading AI usage data...</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Features
          </h2>
          <p className="text-muted-foreground">Failed to load AI data</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchData} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const embeddingPercentage = usageStats ? getUsagePercentage(usageStats.daily.embeddings, usageStats.limits.embeddingsPerDay) : 0;
  const clusteringPercentage = usageStats ? getUsagePercentage(usageStats.daily.clusterings, usageStats.limits.clusteringsPerDay) : 0;
  const searchPercentage = usageStats ? getUsagePercentage(usageStats.daily.searches, usageStats.limits.searchesPerDay) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              AI Features
            </h2>
            <p className="text-muted-foreground">Monitor your AI usage and service status</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Service Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Embedding Service Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                Embeddings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={aiStatus?.embeddingService.available ? "default" : "destructive"}>
                  {aiStatus?.embeddingService.available ? "Online" : "Offline"}
                </Badge>
              </div>
              <div className="text-2xl font-bold">
                {aiStatus?.embeddingService.completedToday || 0}
              </div>
              <p className="text-xs text-muted-foreground">processed today</p>
              {(aiStatus?.embeddingService.pendingCount ?? 0) > 0 && (
                <p className="text-xs text-amber-500 mt-1">
                  {aiStatus?.embeddingService.pendingCount} pending
                </p>
              )}
            </CardContent>
          </Card>


          {/* Clustering Service Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Clustering
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={aiStatus?.clusteringService.available ? "default" : "destructive"}>
                  {aiStatus?.clusteringService.available ? "Online" : "Offline"}
                </Badge>
              </div>
              <div className="text-2xl font-bold">
                {aiStatus?.clusteringService.clustersActive || 0}
              </div>
              <p className="text-xs text-muted-foreground">active clusters</p>
              {aiStatus?.clusteringService.lastRun && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last run: {formatDistanceToNow(new Date(aiStatus.clusteringService.lastRun), { addSuffix: true })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Search Service Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                Semantic Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={aiStatus?.searchService.available ? "default" : "destructive"}>
                  {aiStatus?.searchService.available ? "Online" : "Offline"}
                </Badge>
              </div>
              <div className="text-2xl font-bold">
                {aiStatus?.searchService.queriesProcessed || 0}
              </div>
              <p className="text-xs text-muted-foreground">queries today</p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Daily Usage Section - Requirements: 8.6 */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Daily Usage
          </h3>
          
          {usageStats && (
            <div className="space-y-6">
              {/* Embeddings Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    Embeddings
                  </span>
                  <span className={cn("font-medium", getUsageColor(embeddingPercentage))}>
                    {usageStats.daily.embeddings} / {usageStats.limits.embeddingsPerDay}
                  </span>
                </div>
                <Progress value={embeddingPercentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {usageStats.limits.embeddingsPerDay - usageStats.daily.embeddings} remaining today
                </p>
              </div>

              {/* Clustering Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    Cluster Generations
                  </span>
                  <span className={cn("font-medium", getUsageColor(clusteringPercentage))}>
                    {usageStats.daily.clusterings} / {usageStats.limits.clusteringsPerDay}
                  </span>
                </div>
                <Progress value={clusteringPercentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {usageStats.limits.clusteringsPerDay - usageStats.daily.clusterings} remaining today
                </p>
              </div>

              {/* Search Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    Semantic Searches
                  </span>
                  <span className={cn("font-medium", getUsageColor(searchPercentage))}>
                    {usageStats.daily.searches} / {usageStats.limits.searchesPerDay}
                  </span>
                </div>
                <Progress value={searchPercentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {usageStats.limits.searchesPerDay - usageStats.daily.searches} remaining today
                </p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Token & Cost Summary */}
        {usageStats && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Usage Summary
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {usageStats.daily.totalTokens.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground">Tokens used today</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {formatCost(usageStats.daily.estimatedCost)}
                  </div>
                  <p className="text-sm text-muted-foreground">Estimated cost today</p>
                </CardContent>
              </Card>
            </div>

            {/* Reset Time */}
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Limits reset {formatDistanceToNow(new Date(usageStats.resetAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIUsageSettings;
