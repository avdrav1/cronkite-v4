import { type Article } from "@shared/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Share2, ExternalLink, Sparkles, X, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

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

interface ArticleSheetProps {
  article: ArticleWithUIState | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ArticleSheet({ article, isOpen, onClose }: ArticleSheetProps) {
  if (!article) return null;

  // Extract UI fields with defaults
  const {
    imageUrl = article.image_url,
    source = 'Unknown Source',
    date = article.published_at || article.created_at.toISOString(),
    readTime = '5 min read'
  } = article;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 border-l border-border bg-background shadow-2xl sm:rounded-l-2xl overflow-hidden"
      >
        <div className="h-full flex flex-col relative">
          {/* Header Action Bar */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-background/80 backdrop-blur-md border-b border-border/40">
            <Button variant="ghost" size="sm" onClick={onClose} className="gap-1 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
               <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-yellow-500">
                <Star className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-full w-full">
            <div className="flex flex-col pb-20 pt-20 px-6 md:px-12 max-w-3xl mx-auto">
              {/* Hero Image inside content if available */}
              {imageUrl && (
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.98 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="w-full aspect-video rounded-xl overflow-hidden mb-8 shadow-sm"
                 >
                   <img src={imageUrl} className="w-full h-full object-cover" alt="Article Hero" />
                 </motion.div>
              )}

              {/* Header Info */}
              <div className="space-y-4 mb-8">
                 <div className="flex flex-wrap items-center gap-3 text-sm">
                   <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium border-none px-3 py-1">
                     {source}
                   </Badge>
                   <span className="text-muted-foreground">•</span>
                   <span className="text-muted-foreground font-mono">{format(new Date(date), "MMMM d, yyyy")}</span>
                   <span className="text-muted-foreground">•</span>
                   <span className="text-muted-foreground font-mono">{readTime}</span>
                 </div>

                 <h1 className="font-display font-bold text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-tight text-foreground">
                   {article.title}
                 </h1>
                 
                 <div className="flex items-center gap-2 text-muted-foreground font-medium text-sm">
                   By <span className="text-foreground border-b border-transparent hover:border-foreground transition-all cursor-pointer">{article.author}</span>
                 </div>
              </div>

              {/* AI Summary Block */}
              <div className="bg-muted/30 rounded-xl p-6 mb-10 border border-border/50 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                <div className="flex items-center gap-2 mb-3 text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-wide">
                  <Sparkles className="h-4 w-4" />
                  AI Summary
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4 marker:text-indigo-400">
                  <li>Key insight extracted from the article automatically.</li>
                  <li>Another important takeaway for quick consumption.</li>
                  <li>Final summary point to give context.</li>
                </ul>
              </div>

              {/* Content Body */}
              <div 
                className="prose prose-lg dark:prose-invert max-w-none font-article text-foreground/90 leading-loose prose-headings:font-display prose-headings:font-bold prose-a:text-primary prose-img:rounded-xl"
                dangerouslySetInnerHTML={{ __html: article.content || '' }} 
              />
              
              <Separator className="my-12" />
              
              <div className="flex justify-center">
                 <Button size="lg" className="rounded-full px-8 shadow-lg hover:shadow-primary/25 transition-all" asChild>
                   <a href="#" target="_blank">
                     Read Original on {source} <ExternalLink className="ml-2 h-4 w-4" />
                   </a>
                 </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
