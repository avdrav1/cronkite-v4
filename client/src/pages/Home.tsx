import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { MasonryGrid } from "@/components/feed/MasonryGrid";
import { ArticleCard } from "@/components/feed/ArticleCard";
import { TrendingTopicCard, type TrendingCluster } from "@/components/feed/TrendingTopicCard";
import { TrendingClusterSheet } from "@/components/trending/TrendingClusterSheet";
import { ArticleSheet } from "@/components/article/ArticleSheet";
import { RefreshCw, AlertCircle, Star, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { apiRequest, apiFetch } from "@/lib/queryClient";
import { type Article } from "@shared/schema";

// Extended article type with feed information and UI state
interface ArticleWithFeed extends Article {
  // UI state fields
  isRead?: boolean;
  isStarred?: boolean;
  relevancyScore?: number;
  engagementSignal?: 'positive' | 'negative' | null;
  
  // Computed/display fields
  source?: string; // Feed name for display
  date?: string; // Formatted date for display
  readTime?: string; // Estimated read time
  imageUrl?: string; // Alias for image_url for compatibility
  
  // Feed information
  feed_name?: string;
  feed_url?: string;
  feed_icon?: string;
  feed_category?: string; // Category/folder_name for filtering
  
  // Cluster information for visual grouping (cluster_id inherited from Article)
  clusterTopic?: string;
  clusterColor?: string;
}

// Mixed feed item type (articles and trending topics)
interface FeedItem {
  type: 'article' | 'trending';
  data: ArticleWithFeed | TrendingCluster;
  id: string;
}

import { subDays, isAfter, isBefore, parseISO, differenceInDays } from "date-fns";
import { ArrowDown } from "lucide-react";

const CURRENT_DATE = new Date();
const CHUNK_SIZE_DAYS = 7;

// Color palette for cluster visual grouping - distinct, accessible colors
const CLUSTER_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

export default function Home() {
  const [selectedArticle, setSelectedArticle] = useState<ArticleWithFeed | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<TrendingCluster | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [historyDepth, setHistoryDepth] = useState(CHUNK_SIZE_DAYS);
  
  // Real data state
  const [articles, setArticles] = useState<ArticleWithFeed[]>([]);
  const [starredArticles, setStarredArticles] = useState<ArticleWithFeed[]>([]);
  const [readArticles, setReadArticles] = useState<ArticleWithFeed[]>([]);
  const [clusters, setClusters] = useState<TrendingCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStarred, setIsLoadingStarred] = useState(false);
  const [isLoadingRead, setIsLoadingRead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedsCount, setFeedsCount] = useState(0);
  
  // Track URL search params for filtering
  const [filterKey, setFilterKey] = useState(0); // Force re-render key
  
  // Use wouter's useLocation and useSearch for reactivity when URL changes
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  
  // Parse URL params reactively using wouter's useSearch
  const { sourceFilter, categoryFilter, urlFilter, articleIdFromUrl, clusterFilter } = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return {
      sourceFilter: params.get("source"),
      categoryFilter: params.get("category"),
      urlFilter: params.get("filter"), // "starred", "unread", or "read" from side nav
      articleIdFromUrl: params.get("article"), // Article ID from search result click
      clusterFilter: params.get("cluster") // Cluster ID for filtering by trending topic
    };
  }, [searchString, filterKey]);
  
  // Sync activeFilter with URL filter param
  useEffect(() => {
    if (urlFilter === "starred") {
      setActiveFilter("saved");
    } else if (urlFilter === "unread") {
      setActiveFilter("unread");
    } else if (urlFilter === "read") {
      setActiveFilter("read");
    } else if (!urlFilter && !sourceFilter && !categoryFilter) {
      setActiveFilter("all");
    }
  }, [urlFilter, sourceFilter, categoryFilter]);
  
  // Listen for custom filter change events from FeedsList
  useEffect(() => {
    const handleFilterChange = () => {
      console.log('Home: Filter change detected');
      setFilterKey(k => k + 1); // Force re-parse of URL params
    };
    window.addEventListener('feedFilterChange', handleFilterChange);
    window.addEventListener('popstate', handleFilterChange);
    return () => {
      window.removeEventListener('feedFilterChange', handleFilterChange);
      window.removeEventListener('popstate', handleFilterChange);
    };
  }, []);

  // Listen for trending cluster clicks from sidebar
  useEffect(() => {
    const handleOpenTrendingCluster = (event: CustomEvent) => {
      console.log('Home: Opening trending cluster from sidebar:', event.detail);
      setSelectedCluster(event.detail as TrendingCluster);
    };
    window.addEventListener('openTrendingCluster', handleOpenTrendingCluster as EventListener);
    return () => {
      window.removeEventListener('openTrendingCluster', handleOpenTrendingCluster as EventListener);
    };
  }, []);

  // Handle article ID from URL (from search results)
  useEffect(() => {
    if (articleIdFromUrl && articles.length > 0) {
      const article = articles.find(a => a.id === articleIdFromUrl);
      if (article) {
        setSelectedArticle(article);
        // Clear the article param from URL after opening
        setLocation("/", { replace: true });
      } else {
        // Article not in current list - fetch it directly
        const fetchArticleById = async () => {
          try {
            const response = await apiRequest('GET', `/api/articles/${articleIdFromUrl}`);
            const data = await response.json();
            if (data.article) {
              const articleWithState: ArticleWithFeed = {
                ...data.article,
                id: data.article.id,
                title: data.article.title,
                url: data.article.url,
                excerpt: data.article.excerpt || data.article.content?.substring(0, 200) + '...',
                content: data.article.content,
                author: data.article.author,
                date: data.article.published_at || data.article.created_at,
                published_at: data.article.published_at,
                source: data.article.feed_name || 'Unknown Source',
                image: data.article.image_url,
                imageUrl: data.article.image_url,
                readTime: Math.max(1, Math.floor((data.article.content?.length || 0) / 200)) + ' min read',
                relevancyScore: 75,
                tags: [],
                isRead: data.article.is_read || false,
                isStarred: data.article.is_starred || false,
                engagementSignal: data.article.engagement_signal || null,
                feed_name: data.article.feed_name,
                feed_url: data.article.feed_url,
                feed_icon: data.article.feed_icon,
                feed_category: data.article.feed_category || 'General'
              };
              setSelectedArticle(articleWithState);
              // Clear the article param from URL after opening
              setLocation("/", { replace: true });
            }
          } catch (err) {
            console.error('Failed to fetch article by ID:', err);
          }
        };
        fetchArticleById();
      }
    }
  }, [articleIdFromUrl, articles, setLocation]);

  // Fetch articles from API
  const fetchArticles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🚀 Starting fetchArticles...');
      
      // Fetch articles and clusters in parallel
      // Use apiFetch for clusters to handle auth errors gracefully
      const [articlesResponse, clustersResponse] = await Promise.all([
        apiRequest('GET', '/api/articles'),
        apiFetch('GET', '/api/clusters') // Use apiFetch to not throw on 401
      ]);
      
      console.log('🚀 Got responses - articles:', articlesResponse.status, 'clusters:', clustersResponse?.status);
      
      const data = await articlesResponse.json();
      
      if (!data.articles) {
        throw new Error('No articles data received');
      }
      
      // Log read state statistics
      const readCount = data.articles.filter((a: any) => a.is_read).length;
      const starredCount = data.articles.filter((a: any) => a.is_starred).length;
      console.log('📖 Articles loaded from API:', {
        total: data.articles.length,
        readCount,
        starredCount,
        readArticleIds: data.articles.filter((a: any) => a.is_read).map((a: any) => a.id?.substring(0, 8)),
        sampleReadStates: data.articles.slice(0, 10).map((a: any) => ({ 
          id: a.id?.substring(0, 8), 
          is_read: a.is_read 
        }))
      });
      
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
        engagementSignal: article.engagement_signal || null,
        // Feed information
        feed_name: article.feed_name,
        feed_url: article.feed_url,
        feed_icon: article.feed_icon,
        feed_category: article.feed_category || 'General' // Category for filtering
      }));
      
      setArticles(articlesWithState);
      setFeedsCount(data.feeds_count || 0);
      
      // Process clusters if available - use real data only, no mock fallback
      if (clustersResponse) {
        try {
          // Check if response is OK before parsing
          if (!clustersResponse.ok) {
            console.log('⚠️ Clusters API returned non-OK status:', clustersResponse.status);
            const errorText = await clustersResponse.text();
            console.log('⚠️ Clusters API error response:', errorText);
            if (clustersResponse.status === 401) {
              console.log('ℹ️ Clusters require authentication - user may need to re-login');
            }
            setClusters([]);
          } else {
            const clustersData = await clustersResponse.json();
            console.log('📊 Clusters API response:', {
              status: clustersResponse.status,
              hasClusters: !!clustersData.clusters,
              clusterCount: clustersData.clusters?.length || 0,
              method: clustersData.method,
              cached: clustersData.cached,
              message: clustersData.message,
              error: clustersData.error
            });
            
            if (clustersData.clusters && clustersData.clusters.length > 0) {
              setClusters(clustersData.clusters);
              console.log(`✅ Loaded ${clustersData.clusters.length} trending clusters from API`);
              // Debug: log articleIds for each cluster
              clustersData.clusters.forEach((c: any) => {
                console.log(`📊 Cluster "${c.topic}": ${c.articleCount} articles, articleIds:`, c.articleIds?.slice(0, 5) || 'none');
              });
            } else {
              // No clusters available - this is fine, just don't show trending cards
              console.log('ℹ️ No trending clusters available from API:', clustersData.message || 'No message');
              setClusters([]);
            }
          }
        } catch (e) {
          console.error('❌ Clusters parsing error:', e);
          setClusters([]);
        }
      } else {
        // No clusters response at all (API call failed)
        console.log('⚠️ Clusters API call failed or returned null');
        setClusters([]);
      }
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

  // Fetch starred articles from API - Requirements: 7.3
  const fetchStarredArticles = async () => {
    try {
      setIsLoadingStarred(true);
      setStarredArticles([]); // Clear previous starred articles
      console.log('⭐ Fetching starred articles...');
      
      // Use apiFetch instead of apiRequest to handle errors gracefully
      const response = await apiFetch('GET', '/api/articles/starred');
      
      console.log('⭐ Starred articles response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('⭐ Starred articles API error:', response.status, errorText);
        return;
      }
      
      const data = await response.json();
      
      console.log('⭐ Starred articles API response:', {
        hasArticles: !!data.articles,
        count: data.articles?.length || 0,
        total: data.total,
        firstArticle: data.articles?.[0]?.title?.substring(0, 50)
      });
      
      if (data.articles && data.articles.length > 0) {
        const starredWithState: ArticleWithFeed[] = data.articles.map((article: any) => ({
          ...article,
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
          imageUrl: article.image_url,
          readTime: Math.max(1, Math.floor((article.content?.length || 0) / 200)) + ' min read',
          relevancyScore: 75,
          tags: [],
          isRead: article.is_read || false,
          isStarred: true, // These are starred articles
          engagementSignal: article.engagement_signal || null,
          feed_name: article.feed_name,
          feed_url: article.feed_url,
          feed_icon: article.feed_icon,
          feed_category: article.feed_category || 'General' // Category for filtering
        }));
        setStarredArticles(starredWithState);
        console.log('⭐ Set starred articles state:', starredWithState.length, 'articles');
      } else {
        console.log('⭐ No starred articles in response');
        setStarredArticles([]);
      }
    } catch (error) {
      console.error('Failed to fetch starred articles:', error);
      setStarredArticles([]);
    } finally {
      setIsLoadingStarred(false);
    }
  };

  // Fetch starred articles when filter changes to "saved"
  useEffect(() => {
    if (activeFilter === "saved") {
      fetchStarredArticles();
    }
  }, [activeFilter]);

  // Fetch read articles from API - Requirements: 6.1, 6.2
  const fetchReadArticles = async () => {
    try {
      setIsLoadingRead(true);
      setReadArticles([]); // Clear previous read articles
      console.log('📖 Fetching read articles...');
      
      // Use apiFetch instead of apiRequest to handle errors gracefully
      const response = await apiFetch('GET', '/api/articles/read');
      
      console.log('📖 Read articles response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('📖 Read articles API error:', response.status, errorText);
        return;
      }
      
      const data = await response.json();
      
      console.log('📖 Read articles API response:', {
        hasArticles: !!data.articles,
        count: data.articles?.length || 0,
        total: data.total,
        firstArticle: data.articles?.[0]?.title?.substring(0, 50)
      });
      
      if (data.articles && data.articles.length > 0) {
        const readWithState: ArticleWithFeed[] = data.articles.map((article: any) => ({
          ...article,
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
          imageUrl: article.image_url,
          readTime: Math.max(1, Math.floor((article.content?.length || 0) / 200)) + ' min read',
          relevancyScore: 75,
          tags: [],
          isRead: true, // These are read articles
          isStarred: article.is_starred || false,
          engagementSignal: article.engagement_signal || null,
          feed_name: article.feed_name,
          feed_url: article.feed_url,
          feed_icon: article.feed_icon,
          feed_category: article.feed_category || 'General' // Category for filtering
        }));
        setReadArticles(readWithState);
        console.log('📖 Set read articles state:', readWithState.length, 'articles');
      } else {
        console.log('📖 No read articles in response');
        setReadArticles([]);
      }
    } catch (error) {
      console.error('Failed to fetch read articles:', error);
      setReadArticles([]);
    } finally {
      setIsLoadingRead(false);
    }
  };

  // Fetch read articles when filter changes to "read"
  useEffect(() => {
    if (activeFilter === "read") {
      fetchReadArticles();
    }
  }, [activeFilter]);

  // Create feed with articles and interspersed trending topics
  const createMixedFeed = (articles: ArticleWithFeed[], clusters: TrendingCluster[]): FeedItem[] => {
    console.log('🔄 createMixedFeed called:', { articlesCount: articles.length, clustersCount: clusters.length });
    
    const articleItems: FeedItem[] = articles.map(article => ({
      type: 'article' as const,
      data: article,
      id: article.id
    }));
    
    // If no clusters or filtering by source/category, just return articles
    if (clusters.length === 0 || sourceFilter || categoryFilter) {
      console.log('🔄 Returning articles only (no clusters or filtering active)');
      return articleItems;
    }
    
    // Intersperse trending topic cards every 4-6 articles
    const result: FeedItem[] = [];
    let clusterIndex = 0;
    const insertInterval = 5; // Insert a trending card every 5 articles
    
    articleItems.forEach((item, index) => {
      result.push(item);
      
      // Insert a trending topic card after every `insertInterval` articles
      if ((index + 1) % insertInterval === 0 && clusterIndex < clusters.length) {
        result.push({
          type: 'trending' as const,
          data: clusters[clusterIndex],
          id: `trending-${clusters[clusterIndex].id}`
        });
        clusterIndex++;
      }
    });
    
    console.log('🔄 Mixed feed created:', { totalItems: result.length, trendingCards: clusterIndex });
    return result;
  };

  // Actions
  const handleRemoveArticle = (id: string) => {
    setArticles(prev => prev.filter(article => article.id !== id));
  };

  // Called after ArticleCard successfully updates star state via API
  const handleStarChange = (id: string, isStarred: boolean) => {
    // Update main articles list with the actual new state (not toggling)
    setArticles(prev => prev.map(article => {
      if (article.id === id) {
        return { ...article, isStarred };
      }
      return article;
    }));
    // Also update starred articles list if we're viewing it
    if (activeFilter === "saved") {
      // Refetch starred articles to get accurate list
      fetchStarredArticles();
    }
    // Also update read articles list if we're viewing it
    setReadArticles(prev => prev.map(article => {
      if (article.id === id) {
        return { ...article, isStarred };
      }
      return article;
    }));
  };

  // Called after ArticleCard successfully updates engagement signal via API
  const handleEngagementChange = (id: string, signal: 'positive' | 'negative' | null) => {
    setArticles(prev => prev.map(article => {
      if (article.id === id) {
        return { ...article, engagementSignal: signal };
      }
      return article;
    }));
    // Also update starred articles if viewing that filter
    setStarredArticles(prev => prev.map(article => {
      if (article.id === id) {
        return { ...article, engagementSignal: signal };
      }
      return article;
    }));
    // Also update read articles if viewing that filter
    setReadArticles(prev => prev.map(article => {
      if (article.id === id) {
        return { ...article, engagementSignal: signal };
      }
      return article;
    }));
  };

  const handleArticleClick = async (article: ArticleWithFeed) => {
    setSelectedArticle(article);
    
    // Mark as read locally first for immediate UI feedback
    setArticles(prev => prev.map(item => {
      if (item.id === article.id) {
        return { ...item, isRead: true };
      }
      return item;
    }));
    
    // Also add to readArticles if not already there (for immediate "Read" tab update)
    setReadArticles(prev => {
      const exists = prev.some(a => a.id === article.id);
      if (!exists) {
        return [{ ...article, isRead: true }, ...prev];
      }
      return prev;
    });
    
    // Persist read state to database
    try {
      console.log('📖 Marking article as read:', article.id);
      const response = await apiRequest('PUT', `/api/articles/${article.id}/read`, { isRead: true });
      const result = await response.json();
      console.log('📖 Mark as read response:', result);
      
      if (!result.success) {
        console.error('📖 Mark as read failed:', result.error, result.message);
      }
    } catch (error) {
      console.error('📖 Failed to mark article as read:', error);
      // Don't revert UI state - the article was opened, so it's effectively "read"
    }
  };

  // Create feed
  // Build cluster map for visual grouping - maps cluster ID to topic and color
  const clusterMap = useMemo(() => {
    const map = new Map<string, { topic: string; color: string }>();
    clusters.forEach((cluster, index) => {
      map.set(cluster.id, {
        topic: cluster.topic,
        color: CLUSTER_COLORS[index % CLUSTER_COLORS.length]
      });
    });
    return map;
  }, [clusters]);

  // Build a reverse map: article ID -> cluster info (for visual grouping)
  const articleToClusterMap = useMemo(() => {
    const map = new Map<string, { clusterId: string; topic: string; color: string }>();
    clusters.forEach((cluster, index) => {
      const color = CLUSTER_COLORS[index % CLUSTER_COLORS.length];
      // Use articleIds from cluster to map articles to their cluster
      if (cluster.articleIds && cluster.articleIds.length > 0) {
        cluster.articleIds.forEach(articleId => {
          map.set(articleId, {
            clusterId: cluster.id,
            topic: cluster.topic,
            color
          });
        });
      }
    });
    console.log('📊 Built articleToClusterMap with', map.size, 'article mappings');
    return map;
  }, [clusters]);

  // Enrich articles with cluster info for visual grouping
  const enrichedArticles = useMemo(() => {
    return articles.map(article => {
      // First check if article has cluster_id set directly
      if (article.cluster_id && clusterMap.has(article.cluster_id)) {
        const clusterInfo = clusterMap.get(article.cluster_id)!;
        return {
          ...article,
          clusterTopic: clusterInfo.topic,
          clusterColor: clusterInfo.color
        };
      }
      // Otherwise check if article is in any cluster's articleIds
      if (articleToClusterMap.has(article.id)) {
        const clusterInfo = articleToClusterMap.get(article.id)!;
        return {
          ...article,
          cluster_id: clusterInfo.clusterId,
          clusterTopic: clusterInfo.topic,
          clusterColor: clusterInfo.color
        };
      }
      return article;
    });
  }, [articles, clusterMap, articleToClusterMap]);

  const enrichedStarredArticles = useMemo(() => {
    return starredArticles.map(article => {
      if (article.cluster_id && clusterMap.has(article.cluster_id)) {
        const clusterInfo = clusterMap.get(article.cluster_id)!;
        return {
          ...article,
          clusterTopic: clusterInfo.topic,
          clusterColor: clusterInfo.color
        };
      }
      if (articleToClusterMap.has(article.id)) {
        const clusterInfo = articleToClusterMap.get(article.id)!;
        return {
          ...article,
          cluster_id: clusterInfo.clusterId,
          clusterTopic: clusterInfo.topic,
          clusterColor: clusterInfo.color
        };
      }
      return article;
    });
  }, [starredArticles, clusterMap, articleToClusterMap]);

  const enrichedReadArticles = useMemo(() => {
    return readArticles.map(article => {
      if (article.cluster_id && clusterMap.has(article.cluster_id)) {
        const clusterInfo = clusterMap.get(article.cluster_id)!;
        return {
          ...article,
          clusterTopic: clusterInfo.topic,
          clusterColor: clusterInfo.color
        };
      }
      if (articleToClusterMap.has(article.id)) {
        const clusterInfo = articleToClusterMap.get(article.id)!;
        return {
          ...article,
          cluster_id: clusterInfo.clusterId,
          clusterTopic: clusterInfo.topic,
          clusterColor: clusterInfo.color
        };
      }
      return article;
    });
  }, [readArticles, clusterMap]);

  // Use starred/read articles from API when filter is "saved"/"read" - Requirements: 6.1, 6.2, 7.3
  const articlesToUse = activeFilter === "saved" 
    ? enrichedStarredArticles 
    : activeFilter === "read" 
      ? enrichedReadArticles 
      : enrichedArticles;
  console.log('📋 Creating feed:', {
    activeFilter,
    articlesToUseCount: articlesToUse.length,
    isUsingStarred: activeFilter === "saved",
    isUsingRead: activeFilter === "read",
    starredArticlesCount: starredArticles.length,
    readArticlesCount: readArticles.length
  });
  const mixedFeed = createMixedFeed(articlesToUse, clusters);

  // Base filtering (Source + Category + Status + Cluster)
  // Build a set of article IDs for the active cluster filter (for efficient lookup)
  const clusterArticleIds = useMemo(() => {
    if (!clusterFilter) return null;
    const cluster = clusters.find(c => c.id === clusterFilter);
    console.log('🔍 Cluster filter debug:', {
      clusterFilter,
      foundCluster: cluster?.topic,
      clusterArticleIds: cluster?.articleIds,
      articleIdsLength: cluster?.articleIds?.length
    });
    if (!cluster || !cluster.articleIds || cluster.articleIds.length === 0) {
      // Fallback: use articleToClusterMap to find articles
      const articleIds: string[] = [];
      articleToClusterMap.forEach((info, articleId) => {
        if (info.clusterId === clusterFilter) {
          articleIds.push(articleId);
        }
      });
      if (articleIds.length > 0) {
        console.log('🔍 Using articleToClusterMap fallback, found', articleIds.length, 'articles');
        return new Set(articleIds);
      }
      return null;
    }
    return new Set(cluster.articleIds);
  }, [clusterFilter, clusters, articleToClusterMap]);

  // Debug: Log when cluster filter is active
  if (clusterFilter) {
    const matchingArticles = articlesToUse.filter(a => clusterArticleIds?.has(a.id));
    console.log('🔍 Active cluster filter:', {
      clusterFilter,
      clusterArticleIdsSet: clusterArticleIds ? Array.from(clusterArticleIds) : null,
      totalArticlesInFeed: articlesToUse.length,
      matchingArticlesCount: matchingArticles.length,
      sampleFeedArticleIds: articlesToUse.slice(0, 10).map(a => a.id),
      matchingArticleTitles: matchingArticles.slice(0, 3).map(a => a.title?.substring(0, 50))
    });
  }

  const baseFilteredFeed = mixedFeed.filter((item) => {
    // Trending items pass through unless we're filtering by source/category/cluster
    if (item.type === 'trending') {
      // Hide trending cards when filtering by specific source, category, or cluster
      if (sourceFilter || categoryFilter || clusterFilter) return false;
      // Hide trending cards when filtering by status
      if (activeFilter !== "all") return false;
      return true;
    }
    
    const article = item.data as ArticleWithFeed;
    
    // 0. Cluster Filter (filter by trending topic cluster)
    // Use the cluster's articleIds array instead of article.cluster_id
    if (clusterFilter && clusterArticleIds) {
      // Only show articles that are in this cluster's articleIds
      if (!clusterArticleIds.has(article.id)) return false;
    }
    
    // 1. Source Filter (specific feed name) - EXACT match
    if (sourceFilter) {
      // Match against the article's source (feed name)
      const articleSource = article.source || article.feed_name || '';
      const matchesSource = articleSource.toLowerCase() === sourceFilter.toLowerCase();
      if (!matchesSource) return false;
    }

    // 2. Category Filter (filter by feed category/folder_name)
    if (categoryFilter) {
      const articleCategory = article.feed_category || 'General';
      const matchesCategory = articleCategory.toLowerCase() === categoryFilter.toLowerCase();
      if (!matchesCategory) return false;
    }

    // 3. Status Filter (only apply for unread filter since starred/read use API)
    if (activeFilter === "unread" && article.isRead) return false;
    // Note: "saved" and "read" filters now use API data, so no client-side filter needed
    
    return true;
  });

  // Calculate visible feed based on history depth
  const visibleFeed = baseFilteredFeed.filter((item) => {
    // Trending items always pass through
    if (item.type === 'trending') return true;
    
    // Starred and read articles bypass date filtering - show all regardless of date
    if (activeFilter === "saved" || activeFilter === "read") return true;
    
    // When filtering by specific source or category, bypass date filtering
    // This ensures users see all articles from their selected feed, not just recent ones
    if (sourceFilter || categoryFilter || clusterFilter) return true;
    
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
    // Don't count trending items
    if (item.type === 'trending') return false;
    
    const article = item.data as ArticleWithFeed;
    if (!article.date) return false;
    const articleDate = parseISO(article.date);
    return isAfter(articleDate, nextChunkStartDate) && isBefore(articleDate, nextChunkEndDate);
  }).length;

  const handleLoadMore = () => {
    setHistoryDepth(prev => prev + CHUNK_SIZE_DAYS);
  };

  // Loading state - Requirement 2.6
  if (isLoading || (activeFilter === "saved" && isLoadingStarred) || (activeFilter === "read" && isLoadingRead)) {
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
                {clusterFilter 
                  ? clusters.find(c => c.id === clusterFilter)?.topic || "Trending Topic"
                  : sourceFilter 
                    ? sourceFilter 
                    : categoryFilter 
                      ? categoryFilter 
                      : "For You"}
              </h1>
              <p className="text-muted-foreground">
                {clusterFilter
                  ? `${visibleFeed.length} articles about this trending topic`
                  : sourceFilter 
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
                 onClick={() => {
                   setActiveFilter("all");
                   setLocation("/");
                 }} 
               />
               <FilterButton 
                 label="Unread" 
                 active={activeFilter === "unread"} 
                 onClick={() => {
                   setActiveFilter("unread");
                   setLocation("/?filter=unread");
                 }} 
               />
               <FilterButton 
                 label="Read" 
                 active={activeFilter === "read"} 
                 onClick={() => {
                   setActiveFilter("read");
                   setLocation("/?filter=read");
                 }} 
               />
               <FilterButton 
                 label="Starred" 
                 active={activeFilter === "saved"} 
                 onClick={() => {
                   setActiveFilter("saved");
                   setLocation("/?filter=starred");
                 }} 
               />
            </div>
          </div>
        </div>

        {/* Masonry Feed */}
        {visibleFeed.length === 0 && activeFilter === "saved" ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Star className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No starred articles yet</h3>
            <p className="text-muted-foreground max-w-md">
              Star articles you want to save for later by clicking the star icon on any article card.
            </p>
          </div>
        ) : visibleFeed.length === 0 && activeFilter === "read" ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No read articles yet</h3>
            <p className="text-muted-foreground max-w-md">
              Articles you've opened will appear here. Click on any article to mark it as read.
            </p>
          </div>
        ) : visibleFeed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No articles found</h3>
            <p className="text-muted-foreground max-w-md">
              Try adjusting your filters or check back later for new content.
            </p>
          </div>
        ) : (
          <MasonryGrid>
          {visibleFeed.map((item, index) => {
            if (item.type === 'trending') {
              const cluster = item.data as TrendingCluster;
              // Alternate between different card variants for visual variety
              const variantIndex = visibleFeed.filter((i, idx) => i.type === 'trending' && idx < index).length;
              const variants: Array<"compact" | "expanded" | "summary"> = ["summary", "expanded", "compact"];
              const variant = variants[variantIndex % variants.length];
              
              return (
                <TrendingTopicCard
                  key={item.id}
                  cluster={cluster}
                  variant={variant}
                  onClick={(c) => setSelectedCluster(c)}
                />
              );
            }
            
            const article = item.data as ArticleWithFeed;
            return (
              <ArticleCard
                key={item.id}
                article={article as any} // Type assertion for compatibility
                onClick={(a) => handleArticleClick(a as ArticleWithFeed)}
                onRemove={handleRemoveArticle}
                onStar={handleStarChange}
                onEngagementChange={handleEngagementChange}
              />
            );
          })}
        </MasonryGrid>
        )}

        {/* Load More Button - only show when not filtering by source/category/cluster */}
        {!sourceFilter && !categoryFilter && !clusterFilter && activeFilter !== "saved" && activeFilter !== "read" && (
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
        )}
      </div>

      {/* Article Sheet */}
      <ArticleSheet
        article={selectedArticle as any} // Type assertion for compatibility
        isOpen={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />

      {/* Trending Cluster Sheet */}
      <TrendingClusterSheet
        cluster={selectedCluster}
        isOpen={!!selectedCluster}
        onClose={() => setSelectedCluster(null)}
        allArticles={articles}
        onArticleClick={(articleId) => {
          // Find the article and open it
          const article = articles.find(a => a.id === articleId);
          if (article) {
            setSelectedCluster(null);
            setSelectedArticle(article);
          }
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
