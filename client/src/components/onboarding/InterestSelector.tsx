import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/data/categories";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface InterestSelectorProps {
  selectedInterests: string[];
  toggleInterest: (id: string) => void;
  onNext: () => void;
}

export function InterestSelector({ selectedInterests, toggleInterest, onNext }: InterestSelectorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);

    try {
      // Call the API to set user interests
      await apiRequest('POST', '/api/users/interests', {
        interests: selectedInterests
      });

      // Proceed to next step
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
      <div className="text-center mb-8">
        <h2 className="text-3xl font-display font-bold mb-2">What interests you?</h2>
        <p className="text-muted-foreground">Select topics to populate your feed (aim for 5+ sources)</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {CATEGORIES.map((category, index) => {
          const isSelected = selectedInterests.includes(category.id);
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
              <span className="text-2xl">{category.emoji}</span>
              <span className={cn("font-medium", isSelected ? "text-primary" : "text-foreground")}>
                {category.label}
              </span>
              
              {isSelected && (
                <div className="absolute -top-2 -right-2 bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md">
                  ✓
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col items-center gap-4 sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t border-border/10 md:static md:bg-transparent md:border-none">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
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
