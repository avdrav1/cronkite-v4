import { motion } from "framer-motion";
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
                  step <= currentStep ? "bg-primary" : "bg-border"
                )}
              />
            )}
            
            {/* Step Dot */}
            <motion.div
              initial={false}
              animate={{
                backgroundColor: isActive || isCompleted ? "var(--primary)" : "transparent",
                borderColor: isActive || isCompleted ? "var(--primary)" : "var(--border)",
                scale: isActive ? 1.1 : 1,
              }}
              className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-colors duration-300",
                isActive || isCompleted ? "text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
