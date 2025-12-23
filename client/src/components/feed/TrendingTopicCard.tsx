import { motion } from "framer-motion";
import { TrendingUp, Sparkles, ChevronRight, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export interface TrendingCluster {
  id: string;
  topic: string;
  summary: string;
  articleIds: string[];
  articleCount: number;
  sources: string[];
  latestTimestamp: string;
  relevanceScore: number;
}

interface TrendingTopicCardProps {
  cluster: TrendingCluster;
  variant?: "compact" | "expanded" | "summary";
  onClick?: (cluster: TrendingCluster) => void;
  className?: string;
}

export function TrendingTopicCard({ 
  cluster, 
  variant = "compact", 
  onClick,
  className 
}: TrendingTopicCardProps) {
  
  if (variant === "summary") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={() => onClick?.(cluster)}
        className={cn(
          "group relative rounded-xl overflow-hidden cursor-pointer break-inside-avoid",
          "bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10",
          "border border-primary/20 hover:border-primary/40",
          "shadow-sm hover:shadow-xl transition-all duration-300",
          className
        )}
      >
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary rounded-full blur-2xl" />
        </div>
        
        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              AI Summary
            </span>
          </div>
          
          {/* Topic */}
          <h3 className="font-display font-bold text-lg leading-tight mb-3 group-hover:text-primary transition-colors">
            {cluster.topic}
          </h3>
          
          {/* Summary */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-4">
            {cluster.summary}
          </p>
          
          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-primary/10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
                {cluster.articleCount} articles
              </span>
              <span className="text-xs text-muted-foreground">
                from {cluster.sources.length} sources
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </motion.div>
    );
  }

  if (variant === "expanded") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={() => onClick?.(cluster)}
        className={cn(
          "group relative rounded-xl overflow-hidden cursor-pointer break-inside-avoid col-span-full",
          "bg-gradient-to-r from-primary/5 via-background to-secondary/5",
          "border border-primary/20 hover:border-primary/40",
          "shadow-sm hover:shadow-lg transition-all duration-300",
          className
        )}
      >
        <div className="p-6">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider block">
                  Trending Topic
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(cluster.latestTimestamp), { addSuffix: true })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                {cluster.articleCount} articles
              </span>
            </div>
          </div>
          
          {/* Content */}
          <h3 className="font-display font-bold text-xl leading-tight mb-3 group-hover:text-primary transition-colors">
            {cluster.topic}
          </h3>
          
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
            {cluster.summary}
          </p>
          
          {/* Sources */}
          <div className="flex items-center gap-2 flex-wrap">
            <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
            {cluster.sources.slice(0, 4).map((source, i) => (
              <span 
                key={i} 
                className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
              >
                {source}
              </span>
            ))}
            {cluster.sources.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{cluster.sources.length - 4} more
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary ml-auto group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </motion.div>
    );
  }

  // Compact variant (default)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onClick={() => onClick?.(cluster)}
      className={cn(
        "group relative rounded-xl overflow-hidden cursor-pointer break-inside-avoid",
        "bg-gradient-to-br from-primary/8 to-secondary/8",
        "border border-primary/15 hover:border-primary/30",
        "shadow-sm hover:shadow-lg transition-all duration-300",
        className
      )}
    >
      <div className="p-4">
        {/* Badge */}
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
            Trending
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {cluster.articleCount} articles
          </span>
        </div>
        
        {/* Topic */}
        <h4 className="font-display font-semibold text-sm leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {cluster.topic}
        </h4>
        
        {/* Summary preview */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {cluster.summary}
        </p>
        
        {/* Sources */}
        <div className="flex items-center gap-1 flex-wrap">
          {cluster.sources.slice(0, 2).map((source, i) => (
            <span 
              key={i} 
              className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded"
            >
              {source}
            </span>
          ))}
          {cluster.sources.length > 2 && (
            <span className="text-[10px] text-muted-foreground">
              +{cluster.sources.length - 2}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default TrendingTopicCard;
