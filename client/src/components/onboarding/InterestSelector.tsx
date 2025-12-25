import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { transformCategories, type Category } from "@/data/categories";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Check, Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface InterestSelectorProps {
  selectedInterests: string[];
  toggleInterest: (id: string) => void;
  onNext: () => void;
}

export function InterestSelector({ selectedInterests, toggleInterest, onNext }: InterestSelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const response = await apiRequest('GET', '/api/feeds/categories');
        const data = await response.json();
        if (data.categories) {
          setCategories(transformCategories(data.categories));
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        setLoadError('Failed to load categories. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const handleRetry = () => {
    setIsLoading(true);
    setLoadError(null);
    apiRequest('GET', '/api/feeds/categories')
      .then(res => res.json())
      .then(data => {
        if (data.categories) {
          setCategories(transformCategories(data.categories));
        }
      })
      .catch(() => setLoadError('Failed to load categories'))
      .finally(() => setIsLoading(false));
  };

  const hasEnoughInterests = selectedInterests.length >= 3;
  const isValid = hasEnoughInterests;

  const getStatusMessage = () => {
    if (!hasEnoughInterests) {
      return `${selectedInterests.length} of 3 minimum selected`;
    }
    return `${selectedInterests.length} topics selected`;
  };

  const handleNext = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await apiRequest('POST', '/api/users/interests', {
        interests: selectedInterests
      });
      onNext();
    } catch (error) {
      console.error('Failed to save interests:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to save interests');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading categories...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">{loadError}</p>
        <Button onClick={handleRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-display font-bold mb-2">What interests you?</h2>
        <p className="text-muted-foreground">Select topics to populate your feed (aim for 5+ sources)</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {categories.map((category, index) => {
          const isSelected = selectedInterests.includes(category.id);
          const Icon = category.icon;
          return (
            <motion.button
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleInterest(category.id)}
              className={cn(
                "relative p-4 rounded-2xl border text-center transition-all duration-200 flex flex-col items-center gap-2",
                isSelected
                  ? "bg-primary/5 border-primary shadow-[0_0_0_2px_rgba(79,70,229,0.2)]"
                  : "bg-card border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg",
                isSelected ? "bg-primary/20" : "bg-muted"
              )}>
                <Icon className={cn(
                  "h-6 w-6",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <span className={cn("font-medium", isSelected ? "text-primary" : "text-foreground")}>
                {category.label}
              </span>
              
              {isSelected && (
                <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                  <Check className="h-3 w-3" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col items-center gap-4 sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t border-border/10 md:static md:bg-transparent md:border-none">
        {submitError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {submitError}
          </div>
        )}
        <div className={cn("text-sm font-medium transition-colors", isValid ? "text-green-600" : "text-amber-500")}>
          {getStatusMessage()}
        </div>
        <Button 
          size="lg" 
          onClick={handleNext} 
          disabled={!isValid || isSubmitting}
          className="w-full md:w-auto px-12 h-12 rounded-xl transition-all"
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
