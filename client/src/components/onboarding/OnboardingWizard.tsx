import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StepIndicator } from "./StepIndicator";
import { WelcomeStep } from "./WelcomeStep";
import { InterestSelector } from "./InterestSelector";
import { RegionSelector } from "./RegionSelector";
import { FeedPreview } from "./FeedPreview";
import { ConfirmationStep } from "./ConfirmationStep";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { type RecommendedFeed } from "@shared/schema";

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [location, setLocation] = useLocation();

  // State
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
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
  const toggleInterest = (id: string) => {
    setSelectedInterests(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleFeed = (id: string) => {
    setSelectedFeeds(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const toggleCategory = (category: string, feedIds: string[]) => {
    const allSelected = feedIds.every(id => selectedFeeds.includes(id));
    if (allSelected) {
      setSelectedFeeds(prev => prev.filter(id => !feedIds.includes(id)));
    } else {
      setSelectedFeeds(prev => Array.from(new Set([...prev, ...feedIds])));
    }
  };

  // Pre-select popular feeds when moving to feed step
  useEffect(() => {
    if (step === 4 && selectedFeeds.length === 0) {
      const preselectPopularFeeds = async () => {
        try {
          const response = await apiRequest('GET', '/api/feeds/recommended');
          const data = await response.json();
          const recommendedFeeds: RecommendedFeed[] = data.feeds;
          
          // Pre-select featured feeds that match selected interests
          const relevantPopular = recommendedFeeds
            .filter(f => selectedInterests.includes(f.category) && f.is_featured)
            .map(f => f.id);
          
          setSelectedFeeds(relevantPopular);
        } catch (error) {
          console.error('Failed to pre-select feeds:', error);
          // Continue without pre-selection if API fails
        }
      };

      preselectPopularFeeds();
    }
  }, [step, selectedInterests]);

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

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-accent/5 pointer-events-none" />

      <div className="w-full max-w-4xl relative z-10 flex flex-col h-full md:h-auto min-h-[600px]">
        {/* Only show step indicator for steps 2-4 */}
        {step > 1 && step < 5 && (
          <StepIndicator currentStep={step} totalSteps={5} />
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
                <WelcomeStep onNext={nextStep} />
              )}
              {step === 2 && (
                <InterestSelector 
                  selectedInterests={selectedInterests} 
                  toggleInterest={toggleInterest} 
                  onNext={nextStep} 
                />
              )}
              {step === 3 && (
                <RegionSelector 
                  selectedRegion={selectedRegion} 
                  setRegion={setSelectedRegion} 
                  onNext={nextStep} 
                />
              )}
              {step === 4 && (
                <FeedPreview 
                  selectedInterests={selectedInterests}
                  selectedFeeds={selectedFeeds}
                  toggleFeed={toggleFeed}
                  toggleCategory={toggleCategory}
                  onNext={nextStep}
                />
              )}
              {step === 5 && (
                <ConfirmationStep 
                  selectedInterests={selectedInterests}
                  selectedRegion={selectedRegion}
                  selectedFeedsCount={selectedFeeds.length}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Back button for steps 2-4 */}
        {step > 1 && step < 5 && (
           <button 
             onClick={prevStep}
             className="absolute top-4 left-4 md:top-8 md:left-8 text-sm text-muted-foreground hover:text-foreground transition-colors"
           >
             ← Back
           </button>
        )}
      </div>
    </div>
  );
}
