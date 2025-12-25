import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CATEGORIES, type Category } from "@/data/categories";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Check } from "lucide-react";

interface CategorySelectorProps {
  selectedCategories: string[];
  toggleCategory: (id: string) => void;
  onNext: () => void;
}

export function CategorySelector({ selectedCategories, toggleCategory, onNext }: CategorySelectorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);

    try {
      await apiRequest('POST', '/api/users/interests', {
        interests: selectedCategories
      });
      onNext();
    } catch (error) {
      console.error('Failed to save interests:', error);
      setError(error instanceof Error ? error.message : 'Failed to save interests');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-display font-bold mb-2">What topics interest you?</h2>
        <p className="text-muted-foreground">Select categories to browse feeds from</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {CATEGORIES.map((category, index) => {
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
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {category.description}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 pt-4 border-t border-border/50">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
            {error}
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
