import { TopicCluster } from "@/lib/mock-clusters";
import { TrendingBadge } from "./TrendingBadge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import techImage1 from '@assets/stock_images/abstract_technology__444bd4e8.jpg';
import techImage2 from '@assets/stock_images/abstract_technology__271dd1f7.jpg';
import techImage3 from '@assets/stock_images/abstract_technology__6049a3f2.jpg';
import archiImage1 from '@assets/stock_images/modern_minimal_archi_57055080.jpg';
import archiImage2 from '@assets/stock_images/modern_minimal_archi_a62f2ad7.jpg';

// Helper to resolve image paths (since mock data has strings)
const resolveImage = (path: string) => {
  if (path.includes('abstract_technology__444bd4e8')) return techImage1;
  if (path.includes('abstract_technology__271dd1f7')) return techImage2;
  if (path.includes('abstract_technology__6049a3f2')) return techImage3;
  if (path.includes('modern_minimal_archi_57055080')) return archiImage1;
  if (path.includes('modern_minimal_archi_a62f2ad7')) return archiImage2;
  // Fallback
  return techImage1;
};

interface TrendingTopicCardProps {
  cluster: TopicCluster;
  onClick: (cluster: TopicCluster) => void;
}

export function TrendingTopicCard({ cluster, onClick }: TrendingTopicCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={() => onClick(cluster)}
      className="group relative bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50 overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 mb-6 break-inside-avoid"
    >
      <div className="absolute inset-0 bg-white/40 dark:bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="p-5 flex flex-col gap-4 relative z-10">
        <div className="flex items-center justify-between">
          <TrendingBadge />
          <span className="text-xs text-muted-foreground font-mono">
            {formatDistanceToNow(new Date(cluster.latestTimestamp), { addSuffix: true })}
          </span>
        </div>

        {/* Thumbnail Stack */}
        <div className="flex items-center pl-2">
          {cluster.thumbnails.slice(0, 3).map((thumb, i) => (
            <div 
              key={i} 
              className="h-10 w-10 rounded-full border-2 border-background overflow-hidden -ml-2 shadow-sm relative z-0"
              style={{ zIndex: 3 - i }}
            >
              <img src={resolveImage(thumb)} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
          {cluster.sources.length > 3 && (
            <div className="h-10 w-10 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground -ml-2 relative z-0" style={{ zIndex: 0 }}>
              +{cluster.sources.length - 3}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-display font-bold text-lg leading-tight group-hover:text-primary transition-colors mb-1">
            {cluster.topic}
          </h3>
          {cluster.summary && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2 font-serif">
              {cluster.summary}
            </p>
          )}
          <p className="text-xs text-muted-foreground/80">
            From {cluster.sources.length} source{cluster.sources.length !== 1 ? 's' : ''}: {cluster.sources.join(", ")}
          </p>
        </div>
      </div>
      
      {/* Decorative gradient line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-60" />
    </motion.div>
  );
}
