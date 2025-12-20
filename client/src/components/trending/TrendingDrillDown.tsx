import { TopicCluster } from "@/lib/mock-clusters";
import { Article } from "@/lib/mock-data";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Share2, Sparkles, X, Star } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingBadge } from "./TrendingBadge";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// Mock articles for drill down (normally would fetch by ID)
const MOCK_CLUSTERED_ARTICLES: Article[] = [
  {
    id: 'c1-1',
    title: "OpenAI announces GPT-5 with enhanced reasoning",
    excerpt: "The new model promises to solve complex math and coding problems with near-human reliability.",
    content: "...",
    source: "TechCrunch",
    author: "Sarah Perez",
    date: new Date().toISOString(),
    relevancyScore: 95,
    readTime: 5,
    tags: ["AI"],
  },
  {
    id: 'c1-2',
    title: "GPT-5 release date revealed: Coming next month",
    excerpt: "Developers will get API access starting November 1st, according to leaked documents.",
    content: "...",
    source: "The Verge",
    author: "Nilay Patel",
    date: new Date(Date.now() - 3600000).toISOString(),
    relevancyScore: 88,
    readTime: 4,
    tags: ["AI"],
  },
  {
    id: 'c1-3',
    title: "What GPT-5 means for the future of coding",
    excerpt: "Experts weigh in on whether this is the end of junior developer roles.",
    content: "...",
    source: "Ars Technica",
    author: "Samuel Axon",
    date: new Date(Date.now() - 7200000).toISOString(),
    relevancyScore: 82,
    readTime: 8,
    tags: ["AI"],
  }
];

interface TrendingDrillDownProps {
  cluster: TopicCluster | null;
  isOpen: boolean;
  onClose: () => void;
  onArticleClick: (article: Article) => void;
}

export function TrendingDrillDown({ cluster, isOpen, onClose, onArticleClick }: TrendingDrillDownProps) {
  if (!cluster) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 border-l border-border bg-background shadow-2xl"
      >
        <div className="h-full flex flex-col relative">
           {/* Header */}
           <div className="flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-sm z-10">
             <Button variant="ghost" size="sm" onClick={onClose} className="gap-1 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
           </div>

           <ScrollArea className="flex-1">
             <div className="p-6">
               {/* Cluster Header */}
               <div className="mb-8">
                 <div className="mb-4">
                   <TrendingBadge />
                 </div>
                 <h2 className="font-display font-bold text-2xl md:text-3xl leading-tight mb-3">
                   {cluster.topic}
                 </h2>
                 <p className="text-muted-foreground text-sm mb-4">
                   {cluster.articleCount} stories • Updated {formatDistanceToNow(new Date(cluster.latestTimestamp), { addSuffix: true })}
                 </p>
                 
                 {cluster.summary && (
                   <div className="bg-muted/30 rounded-xl p-4 border border-border/50 relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-400 to-red-500" />
                     <p className="text-sm text-foreground/90 font-serif leading-relaxed">
                       {cluster.summary}
                     </p>
                   </div>
                 )}
               </div>

               {/* Article List */}
               <div className="space-y-4">
                 <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pl-1">Coverage</h3>
                 {MOCK_CLUSTERED_ARTICLES.map((article, i) => (
                   <motion.div
                     key={article.id}
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: i * 0.1 }}
                     onClick={() => onArticleClick(article)}
                     className="group cursor-pointer bg-card hover:bg-muted/50 border border-border/50 hover:border-border rounded-xl p-4 transition-all duration-200"
                   >
                     <h4 className="font-bold text-base leading-snug mb-2 group-hover:text-primary transition-colors">
                       {article.title}
                     </h4>
                     <p className="text-sm text-muted-foreground line-clamp-2 mb-3 font-serif">
                       {article.excerpt}
                     </p>
                     <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                       <div className="flex items-center gap-2">
                         <span className={cn("font-medium text-foreground", article.relevancyScore >= 80 ? "text-blue-500" : "")}>
                           {article.source}
                         </span>
                         <span>•</span>
                         <span>{formatDistanceToNow(new Date(article.date), { addSuffix: true })}</span>
                       </div>
                       <Star className="h-3 w-3 hover:fill-yellow-500 hover:text-yellow-500 transition-colors" />
                     </div>
                   </motion.div>
                 ))}
               </div>
             </div>
           </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
