import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, X, FileText, Clock, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SearchResultArticle {
  id: string;
  title: string;
  excerpt?: string;
  feedName: string;
  publishedAt: string;
  relevanceScore: number;
  imageUrl?: string;
}

interface SearchResult {
  articles: SearchResultArticle[];
  query: string;
  totalResults: number;
  processingTimeMs: number;
  fallbackUsed: boolean;
}

interface SemanticSearchProps {
  className?: string;
  onArticleClick?: (articleId: string) => void;
  placeholder?: string;
}

/**
 * SemanticSearch component provides natural language search using AI embeddings.
 * 
 * Requirements: 5.1, 5.4, 5.6
 * - Convert search query to embedding using OpenAI
 * - Display search results with relevance scores
 * - Handle loading and error states
 * - Handle empty query (return default feed)
 */
export function SemanticSearch({ className, onArticleClick, placeholder = "Search articles..." }: SemanticSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setIsOpen(true);

      const response = await apiRequest('GET', `/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      setResults({
        articles: data.articles || [],
        query: data.query || searchQuery,
        totalResults: data.totalResults || 0,
        processingTimeMs: data.processingTimeMs || 0,
        fallbackUsed: data.fallbackUsed || false
      });
    } catch (err) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search by 300ms
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Handle form submit (immediate search)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    performSearch(query);
  };

  // Clear search
  const handleClear = () => {
    setQuery("");
    setResults(null);
    setIsOpen(false);
    setError(null);
    inputRef.current?.focus();
  };

  // Handle article click
  const handleArticleClick = (articleId: string) => {
    setIsOpen(false);
    onArticleClick?.(articleId);
  };

  // Format relevance score as percentage
  const formatRelevance = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  // Get color class based on relevance score
  const getRelevanceColor = (score: number): string => {
    if (score >= 0.8) return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10";
    if (score >= 0.6) return "text-blue-600 dark:text-blue-400 bg-blue-500/10";
    return "text-amber-600 dark:text-amber-400 bg-amber-500/10";
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form onSubmit={handleSubmit} className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => results && setIsOpen(true)}
          placeholder={placeholder}
          className="pl-10 pr-10 h-11 bg-muted/50 border-transparent focus:bg-background focus:border-primary/20 transition-all rounded-full shadow-sm hover:bg-muted/80 w-full"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
        )}
        {!isLoading && query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>


      {/* Search Results Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-lg overflow-hidden z-50"
          >
            {error ? (
              <div className="p-4 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                <p className="text-sm">{error}</p>
              </div>
            ) : results ? (
              <>
                {/* Results Header */}
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {results.totalResults} result{results.totalResults !== 1 ? 's' : ''}
                      </span>
                      {results.fallbackUsed && (
                        <Badge variant="secondary" className="text-xs">
                          Text search
                        </Badge>
                      )}
                      {!results.fallbackUsed && (
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-none">
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI-powered
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {results.processingTimeMs}ms
                    </span>
                  </div>
                </div>

                {/* Results List */}
                {results.articles.length > 0 ? (
                  <ScrollArea className="max-h-[400px]">
                    <div className="p-2">
                      {results.articles.slice(0, 10).map((article, index) => (
                        <motion.button
                          key={article.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 }}
                          onClick={() => handleArticleClick(article.id)}
                          className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex gap-3">
                            {article.imageUrl && (
                              <div className="h-12 w-12 shrink-0 rounded-md overflow-hidden bg-muted">
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
                                
                                {/* Relevance score - Requirements: 5.4 */}
                                <span className={cn(
                                  "text-xs font-medium px-1.5 py-0.5 rounded",
                                  getRelevanceColor(article.relevanceScore)
                                )}>
                                  {formatRelevance(article.relevanceScore)}
                                </span>
                                
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
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
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No articles found for "{results.query}"</p>
                    <p className="text-xs mt-1">Try different keywords or check your subscribed feeds</p>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 text-center text-muted-foreground text-sm">
                <Sparkles className="h-6 w-6 mx-auto mb-2 text-primary opacity-50" />
                <p>Start typing to search your articles</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SemanticSearch;
