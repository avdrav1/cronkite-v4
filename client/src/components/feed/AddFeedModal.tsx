import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Globe, Plus, Check, Link as LinkIcon, RefreshCw, X, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useInvalidateFeedsQuery } from "@/hooks/useFeedsQuery";

interface RecommendedFeed {
  id: string;
  name: string;
  url: string;
  description: string | null;
  category: string;
  is_featured: boolean;
  country: string | null;
  language: string;
  tags: string[] | null;
}

interface AddFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFeedAdded?: () => void;
}

export function AddFeedModal({ isOpen, onClose, onFeedAdded }: AddFeedModalProps) {
  const [activeTab, setActiveTab] = useState("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [addedFeeds, setAddedFeeds] = useState<string[]>([]);
  const { toast } = useToast();
  const invalidateFeedsQuery = useInvalidateFeedsQuery();

  // Database feeds state
  const [allFeeds, setAllFeeds] = useState<RecommendedFeed[]>([]);
  const [isLoadingFeeds, setIsLoadingFeeds] = useState(false);
  const [feedsError, setFeedsError] = useState<string | null>(null);

  // Custom URL State
  const [customUrl, setCustomUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isValidFeed, setIsValidFeed] = useState(false);
  const [feedDetails, setFeedDetails] = useState<{ name: string; description?: string } | null>(null);

  // Fetch feeds from database when modal opens
  useEffect(() => {
    if (isOpen && allFeeds.length === 0) {
      fetchRecommendedFeeds();
    }
  }, [isOpen]);

  const fetchRecommendedFeeds = async () => {
    try {
      setIsLoadingFeeds(true);
      setFeedsError(null);
      const response = await apiRequest('GET', '/api/feeds/recommended?limit=1000');
      const data = await response.json();
      if (data.feeds) {
        setAllFeeds(data.feeds);
      }
    } catch (error) {
      console.error('Failed to fetch recommended feeds:', error);
      setFeedsError('Failed to load feeds. Please try again.');
    } finally {
      setIsLoadingFeeds(false);
    }
  };

  // Build dynamic categories from fetched feeds
  const dynamicCategories = useMemo(() => {
    const categoryMap = new Map<string, number>();
    allFeeds.forEach(feed => {
      categoryMap.set(feed.category, (categoryMap.get(feed.category) || 0) + 1);
    });
    
    // Sort by count descending
    const sorted = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ id: name, label: name, count }));
    
    return sorted;
  }, [allFeeds]);

  // Filter feeds based on search and category
  const filteredFeeds = useMemo(() => {
    // Require category selection before showing feeds
    if (!selectedCategory) {
      return [];
    }

    let feeds = allFeeds.filter(feed => feed.category === selectedCategory);
    
    // Then filter by search
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      feeds = feeds.filter(feed => 
        feed.name.toLowerCase().includes(searchLower) || 
        (feed.description?.toLowerCase().includes(searchLower)) ||
        feed.category.toLowerCase().includes(searchLower) ||
        (feed.tags?.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }
    
    // Sort: featured first, then by name
    return feeds.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [allFeeds, searchQuery, selectedCategory]);

  const handleQuickAdd = async (feedId: string, feedName: string, category: string, feedUrl: string) => {
    try {
      // Subscribe using the feed URL (the backend will look up the UUID)
      await apiRequest('POST', '/api/feeds/subscribe-by-url', {
        url: feedUrl,
        name: feedName,
        category: category
      });
      
      setAddedFeeds(prev => [...prev, feedId]);
      
      // Invalidate the user feeds query to update sidebar immediately
      // Requirements: 5.1 - Add feed to sidebar without page refresh
      invalidateFeedsQuery();
      
      toast({
        title: "Feed Added",
        description: `${feedName} has been added to your ${category} folder.`,
        duration: 3000,
      });
      
      // Notify parent component
      onFeedAdded?.();
    } catch (error) {
      console.error('Failed to add feed:', error);
      toast({
        variant: "destructive",
        title: "Failed to Add Feed",
        description: error instanceof Error ? error.message : "An error occurred while adding the feed.",
        duration: 5000,
      });
    }
  };

  const validateCustomUrl = async () => {
    if (!customUrl) return;
    setIsValidating(true);
    setIsValidFeed(false);
    
    try {
      // Call API to validate the custom feed URL
      const response = await apiRequest('POST', '/api/feeds/validate', {
        url: customUrl
      });
      
      const data = await response.json();
      
      if (data.valid) {
        setIsValidFeed(true);
        setFeedDetails({
          name: data.name || "Custom Feed",
          description: data.description || "This is a valid RSS feed found at the provided URL."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Invalid Feed",
          description: data.message || "Could not find a valid RSS or Atom feed at this URL.",
        });
      }
    } catch (error) {
      console.error('Feed validation error:', error);
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: error instanceof Error ? error.message : "Failed to validate the feed URL.",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleAddCustomFeed = async () => {
    if (!feedDetails || !customUrl) return;
    
    try {
      // Add the custom feed
      const response = await apiRequest('POST', '/api/feeds/custom', {
        url: customUrl,
        name: feedDetails.name,
        description: feedDetails.description
      });
      
      const data = await response.json();
      
      // Subscribe to the newly added feed
      await apiRequest('POST', '/api/feeds/subscribe', {
        feedIds: [data.feedId]
      });
      
      // Invalidate the user feeds query to update sidebar immediately
      // Requirements: 5.1 - Add feed to sidebar without page refresh
      invalidateFeedsQuery();
      
      toast({
        title: "Feed Added",
        description: `${feedDetails.name} added successfully.`,
      });
      
      onClose();
      
      // Reset state
      setCustomUrl("");
      setIsValidFeed(false);
      setFeedDetails(null);
      
      // Notify parent component
      onFeedAdded?.();
    } catch (error) {
      console.error('Failed to add custom feed:', error);
      toast({
        variant: "destructive",
        title: "Failed to Add Feed",
        description: error instanceof Error ? error.message : "An error occurred while adding the custom feed.",
        duration: 5000,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden gap-0 border-border bg-background shadow-2xl max-h-[90vh] flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
        <div className="p-6 pb-2 border-b border-border bg-background/50 backdrop-blur-sm shrink-0">
          <DialogHeader className="flex flex-row items-center justify-between mb-4 space-y-0">
            <DialogTitle className="text-xl font-display font-bold">Add Feed</DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="browse" className="gap-2">
                <Globe className="h-4 w-4" /> Browse
              </TabsTrigger>
              <TabsTrigger value="custom" className="gap-2">
                <LinkIcon className="h-4 w-4" /> Custom URL
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-hidden bg-background min-h-0">
          {activeTab === "browse" && (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Search & Filter Bar */}
              <div className="p-4 space-y-4 border-b border-border bg-background shrink-0 z-10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search feeds..." 
                    className="pl-9 bg-muted/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full bg-muted/50">
                    <SelectValue placeholder="Select a category">
                      {selectedCategory && (
                        <>
                          {dynamicCategories.find(c => c.id === selectedCategory)?.label}
                          <span className="text-muted-foreground ml-1">
                            ({dynamicCategories.find(c => c.id === selectedCategory)?.count || 0})
                          </span>
                        </>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {dynamicCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{cat.label}</span>
                          <span className="text-xs text-muted-foreground">({cat.count})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Feed List */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {isLoadingFeeds ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p>Loading feeds...</p>
                  </div>
                ) : feedsError ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <p className="text-red-500 mb-2">{feedsError}</p>
                    <Button variant="outline" onClick={fetchRecommendedFeeds}>
                      <RefreshCw className="h-4 w-4 mr-2" /> Retry
                    </Button>
                  </div>
                ) : filteredFeeds.length > 0 ? (
                  <div className="p-3 sm:p-4">
                    <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between sticky top-0 bg-background py-1">
                      <span>{filteredFeeds.length} feeds</span>
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => setSearchQuery("")}
                        >
                          Clear search
                        </Button>
                      )}
                    </div>
                    {/* Compact list view for better mobile scrolling */}
                    <div className="space-y-1">
                      {filteredFeeds.map((feed) => {
                        const isAdded = addedFeeds.includes(feed.id);
                        return (
                          <div 
                            key={feed.id} 
                            className={cn(
                              "flex items-center gap-3 p-2.5 sm:p-3 rounded-lg border transition-colors",
                              isAdded 
                                ? "bg-muted/50 border-transparent" 
                                : "bg-card border-border hover:bg-muted/30 active:bg-muted/50"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  "font-medium text-sm truncate",
                                  isAdded ? "text-muted-foreground" : "text-foreground"
                                )}>
                                  {feed.name}
                                </span>
                                {feed.is_featured && (
                                  <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {(() => {
                                  try {
                                    return new URL(feed.url).hostname.replace('www.', '');
                                  } catch {
                                    return feed.url;
                                  }
                                })()}
                              </div>
                            </div>
                            {isAdded ? (
                              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 hover:bg-primary hover:text-primary-foreground shrink-0"
                                onClick={() => handleQuickAdd(feed.id, feed.name, feed.category, feed.url)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : !selectedCategory ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-4 text-center">
                    <p>Select a category above to browse feeds</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-4 text-center">
                    <p>No feeds found matching "{searchQuery}"</p>
                    <Button variant="link" size="sm" onClick={() => setSearchQuery("")}>
                      Clear search
                    </Button>
                    <Button variant="link" size="sm" onClick={() => setActiveTab("custom")}>
                      Or add a custom URL
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "custom" && (
            <div className="p-6 h-full flex flex-col overflow-y-auto">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-base">Feed URL</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="https://example.com/feed.xml" 
                        className="pl-9"
                        value={customUrl}
                        onChange={(e) => {
                          setCustomUrl(e.target.value);
                          setIsValidFeed(false);
                          setFeedDetails(null);
                        }}
                      />
                    </div>
                    <Button 
                      onClick={validateCustomUrl}
                      disabled={!customUrl || isValidating}
                      className="min-w-[100px]"
                    >
                      {isValidating ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        "Validate"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: RSS 2.0, Atom, JSON Feed
                  </p>
                </div>

                {isValidFeed && feedDetails && (
                  <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 mb-6">
                      <div className="flex items-start gap-3">
                        <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2 rounded-full">
                          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-emerald-900 dark:text-emerald-100">Valid RSS Feed Found!</h3>
                          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">{feedDetails.description}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 border-t border-border pt-6">
                       <div className="space-y-2">
                         <Label>Feed Name</Label>
                         <Input defaultValue={feedDetails.name} />
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label>Folder</Label>
                           <Select defaultValue="tech">
                             <SelectTrigger>
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="tech">Tech</SelectItem>
                               <SelectItem value="news">News</SelectItem>
                               <SelectItem value="gaming">Gaming</SelectItem>
                               <SelectItem value="create">+ Create New</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                         
                         <div className="space-y-2">
                           <Label>Priority</Label>
                           <Select defaultValue="medium">
                             <SelectTrigger>
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="high">High</SelectItem>
                               <SelectItem value="medium">Medium</SelectItem>
                               <SelectItem value="low">Low</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       </div>

                       <div className="pt-4 flex justify-end gap-2">
                         <Button variant="outline" onClick={onClose}>Cancel</Button>
                         <Button onClick={handleAddCustomFeed}>Add Feed</Button>
                       </div>
                    </div>
                  </div>
                )}

                {!isValidFeed && !isValidating && (
                  <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <span className="text-xl">💡</span> Tips for finding feeds
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
                      <li>Most blogs have <code>/feed</code> or <code>/rss</code> in the URL</li>
                      <li>Try adding <code>/feed.xml</code> or <code>/rss.xml</code> to any site</li>
                      <li>For YouTube: <code>youtube.com/feeds/videos.xml?channel_id=...</code></li>
                      <li>For Reddit: add <code>.rss</code> to any subreddit URL</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
