import { type Article } from "@shared/schema";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Star, Circle, X, Check } from "lucide-react";
import { motion } from "framer-motion";

// Extended article interface for UI compatibility
interface ArticleWithUIState extends Article {
  isRead?: boolean;
  isStarred?: boolean;
  relevancyScore?: number;
  source?: string;
  date?: string;
  readTime?: string;
  imageUrl?: string;
}

interface ArticleCardProps {
  article: ArticleWithUIState;
  onClick: (article: ArticleWithUIState) => void;
  onRemove?: (id: string) => void;
  onStar?: (id: string) => void;
}

export function ArticleCard({ article, onClick, onRemove, onStar }: ArticleCardProps) {
  const { 
    relevancyScore = 50, 
    imageUrl = article.image_url, 
    isRead = false,
    source = 'Unknown Source',
    date = article.published_at || article.created_at.toISOString(),
    isStarred = false
  } = article;

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group relative bg-card text-card-foreground rounded-xl border overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-shadow duration-300 mb-6 break-inside-avoid flex flex-col",
        isRead ? "opacity-70 border-transparent bg-muted/20" : "border-border/50"
      )}
      onClick={() => onClick(article)}
    >
      {/* Read Indicator */}
      {isRead && (
        <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm rounded-full p-1 shadow-sm opacity-50 group-hover:opacity-100 transition-opacity">
          <Check className="h-3 w-3 text-muted-foreground" />
        </div>
      )}

      {/* Large Card Image */}
      {variant === "large" && imageUrl && (
        <div className="aspect-video w-full overflow-hidden relative">
          <img
            src={imageUrl}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      )}

      <div className={cn("p-5 flex flex-col gap-3", variant === "large" ? "p-6" : "")}>
        {/* Medium Card Image (Thumbnail style) */}
        {variant === "medium" && imageUrl && (
          <div className="flex gap-4 mb-2">
            <div className="h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-muted">
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex-1">
               <h3 className="font-display font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-3">
                {article.title}
              </h3>
            </div>
          </div>
        )}

        {/* Title for Large and Small variants (Medium handled above) */}
        {variant !== "medium" && (
          <h3
            className={cn(
              "font-display font-bold leading-tight group-hover:text-primary transition-colors",
              variant === "large" ? "text-2xl" : "text-lg"
            )}
          >
            {article.title}
          </h3>
        )}

        {/* Excerpt */}
        {variant !== "small" && (
          <p className={cn(
            "text-muted-foreground font-serif leading-relaxed",
            variant === "medium" && "hidden" // Hidden in medium layout structure above effectively, but let's just not show excerpt below image for medium to match spec roughly
          )}>
            {variant === "large" ? article.excerpt : null} 
          </p>
        )}
        
        {variant === "medium" && !imageUrl && (
           <p className="text-muted-foreground font-serif text-sm line-clamp-3">
             {article.excerpt}
           </p>
        )}
        
        {variant === "medium" && imageUrl && (
             <p className="text-muted-foreground font-serif text-sm line-clamp-2 mt-[-0.5rem]">
              {article.excerpt}
            </p>
        )}

        {/* Metadata Footer */}
        <div className="flex items-center justify-between mt-auto pt-2">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Circle className={cn("h-2.5 w-2.5 fill-current", scoreColor)} />
            <span className="font-semibold text-foreground">{source}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(date), { addSuffix: true })}</span>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onStar && (
              <button 
                onClick={(e) => handleAction(e, () => onStar(article.id))}
                className="p-1.5 hover:bg-muted rounded-full text-muted-foreground hover:text-yellow-500 transition-colors"
                title={isStarred ? "Unstar" : "Star"}
              >
                <Star className={cn("h-4 w-4", isStarred && "fill-yellow-500 text-yellow-500")} />
              </button>
            )}
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
