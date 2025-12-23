import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Globe, Plus, Check, Link as LinkIcon, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BROWSE_FEEDS, CATEGORIES_FILTER } from "@/lib/browse-feeds";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useInvalidateFeedsQuery } from "@/hooks/useFeedsQuery";

interface AddFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFeedAdded?: () => void;
}

export function AddFeedModal({ isOpen, onClose, onFeedAdded }: AddFeedModalProps) {
  const [activeTab, setActiveTab] = useState("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [addedFeeds, setAddedFeeds] = useState<string[]>([]);
  const { toast } = useToast();
  const invalidateFeedsQuery = useInvalidateFeedsQuery();

  // Custom URL State
  const [customUrl, setCustomUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isValidFeed, setIsValidFeed] = useState(false);
  const [feedDetails, setFeedDetails] = useState<{ name: string; description?: string } | null>(null);

  const filteredFeeds = BROWSE_FEEDS.filter(feed => {
    const matchesSearch = 
      feed.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      feed.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || feed.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden gap-0 border-border bg-background shadow-2xl max-h-[90vh] flex flex-col">
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

        <div className="flex-1 overflow-hidden bg-background min-h-[300px]">
          {activeTab === "browse" && (
            <div className="h-full flex flex-col">
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

                <ScrollArea className="w-full whitespace-nowrap pb-2">
                  <div className="flex w-max space-x-2 p-1">
                    {CATEGORIES_FILTER.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                          selectedCategory === cat.id
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <span>{cat.icon}</span>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>

              {/* Feed Grid */}
              <ScrollArea className="flex-1 p-4">
                {filteredFeeds.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredFeeds.map((feed) => {
                      const isAdded = addedFeeds.includes(feed.id);
                      return (
                        <div 
                          key={feed.id} 
                          className={cn(
                            "group p-4 rounded-xl border transition-all duration-200 flex flex-col gap-2",
                            isAdded 
                              ? "bg-muted border-transparent" 
                              : "bg-card border-border hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
                          )}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className={cn("font-bold text-base leading-tight", isAdded ? "text-muted-foreground" : "text-foreground")}>{feed.name}</h3>
                              <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[180px]">
                                {new URL(feed.url).hostname.replace('www.', '')}
                              </div>
                            </div>
                            {isAdded ? (
                              <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
                                <Check className="h-3 w-3" /> Added
                              </div>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-xs gap-1 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                                onClick={() => handleQuickAdd(feed.id, feed.name, feed.category, feed.url)}
                              >
                                <Plus className="h-3 w-3" /> Add
                              </Button>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                            {feed.description}
                          </p>
                          
                          <div className="mt-auto pt-2 text-xs text-muted-foreground font-medium">
                            ~{feed.articlesPerDay} articles/day
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <p>No feeds found matching your filters.</p>
                    <Button variant="link" onClick={() => setActiveTab("custom")}>
                      Try adding a custom URL instead?
                    </Button>
                  </div>
                )}
              </ScrollArea>
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
