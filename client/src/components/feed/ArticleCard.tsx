import { type Article } from "@shared/schema";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Star, X, Clock, User, ThumbsUp, ThumbsDown, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useRef } from "react";

// Extended article interface for UI compatibility
interface ArticleWithUIState extends Article {
  isRead?: boolean;
  isStarred?: boolean;
  relevancyScore?: number;
  source?: string;
  date?: string;
  readTime?: string;
  imageUrl?: string;
  engagementSignal?: 'positive' | 'negative' | null;
  // Cluster information for visual grouping
  cluster_id?: string | null;
  clusterTopic?: string;
  clusterColor?: string;
}

interface ArticleCardProps {
  article: ArticleWithUIState;
  onClick: (article: ArticleWithUIState) => void;
  onRemove?: (id: string) => void;
  onStar?: (id: string, isStarred: boolean) => void;
  onReadChange?: (id: string, isRead: boolean) => void;
  onEngagementChange?: (id: string, signal: 'positive' | 'negative' | null) => void;
}

// Calculate estimated read time from content
function calculateReadTime(content?: string | null): string {
  if (!content) return '1 min';
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / wordsPerMinute));
  return `${minutes} min`;
}

export function ArticleCard({ article, onClick, onRemove, onStar, onReadChange, onEngagementChange }: ArticleCardProps) {
  const { 
    relevancyScore = 50, 
    imageUrl = article.image_url, 
    isRead = false,
    source = 'Unknown Source',
    date = article.published_at || article.created_at.toISOString(),
    isStarred = false,
    readTime = calculateReadTime(article.content),
    engagementSignal = null,
    cluster_id = null,
    clusterTopic,
    clusterColor
  } = article;

  // Local state for optimistic updates
  const [localIsRead, setLocalIsRead] = useState(isRead);
  const [localIsStarred, setLocalIsStarred] = useState(isStarred);
  const [localEngagement, setLocalEngagement] = useState<'positive' | 'negative' | null>(engagementSignal);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Track the previous article ID to detect when we're showing a different article
  const prevArticleIdRef = useRef(article.id);

  // Only sync local state with props when the article changes (different article ID)
  // This prevents overwriting optimistic updates when the parent re-renders
  useEffect(() => {
    if (prevArticleIdRef.current !== article.id) {
      // New article - sync all states
      setLocalIsRead(isRead);
      setLocalIsStarred(isStarred);
      setLocalEngagement(engagementSignal);
      prevArticleIdRef.current = article.id;
    }
  }, [article.id, isRead, isStarred, engagementSignal]);

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  // Toggle star state with API persistence - Requirements: 7.1, 7.2
  const handleToggleStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdating) return;
    
    const newStarredState = !localIsStarred;
    setLocalIsStarred(newStarredState); // Optimistic update
    setIsUpdating(true);
    
    try {
      await apiRequest('PUT', `/api/articles/${article.id}/star`, { isStarred: newStarredState });
      // Pass the new state to parent so it can update its state correctly
      onStar?.(article.id, newStarredState);
    } catch (error) {
      console.error('Failed to update starred state:', error);
      setLocalIsStarred(!newStarredState); // Revert on error
    } finally {
      setIsUpdating(false);
    }
  };

  // Set engagement signal with API persistence - Requirements: 8.1, 8.2, 8.3, 8.4, 8.6
  const handleEngagement = async (e: React.MouseEvent, signal: 'positive' | 'negative') => {
    e.stopPropagation();
    if (isUpdating) return;
    
    // Toggle off if clicking the same signal, otherwise set new signal
    const newSignal = localEngagement === signal ? null : signal;
    const previousSignal = localEngagement;
    setLocalEngagement(newSignal); // Optimistic update
    setIsUpdating(true);
    
    try {
      await apiRequest('PUT', `/api/articles/${article.id}/engagement`, { signal: newSignal });
      onEngagementChange?.(article.id, newSignal);
    } catch (error) {
      console.error('Failed to update engagement signal:', error);
      setLocalEngagement(previousSignal); // Revert on error
    } finally {
      setIsUpdating(false);
    }
  };

  // Determine variant based on score
  let variant: "large" | "medium" | "small" = "small";
  if (relevancyScore >= 80) variant = "large";
  else if (relevancyScore >= 50) variant = "medium";

  // Visual cues for relevancy
  const scoreColor = 
    relevancyScore >= 80 ? "text-blue-500" : 
    relevancyScore >= 50 ? "text-green-500" : 
    "text-yellow-500";

  // Get excerpt with appropriate length based on variant
  const getExcerpt = () => {
    const text = article.excerpt || article.content?.substring(0, 400) || '';
    if (variant === "large") return text.substring(0, 280);
    if (variant === "medium") return text.substring(0, 180);
    return text.substring(0, 120);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group relative bg-card text-card-foreground rounded-xl border overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-shadow duration-300 break-inside-avoid flex flex-col",
        localIsRead ? "opacity-70 border-transparent bg-muted/20" : "border-border/50",
        variant === "large" && "row-span-2",
        // Cluster visual indicator - colored left border and light border around entire card
        cluster_id && clusterColor && `border-l-4 border-2`
      )}
      style={cluster_id && clusterColor ? { 
        borderLeftColor: clusterColor,
        borderColor: `${clusterColor}30` // Light version of cluster color for outer border
      } : undefined}
      onClick={() => onClick(article)}
    >
      {/* Cluster Badge - shown for articles in a cluster */}
      {cluster_id && clusterTopic && (
        <div 
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          style={{ backgroundColor: clusterColor ? `${clusterColor}15` : 'var(--primary-5)' }}
        >
          <Sparkles className="h-3 w-3" style={{ color: clusterColor || 'var(--primary)' }} />
          <span className="truncate" style={{ color: clusterColor || 'var(--primary)' }}>
            {clusterTopic}
          </span>
        </div>
      )}


      {/* Large Card Image */}
      {variant === "large" && imageUrl && (
        <div className="aspect-[16/10] w-full overflow-hidden relative">
          <img
            src={imageUrl}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      )}

      <div className={cn(
        "p-4 flex flex-col gap-3 flex-1",
        variant === "large" && "p-5"
      )}>
        {/* Source Badge - Top of card */}
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", scoreColor, "bg-current")} />
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">{source}</span>
        </div>

        {/* Medium Card with Thumbnail */}
        {variant === "medium" && imageUrl && (
          <div className="flex gap-4">
            <div className="flex-1">
              <h3 className="font-display font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-3">
                {article.title}
              </h3>
            </div>
            <div className="h-24 w-24 shrink-0 rounded-lg overflow-hidden bg-muted">
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
        )}

        {/* Title for Large and Small variants */}
        {variant !== "medium" && (
          <h3
            className={cn(
              "font-display font-bold leading-tight group-hover:text-primary transition-colors",
              variant === "large" ? "text-xl line-clamp-3" : "text-base line-clamp-2"
            )}
          >
            {article.title}
          </h3>
        )}

        {/* Excerpt - Show for all variants */}
        <p className={cn(
          "text-muted-foreground font-serif leading-relaxed",
          variant === "large" ? "text-sm line-clamp-4" : "text-sm line-clamp-3"
        )}>
          {getExcerpt()}
        </p>

        {/* Author & Read Time Row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
          {article.author && (
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3" />
              <span className="font-medium truncate max-w-[120px]">{article.author}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>{readTime}</span>
          </div>
        </div>

        {/* Metadata Footer - Time display */}
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground pt-2 border-t border-border/30">
          <span>{formatDistanceToNow(new Date(date), { addSuffix: true })}</span>
        </div>
        
        {/* Action Buttons Row - Requirements: 3.1, 3.2, 3.3 - Separated groups with justify-between */}
        <div className="flex items-center justify-between pt-1">
          {/* Left Group: More Like This? Engagement Buttons - Requirements: 3.2, 3.6, 3.7 - Always visible */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">More like this?</span>
            <button 
              onClick={(e) => handleEngagement(e, 'positive')}
              disabled={isUpdating}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors",
                localEngagement === 'positive'
                  ? "text-green-600 bg-green-500/15 font-medium"
                  : "text-muted-foreground hover:text-green-600 hover:bg-green-500/10"
              )}
              title="Yes, more like this"
            >
              <ThumbsUp className={cn("h-3.5 w-3.5", localEngagement === 'positive' && "fill-green-500")} />
              <span className="hidden sm:inline">Yes</span>
            </button>
            <button 
              onClick={(e) => handleEngagement(e, 'negative')}
              disabled={isUpdating}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors",
                localEngagement === 'negative'
                  ? "text-red-600 bg-red-500/15 font-medium"
                  : "text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
              )}
              title="No, less like this"
            >
              <ThumbsDown className={cn("h-3.5 w-3.5", localEngagement === 'negative' && "fill-red-500")} />
              <span className="hidden sm:inline">No</span>
            </button>
          </div>
          
          {/* Right Group: Star and Remove Buttons - Requirements: 3.3, 2.1, 2.2 - Always visible */}
          <div className="flex items-center gap-1">
            {/* Star Button - Requirements: 2.1, 2.3, 2.4 - Always visible */}
            <button 
              onClick={handleToggleStar}
              disabled={isUpdating}
              className={cn(
                "p-1.5 hover:bg-muted rounded-full transition-colors",
                localIsStarred 
                  ? "text-yellow-500" 
                  : "text-muted-foreground hover:text-yellow-500"
              )}
              title={localIsStarred ? "Unstar" : "Star"}
            >
              <Star className={cn("h-4 w-4", localIsStarred && "fill-yellow-500")} />
            </button>
            {/* Remove Button - Requirements: 2.2 - Always visible */}
            {onRemove && (
              <button 
                onClick={(e) => handleAction(e, () => onRemove(article.id))}
                className="p-1.5 hover:bg-muted rounded-full text-muted-foreground hover:text-red-500 transition-colors"
                title="Remove from feed"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
