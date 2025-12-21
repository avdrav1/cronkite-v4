import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { REGIONS } from "@/data/regions";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface RegionSelectorProps {
  selectedRegion: string | null;
  setRegion: (code: string | null) => void;
  onNext: () => void;
}

export function RegionSelector({ selectedRegion, setRegion, onNext }: RegionSelectorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const POPULAR_REGIONS = ['US', 'GB', 'CA', 'AU', 'IN', 'DE', 'FR', 'JP'];

  const handleNext = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Save region preference to user profile
      if (selectedRegion) {
        await apiRequest('PUT', '/api/users/profile', {
          region_code: selectedRegion
        });
      }

      // Proceed to next step
      onNext();
    } catch (error) {
      console.error('Failed to save region preference:', error);
      setError(error instanceof Error ? error.message : 'Failed to save region preference');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-xl mx-auto w-full">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-display font-bold mb-2">Add local news? (Optional)</h2>
        <p className="text-muted-foreground">Get news from your region alongside global feeds</p>
      </div>

      <div className="space-y-8 mb-12">
        {/* Dropdown for all regions */}
        <div className="w-full">
           <Select 
             value={selectedRegion || ""} 
             onValueChange={(val) => setRegion(val === "none" ? null : val)}
           >
            <SelectTrigger className="w-full h-14 text-lg rounded-xl bg-card border-border hover:border-primary/50 transition-colors">
              <SelectValue placeholder="🌍  Select your country" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="none">No specific region</SelectItem>
              {REGIONS.map((region) => (
                <SelectItem key={region.code} value={region.code}>
                  <span className="mr-2">{region.flag}</span> {region.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quick Picks */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Popular Regions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {POPULAR_REGIONS.map((code, index) => {
              const region = REGIONS.find(r => r.code === code);
              if (!region) return null;
              
              const isSelected = selectedRegion === code;
              
              return (
                <motion.button
                  key={code}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setRegion(isSelected ? null : code)}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200",
                    isSelected 
                      ? "bg-primary/10 border-primary text-primary font-medium ring-2 ring-primary/20" 
                      : "bg-card border-border hover:bg-muted hover:border-muted-foreground/30"
                  )}
                >
                  <span className="text-xl">{region.flag}</span>
                  <span>{region.code}</span>
                  {isSelected && <Check className="h-4 w-4 ml-1" />}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col items-center gap-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <Button 
          size="lg" 
          onClick={handleNext} 
          disabled={isSubmitting}
          className="w-full md:w-auto px-12 h-12 rounded-xl"
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </Button>
        <button 
          onClick={handleNext}
          disabled={isSubmitting}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline decoration-dotted underline-offset-4 disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
