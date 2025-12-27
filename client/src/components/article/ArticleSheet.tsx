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
import { Star, Copy, ExternalLink, Sparkles, X, ChevronLeft, Clock, User, Loader2, AlertCircle, Check } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { SimilarArticles } from "./SimilarArticles";
import { CommentList } from "@/components/comments";
import { useAuth } from "@/contexts/AuthContext";

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

// Fallback: Generate local summary when API is unavailable
function generateFallbackSummary(article: ArticleWithUIState): string[] {
  const content = article.content || article.excerpt || '';
  const title = article.title || '';
  
  const cleanContent = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const sentences = cleanContent
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).length >= 6 && s.length > 30);
  
  if (sentences.length === 0) {
    return [
      `This article covers: ${title}`,
      "AI summary unavailable. Read the full article below.",
      "Click 'Read Original' for the complete story."
    ];
  }
  
  // Pick first, middle, and a later sentence
  const points: string[] = [];
  if (sentences.length > 0) points.push(sentences[0]);
  if (sentences.length > 2) points.push(sentences[Math.floor(sentences.length / 2)]);
  if (sentences.length > 4) points.push(sentences[Math.min(sentences.length - 1, Math.floor(sentences.length * 0.8))]);
  
  while (points.length < 3) {
    points.push("Read the full article for more details.");
  }
  
  return points.slice(0, 3);
}

// Fetch AI summary from API
async function fetchAISummary(article: ArticleWithUIState): Promise<{ points: string[]; isAI: boolean }> {
  try {
    const response = await apiRequest('POST', `/api/articles/${article.id}/summary`, {
      title: article.title,
      content: article.content,
      excerpt: article.excerpt
    });
    
    if (!response.ok) {
      const error = await response.json();
      if (error.fallback) {
        // API indicated to use fallback
        return { points: generateFallbackSummary(article), isAI: false };
      }
      throw new Error(error.message || 'Failed to generate summary');
    }
    
    const data = await response.json();
    return { points: data.summary, isAI: true };
  } catch (error) {
    console.log('AI summary unavailable, using fallback:', error);
    return { points: generateFallbackSummary(article), isAI: false };
  }
}

// Calculate read time
function calculateReadTime(content?: string | null): string {
  if (!content) return '1 min read';
  const text = content.replace(/<[^>]*>/g, '');
  const wordsPerMinute = 200;
  const words = text.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / wordsPerMinute));
  return `${minutes} min read`;
}

export function ArticleSheet({ article, isOpen, onClose }: ArticleSheetProps) {
  const [summaryPoints, setSummaryPoints] = useState<string[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isAIPowered, setIsAIPowered] = useState(false);
  const [isStarred, setIsStarred] = useState(article?.isStarred ?? false);
  const [isStarring, setIsStarring] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { user } = useAuth();

  // Sync starred state when article changes
  useEffect(() => {
    if (article) {
      setIsStarred(article.isStarred ?? false);
    }
  }, [article?.id, article?.isStarred]);

  // Fetch AI summary when article changes
  useEffect(() => {
    if (article && isOpen) {
      setIsLoadingSummary(true);
      setIsAIPowered(false);
      
      fetchAISummary(article)
        .then(({ points, isAI }) => {
          setSummaryPoints(points);
          setIsAIPowered(isAI);
        })
        .finally(() => {
          setIsLoadingSummary(false);
        });
    }
  }, [article?.id, isOpen]);

  const handleStar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!article || isStarring) return;
    
    setIsStarring(true);
    const newStarred = !isStarred;
    setIsStarred(newStarred); // Optimistic update
    
    try {
      await apiRequest('PUT', `/api/articles/${article.id}/star`, { isStarred: newStarred });
    } catch (error) {
      console.error('Failed to star article:', error);
      setIsStarred(!newStarred); // Revert on error
    } finally {
      setIsStarring(false);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!article?.url) return;
    
    try {
      // Use the Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(article.url);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = article.url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      // Try fallback on error
      try {
        const textArea = document.createElement('textarea');
        textArea.value = article.url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError);
      }
    }
  };

  if (!article) return null;

  // Extract UI fields with defaults
  const {
    imageUrl = article.image_url,
    source = 'Unknown Source',
    date = article.published_at || article.created_at.toISOString(),
    readTime = calculateReadTime(article.content)
  } = article;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        hideCloseButton
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 border-l border-border bg-background shadow-2xl sm:rounded-l-2xl overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="h-full flex flex-col">
          {/* Header Action Bar - fixed at top, not inside scroll area */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 bg-background/80 backdrop-blur-md border-b border-border/40 relative z-10">
            <button 
              type="button"
              onClick={onClose} 
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-md cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <div className="flex items-center gap-2">
               <button 
                 type="button"
                 onClick={handleStar}
                 disabled={isStarring}
                 className={`h-9 w-9 inline-flex items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:text-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed ${isStarred ? 'text-yellow-500' : ''}`}
               >
                <Star className={`h-4 w-4 pointer-events-none ${isStarred ? 'fill-current' : ''}`} />
              </button>
              <button 
                type="button"
                onClick={handleCopyLink} 
                className={`h-9 w-9 inline-flex items-center justify-center rounded-md cursor-pointer transition-colors ${linkCopied ? 'text-green-500' : 'text-muted-foreground hover:text-primary'}`}
                title="Copy link to clipboard"
              >
                {linkCopied ? <Check className="h-4 w-4 pointer-events-none" /> : <Copy className="h-4 w-4 pointer-events-none" />}
              </button>
              <button 
                type="button"
                onClick={onClose}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5 pointer-events-none" />
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1 w-full">
            <div className="flex flex-col pb-20 pt-6 px-6 md:px-12 max-w-3xl mx-auto">
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
                   <div className="flex items-center gap-1 text-muted-foreground">
                     <Clock className="h-3.5 w-3.5" />
                     <span className="font-mono">{readTime}</span>
                   </div>
                 </div>

                 <h1 className="font-display font-bold text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-tight text-foreground">
                   {article.title}
                 </h1>
                 
                 {article.author && (
                   <div className="flex items-center gap-2 text-muted-foreground font-medium text-sm">
                     <User className="h-4 w-4" />
                     By <span className="text-foreground border-b border-transparent hover:border-foreground transition-all cursor-pointer">{article.author}</span>
                   </div>
                 )}
              </div>

              {/* AI Summary Block */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl p-6 mb-10 border border-indigo-200/50 dark:border-indigo-800/50 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-purple-500 rounded-l-xl" />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-wide">
                    <Sparkles className="h-4 w-4" />
                    AI Summary
                  </div>
                  {!isLoadingSummary && !isAIPowered && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3 w-3" />
                      <span>Basic extraction</span>
                    </div>
                  )}
                </div>
                
                <AnimatePresence mode="wait">
                  {isLoadingSummary ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 text-sm text-muted-foreground py-4"
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                      <span>Generating summary...</span>
                    </motion.div>
                  ) : (
                    <motion.ul
                      key="summary"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-3 text-sm text-foreground/80"
                    >
                      {summaryPoints.map((point, index) => (
                        <motion.li
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex gap-3 items-start"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                          <span className="leading-relaxed">{point}</span>
                        </motion.li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Content Body */}
              <div 
                className="prose prose-lg dark:prose-invert max-w-none font-article text-foreground/90 leading-loose prose-headings:font-display prose-headings:font-bold prose-a:text-primary prose-img:rounded-xl"
                dangerouslySetInnerHTML={{ __html: article.content || '' }} 
              />
              
              <Separator className="my-12" />
              
              {/* Similar Articles Section - Requirements: 4.1, 4.5 */}
              {article.id && (
                <div className="mb-8">
                  <SimilarArticles 
                    articleId={article.id} 
                    onArticleClick={(articleId) => {
                      // Could navigate to the similar article or open it in a new sheet
                      console.log('Similar article clicked:', articleId);
                    }}
                  />
                </div>
              )}
              
              {/* Comment System Integration - Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3 */}
              {article.id && user && (
                <div className="mb-8">
                  <CommentList 
                    articleId={article.id} 
                    currentUserId={user.id} 
                  />
                </div>
              )}
              
              <div className="flex justify-center pt-4">
                 <Button size="lg" className="rounded-full px-8 shadow-lg hover:shadow-primary/25 transition-all" asChild>
                   <a href={article.url} target="_blank" rel="noopener noreferrer">
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
