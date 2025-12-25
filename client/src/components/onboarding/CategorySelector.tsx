import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { transformCategories, type Category } from "@/data/categories";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Check, Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface CategorySelectorProps {
  selectedCategories: string[];
  toggleCategory: (id: string) => void;
  onNext: () => void;
}

export function CategorySelector({ selectedCategories, toggleCategory, onNext }: CategorySelectorProps) {
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

  const hasEnoughCategories = selectedCategories.length >= 1;

  const getStatusMessage = () => {
    if (selectedCategories.length === 0) {
      return "Select at least 1 category to continue";
    }
    return `${selectedCategories.length} ${selectedCategories.length === 1 ? 'category' : 'categories'} selected`;
  };

  const handleNext = async () => {
    if (!hasEnoughCategories || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await apiRequest('POST', '/api/users/interests', {
        interests: selectedCategories
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
      <div className="text-center mb-6">
        <h2 className="text-3xl font-display font-bold mb-2">What topics interest you?</h2>
        <p className="text-muted-foreground">Select categories to browse feeds from ({categories.length} available)</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((category, index) => {
            const isSelected = selectedCategories.includes(category.id);
            const Icon = category.icon;
            
            return (
              <motion.button
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "relative p-4 rounded-xl border text-left transition-all duration-200",
                  "flex flex-col gap-2 min-h-[100px]",
                  isSelected
                    ? "bg-primary/10 border-primary shadow-sm"
                    : "bg-card border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isSelected ? "bg-primary/20" : "bg-muted"
                  )}>
                    <Icon className={cn(
                      "h-5 w-5",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  {isSelected && (
                    <div className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <div>
                  <span className={cn(
                    "font-medium text-sm block",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {category.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {category.feedCount} feeds
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 pt-4 border-t border-border/50">
        {submitError && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
            {submitError}
          </div>
        )}
        <div className={cn(
          "text-sm font-medium transition-colors",
          hasEnoughCategories ? "text-primary" : "text-muted-foreground"
        )}>
          {getStatusMessage()}
        </div>
        <Button 
          size="lg" 
          onClick={handleNext} 
          disabled={!hasEnoughCategories || isSubmitting}
          className="w-full sm:w-auto px-12 h-12 rounded-xl"
        >
          {isSubmitting ? "Saving..." : "Browse Feeds"}
        </Button>
      </div>
    </div>
  );
}
