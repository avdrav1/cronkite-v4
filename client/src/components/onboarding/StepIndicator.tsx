import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  // Only show steps 2 and 3 (Categories and Feeds) - step 1 is welcome, step 4 is confirmation
  const visibleSteps = [2, 3];
  
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {visibleSteps.map((step, i) => {
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <div key={step} className="flex items-center">
            {/* Connector Line */}
            {i > 0 && (
              <div 
                className={cn(
                  "w-12 h-0.5 mx-2 transition-colors duration-300",
                  step <= currentStep ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            )}
            
            {/* Step Dot */}
            <div
              className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all duration-300",
                isActive && "border-primary bg-primary text-primary-foreground scale-110",
                isCompleted && "border-primary bg-primary text-primary-foreground",
                !isActive && !isCompleted && "border-muted-foreground/50 bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
}
