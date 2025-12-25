import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { StepIndicator } from "./StepIndicator";
import { WelcomeStep } from "./WelcomeStep";
import { CategorySelector } from "./CategorySelector";
import { FeedDiscovery } from "./FeedDiscovery";
import { ConfirmationStep } from "./ConfirmationStep";
import { apiRequest } from "@/lib/queryClient";
import { type RecommendedFeed } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Determine if this is first-time onboarding or a reset from main UI
  const isFirstTime = !user?.onboarding_completed;

  // State - selectedCategories now stores database category names directly
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]);

  // Navigation handlers
  const nextStep = () => {
    setDirection(1);
    setStep(s => s + 1);
  };

  const prevStep = () => {
    if (step > 1) {
      setDirection(-1);
      setStep(s => s - 1);
    }
  };

  // Logic handlers
  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleFeed = (id: string) => {
    setSelectedFeeds(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  // Pre-select featured feeds when moving to feed discovery step
  useEffect(() => {
    if (step === 3 && selectedFeeds.length === 0 && selectedCategories.length > 0) {
      const preselectFeaturedFeeds = async () => {
        try {
          const response = await apiRequest('GET', '/api/feeds/recommended?limit=1000');
          const data = await response.json();
          const recommendedFeeds: RecommendedFeed[] = data.feeds;
          
          // Pre-select featured feeds that match selected categories (max 25)
          // selectedCategories now contains database category names directly
          const relevantFeatured = recommendedFeeds
            .filter(f => selectedCategories.includes(f.category) && f.is_featured)
            .slice(0, 25) // Limit to 25 feeds max
            .map(f => f.id);
          
          if (relevantFeatured.length > 0) {
            setSelectedFeeds(relevantFeatured);
          }
        } catch (error) {
          console.error('Failed to pre-select feeds:', error);
        }
      };

      preselectFeaturedFeeds();
    }
  }, [step, selectedCategories]);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 50 : -50,
      opacity: 0,
    }),
  };

  // Total steps: Welcome (1), Categories (2), Feed Discovery (3), Confirmation (4)
  const totalSteps = 4;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-accent/5 pointer-events-none" />

      <div className="w-full max-w-4xl relative z-10 flex flex-col h-full md:h-auto min-h-[600px]">
        {/* Only show step indicator for steps 2-3 */}
        {step > 1 && step < 4 && (
          <StepIndicator currentStep={step} totalSteps={totalSteps} />
        )}

        <div className="flex-1 bg-transparent md:bg-card/50 md:backdrop-blur-xl md:border md:border-border/50 md:rounded-3xl md:shadow-2xl md:p-8 relative overflow-hidden flex flex-col">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex-1 flex flex-col h-full"
            >
              {step === 1 && (
                <WelcomeStep 
                  onNext={nextStep} 
                  isFirstTime={isFirstTime}
                  onCancel={() => setLocation('/')}
                />
              )}
              {step === 2 && (
                <CategorySelector 
                  selectedCategories={selectedCategories} 
                  toggleCategory={toggleCategory} 
                  onNext={nextStep} 
                />
              )}
              {step === 3 && (
                <FeedDiscovery 
                  selectedCategories={selectedCategories}
                  selectedFeeds={selectedFeeds}
                  toggleFeed={toggleFeed}
                  onNext={nextStep}
                  onBack={prevStep}
                />
              )}
              {step === 4 && (
                <ConfirmationStep 
                  selectedInterests={selectedCategories}
                  selectedRegion={null}
                  selectedFeedsCount={selectedFeeds.length}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Back button for step 2 only (step 3 has its own back button) */}
        {step === 2 && (
           <button 
             onClick={prevStep}
             className="absolute top-4 left-4 md:top-8 md:left-8 text-sm text-muted-foreground hover:text-foreground transition-colors"
           >
             Back
           </button>
        )}
      </div>
    </div>
  );
}
